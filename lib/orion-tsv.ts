import { buildNormalizedHeaders, normalizeHeaderValue, resolveHeaderMapping } from '@/lib/import/header-utils';
import type { OrionCatalogItem, ParseError, ParseResult, ParseWarning } from '@/lib/import/types';

const REQUIRED_COLUMNS = ['Artículo', 'Descripción', 'Estado de Artículo'] as const;
const OPTIONAL_COLUMNS = ['Descripción Larga', 'Unidad de Medida Principal'] as const;
const IGNORED_COLUMNS = new Set(['Tipo Art. Usuario', '[ ]']);

function decodeUtf8Strict(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function decodeWindows1252(bytes: Uint8Array): string {
  return new TextDecoder('windows-1252').decode(bytes);
}

function decodeTsv(bytes: Uint8Array): { encoding: 'utf-8' | 'windows-1252'; text: string } {
  try {
    return {
      encoding: 'utf-8',
      text: decodeUtf8Strict(bytes),
    };
  } catch {
    return {
      encoding: 'windows-1252',
      text: decodeWindows1252(bytes),
    };
  }
}

function removeCompletelyEmptyColumns(rows: string[][]): string[][] {
  if (rows.length === 0) {
    return rows;
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const keepIndexes = Array.from({ length: columnCount }, (_, columnIndex) =>
    rows.some((row) => normalizeHeaderValue(row[columnIndex] ?? '').length > 0),
  )
    .map((keep, index) => (keep ? index : -1))
    .filter((index) => index >= 0);

  return rows.map((row) => keepIndexes.map((index) => row[index] ?? ''));
}

function splitTsvRows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ');
}

function normalizeNullable(value: string | undefined): string | null {
  const normalized = collapseWhitespace(value ?? '');
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(value: string): string {
  return collapseWhitespace(value).toUpperCase().replace(/\s+/g, '_');
}

function isCompletelyEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => normalizeHeaderValue(cell).length === 0);
}

function buildConflictError(articleCode: string, firstItem: OrionCatalogItem, nextItem: OrionCatalogItem): ParseError {
  return {
    code: 'DUPLICATE_CONFLICT',
    message: `Se han encontrado filas conflictivas para el artículo ${articleCode}. La importación TSV se aborta para evitar consolidar datos inconsistentes.`,
    rowNumbers: [firstItem.rowNumber, nextItem.rowNumber],
    context: {
      articleCode,
      firstRow: firstItem.rowNumber,
      secondRow: nextItem.rowNumber,
    },
  };
}

function buildRowStructureError(rowNumber: number, missingFields: string[]): ParseError {
  return {
    code: 'INVALID_STRUCTURE',
    message: `La fila ${rowNumber} contiene datos pero carece de campos obligatorios: ${missingFields.join(', ')}.`,
    rowNumbers: [rowNumber],
    context: {
      missingFields,
    },
  };
}

function areCatalogItemsEquivalent(left: OrionCatalogItem, right: OrionCatalogItem): boolean {
  return (
    left.articleCode === right.articleCode &&
    left.shortDescription === right.shortDescription &&
    left.longDescription === right.longDescription &&
    left.unit === right.unit &&
    left.statusOriginal === right.statusOriginal &&
    left.statusNormalized === right.statusNormalized
  );
}

function parseRowsToItems(rows: string[][], sourceFile: string, warnings: ParseWarning[]): ParseResult<OrionCatalogItem> {
  if (rows.length === 0) {
    return {
      headers: [],
      items: [],
      warnings,
      errors: [{ code: 'EMPTY_INPUT', message: 'El fichero TSV no contiene filas legibles.' }],
      rowCount: 0,
      duplicateCount: 0,
    };
  }

  const sanitizedRows = removeCompletelyEmptyColumns(rows);
  const headerRow = sanitizedRows[0];
  let headers;

  try {
    headers = buildNormalizedHeaders(headerRow);
  } catch (error) {
    return {
      headers: [],
      items: [],
      warnings,
      errors: [{
        code: 'AMBIGUOUS_HEADERS',
        message: error instanceof Error ? error.message : 'No se pudieron normalizar los encabezados del TSV.',
      }],
      rowCount: Math.max(sanitizedRows.length - 1, 0),
      duplicateCount: 0,
    };
  }

  const visibleHeaders = headers.filter((header) => !IGNORED_COLUMNS.has(header.normalized));

  const unnamedNonEmptyColumns = headerRow
    .map((header, index) => ({ header: String(header ?? ''), index }))
    .filter(
      ({ header, index }) =>
        normalizeHeaderValue(header).length === 0 &&
        sanitizedRows.slice(1).some((row) => normalizeHeaderValue(row[index] ?? '').length > 0),
    );

  if (unnamedNonEmptyColumns.length > 0) {
    warnings.push({
      code: 'UNNAMED_COLUMN_IGNORED',
      message: `Se ignoran ${unnamedNonEmptyColumns.length} columnas sin nombre en el TSV de Orion.`,
      context: { columnIndexes: unnamedNonEmptyColumns.map((column) => column.index + 1) },
    });
  }

  for (const header of headers) {
    if (IGNORED_COLUMNS.has(header.normalized)) {
      warnings.push({
        code: 'IGNORED_COLUMN',
        message: `La columna ${header.normalized} se ignora en esta iteración del importador TSV de Orion.`,
        context: { column: header.normalized },
      });
    }
  }

  let resolvedRequired: string[];
  let resolvedOptional: string[] = [];

  try {
    resolvedRequired = resolveHeaderMapping(visibleHeaders, [...REQUIRED_COLUMNS]).resolvedKeys;
  } catch (error) {
    return {
      headers: visibleHeaders,
      items: [],
      warnings,
      errors: [
        {
          code: error instanceof Error && error.message.includes('encabezados ambiguos') ? 'AMBIGUOUS_HEADERS' : 'MISSING_REQUIRED_COLUMNS',
          message: error instanceof Error ? error.message : 'No se pudieron resolver las columnas obligatorias del TSV.',
        },
      ],
      rowCount: Math.max(sanitizedRows.length - 1, 0),
      duplicateCount: 0,
    };
  }

  try {
    resolvedOptional = resolveHeaderMapping(
      visibleHeaders.filter((header) => OPTIONAL_COLUMNS.includes(header.normalized as (typeof OPTIONAL_COLUMNS)[number])),
      [...OPTIONAL_COLUMNS].filter((columnName) => visibleHeaders.some((header) => header.normalized === columnName)),
    ).resolvedKeys;
  } catch {
    resolvedOptional = [];
  }

  const [articleKey, descriptionKey, statusKey] = resolvedRequired;
  const longDescriptionKey = resolvedOptional.find((key) => normalizeHeaderValue(key) === 'Descripción Larga');
  const unitKey = resolvedOptional.find((key) => normalizeHeaderValue(key) === 'Unidad de Medida Principal');

  const itemsByArticleCode = new Map<string, OrionCatalogItem>();
  const errors: ParseError[] = [];
  let duplicateCount = 0;
  let rowCount = 0;

  const dataRows = sanitizedRows.slice(1);
  for (const [index, cells] of dataRows.entries()) {
    if (isCompletelyEmptyRow(cells)) {
      continue;
    }

    rowCount += 1;

    const rowNumber = index + 2;
    const rowRecord = Object.fromEntries(headerRow.map((header, cellIndex) => [String(header ?? ''), cells[cellIndex] ?? '']));
    const articleCode = collapseWhitespace(rowRecord[articleKey] ?? '').toUpperCase();
    const shortDescription = collapseWhitespace(rowRecord[descriptionKey] ?? '');
    const statusOriginal = rowRecord[statusKey] ?? '';
    const missingFields = [
      articleCode.length === 0 ? 'Artículo' : null,
      shortDescription.length === 0 ? 'Descripción' : null,
      collapseWhitespace(statusOriginal).length === 0 ? 'Estado de Artículo' : null,
    ].filter((value): value is string => value !== null);

    if (missingFields.length > 0) {
      errors.push(buildRowStructureError(rowNumber, missingFields));
      continue;
    }

    const item: OrionCatalogItem = {
      articleCode,
      shortDescription,
      longDescription: normalizeNullable(longDescriptionKey ? rowRecord[longDescriptionKey] : undefined),
      unit: normalizeNullable(unitKey ? rowRecord[unitKey] : undefined),
      statusOriginal,
      statusNormalized: normalizeStatus(statusOriginal),
      sourceFile,
      rowNumber,
    };

    const existing = itemsByArticleCode.get(item.articleCode);
    if (!existing) {
      itemsByArticleCode.set(item.articleCode, item);
      continue;
    }

    duplicateCount += 1;
    if (areCatalogItemsEquivalent(existing, item)) {
      warnings.push({
        code: 'DUPLICATE_IDENTICAL_ROWS',
        message: `El artículo ${item.articleCode} aparece duplicado con el mismo contenido; se conserva la primera fila.`,
        rowNumbers: [existing.rowNumber, item.rowNumber],
        context: { articleCode: item.articleCode },
      });
      continue;
    }

    errors.push(buildConflictError(item.articleCode, existing, item));
  }

  if (errors.some((error) => error.code === 'DUPLICATE_CONFLICT')) {
    return {
      headers: visibleHeaders,
      items: [],
      warnings,
      errors,
      rowCount,
      duplicateCount,
    };
  }

  return {
    headers: visibleHeaders,
    items: [...itemsByArticleCode.values()],
    warnings,
    errors,
    rowCount,
    duplicateCount,
  };
}

export function parseOrionCatalogTsv(
  input: ArrayBuffer | Uint8Array,
  options: { sourceFile: string },
): ParseResult<OrionCatalogItem> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const decodingWarnings: ParseWarning[] = [];
  const decoded = decodeTsv(bytes);
  const parsed = parseRowsToItems(splitTsvRows(decoded.text), options.sourceFile, [...decodingWarnings]);

  if (decoded.encoding === 'windows-1252') {
    parsed.warnings.unshift({
      code: 'DECODING_FALLBACK_USED',
      message: 'Se ha usado windows-1252 como fallback de decodificación para el TSV de Orion.',
      context: { encoding: 'windows-1252' },
    });
  }

  return parsed;
}
