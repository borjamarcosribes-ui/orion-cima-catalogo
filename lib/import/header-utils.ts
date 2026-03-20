import type { NormalizedHeader } from '@/lib/import/types';

export function normalizeHeaderValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildNormalizedHeaders(values: Array<string | number | boolean | null | undefined>): NormalizedHeader[] {
  const headers = values
    .map((value) => {
      const raw = value === null || value === undefined ? '' : String(value);
      return {
        raw,
        normalized: normalizeHeaderValue(raw),
      };
    })
    .filter((header) => header.normalized.length > 0);

  if (headers.length === 0) {
    throw new Error('La hoja o fichero no contiene encabezados utilizables tras normalizar espacios.');
  }

  const normalizedValues = headers.map((header) => header.normalized);
  const duplicatedNormalizedHeaders = normalizedValues.filter(
    (value, index) => normalizedValues.indexOf(value) !== index,
  );

  if (duplicatedNormalizedHeaders.length > 0) {
    throw new Error(
      `La entrada contiene encabezados ambiguos tras normalizar espacios: ${[...new Set(duplicatedNormalizedHeaders)].join(', ')}.`,
    );
  }

  return headers;
}

export function resolveHeaderMapping(
  headers: NormalizedHeader[],
  requestedColumns: string[],
): { resolvedKeys: string[]; normalizedHeaders: string[] } {
  const headersByNormalizedName = new Map(headers.map((header) => [header.normalized, header.raw]));
  const normalizedRequestedColumns = requestedColumns.map((columnName) => normalizeHeaderValue(columnName));
  const missingColumns = normalizedRequestedColumns.filter((columnName) => !headersByNormalizedName.has(columnName));

  if (missingColumns.length > 0) {
    throw new Error(
      `El mapeo no coincide con la entrada. Faltan las columnas: ${missingColumns.join(', ')}. Encabezados detectados: ${headers.map((header) => header.normalized).join(', ') || 'ninguno'}.`,
    );
  }

  return {
    resolvedKeys: normalizedRequestedColumns.map((columnName) => headersByNormalizedName.get(columnName) as string),
    normalizedHeaders: headers.map((header) => header.normalized),
  };
}
