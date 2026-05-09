import { NextRequest, NextResponse } from 'next/server';

import { runScheduledJob } from '@/lib/scheduled-jobs';
import { executeSupplyMonitor } from '@/lib/supply-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error('Falta CRON_SECRET en el entorno.');
  }

  const authorization = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const response = await runScheduledJob({
      jobName: 'SUPPLY_MONITOR',
      triggerType: 'scheduled_http',
      requestedBy: request.headers.get('user-agent') ?? 'http',
      idempotencyKey: request.headers.get('x-idempotency-key'),
      handler: async () => {
        const monitorResult = await executeSupplyMonitor({ source: 'scheduled' });
        return {
          status: 'completed',
          summary: {
            supplyMonitorRunId: monitorResult.runId,
          },
          errors: null,
        };
      },
    });

    const httpStatus = response.result.status === 'skipped_locked' ? 409 : 200;

    return NextResponse.json(
      {
        ok: response.result.status === 'completed' || response.result.status === 'completed_with_errors',
        runId: response.runId,
        lockKey: response.lockKey,
        status: response.result.status,
        summary: response.result.summary ?? null,
        errors: response.result.errors ?? null,
      },
      { status: httpStatus },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Error inesperado al ejecutar el monitor CIMA.',
      },
      { status: 500 },
    );
  }
}