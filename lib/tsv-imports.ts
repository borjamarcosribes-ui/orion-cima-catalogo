import { prisma } from '@/lib/prisma';
import type {
  PersistedTsvImportHistoryEntry,
  PersistedTsvImportPreview,
  SaveTsvImportPayload,
} from '@/lib/import/persistence';
import type { OrionCatalogItem, ParseError, ParseWarning } from '@/lib/import/types';

function mapHistoryEntry(entry: {
  id: string;
  fileName: string;
  importedAt: Date;
  rowCount: number;
  validItems: number;
  duplicateCount: number;
  warningCount: number;
  errorCount: number;
}): PersistedTsvImportHistoryEntry {
  return {
    id: entry.id,
    fileName: entry.fileName,
    importedAt: entry.importedAt.toISOString(),
    rowCount: entry.rowCount,
    validItems: entry.validItems,
    duplicateCount: entry.duplicateCount,
    warningCount: entry.warningCount,
    errorCount: entry.errorCount,
  };
}

function parseStoredArray<TItem>(value: unknown): TItem[] {
  if (Array.isArray(value)) {
    return value as TItem[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as TItem[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mapPersistedPreview(entry: {
  id: string;
  fileName: string;
  importedAt: Date;
  rowCount: number;
  duplicateCount: number;
  warningsJson: unknown;
  errorsJson: unknown;
  items: Array<{
    articleCode: string;
    shortDescription: string;
    longDescription: string | null;
    unit: string | null;
    statusOriginal: string;
    statusNormalized: string;
    rowNumber: number;
  }>;
}): PersistedTsvImportPreview {
  const warnings = parseStoredArray<ParseWarning>(entry.warningsJson);
  const errors = parseStoredArray<ParseError>(entry.errorsJson);
  const items: OrionCatalogItem[] = entry.items.map((item) => ({
    articleCode: item.articleCode,
    shortDescription: item.shortDescription,
    longDescription: item.longDescription,
    unit: item.unit,
    statusOriginal: item.statusOriginal,
    statusNormalized: item.statusNormalized,
    sourceFile: entry.fileName,
    rowNumber: item.rowNumber,
  }));

  return {
    id: entry.id,
    fileName: entry.fileName,
    importedAt: entry.importedAt.toISOString(),
    result: {
      headers: [],
      items,
      warnings,
      errors,
      rowCount: entry.rowCount,
      duplicateCount: entry.duplicateCount,
    },
  };
}

export async function listTsvImportHistory(): Promise<PersistedTsvImportHistoryEntry[]> {
  try {
    const entries = await prisma.tsvImport.findMany({
      orderBy: { importedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        importedAt: true,
        rowCount: true,
        validItems: true,
        duplicateCount: true,
        warningCount: true,
        errorCount: true,
      },
    });

    return entries.map(mapHistoryEntry);
  } catch (error) {
    console.error('No se pudo cargar el histórico de importaciones TSV.', error);
    return [];
  }
}

export async function getTsvImportPreviewById(importId: string): Promise<PersistedTsvImportPreview | null> {
  if (importId.trim().length === 0) {
    return null;
  }

  try {
    const entry = await prisma.tsvImport.findUnique({
      where: { id: importId },
      select: {
        id: true,
        fileName: true,
        importedAt: true,
        rowCount: true,
        duplicateCount: true,
        warningsJson: true,
        errorsJson: true,
        items: {
          orderBy: { rowNumber: 'asc' },
          select: {
            articleCode: true,
            shortDescription: true,
            longDescription: true,
            unit: true,
            statusOriginal: true,
            statusNormalized: true,
            rowNumber: true,
          },
        },
      },
    });

    return entry ? mapPersistedPreview(entry) : null;
  } catch (error) {
    console.error(`No se pudo cargar la importación TSV ${importId}.`, error);
    return null;
  }
}

export async function saveTsvImport(payload: SaveTsvImportPayload): Promise<PersistedTsvImportHistoryEntry> {
  const created = await prisma.$transaction(async (tx) => {
    const savedImport = await tx.tsvImport.create({
      data: {
        fileName: payload.fileName,
        rowCount: payload.rowCount,
        validItems: payload.items.length,
        duplicateCount: payload.duplicateCount,
        warningCount: payload.warnings.length,
        errorCount: payload.errors.length,
        warningsJson: JSON.stringify(payload.warnings),
        errorsJson: JSON.stringify(payload.errors),
      },
    });

    if (payload.items.length > 0) {
      await tx.tsvImportItem.createMany({
        data: payload.items.map((item) => ({
          tsvImportId: savedImport.id,
          articleCode: item.articleCode,
          shortDescription: item.shortDescription,
          longDescription: item.longDescription,
          unit: item.unit,
          statusOriginal: item.statusOriginal,
          statusNormalized: item.statusNormalized,
          rowNumber: item.rowNumber,
        })),
      });
    }

    return savedImport;
  });

  return mapHistoryEntry(created);
}