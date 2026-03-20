import { prisma } from '@/lib/prisma';
import type {
  PersistedTsvImportHistoryEntry,
  SaveTsvImportPayload,
} from '@/lib/import/persistence';

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