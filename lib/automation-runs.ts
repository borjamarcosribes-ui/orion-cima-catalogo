import { prisma } from '@/lib/prisma';

export type AutomationProcessKey = 'NOMENCLATOR' | 'SUPPLY_MONITOR';
export type AutomationOriginFilter = 'all' | 'manual' | 'scheduled';
export type AutomationStatusFilter = 'all' | 'failed';

export type AutomationLockOverview = {
  key: string;
  label: string;
  status: 'active' | 'free';
  expiresAt: string | null;
};

export type AutomationRunDetail = {
  errors: unknown[];
  lockKey: string | null;
  requestedAt: string;
  requestedBy: string | null;
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown>;
  triggerType: string;
};

export type AutomationRunListItem = {
  detail: AutomationRunDetail;
  displayOrigin: string;
  displayProcess: string;
  displayStatus: string;
  processKey: AutomationProcessKey;
  shortSummary: string;
  sortDate: string;
  status: string;
};

export type AutomationOverviewCard = {
  lastRunAt: string | null;
  processKey: AutomationProcessKey;
  processLabel: string;
  status: string | null;
};

export type AutomationDashboardData = {
  locks: AutomationLockOverview[];
  recentRuns: AutomationRunListItem[];
  summaryCards: AutomationOverviewCard[];
};

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [{ message: value }];
  }
}

function formatProcess(jobName: string): { key: AutomationProcessKey; label: string } {
  if (jobName === 'NOMENCLATOR_UPDATE') {
    return { key: 'NOMENCLATOR', label: 'Nomenclátor' };
  }

  return { key: 'SUPPLY_MONITOR', label: 'Monitor AEMPS / CIMA' };
}

function formatOrigin(triggerType: string): string {
  if (triggerType === 'scheduled_http') {
    return 'Programado';
  }

  if (triggerType === 'manual_http') {
    return 'Manual';
  }

  return 'Interno';
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completado';
    case 'completed_with_errors':
      return 'Completado con avisos';
    case 'failed':
      return 'Fallido';
    case 'skipped_locked':
      return 'Omitido por lock';
    case 'running':
      return 'En curso';
    default:
      return status;
  }
}

function summarizeNomenclator(summary: Record<string, unknown>): string {
  const processed = typeof summary.processed === 'number' ? summary.processed : null;
  const insertedOrUpdated =
    typeof summary.insertedOrUpdated === 'number' ? summary.insertedOrUpdated : null;
  const discarded = typeof summary.discarded === 'number' ? summary.discarded : null;
  const sourceMode = summary.sourceMode === 'zip_download' ? 'ZIP' : 'XML local';

  const parts = [
    processed !== null ? `${processed} procesados` : null,
    insertedOrUpdated !== null ? `${insertedOrUpdated} actualizados` : null,
    discarded !== null ? `${discarded} descartados` : null,
    sourceMode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Sin resumen disponible';
}

function summarizeSupplyMonitor(
  summary: Record<string, unknown>,
  supplyMonitorRunById: Map<
    string,
    {
      checkedProducts: number;
      changedProducts: number;
      newIssues: number;
      resolvedIssues: number;
    }
  >,
): string {
  const supplyMonitorRunId =
    typeof summary.supplyMonitorRunId === 'string' ? summary.supplyMonitorRunId : null;
  const enriched = supplyMonitorRunId ? supplyMonitorRunById.get(supplyMonitorRunId) : null;

  if (enriched) {
    return [
      `${enriched.checkedProducts} revisados`,
      `${enriched.changedProducts} cambios`,
      `${enriched.newIssues} nuevas`,
      `${enriched.resolvedIssues} resueltas`,
    ].join(' · ');
  }

  return supplyMonitorRunId ? `Run ${supplyMonitorRunId}` : 'Sin resumen disponible';
}

function summarizeRun(
  jobName: string,
  summary: Record<string, unknown>,
  supplyMonitorRunById: Map<
    string,
    {
      checkedProducts: number;
      changedProducts: number;
      newIssues: number;
      resolvedIssues: number;
    }
  >,
): string {
  if (jobName === 'NOMENCLATOR_UPDATE') {
    return summarizeNomenclator(summary);
  }

  return summarizeSupplyMonitor(summary, supplyMonitorRunById);
}

export async function getAutomationDashboardData(limit = 20): Promise<AutomationDashboardData> {
  const now = new Date();

  const [recentRuns, latestNomenclatorRun, latestSupplyMonitorRun, locks] = await Promise.all([
    prisma.scheduledJobRun.findMany({
      where: {
        jobName: {
          in: ['NOMENCLATOR_UPDATE', 'SUPPLY_MONITOR'],
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    }),
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'NOMENCLATOR_UPDATE' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'SUPPLY_MONITOR' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.executionLock.findMany({
      where: {
        key: { in: ['nomenclator_update', 'supply_monitor'] },
        expiresAt: { gte: now },
      },
    }),
  ]);

  const supplyMonitorRunIds = recentRuns
    .map((run) => parseJsonObject(run.summaryJson).supplyMonitorRunId)
    .filter((value): value is string => typeof value === 'string');

  const supplyMonitorRuns = supplyMonitorRunIds.length
    ? await prisma.supplyMonitorRun.findMany({
        where: {
          id: {
            in: supplyMonitorRunIds,
          },
        },
        select: {
          id: true,
          checkedProducts: true,
          changedProducts: true,
          newIssues: true,
          resolvedIssues: true,
        },
      })
    : [];

  const supplyMonitorRunById = new Map(
    supplyMonitorRuns.map((run) => [
      run.id,
      {
        checkedProducts: run.checkedProducts,
        changedProducts: run.changedProducts,
        newIssues: run.newIssues,
        resolvedIssues: run.resolvedIssues,
      },
    ]),
  );

  const activeLockByKey = new Map(locks.map((lock) => [lock.key, lock]));

  return {
    summaryCards: [
      {
        processKey: 'NOMENCLATOR',
        processLabel: 'Nomenclátor',
        lastRunAt: latestNomenclatorRun
          ? (latestNomenclatorRun.finishedAt ?? latestNomenclatorRun.startedAt).toISOString()
          : null,
        status: latestNomenclatorRun?.status ?? null,
      },
      {
        processKey: 'SUPPLY_MONITOR',
        processLabel: 'Monitor AEMPS / CIMA',
        lastRunAt: latestSupplyMonitorRun
          ? (latestSupplyMonitorRun.finishedAt ?? latestSupplyMonitorRun.startedAt).toISOString()
          : null,
        status: latestSupplyMonitorRun?.status ?? null,
      },
    ],
    locks: [
      {
        key: 'nomenclator_update',
        label: 'Nomenclátor',
      },
      {
        key: 'supply_monitor',
        label: 'Monitor AEMPS / CIMA',
      },
    ].map((item) => {
      const lock = activeLockByKey.get(item.key);

      return {
        key: item.key,
        label: item.label,
        status: lock ? 'active' : 'free',
        expiresAt: lock?.expiresAt.toISOString() ?? null,
      };
    }),
    recentRuns: recentRuns.map((run) => {
      const process = formatProcess(run.jobName);
      const summary = parseJsonObject(run.summaryJson);
      const errors = parseJsonArray(run.errorsJson);
      const sortDate = (run.finishedAt ?? run.startedAt).toISOString();

      return {
        processKey: process.key,
        displayProcess: process.label,
        displayOrigin: formatOrigin(run.triggerType),
        displayStatus: formatStatus(run.status),
        status: run.status,
        sortDate,
        shortSummary: summarizeRun(run.jobName, summary, supplyMonitorRunById),
        detail: {
          runId: run.id,
          lockKey: run.lockKey ?? null,
          requestedAt: run.requestedAt.toISOString(),
          requestedBy: run.requestedBy ?? null,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
          triggerType: run.triggerType,
          summary,
          errors,
        },
      };
    }),
  };
}