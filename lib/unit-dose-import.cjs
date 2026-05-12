const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const UNIT_DOSE_TRUE_VALUES = new Set(['SI', 'SIPEX']);
const MIN_DETECTED_AT = new Date(Date.UTC(2000, 0, 1));

const COLUMN_ALIASES = {
  cn: ['ns1_cod_nacion', 'cod_nacion', 'cn', 'codigo_nacional', 'codigo_nacion', 'cod_nacional'],
  presentation: ['ns1_des_prese', 'des_prese', 'presentacion', 'presentacion_descripcion', 'descripcion'],
  dcp: ['dcp', 'cod_dcp', 'ns1_cod_dcp'],
  atcCode: ['final_atc', 'atc', 'atc_code', 'codigo_atc'],
  laboratory: ['laboratorio_titular', 'laboratorio', 'titular'],
  unitDoseRaw: ['unidosis', 'dosis_unitaria', 'unit_dose'],
  quantity: ['cantidad', 'quantity'],
  detectedAt: ['detectado', 'detected_at', 'detected'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeNullableText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUnitDoseRaw(value) {
  const normalized = normalizeNullableText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function isUnitDoseValue(value) {
  const normalized = normalizeUnitDoseRaw(value);
  return normalized ? UNIT_DOSE_TRUE_VALUES.has(normalized) : false;
}

function normalizeNationalCode(value) {
  if (value === null || value === undefined) {
    return null;
  }

  let normalized;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (!Number.isInteger(value)) {
      return null;
    }
    normalized = String(value);
  } else {
    normalized = String(value).trim();
    if (/^\d+\.0+$/.test(normalized)) {
      normalized = normalized.replace(/\.0+$/, '');
    }
  }

  if (!/^\d{1,6}$/.test(normalized)) {
    return null;
  }

  return normalized.padStart(6, '0');
}

function normalizeDate(value) {
  let date = null;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    date = value;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }
    date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0)));
  } else {
    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const parsed = new Date(text);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return date && date >= MIN_DETECTED_AT ? date : null;
}

function normalizeRow(row) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});
}

function pickColumn(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias];
    }
  }
  return undefined;
}

function mapUnitDoseRow(row, sourceFileName = null) {
  const normalizedRow = normalizeRow(row);
  const cn = normalizeNationalCode(pickColumn(normalizedRow, COLUMN_ALIASES.cn));

  if (!cn) {
    return {
      discarded: true,
      reason: 'CN inválido o ausente',
      rawPayload: JSON.stringify(row),
    };
  }

  const unitDoseRaw = normalizeUnitDoseRaw(pickColumn(normalizedRow, COLUMN_ALIASES.unitDoseRaw));

  return {
    discarded: false,
    data: {
      cn,
      presentation: normalizeNullableText(pickColumn(normalizedRow, COLUMN_ALIASES.presentation)),
      dcp: normalizeNullableText(pickColumn(normalizedRow, COLUMN_ALIASES.dcp)),
      atcCode: normalizeNullableText(pickColumn(normalizedRow, COLUMN_ALIASES.atcCode)),
      laboratory: normalizeNullableText(pickColumn(normalizedRow, COLUMN_ALIASES.laboratory)),
      unitDoseRaw,
      isUnitDose: isUnitDoseValue(unitDoseRaw),
      quantity: normalizeNullableText(pickColumn(normalizedRow, COLUMN_ALIASES.quantity)),
      detectedAt: normalizeDate(pickColumn(normalizedRow, COLUMN_ALIASES.detectedAt)),
      sourceFileName,
      rawPayload: JSON.stringify(row),
    },
  };
}

function getPrismaClient() {
  const { PrismaClient } = require('../generated/postgres-client');
  return new PrismaClient();
}

async function importUnitDoseCache(filePath, options = {}) {
  if (!filePath) {
    throw new Error('Debes indicar la ruta del Excel de SCMFH.');
  }

  const sourceFileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El Excel de SCMFH no contiene hojas.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });
  const prisma = options.prismaClient || getPrismaClient();
  const shouldDisconnect = !options.prismaClient && prisma && typeof prisma.$disconnect === 'function';

  const summary = {
    processed: rows.length,
    insertedOrUpdated: 0,
    unitDoseCount: 0,
    discarded: 0,
    sourceFileName,
  };

  try {
    for (const row of rows) {
      const mapped = mapUnitDoseRow(row, sourceFileName);
      if (mapped.discarded) {
        summary.discarded += 1;
        continue;
      }

      await prisma.unitDoseCache.upsert({
        where: { cn: mapped.data.cn },
        create: mapped.data,
        update: {
          presentation: mapped.data.presentation,
          dcp: mapped.data.dcp,
          atcCode: mapped.data.atcCode,
          laboratory: mapped.data.laboratory,
          unitDoseRaw: mapped.data.unitDoseRaw,
          isUnitDose: mapped.data.isUnitDose,
          quantity: mapped.data.quantity,
          detectedAt: mapped.data.detectedAt,
          sourceFileName: mapped.data.sourceFileName,
          rawPayload: mapped.data.rawPayload,
          importedAt: new Date(),
        },
      });

      summary.insertedOrUpdated += 1;
      if (mapped.data.isUnitDose) {
        summary.unitDoseCount += 1;
      }
    }

    return summary;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

module.exports = {
  COLUMN_ALIASES,
  importUnitDoseCache,
  isUnitDoseValue,
  mapUnitDoseRow,
  normalizeHeader,
  normalizeNationalCode,
  normalizeUnitDoseRaw,
};
