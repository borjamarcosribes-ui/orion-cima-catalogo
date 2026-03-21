import type { Prisma, PrismaClient } from '@prisma/client';

import type { OrionCatalogItem } from '@/lib/import/types';

const WATCHABLE_ARTICLE_CODE_REGEX = /^[1-9]\d{5}\.CNA$/;

type PrismaTransaction = Prisma.TransactionClient | PrismaClient;

type WatchedMedicineCandidate = {
  articleCode: string;
  cn: string;
  shortDescription: string;
  statusOriginal: string;
  statusNormalized: string;
};

export function extractWatchableMedicine(item: OrionCatalogItem): WatchedMedicineCandidate | null {
  if (!WATCHABLE_ARTICLE_CODE_REGEX.test(item.articleCode)) {
    return null;
  }

  return {
    articleCode: item.articleCode,
    cn: item.articleCode.slice(0, 6),
    shortDescription: item.shortDescription,
    statusOriginal: item.statusOriginal,
    statusNormalized: item.statusNormalized,
  };
}

export async function syncWatchedMedicinesFromImport(
  tx: PrismaTransaction,
  importId: string,
  items: OrionCatalogItem[],
  seenAt = new Date(),
): Promise<number> {
  const candidates = items
    .map(extractWatchableMedicine)
    .filter((item): item is WatchedMedicineCandidate => item !== null);

  for (const candidate of candidates) {
    await tx.watchedMedicine.upsert({
      where: { articleCode: candidate.articleCode },
      update: {
        cn: candidate.cn,
        shortDescription: candidate.shortDescription,
        statusOriginal: candidate.statusOriginal,
        statusNormalized: candidate.statusNormalized,
        isWatched: true,
        lastSeenAt: seenAt,
        lastImportId: importId,
      },
      create: {
        articleCode: candidate.articleCode,
        cn: candidate.cn,
        shortDescription: candidate.shortDescription,
        statusOriginal: candidate.statusOriginal,
        statusNormalized: candidate.statusNormalized,
        isWatched: true,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        lastImportId: importId,
      },
    });
  }

  return candidates.length;
}