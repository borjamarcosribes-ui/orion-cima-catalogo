import type { Prisma } from '@/generated/postgres-client';

import { prisma } from '@/lib/prisma';
import { fetchSupplyStatusByCn, type NormalizedSupplyStatus } from '@/lib/cima-supply';

export type SupplyEventType = 'NEW_ISSUE' | 'RESOLVED' | 'CHANGED';

export type ActiveSupplyIssue = {
  cn: string;
  articleCode: string;
  shortDescription: string;
  activeIngredient: string | null;
  status: 'ACTIVO' | 'LAB';
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  observations: string | null;
};

export type SupplyMonitorOverview = {
  watchedProducts: number;
  activeIssues: number;
  newIssues: number;
  resolvedIssues: number;
  latestRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    checkedProducts: number;
    changedProducts: number;
    activeIssues: number;
    newIssues: number;
    resolvedIssues: number;
  } | null;
  recentEvents: Array<{
    id: string;
    cn: string;
    articleCode: string;
    shortDescription: string;
    eventType: SupplyEventType;
    createdAt: string;
  }>;
};

type PreviousSupplyState = {
  hasActiveSupplyIssue: boolean;
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  resolvedAt: string | null;
  observations: string | null;
  rawPayload: string | null;
};

type CheckedWatchedMedicine = {
  id: string;
  articleCode: string;
  cn: string;
  shortDescription: string;
};

type MonitorCheckResult = {
  watchedMedicine: CheckedWatchedMedicine;
  currentState: NormalizedSupplyStatus;
  previousState: PreviousSupplyState | null;
  eventType: SupplyEventType | null;
};

type RecentEventRow = {
  id: string;
  cn: string;
  eventType: string;
  createdAt: Date;
  watchedMedicine: {
    articleCode: string;
    shortDescription: string;
  };
};

type ActiveSupplyIssueSourceRow = {
  cn: string;
  issueType: string | null;
  startedAt: Date | null;
  expectedEndAt: Date | null;
  observations: string | null;
  watchedMedicine: {
    articleCode: string;
    shortDescription: string;
    statusNormalized: string | null;
  };
};

const SUPPLY_MONITOR_TRANSACTION_MAX_WAIT_MS = 15_000;
const SUPPLY_MONITOR_TRANSACTION_TIMEOUT_MS = 180_000;

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizePreviousState(value: {
  hasActiveSupplyIssue: boolean;
  issueType: string | null;
  startedAt: Date | null;
  expectedEndAt: Date | null;
  resolvedAt: Date | null;
  observations: string | null;
  rawPayload: string | null;
} | null): PreviousSupplyState | null {
  if (!value) {
    return null;
  }

  return {
    hasActiveSupplyIssue: value.hasActiveSupplyIssue,
    issueType: value.issueType,
    startedAt: toIsoOrNull(value.startedAt),
    expectedEndAt: toIsoOrNull(value.expectedEndAt),
    resolvedAt: toIsoOrNull(value.resolvedAt),
    observations: value.observations,
    rawPayload: value.rawPayload,
  };
}

function detectEventType(
  previousState: PreviousSupplyState | null,
  currentState: NormalizedSupplyStatus,
): SupplyEventType | null {
  if (!currentState.foundInCima) {
    return null;
  }

  if (!previousState) {
    return currentState.hasActiveSupplyIssue ? 'NEW_ISSUE' : null;
  }

  if (!previousState.hasActiveSupplyIssue && currentState.hasActiveSupplyIssue) {
    return 'NEW_ISSUE';
  }

  if (previousState.hasActiveSupplyIssue && !currentState.hasActiveSupplyIssue) {
    return 'RESOLVED';
  }

  if (!previousState.hasActiveSupplyIssue && !currentState.hasActiveSupplyIssue) {
    return null;
  }

  const relevantChange =
    previousState.issueType !== currentState.issueType ||
    previousState.startedAt !== currentState.startedAt ||
    previousState.expectedEndAt !== currentState.expectedEndAt ||
    previousState.observations !== currentState.observations;

  return relevantChange ? 'CHANGED' : null;
}

function parseDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export async function executeSupplyMonitor(options?: { source?: 'manual' | 'scheduled' }) {
  const run = await prisma.supplyMonitorRun.create({
    data: {
      status: 'running',
      source: options?.source ?? 'manual',
    },
  });

  try {
    const watchedMedicines = await prisma.watchedMedicine.findMany({
      where: { isWatched: true },
      include: { supplyStatus: true },
      orderBy: { cn: 'asc' },
    });

    const results: MonitorCheckResult[] = [];
    const errors: Array<{ cn: string; articleCode: string; message: string }> = [];

    for (const watchedMedicine of watchedMedicines) {
      try {
        const currentState = await fetchSupplyStatusByCn(watchedMedicine.cn);
        const previousState = normalizePreviousState(watchedMedicine.supplyStatus);
        const eventType = detectEventType(previousState, currentState);

        results.push({
          watchedMedicine: {
            id: watchedMedicine.id,
            articleCode: watchedMedicine.articleCode,
            cn: watchedMedicine.cn,
            shortDescription: watchedMedicine.shortDescription,
          },
          currentState,
          previousState,
          eventType,
        });
      } catch (error) {
        errors.push({
          cn: watchedMedicine.cn,
          articleCode: watchedMedicine.articleCode,
          message: error instanceof Error ? error.message : 'Error desconocido al consultar CIMA.',
        });
      }
    }

    const newIssues = results.filter(
      (result: MonitorCheckResult) => result.eventType === 'NEW_ISSUE',
    ).length;
    const resolvedIssues = results.filter(
      (result: MonitorCheckResult) => result.eventType === 'RESOLVED',
    ).length;
    const changedIssues = results.filter(
      (result: MonitorCheckResult) => result.eventType === 'CHANGED',
    ).length;
    const activeIssues = results.filter(
      (result: MonitorCheckResult) =>
        result.currentState.foundInCima && result.currentState.hasActiveSupplyIssue,
    ).length;

    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const result of results) {
          await tx.supplyStatus.upsert({
            where: { watchedMedicineId: result.watchedMedicine.id },
            update: {
              cn: result.currentState.cn,
              hasActiveSupplyIssue: result.currentState.hasActiveSupplyIssue,
              issueType: result.currentState.issueType,
              startedAt: parseDate(result.currentState.startedAt),
              expectedEndAt: parseDate(result.currentState.expectedEndAt),
              resolvedAt: parseDate(result.currentState.resolvedAt),
              observations: result.currentState.observations,
              rawPayload: result.currentState.rawPayload,
              lastCheckedAt: new Date(),
            },
            create: {
              watchedMedicineId: result.watchedMedicine.id,
              cn: result.currentState.cn,
              hasActiveSupplyIssue: result.currentState.hasActiveSupplyIssue,
              issueType: result.currentState.issueType,
              startedAt: parseDate(result.currentState.startedAt),
              expectedEndAt: parseDate(result.currentState.expectedEndAt),
              resolvedAt: parseDate(result.currentState.resolvedAt),
              observations: result.currentState.observations,
              rawPayload: result.currentState.rawPayload,
              lastCheckedAt: new Date(),
            },
          });

          if (result.eventType) {
            await tx.supplyMonitoringEvent.create({
              data: {
                monitorRunId: run.id,
                watchedMedicineId: result.watchedMedicine.id,
                cn: result.watchedMedicine.cn,
                eventType: result.eventType,
                previousStateJson: result.previousState ? JSON.stringify(result.previousState) : null,
                currentStateJson: JSON.stringify(result.currentState),
              },
            });
          }
        }

        await tx.supplyMonitorRun.update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            status: errors.length > 0 ? 'completed_with_errors' : 'completed',
            checkedProducts: watchedMedicines.length,
            changedProducts: newIssues + resolvedIssues + changedIssues,
            activeIssues,
            newIssues,
            resolvedIssues,
            errorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
          },
        });
      },
      {
        maxWait: SUPPLY_MONITOR_TRANSACTION_MAX_WAIT_MS,
        timeout: SUPPLY_MONITOR_TRANSACTION_TIMEOUT_MS,
      },
    );

    return { runId: run.id };
  } catch (error) {
    await prisma.supplyMonitorRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        errorsJson: JSON.stringify([
          {
            message: error instanceof Error ? error.message : 'Error desconocido en la ejecución del monitor.',
          },
        ]),
      },
    });

    throw error;
  }
}

export async function getActiveSupplyIssues(): Promise<ActiveSupplyIssue[]> {
  try {
    const rows = (await prisma.supplyStatus.findMany({
      where: {
        hasActiveSupplyIssue: true,
        watchedMedicine: {
          is: {
            isWatched: true,
          },
        },
      },
      select: {
        cn: true,
        issueType: true,
        startedAt: true,
        expectedEndAt: true,
        observations: true,
        watchedMedicine: {
          select: {
            articleCode: true,
            shortDescription: true,
            statusNormalized: true,
          },
        },
      },
    })) as ActiveSupplyIssueSourceRow[];

    const activeIngredients = await prisma.cimaCache.findMany({
      where: { nationalCode: { in: rows.map((row: ActiveSupplyIssueSourceRow) => row.cn) } },
      select: {
        nationalCode: true,
        activeIngredient: true,
      },
    });
    const activeIngredientByCn = new Map(
      activeIngredients.map((row: { nationalCode: string; activeIngredient: string | null }) => [
        row.nationalCode,
        row.activeIngredient,
      ]),
    );

    return rows
      .map((row: ActiveSupplyIssueSourceRow): ActiveSupplyIssue => ({
        cn: row.cn,
        articleCode: row.watchedMedicine.articleCode,
        shortDescription: row.watchedMedicine.shortDescription,
        activeIngredient: activeIngredientByCn.get(row.cn) ?? null,
        status: row.watchedMedicine.statusNormalized === 'LAB' ? 'LAB' : 'ACTIVO',
        issueType: row.issueType,
        startedAt: row.startedAt?.toISOString() ?? null,
        expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
        observations: row.observations,
      }))
      .sort((left: ActiveSupplyIssue, right: ActiveSupplyIssue) => {
        if (left.startedAt && right.startedAt) {
          const byStartedAt = right.startedAt.localeCompare(left.startedAt);
          if (byStartedAt !== 0) {
            return byStartedAt;
          }
        } else if (left.startedAt) {
          return -1;
        } else if (right.startedAt) {
          return 1;
        }

        return left.cn.localeCompare(right.cn);
      });
  } catch (error) {
    console.error('No se pudo cargar la tabla de roturas activas.', error);
    return [];
  }
}

export async function getSupplyMonitorOverview(): Promise<SupplyMonitorOverview> {
  try {
    const [watchedProducts, activeIssues, latestRun, recentEvents] = await Promise.all([
      prisma.watchedMedicine.count({ where: { isWatched: true } }),
      prisma.supplyStatus.count({
        where: {
          hasActiveSupplyIssue: true,
          watchedMedicine: {
            is: {
              isWatched: true,
            },
          },
        },
      }),
      prisma.supplyMonitorRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          checkedProducts: true,
          changedProducts: true,
          activeIssues: true,
          newIssues: true,
          resolvedIssues: true,
        },
      }),
      prisma.supplyMonitoringEvent.findMany({
        where: {
          watchedMedicine: {
            is: {
              isWatched: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          cn: true,
          eventType: true,
          createdAt: true,
          watchedMedicine: {
            select: {
              articleCode: true,
              shortDescription: true,
            },
          },
        },
      }),
    ]);

    return {
      watchedProducts,
      activeIssues,
      newIssues: latestRun?.newIssues ?? 0,
      resolvedIssues: latestRun?.resolvedIssues ?? 0,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            startedAt: latestRun.startedAt.toISOString(),
            finishedAt: latestRun.finishedAt?.toISOString() ?? null,
            status: latestRun.status,
            checkedProducts: latestRun.checkedProducts,
            changedProducts: latestRun.changedProducts,
            activeIssues: latestRun.activeIssues,
            newIssues: latestRun.newIssues,
            resolvedIssues: latestRun.resolvedIssues,
          }
        : null,
      recentEvents: (recentEvents as RecentEventRow[]).map((event: RecentEventRow) => ({
        id: event.id,
        cn: event.cn,
        articleCode: event.watchedMedicine.articleCode,
        shortDescription: event.watchedMedicine.shortDescription,
        eventType: event.eventType as SupplyEventType,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('No se pudo cargar el panel de suministro.', error);
    return {
      watchedProducts: 0,
      activeIssues: 0,
      newIssues: 0,
      resolvedIssues: 0,
      latestRun: null,
      recentEvents: [],
    };
  }
}