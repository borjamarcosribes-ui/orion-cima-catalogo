'use server';

import type { SaveTsvImportPayload, SaveTsvImportResult } from '@/lib/import/persistence';
import { listTsvImportHistory, saveTsvImport } from '@/lib/tsv-imports';

export async function saveTsvImportAction(payload: SaveTsvImportPayload): Promise<SaveTsvImportResult> {
  if (payload.errors.length > 0) {
    return {
      ok: false,
      message: 'No se puede guardar una importación con errores de parser.',
      history: await listTsvImportHistory(),
    };
  }

  if (payload.items.length === 0) {
    return {
      ok: false,
      message: 'No se puede guardar una importación sin items válidos.',
      history: await listTsvImportHistory(),
    };
  }

  try {
    const savedImport = await saveTsvImport(payload);
    const history = await listTsvImportHistory();

    return {
      ok: true,
      savedImport,
      history,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo guardar la importación TSV.',
      history: await listTsvImportHistory(),
    };
  }
}