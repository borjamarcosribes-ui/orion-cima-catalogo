const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const XML_RECORD_FIELDS = ['cod_nacion', 'cod_dcp', 'des_prese', 'des_nomco', 'sw_comercializado'];

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeCommercializationStatus(value) {
  if (value === 'COMERCIALIZADO' || value === 1 || value === '1') return 'COMERCIALIZADO';
  if (value === 'NO_COMERCIALIZADO' || value === 0 || value === '0') return 'NO_COMERCIALIZADO';
  return 'DESCONOCIDO';
}

function normalizeNullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredText(value) {
  return String(value ?? '').trim();
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function createXmlRecordStreamParser(onRecord) {
  const root = { name: '__root__', fields: new Map(), text: '' };
  const stack = [root];
  let state = 'TEXT';
  let textBuffer = '';
  let tagBuffer = '';
  let openBuffer = '';
  let commentBuffer = '';
  let cdataBuffer = '';
  let declarationBuffer = '';

  function appendText(value) {
    if (!value) {
      return;
    }

    stack[stack.length - 1].text += value;
  }

  function emitRecordIfComplete(node) {
    if (!XML_RECORD_FIELDS.every((field) => node.fields.has(field))) {
      return null;
    }

    const record = {};
    for (const field of XML_RECORD_FIELDS) {
      record[field] = node.fields.get(field);
    }

    return record;
  }

  function processTag(rawTag, emittedRecords) {
    if (!rawTag || rawTag.startsWith('!')) {
      return;
    }

    if (rawTag.startsWith('/')) {
      const closingName = rawTag.slice(1).trim().split(/\s+/)[0].split(':').pop().toLowerCase();
      const node = stack.pop();

      if (!node || node.name !== closingName) {
        return;
      }

      const normalizedText = decodeXmlEntities(node.text).trim();
      const parent = stack[stack.length - 1];
      if (parent && XML_RECORD_FIELDS.includes(node.name) && normalizedText.length > 0) {
        parent.fields.set(node.name, normalizedText);
      }

      const record = emitRecordIfComplete(node);
      if (record) {
        emittedRecords.push(record);
      }

      return;
    }

    const selfClosing = rawTag.endsWith('/');
    const tagName = rawTag
      .replace(/\/$/, '')
      .trim()
      .split(/\s+/)[0]
      .split(':')
      .pop()
      .toLowerCase();

    const node = { name: tagName, fields: new Map(), text: '' };
    stack.push(node);

    if (selfClosing) {
      const closedNode = stack.pop();
      const parent = stack[stack.length - 1];
      if (parent && XML_RECORD_FIELDS.includes(closedNode.name)) {
        parent.fields.set(closedNode.name, '');
      }
      const record = emitRecordIfComplete(closedNode);
      if (record) {
        emittedRecords.push(record);
      }
    }
  }

  async function write(chunk) {
    const emittedRecords = [];

    for (const char of chunk) {
      if (state === 'TEXT') {
        if (char === '<') {
          appendText(textBuffer);
          textBuffer = '';
          state = 'OPEN';
          openBuffer = '';
        } else {
          textBuffer += char;
        }
        continue;
      }

      if (state === 'OPEN') {
        openBuffer += char;

        if (openBuffer === '?') {
          state = 'DECLARATION';
          declarationBuffer = '';
          continue;
        }

        if ('!--'.startsWith(openBuffer) || '![CDATA['.startsWith(openBuffer)) {
          if (openBuffer === '!--') {
            state = 'COMMENT';
            commentBuffer = '';
          } else if (openBuffer === '![CDATA[') {
            state = 'CDATA';
            cdataBuffer = '';
          }
          continue;
        }

        if (openBuffer.startsWith('!') && !'!--'.startsWith(openBuffer) && !'![CDATA['.startsWith(openBuffer)) {
          state = 'TAG';
          tagBuffer = openBuffer;
          continue;
        }

        if (!openBuffer.startsWith('!') && !openBuffer.startsWith('?')) {
          state = 'TAG';
          tagBuffer = openBuffer;
        }
        continue;
      }

      if (state === 'TAG') {
        if (char === '>') {
          processTag(tagBuffer.trim(), emittedRecords);
          tagBuffer = '';
          state = 'TEXT';
        } else {
          tagBuffer += char;
        }
        continue;
      }

      if (state === 'COMMENT') {
        commentBuffer += char;
        if (commentBuffer.endsWith('-->')) {
          commentBuffer = '';
          state = 'TEXT';
        }
        continue;
      }

      if (state === 'CDATA') {
        cdataBuffer += char;
        if (cdataBuffer.endsWith(']]>')) {
          appendText(cdataBuffer.slice(0, -3));
          cdataBuffer = '';
          state = 'TEXT';
        }
        continue;
      }

      if (state === 'DECLARATION') {
        declarationBuffer += char;
        if (declarationBuffer.endsWith('?>')) {
          declarationBuffer = '';
          state = 'TEXT';
        }
      }
    }

    for (const record of emittedRecords) {
      await onRecord(record);
    }
  }

  async function end() {
    if (textBuffer.length > 0) {
      appendText(textBuffer);
      textBuffer = '';
    }

    if (state !== 'TEXT') {
      throw new Error(`XML incompleto o mal formado. Estado final no esperado: ${state}`);
    }
  }

  return {
    write,
    end,
  };
}

async function processXmlFile(resolvedPath, handleRow) {
  const parser = createXmlRecordStreamParser(handleRow);
  const stream = fs.createReadStream(resolvedPath, {
    encoding: 'utf8',
    highWaterMark: 1024 * 1024,
  });

  for await (const chunk of stream) {
    await parser.write(chunk);
  }

  await parser.end();
}

function readRowsFromSpreadsheet(resolvedPath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(resolvedPath, { cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El fichero no contiene hojas legibles.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return {
    rows: rows.map((rawRow) =>
      Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value])),
    ),
    sourceLabel: `sheet:${firstSheetName}`,
  };
}

async function importRow(prisma, row, counters) {
  counters.processed += 1;

  const cn = normalizeRequiredText(row.cod_nacion);
  const codDcp = normalizeRequiredText(row.cod_dcp);
  const presentation = normalizeRequiredText(row.des_prese);
  const officialName = normalizeNullableText(row.des_nomco);
  const commercializationStatus = normalizeCommercializationStatus(row.sw_comercializado);

  if (!cn || !codDcp || !presentation) {
    counters.discarded += 1;
    return;
  }

  await prisma.nomenclatorProduct.upsert({
    where: { cn },
    update: {
      codDcp,
      presentation,
      officialName,
      commercializationStatus,
      rawPayload: JSON.stringify(row),
      importedAt: new Date(),
    },
    create: {
      cn,
      codDcp,
      presentation,
      officialName,
      commercializationStatus,
      rawPayload: JSON.stringify(row),
    },
  });

  counters.insertedOrUpdated += 1;
}

async function importNomenclatorFromResolvedPath(resolvedPath, prisma) {
  const extension = path.extname(resolvedPath).toLowerCase();
  const counters = {
    processed: 0,
    insertedOrUpdated: 0,
    discarded: 0,
  };

  let sourceLabel = '';

  if (extension === '.xml') {
    sourceLabel = 'xml:Prescripcion.xml';
    await processXmlFile(resolvedPath, async (row) => {
      await importRow(prisma, row, counters);
    });
  } else {
    const { rows, sourceLabel: spreadsheetSourceLabel } = readRowsFromSpreadsheet(resolvedPath);
    sourceLabel = spreadsheetSourceLabel;

    for (const row of rows) {
      await importRow(prisma, row, counters);
    }
  }

  return {
    file: resolvedPath,
    source: sourceLabel,
    processed: counters.processed,
    insertedOrUpdated: counters.insertedOrUpdated,
    discarded: counters.discarded,
  };
}

async function importNomenclatorFromFile(inputPath, options = {}) {
  if (!inputPath) {
    throw new Error('Debes indicar una ruta de entrada para importar el Nomenclátor.');
  }

  const cwd = options.cwd ?? process.cwd();
  const resolvedPath = path.resolve(cwd, inputPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`No existe el fichero: ${resolvedPath}`);
  }

  const prisma = options.prisma ?? new PrismaClient();
  const shouldDisconnect = !options.prisma;

  try {
    return await importNomenclatorFromResolvedPath(resolvedPath, prisma);
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

module.exports = {
  importNomenclatorFromFile,
};