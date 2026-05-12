import { createRequire } from 'node:module';

import { prisma } from '@/lib/prisma';
import type { ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';
import { prepareUnitDoseSource } from '@/lib/unit-dose-download';

const require = createRequire(import.meta.url);
const { importUnitDoseCache } = require('./unit-dose-import.cjs') as {
  importUnitDoseCache: (
    filePath: string,
    options?: { prismaClient?: typeof prisma },
  ) => Promise<{
    processed: number;
    insertedOrUpdated: number;
    unitDoseCount: number;
    discarded: number;
    sourceFileName: string;
  }>;
};

export async function executeUnitDoseCacheRefresh(): Promise<ScheduledJobExecutionResult> {
  const preparedSource = await prepareUnitDoseSource();

  try {
    const importSummary = await importUnitDoseCache(preparedSource.filePath, { prismaClient: prisma });

    return {
      status: 'completed',
      summary: {
        processed: importSummary.processed,
        insertedOrUpdated: importSummary.insertedOrUpdated,
        unitDoseCount: importSummary.unitDoseCount,
        discarded: importSummary.discarded,
        sourceFileName: importSummary.sourceFileName,
        sourceMode: preparedSource.sourceMode,
        sourceUrl: preparedSource.sourceUrl,
        downloadedBytes: preparedSource.downloadedBytes,
      },
      errors: null,
    };
  } finally {
    await preparedSource.cleanup();
  }
}
