import { createRequire } from 'node:module';
import { basename } from 'node:path';

import { prisma } from '@/lib/prisma';
import type { ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';
import { prepareUnitDoseSource } from '@/lib/unit-dose-download';

const require = createRequire(import.meta.url);
const { importUnitDoseCache } = require('./unit-dose-import.cjs') as {
  importUnitDoseCache: (
    filePath: string,
    options: { prismaClient: typeof prisma },
  ) => Promise<{
    processed: number;
    insertedOrUpdated: number;
    unitDoseCount: number;
    discarded: number;
    sourceFileName: string;
  }>;
};

export async function executeUnitDoseCacheRefresh(): Promise<ScheduledJobExecutionResult> {
  const source = await prepareUnitDoseSource();

  try {
    const summary = await importUnitDoseCache(source.filePath, { prismaClient: prisma });

    return {
      status: 'completed',
      summary: {
        processed: summary.processed,
        insertedOrUpdated: summary.insertedOrUpdated,
        unitDoseCount: summary.unitDoseCount,
        discarded: summary.discarded,
        sourceFileName: summary.sourceFileName || basename(source.filePath),
        sourceMode: source.sourceMode,
        sourceUrl: source.sourceUrl,
        downloadedBytes: source.downloadedBytes,
      },
      errors: null,
    };
  } finally {
    await source.cleanup();
  }
}
