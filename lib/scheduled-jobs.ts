import { prisma } from '@/lib/prisma';

export type ScheduledJobName = 'NOMENCLATOR_UPDATE' | 'SUPPLY_MONITOR';
export type ScheduledTriggerType = 'scheduled_http' | 'manual_http' | 'internal';
export type ScheduledJobStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'skipped_locked';

export type ScheduledJobExecutionResult = {
  status: Exclude<ScheduledJobStatus, 'running'>;
  summary?: Record<string, unknown> | null;
  errors?: unknown[] | null;
};

const LOCK_TTLS_MS: Record<ScheduledJobName, number> = {
  NOMENCLATOR_UPDATE: 2 * 60 * 60 * 1000,
  SUPPLY_MONITOR: 60 * 60 * 1000,
};

const LOCK_KEYS: Record<ScheduledJobName, string> = {
  NOMENCLATOR_UPDATE: 'nomenclator_update',
  SUPPLY_MONITOR: 'supply_monitor',
};

export function getScheduledJobLockKey(jobName: ScheduledJobName): string {
  return LOCK_KEYS[jobName];
}

function getLockExpiry(jobName: ScheduledJobName): Date {
  return new Date(Date.now() + LOCK_TTLS_MS[jobName]);
}

export async function createScheduledJobRun(input: {
  jobName: ScheduledJobName;
  triggerType: ScheduledTriggerType;
  requestedBy?: string | null;
  idempotencyKey?: string | null;
}): Promise<{ id: string; lockKey: string }> {
  const lockKey = getScheduledJobLockKey(input.jobName);
  const run = await prisma.scheduledJobRun.create({
    data: {
      jobName: input.jobName,
      triggerType: input.triggerType,
      requestedBy: input.requestedBy ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      status: 'running',
      lockKey,
    },
    select: {
      id: true,
      lockKey: true,
    },
  });

  return {
    id: run.id,
    lockKey: run.lockKey ?? lockKey,
  };
}

export async function acquireExecutionLock(jobName: ScheduledJobName, runId: string): Promise<boolean> {
  const key = getScheduledJobLockKey(jobName);
  const now = new Date();
  const expiresAt = getLockExpiry(jobName);

  try {
    await prisma.executionLock.create({
      data: {
        key,
        ownerRunId: runId,
        acquiredAt: now,
        heartbeatAt: now,
        expiresAt,
      },
    });

    return true;
  } catch {
    const updated = await prisma.executionLock.updateMany({
      where: {
        key,
        expiresAt: {
          lt: now,
        },
      },
      data: {
        ownerRunId: runId,
        acquiredAt: now,
        heartbeatAt: now,
        expiresAt,
      },
    });

    return updated.count === 1;
  }
}

export async function releaseExecutionLock(jobName: ScheduledJobName, runId: string): Promise<void> {
  await prisma.executionLock.deleteMany({
    where: {
      key: getScheduledJobLockKey(jobName),
      ownerRunId: runId,
    },
  });
}

export async function completeScheduledJobRun(
  runId: string,
  result: ScheduledJobExecutionResult,
): Promise<void> {
  await prisma.scheduledJobRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      status: result.status,
      summaryJson: result.summary ? JSON.stringify(result.summary) : null,
      errorsJson: result.errors ? JSON.stringify(result.errors) : null,
    },
  });
}

export async function failScheduledJobRun(runId: string, error: unknown): Promise<void> {
  const payload = error instanceof Error ? [{ message: error.message }] : [{ message: String(error) }];

  await prisma.scheduledJobRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      status: 'failed',
      errorsJson: JSON.stringify(payload),
    },
  });
}

export async function runScheduledJob(input: {
  jobName: ScheduledJobName;
  triggerType: ScheduledTriggerType;
  requestedBy?: string | null;
  idempotencyKey?: string | null;
  handler: (context: { runId: string; lockKey: string }) => Promise<ScheduledJobExecutionResult>;
}): Promise<{ runId: string; lockKey: string; result: ScheduledJobExecutionResult }> {
  const run = await createScheduledJobRun({
    jobName: input.jobName,
    triggerType: input.triggerType,
    requestedBy: input.requestedBy,
    idempotencyKey: input.idempotencyKey,
  });

  const acquired = await acquireExecutionLock(input.jobName, run.id);
  if (!acquired) {
    const result: ScheduledJobExecutionResult = {
      status: 'skipped_locked',
      summary: {
        reason: 'lock_active',
        lockKey: run.lockKey,
      },
      errors: null,
    };

    await completeScheduledJobRun(run.id, result);
    return { runId: run.id, lockKey: run.lockKey, result };
  }

  try {
    const result = await input.handler({ runId: run.id, lockKey: run.lockKey });
    await completeScheduledJobRun(run.id, result);
    return { runId: run.id, lockKey: run.lockKey, result };
  } catch (error) {
    await failScheduledJobRun(run.id, error);
    throw error;
  } finally {
    await releaseExecutionLock(input.jobName, run.id);
  }
}