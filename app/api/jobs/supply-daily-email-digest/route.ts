import { NextRequest, NextResponse } from 'next/server';

import { sendMail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { runScheduledJob, type ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';
import {
  buildSupplyDigestHtml,
  buildSupplyDigestSubject,
  buildSupplyDigestText,
  getSupplyDigestPayload,
} from '@/lib/supply-email-digest';

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

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveTargetSubscriptions(now: Date, emailFilter: string | null) {
  return prisma.supplyNotificationSubscription.findMany({
    where: {
      enabled: true,
      ...(emailFilter ? { email: emailFilter } : {}),
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ email: 'asc' }],
  });
}

type PerSubscriptionResult = {
  email: string;
  eventsCount: number;
  status: 'sent' | 'failed';
  messageId: string | null;
  errorMessage: string | null;
  windowStart: string;
  windowEnd: string;
};

async function executeSupplyDailyEmailDigest(input: {
  emailFilter: string | null;
  lookbackHours: number;
}): Promise<ScheduledJobExecutionResult> {
  const now = new Date();
  const subscriptions = await resolveTargetSubscriptions(now, input.emailFilter);

  if (subscriptions.length === 0) {
    return {
      status: 'completed',
      summary: {
        subscriptionsProcessed: 0,
        emailsSent: 0,
        totalEvents: 0,
        failed: 0,
      },
      errors: null,
    };
  }

  const results: PerSubscriptionResult[] = [];
  const errors: Array<{ email: string; message: string }> = [];

  for (const subscription of subscriptions) {
    const windowEnd = now;
    const windowStart =
      subscription.lastSentAt ?? new Date(now.getTime() - input.lookbackHours * 60 * 60 * 1000);

    const payload = await getSupplyDigestPayload({
      windowStart,
      windowEnd,
    });

    const subject = buildSupplyDigestSubject({
      windowStart: payload.windowStart,
      windowEnd: payload.windowEnd,
      totalEvents: payload.summary.totalEvents,
    });

    const html = buildSupplyDigestHtml(payload);
    const text = buildSupplyDigestText(payload);

    const notificationRun = await prisma.supplyNotificationRun.create({
      data: {
        subscriptionId: subscription.id,
        windowStart,
        windowEnd,
        status: 'pending',
        eventsCount: payload.summary.totalEvents,
        summaryJson: JSON.stringify({
          ...payload.summary,
          subject,
        }),
      },
      select: {
        id: true,
      },
    });

    try {
      const mailResult = await sendMail({
        to: subscription.email,
        subject,
        html,
        text,
      });

      await prisma.$transaction([
        prisma.supplyNotificationRun.update({
          where: { id: notificationRun.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            eventsCount: payload.summary.totalEvents,
            summaryJson: JSON.stringify({
              ...payload.summary,
              subject,
              provider: mailResult.provider,
              messageId: mailResult.messageId,
            }),
          },
        }),
        prisma.supplyNotificationSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSentAt: windowEnd,
          },
        }),
      ]);

      results.push({
        email: subscription.email,
        eventsCount: payload.summary.totalEvents,
        status: 'sent',
        messageId: mailResult.messageId,
        errorMessage: null,
        windowStart: payload.windowStart,
        windowEnd: payload.windowEnd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido enviando el digest.';

      await prisma.supplyNotificationRun.update({
        where: { id: notificationRun.id },
        data: {
          status: 'failed',
          errorMessage: message,
          eventsCount: payload.summary.totalEvents,
          summaryJson: JSON.stringify({
            ...payload.summary,
            subject,
          }),
        },
      });

      results.push({
        email: subscription.email,
        eventsCount: payload.summary.totalEvents,
        status: 'failed',
        messageId: null,
        errorMessage: message,
        windowStart: payload.windowStart,
        windowEnd: payload.windowEnd,
      });

      errors.push({
        email: subscription.email,
        message,
      });
    }
  }

  const summary = {
    subscriptionsProcessed: subscriptions.length,
    emailsSent: results.filter((item) => item.status === 'sent').length,
    totalEvents: results.reduce((sum, item) => sum + item.eventsCount, 0),
    failed: results.filter((item) => item.status === 'failed').length,
  };

  return {
    status: errors.length > 0 ? 'completed_with_errors' : 'completed',
    summary,
    errors: errors.length > 0 ? errors : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const emailFilter = normalizeEmail(request.nextUrl.searchParams.get('email'));
    const lookbackHours = parsePositiveInt(request.nextUrl.searchParams.get('lookbackHours'), 24);

    const response = await runScheduledJob({
      jobName: 'SUPPLY_DAILY_EMAIL_DIGEST',
      triggerType: 'scheduled_http',
      requestedBy: request.headers.get('user-agent') ?? 'http',
      idempotencyKey: request.headers.get('x-idempotency-key'),
      handler: async () =>
        executeSupplyDailyEmailDigest({
          emailFilter,
          lookbackHours,
        }),
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
        error: error instanceof Error ? error.message : 'Error inesperado al ejecutar el digest diario.',
      },
      { status: 500 },
    );
  }
}