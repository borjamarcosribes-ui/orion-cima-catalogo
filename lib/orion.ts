import * as XLSX from 'xlsx';
import { z } from 'zod';

export const ORION_MEDICINE_CODE_REGEX = /^\d{6}\.CNA$/;

export type RowValue = string | number | boolean | null | undefined;
export type RawSpreadsheetRow = Record<string, RowValue>;

export const importMappingSchema = z.object({
  codeColumn: z.string().min(1),
  descriptionColumn: z.string().min(1),
  sheetName: z.string().optional(),
});

export type ImportMapping = z.infer<typeof importMappingSchema>;

export type ParsedImportRow = {
  rowNumber: number;
  raw: RawSpreadsheetRow;
  orionCode: string;
  description: string;
  isValidMedicine: boolean;
  nationalCode: string | null;
  discardReason: string | null;
};

export type DuplicateNationalCodeConflict = {
  nationalCode: string;
  keptRowNumber: number;
  discardedRowNumbers: number[];
  allRowNumbers: number[];
  keptOrionCode: string;
  keptLocalDescription: string;
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  discardedRows: number;
  uniqueNationalCodes: number;
  duplicateNationalCodes: number;
  duplicateValidRows: number;
};

export type ParsedImportBatch = {
  rows: ParsedImportRow[];
  summary: ImportSummary;
  duplicateConflicts: DuplicateNationalCodeConflict[];
};

export type MedicineSnapshotRecord = {
  importBatchId: string;
  nationalCode: string;
  orionCode: string;
  localDescription: string;
  sourceRowNumber: number;
};

export type SnapshotBuildResult = {
  snapshot: MedicineSnapshotRecord[];
  duplicateConflicts: DuplicateNationalCodeConflict[];
};

export type SnapshotDiff = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

type SheetHeader = {
  raw: string;
  normalized: string;
};

type ResolvedMapping = {
  codeColumnKey: string;
  descriptionColumnKey: string;
  normalizedHeaders: string[];
};

function normalizeCell(value: RowValue): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getSheetHeaders(worksheet: XLSX.WorkSheet): SheetHeader[] {
  const rows = XLSX.utils.sheet_to_json<RowValue[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const headerRow = rows[0];
  if (!headerRow) {
    throw new Error('La hoja seleccionada está vacía o no contiene fila de encabezados.');
  }

  const headers = headerRow
    .map((value) => {
      const raw = value === null || value === undefined ? '' : String(value);
      return {
        raw,
        normalized: normalizeCell(raw),
      };
    })
    .filter((header) => header.normalized.length > 0);

  if (headers.length === 0) {
    throw new Error('La hoja seleccionada no contiene encabezados utilizables tras normalizar espacios.');
  }

  const normalizedValues = headers.map((header) => header.normalized);
  const duplicatedNormalizedHeaders = normalizedValues.filter(
    (value, index) => normalizedValues.indexOf(value) !== index,
  );

  if (duplicatedNormalizedHeaders.length > 0) {
    throw new Error(
      `La hoja contiene encabezados ambiguos tras normalizar espacios: ${[...new Set(duplicatedNormalizedHeaders)].join(', ')}.`,
    );
  }

  return headers;
}

function resolveMappedColumnKeys(headers: SheetHeader[], mapping: ImportMapping): ResolvedMapping {
  const headersByNormalizedName = new Map(headers.map((header) => [header.normalized, header.raw]));
  const normalizedCodeColumn = normalizeCell(mapping.codeColumn);
  const normalizedDescriptionColumn = normalizeCell(mapping.descriptionColumn);
  const missingColumns = [normalizedCodeColumn, normalizedDescriptionColumn].filter(
    (columnName) => !headersByNormalizedName.has(columnName),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `El mapeo no coincide con el Excel. Faltan las columnas: ${missingColumns.join(', ')}. Encabezados detectados: ${headers.map((header) => header.normalized).join(', ') || 'ninguno'}.`,
    );
  }

  return {
    codeColumnKey: headersByNormalizedName.get(normalizedCodeColumn) as string,
    descriptionColumnKey: headersByNormalizedName.get(normalizedDescriptionColumn) as string,
    normalizedHeaders: headers.map((header) => header.normalized),
  };
}

export function validateOrionMedicineCode(orionCode: string) {
  const normalized = normalizeCell(orionCode);
  if (!normalized) {
    return {
      isValid: false,
      nationalCode: null,
      discardReason: 'Código Orion vacío.',
    } as const;
  }

  if (!normalized.includes('.CNA')) {
    return {
      isValid: false,
      nationalCode: null,
      discardReason: 'Registro descartado: no contiene el sufijo .CNA y se trata como no medicamentoso.',
    } as const;
  }

  if (!ORION_MEDICINE_CODE_REGEX.test(normalized)) {
    return {
      isValid: false,
      nationalCode: null,
      discardReason: 'Registro descartado: el código no cumple el patrón exacto ^\\d{6}\\.CNA$.',
    } as const;
  }

  return {
    isValid: true,
    nationalCode: normalized.slice(0, 6),
    discardReason: null,
  } as const;
}

/**
 * Política de deduplicación cerrada para esta iteración:
 * - medicines_snapshot representa CN únicos por batch.
 * - gana la primera fila válida observada para cada CN, respetando el orden original del Excel.
 * - se conservan de la fila ganadora: orionCode, localDescription y sourceRowNumber.
 * - sourceRowNumber pasa a significar "fila fuente que ganó la deduplicación".
 * - las filas válidas posteriores con el mismo CN no se ocultan: se reportan en duplicateConflicts.
 */
export function buildMedicineSnapshotWithConflicts(
  importBatchId: string,
  parsedRows: ParsedImportRow[],
): SnapshotBuildResult {
  const snapshotByNationalCode = new Map<string, MedicineSnapshotRecord>();
  const rowNumbersByNationalCode = new Map<string, number[]>();

  for (const row of parsedRows) {
    if (!row.isValidMedicine || !row.nationalCode) {
      continue;
    }

    const existingRowNumbers = rowNumbersByNationalCode.get(row.nationalCode) ?? [];
    existingRowNumbers.push(row.rowNumber);
    rowNumbersByNationalCode.set(row.nationalCode, existingRowNumbers);

    if (!snapshotByNationalCode.has(row.nationalCode)) {
      snapshotByNationalCode.set(row.nationalCode, {
        importBatchId,
        nationalCode: row.nationalCode,
        orionCode: row.orionCode,
        localDescription: row.description,
        sourceRowNumber: row.rowNumber,
      });
    }
  }

  const snapshot = [...snapshotByNationalCode.values()];
  const duplicateConflicts = snapshot
    .filter((record) => (rowNumbersByNationalCode.get(record.nationalCode) ?? []).length > 1)
    .map<DuplicateNationalCodeConflict>((record) => {
      const allRowNumbers = rowNumbersByNationalCode.get(record.nationalCode) ?? [record.sourceRowNumber];
      return {
        nationalCode: record.nationalCode,
        keptRowNumber: record.sourceRowNumber,
        discardedRowNumbers: allRowNumbers.filter((rowNumber) => rowNumber !== record.sourceRowNumber),
        allRowNumbers,
        keptOrionCode: record.orionCode,
        keptLocalDescription: record.localDescription,
      };
    })
    .sort((left, right) => left.nationalCode.localeCompare(right.nationalCode));

  return {
    snapshot,
    duplicateConflicts,
  };
}

export function parseWorkbook(buffer: ArrayBuffer, mapping: ImportMapping): ParsedImportBatch {
  const parsedMapping = importMappingSchema.parse(mapping);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = parsedMapping.sheetName ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('El fichero no contiene hojas legibles.');
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`La hoja "${sheetName}" no existe en el fichero importado. Hojas disponibles: ${workbook.SheetNames.join(', ') || 'ninguna'}.`);
  }

  const headers = getSheetHeaders(worksheet);
  const resolvedMapping = resolveMappedColumnKeys(headers, parsedMapping);

  const rawRows = XLSX.utils.sheet_to_json<RawSpreadsheetRow>(worksheet, {
    defval: '',
    raw: false,
  });

  const rows = rawRows.map<ParsedImportRow>((row, index) => {
    const orionCode = normalizeCell(row[resolvedMapping.codeColumnKey]);
    const description = normalizeCell(row[resolvedMapping.descriptionColumnKey]);
    const validation = validateOrionMedicineCode(orionCode);

    return {
      rowNumber: index + 2,
      raw: row,
      orionCode,
      description,
      isValidMedicine: validation.isValid,
      nationalCode: validation.nationalCode,
      discardReason: validation.discardReason,
    };
  });

  const validRows = rows.filter((row) => row.isValidMedicine);
  const { snapshot, duplicateConflicts } = buildMedicineSnapshotWithConflicts('preview-batch', rows);
  const duplicateValidRows = duplicateConflicts.reduce(
    (total, conflict) => total + conflict.discardedRowNumbers.length,
    0,
  );

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: validRows.length,
      discardedRows: rows.length - validRows.length,
      uniqueNationalCodes: snapshot.length,
      duplicateNationalCodes: duplicateConflicts.length,
      duplicateValidRows,
    },
    duplicateConflicts,
  };
}

export function buildMedicineSnapshot(importBatchId: string, parsedRows: ParsedImportRow[]): MedicineSnapshotRecord[] {
  return buildMedicineSnapshotWithConflicts(importBatchId, parsedRows).snapshot;
}

export function diffSnapshots(previous: MedicineSnapshotRecord[], current: MedicineSnapshotRecord[]): SnapshotDiff {
  const previousCodes = new Set(previous.map((item) => item.nationalCode));
  const currentCodes = new Set(current.map((item) => item.nationalCode));

  const added = [...currentCodes].filter((code) => !previousCodes.has(code)).sort();
  const removed = [...previousCodes].filter((code) => !currentCodes.has(code)).sort();
  const unchanged = [...currentCodes].filter((code) => previousCodes.has(code)).sort();

  return { added, removed, unchanged };
}
