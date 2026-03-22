import type { Prisma, PrismaClient } from '@prisma/client';

import type { OrionCatalogItem } from '@/lib/import/types';

const TRACKABLE_ARTICLE_CODE_REGEX = /^[1-9]\d{5}\.CNA$/;
const CURRENTLY_WATCHABLE_STATUSES = new Set(['ACTIVO', 'LAB']);

type PrismaTransaction = Prisma.TransactionClient | PrismaClient;

type TrackedMedicineCandidate = {
  articleCode: string;
  cn: string;
  shortDescription: string;
  statusOriginal: string;
  statusNormalized: string;
  isWatched: boolean;
};

function hasTrackableArticleCode(articleCode: string): boolean {
  return TRACKABLE_ARTICLE_CODE_REGEX.test(articleCode);
}

function isCurrentlyWatchableStatus(statusNormalized: string): boolean {
  return CURRENTLY_WATCHABLE_STATUSES.has(statusNormalized);
}

export function extractTrackedMedicine(item: OrionCatalogItem): TrackedMedicineCandidate | null {
  if (!hasTrackableArticleCode(item.articleCode)) {
    return null;
  }

  return {
    articleCode: item.articleCode,
    cn: item.articleCode.slice(0, 6),
    shortDescription: item.shortDescription,
    statusOriginal: item.statusOriginal,
    statusNormalized: item.statusNormalized,
    isWatched: isCurrentlyWatchableStatus(item.statusNormalized),
  };
}

export async function syncWatchedMedicinesFromImport(
  tx: PrismaTransaction,
  importId: string,
  items: OrionCatalogItem[],
  seenAt = new Date(),
): Promise<number> {
  const candidates = items
    .map(extractTrackedMedicine)
    .filter((item): item is TrackedMedicineCandidate => item !== null);

  const seenArticleCodes = [...new Set(candidates.map((candidate) => candidate.articleCode))];

  for (const candidate of candidates) {
    await tx.watchedMedicine.upsert({
      where: { articleCode: candidate.articleCode },
      update: {
        cn: candidate.cn,
        shortDescription: candidate.shortDescription,
        statusOriginal: candidate.statusOriginal,
        statusNormalized: candidate.statusNormalized,
        isWatched: candidate.isWatched,
        lastSeenAt: seenAt,
        lastImportId: importId,
      },
      create: {
        articleCode: candidate.articleCode,
        cn: candidate.cn,
        shortDescription: candidate.shortDescription,
        statusOriginal: candidate.statusOriginal,
        statusNormalized: candidate.statusNormalized,
        isWatched: candidate.isWatched,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        lastImportId: importId,
      },
    });
  }

  if (seenArticleCodes.length > 0) {
    await tx.watchedMedicine.updateMany({
      where: {
        articleCode: {
          notIn: seenArticleCodes,
        },
      },
      data: {
        isWatched: false,
      },
    });
  } else {
    await tx.watchedMedicine.updateMany({
      data: {
        isWatched: false,
      },
    });
  }

  return candidates.filter((candidate) => candidate.isWatched).length;
}