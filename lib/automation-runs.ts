import { prisma } from '@/lib/prisma';

export type AutomationProcessKey =
  | 'NOMENCLATOR'
  | 'SUPPLY_MONITOR'
  | 'CIMA_WATCHED'
  | 'CIMA_ALL'
  | 'BIFIMED_ALL'
  | 'SUPPLY_EMAIL_DIGEST';

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

export type AutomationNotificationSubscriptionListItem = {
  createdAt: string;
  email: string;
  enabled: boolean;
  endDate: string | null;
  id: string;
  lastSentAt: string | null;
  updatedAt: string;
};

export type AutomationNotificationRunListItem = {
  email: string;
  errorMessage: string | null;
  eventsCount: number;
  id: string;
  sentAt: string | null;
  status: string;
  subscriptionId: string;
  summary: Record<string, unknown>;
  windowEnd: string;
  windowStart: string;
};

export type AutomationDashboardData = {
  locks: AutomationLockOverview[];
  notificationRuns: AutomationNotificationRunListItem[];
  notificationSubscriptions: AutomationNotificationSubscriptionListItem[];
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

  if (jobName === 'CIMA_CACHE_REFRESH_WATCHED') {
    return { key: 'CIMA_WATCHED', label: 'Caché CIMA (watched)' };
  }

  if (jobName === 'CIMA_CACHE_REFRESH_ALL') {
    return { key: 'CIMA_ALL', label: 'Caché CIMA (all)' };
  }

  if (jobName === 'BIFIMED_CACHE_REFRESH_ALL') {
    return { key: 'BIFIMED_ALL', label: 'Caché BIFIMED (all)' };
  }

  if (jobName === 'SUPPLY_DAILY_EMAIL_DIGEST') {
    return { key: 'SUPPLY_EMAIL_DIGEST', label: 'Digest diario por email' };
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
  const insertedOrUpdated = typeof summary.insertedOrUpdated === 'number' ? summary.insertedOrUpdated : null;
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
  const supplyMonitorRunId = typeof summary.supplyMonitorRunId === 'string' ? summary.supplyMonitorRunId : null;
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

function summarizeCacheRefresh(summary: Record<string, unknown>): string {
  const scope = typeof summary.scope === 'string' ? summary.scope : null;
  const totalTargets = typeof summary.totalTargets === 'number' ? summary.totalTargets : null;
  const updated = typeof summary.updated === 'number' ? summary.updated : null;
  const notFound = typeof summary.notFound === 'number' ? summary.notFound : null;
  const failed = typeof summary.failed === 'number' ? summary.failed : null;

  const parts = [
    scope ? `scope=${scope}` : null,
    totalTargets !== null ? `${totalTargets} objetivos` : null,
    updated !== null ? `${updated} actualizados` : null,
    notFound !== null ? `${notFound} no encontrados` : null,
    failed !== null ? `${failed} fallidos` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Sin resumen disponible';
}

function summarizeSupplyEmailDigest(summary: Record<string, unknown>): string {
  const subscriptionsProcessed =
    typeof summary.subscriptionsProcessed === 'number' ? summary.subscriptionsProcessed : null;
  const emailsSent = typeof summary.emailsSent === 'number' ? summary.emailsSent : null;
  const totalEvents = typeof summary.totalEvents === 'number' ? summary.totalEvents : null;
  const failed = typeof summary.failed === 'number' ? summary.failed : null;

  const parts = [
    subscriptionsProcessed !== null ? `${subscriptionsProcessed} suscripciones` : null,
    emailsSent !== null ? `${emailsSent} enviados` : null,
    totalEvents !== null ? `${totalEvents} eventos` : null,
    failed !== null ? `${failed} fallidos` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Sin resumen disponible';
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

  if (
    jobName === 'CIMA_CACHE_REFRESH_WATCHED' ||
    jobName === 'CIMA_CACHE_REFRESH_ALL' ||
    jobName === 'BIFIMED_CACHE_REFRESH_ALL'
  ) {
    return summarizeCacheRefresh(summary);
  }

  if (jobName === 'SUPPLY_DAILY_EMAIL_DIGEST') {
    return summarizeSupplyEmailDigest(summary);
  }

  return summarizeSupplyMonitor(summary, supplyMonitorRunById);
}

export async function getAutomationDashboardData(limit = 20): Promise<AutomationDashboardData> {
  const now = new Date();

  const [
    recentRuns,
    latestNomenclatorRun,
    latestSupplyMonitorRun,
    latestCimaWatchedRun,
    latestCimaAllRun,
    latestBifimedAllRun,
    latestSupplyEmailDigestRun,
    locks,
    notificationSubscriptions,
    notificationRuns,
  ] = await Promise.all([
    prisma.scheduledJobRun.findMany({
      where: {
        jobName: {
          in: [
            'NOMENCLATOR_UPDATE',
            'SUPPLY_MONITOR',
            'CIMA_CACHE_REFRESH_WATCHED',
            'CIMA_CACHE_REFRESH_ALL',
            'BIFIMED_CACHE_REFRESH_ALL',
            'SUPPLY_DAILY_EMAIL_DIGEST',
          ],
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
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'CIMA_CACHE_REFRESH_WATCHED' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'CIMA_CACHE_REFRESH_ALL' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'BIFIMED_CACHE_REFRESH_ALL' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.scheduledJobRun.findFirst({
      where: { jobName: 'SUPPLY_DAILY_EMAIL_DIGEST' },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.executionLock.findMany({
      where: {
        key: {
          in: [
            'nomenclator_update',
            'supply_monitor',
            'cima_cache_refresh_watched',
            'cima_cache_refresh_all',
            'bifimed_cache_refresh_all',
            'supply_daily_email_digest',
          ],
        },
        expiresAt: { gte: now },
      },
    }),
    prisma.supplyNotificationSubscription.findMany({
      orderBy: [{ enabled: 'desc' }, { email: 'asc' }],
    }),
    prisma.supplyNotificationRun.findMany({
      include: {
        subscription: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    }),
  ]);

  const supplyMonitorRunIds = recentRuns
    .map((run: { summaryJson: string | null }) => parseJsonObject(run.summaryJson).supplyMonitorRunId)
    .filter((value: unknown): value is string => typeof value === 'string');

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
  supplyMonitorRuns.map(
    (run: {
      id: string;
      checkedProducts: number;
      changedProducts: number;
      newIssues: number;
      resolvedIssues: number;
    }) => [
      run.id,
      {
        checkedProducts: run.checkedProducts,
        changedProducts: run.changedProducts,
        newIssues: run.newIssues,
        resolvedIssues: run.resolvedIssues,
      },
    ] as const,
  ),
);

const activeLockByKey = new Map(
  locks.map(
    (lock: { key: string; expiresAt: Date }) => [lock.key, lock] as const,
  ),
);

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
      {
        processKey: 'CIMA_WATCHED',
        processLabel: 'Caché CIMA (watched)',
        lastRunAt: latestCimaWatchedRun
          ? (latestCimaWatchedRun.finishedAt ?? latestCimaWatchedRun.startedAt).toISOString()
          : null,
        status: latestCimaWatchedRun?.status ?? null,
      },
      {
        processKey: 'CIMA_ALL',
        processLabel: 'Caché CIMA (all)',
        lastRunAt: latestCimaAllRun
          ? (latestCimaAllRun.finishedAt ?? latestCimaAllRun.startedAt).toISOString()
          : null,
        status: latestCimaAllRun?.status ?? null,
      },
      {
        processKey: 'BIFIMED_ALL',
        processLabel: 'Caché BIFIMED (all)',
        lastRunAt: latestBifimedAllRun
          ? (latestBifimedAllRun.finishedAt ?? latestBifimedAllRun.startedAt).toISOString()
          : null,
        status: latestBifimedAllRun?.status ?? null,
      },
      {
        processKey: 'SUPPLY_EMAIL_DIGEST',
        processLabel: 'Digest diario por email',
        lastRunAt: latestSupplyEmailDigestRun
          ? (latestSupplyEmailDigestRun.finishedAt ?? latestSupplyEmailDigestRun.startedAt).toISOString()
          : null,
        status: latestSupplyEmailDigestRun?.status ?? null,
      },
    ],
    locks: [
      { key: 'nomenclator_update', label: 'Nomenclátor' },
      { key: 'supply_monitor', label: 'Monitor AEMPS / CIMA' },
      { key: 'cima_cache_refresh_watched', label: 'Caché CIMA (watched)' },
      { key: 'cima_cache_refresh_all', label: 'Caché CIMA (all)' },
      { key: 'bifimed_cache_refresh_all', label: 'Caché BIFIMED (all)' },
      { key: 'supply_daily_email_digest', label: 'Digest diario por email' },
    ].map((item) => {
      const lock = activeLockByKey.get(item.key);

      return {
        key: item.key,
        label: item.label,
        status: lock ? 'active' : 'free',
        expiresAt: lock?.expiresAt.toISOString() ?? null,
      };
    }),
    notificationSubscriptions: notificationSubscriptions.map((item) => ({
      id: item.id,
      email: item.email,
      enabled: item.enabled,
      endDate: item.endDate?.toISOString() ?? null,
      lastSentAt: item.lastSentAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    notificationRuns: notificationRuns.map((item) => ({
      id: item.id,
      subscriptionId: item.subscriptionId,
      email: item.subscription.email,
      windowStart: item.windowStart.toISOString(),
      windowEnd: item.windowEnd.toISOString(),
      status: item.status,
      eventsCount: item.eventsCount,
      sentAt: item.sentAt?.toISOString() ?? null,
      errorMessage: item.errorMessage ?? null,
      summary: parseJsonObject(item.summaryJson),
    })),
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