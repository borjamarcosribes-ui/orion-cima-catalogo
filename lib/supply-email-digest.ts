import { prisma } from '@/lib/prisma';
import type { SupplyEventType } from '@/lib/supply-monitor';

export type SupplyDigestEventRow = {
  id: string;
  createdAt: string;
  eventType: SupplyEventType;
  eventLabel: 'NUEVA ROTURA' | 'RESUELTO' | 'MODIFICACIÓN';
  cn: string;
  articleCode: string;
  status: 'ACTIVO' | 'LAB';
  shortDescription: string;
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  observations: string | null;
};

export type SupplyDigestSummary = {
  totalEvents: number;
  newIssues: number;
  resolved: number;
  changed: number;
};

export type SupplyDigestPayload = {
  windowStart: string;
  windowEnd: string;
  summary: SupplyDigestSummary;
  rows: SupplyDigestEventRow[];
};

type ParsedSupplyState = {
  hasActiveSupplyIssue: boolean;
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  resolvedAt: string | null;
  observations: string | null;
};

function parseStateJson(value: string | null): ParsedSupplyState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ParsedSupplyState> | null;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      hasActiveSupplyIssue: Boolean(parsed.hasActiveSupplyIssue),
      issueType: typeof parsed.issueType === 'string' ? parsed.issueType : null,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
      expectedEndAt: typeof parsed.expectedEndAt === 'string' ? parsed.expectedEndAt : null,
      resolvedAt: typeof parsed.resolvedAt === 'string' ? parsed.resolvedAt : null,
      observations: typeof parsed.observations === 'string' ? parsed.observations : null,
    };
  } catch {
    return null;
  }
}

function getRelevantStateForEvent(
  eventType: SupplyEventType,
  previousStateJson: string | null,
  currentStateJson: string | null,
): ParsedSupplyState | null {
  if (eventType === 'RESOLVED') {
    return parseStateJson(previousStateJson) ?? parseStateJson(currentStateJson);
  }

  return parseStateJson(currentStateJson) ?? parseStateJson(previousStateJson);
}

function toIsoOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeWatchedStatus(value: string | null | undefined): 'ACTIVO' | 'LAB' {
  return value === 'LAB' ? 'LAB' : 'ACTIVO';
}

function translateEventType(eventType: SupplyEventType): 'NUEVA ROTURA' | 'RESUELTO' | 'MODIFICACIÓN' {
  switch (eventType) {
    case 'NEW_ISSUE':
      return 'NUEVA ROTURA';
    case 'RESOLVED':
      return 'RESUELTO';
    case 'CHANGED':
      return 'MODIFICACIÓN';
  }
}

function formatDateTimeEs(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
}

function formatDateEs(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function summarizeRows(rows: SupplyDigestEventRow[]): SupplyDigestSummary {
  return {
    totalEvents: rows.length,
    newIssues: rows.filter((row) => row.eventType === 'NEW_ISSUE').length,
    resolved: rows.filter((row) => row.eventType === 'RESOLVED').length,
    changed: rows.filter((row) => row.eventType === 'CHANGED').length,
  };
}

export async function getSupplyDigestPayload(input: {
  windowStart: Date;
  windowEnd: Date;
}): Promise<SupplyDigestPayload> {
  const events = await prisma.supplyMonitoringEvent.findMany({
    where: {
      createdAt: {
        gte: input.windowStart,
        lt: input.windowEnd,
      },
      watchedMedicine: {
        is: {
          isWatched: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      cn: true,
      eventType: true,
      createdAt: true,
      previousStateJson: true,
      currentStateJson: true,
      watchedMedicine: {
        select: {
          articleCode: true,
          shortDescription: true,
          statusNormalized: true,
        },
      },
    },
  });

  const rows: SupplyDigestEventRow[] = events.map((event) => {
    const eventType = event.eventType as SupplyEventType;
    const state = getRelevantStateForEvent(eventType, event.previousStateJson, event.currentStateJson);

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      eventType,
      eventLabel: translateEventType(eventType),
      cn: event.cn,
      articleCode: event.watchedMedicine.articleCode,
      status: normalizeWatchedStatus(event.watchedMedicine.statusNormalized),
      shortDescription: event.watchedMedicine.shortDescription,
      issueType: state?.issueType ?? null,
      startedAt: toIsoOrNull(state?.startedAt ?? null),
      expectedEndAt: toIsoOrNull(state?.expectedEndAt ?? null),
      observations: state?.observations ?? null,
    };
  });

  return {
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    summary: summarizeRows(rows),
    rows,
  };
}

export function buildSupplyDigestSubject(input: {
  windowStart: string;
  windowEnd: string;
  totalEvents: number;
}): string {
  const startLabel = formatDateEs(input.windowStart);
  const endLabel = formatDateEs(input.windowEnd);

  return `Gestor de Roturas · Resumen diario (${startLabel} - ${endLabel}) · ${input.totalEvents} evento(s)`;
}

export function buildSupplyDigestText(payload: SupplyDigestPayload): string {
  const lines: string[] = [];

  lines.push('Resumen diario de cambios en problemas de suministro');
  lines.push(
    `Ventana: ${formatDateTimeEs(payload.windowStart)} - ${formatDateTimeEs(payload.windowEnd)}`,
  );
  lines.push(
    `Total: ${payload.summary.totalEvents} · Nuevas roturas: ${payload.summary.newIssues} · Modificaciones: ${payload.summary.changed} · Resueltos: ${payload.summary.resolved}`,
  );
  lines.push('');

  if (payload.rows.length === 0) {
    lines.push('No se han detectado cambios en las últimas 24 horas.');
    return lines.join('\n');
  }

  for (const row of payload.rows) {
    lines.push(
      [
        formatDateTimeEs(row.createdAt),
        row.eventLabel,
        `CN ${row.cn}`,
        row.shortDescription,
        `Estado: ${row.status}`,
        `Tipo: ${row.issueType ?? '—'}`,
        `Inicio: ${formatDateEs(row.startedAt)}`,
        `Fin esperado: ${formatDateEs(row.expectedEndAt)}`,
        `Observaciones: ${row.observations ?? '—'}`,
      ].join(' | '),
    );
  }

  return lines.join('\n');
}

export function buildSupplyDigestHtml(payload: SupplyDigestPayload): string {
  const summary = payload.summary;

  const summaryLine = `Total: ${summary.totalEvents} · Nuevas roturas: ${summary.newIssues} · Modificaciones: ${summary.changed} · Resueltos: ${summary.resolved}`;

  const tableRows =
    payload.rows.length === 0
      ? `
        <tr>
          <td colspan="10" style="padding:12px;border:1px solid #d9dde3;text-align:left;">
            No se han detectado cambios en las últimas 24 horas.
          </td>
        </tr>
      `
      : payload.rows
          .map(
            (row) => `
              <tr>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(formatDateTimeEs(row.createdAt))}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.eventLabel)}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.cn)}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.articleCode)}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.status)}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.shortDescription)}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.issueType ?? '—')}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(formatDateEs(row.startedAt))}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(formatDateEs(row.expectedEndAt))}</td>
                <td style="padding:10px 12px;border:1px solid #d9dde3;vertical-align:top;">${escapeHtml(row.observations ?? '—')}</td>
              </tr>
            `,
          )
          .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <title>Resumen diario de problemas de suministro</title>
      </head>
      <body style="margin:0;padding:24px;background:#f6f8fb;color:#172033;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:1200px;margin:0 auto;background:#ffffff;border:1px solid #d9dde3;border-radius:10px;padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;">Resumen diario de problemas de suministro</h1>

          <p style="margin:0 0 8px 0;color:#475467;">
            Ventana analizada: ${escapeHtml(formatDateTimeEs(payload.windowStart))} - ${escapeHtml(
              formatDateTimeEs(payload.windowEnd),
            )}
          </p>

          <p style="margin:0 0 18px 0;color:#475467;">
            ${escapeHtml(summaryLine)}
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Fecha</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Evento</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">CN</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Artículo</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Estado</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Descripción</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Tipo</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Inicio</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Fin esperado</th>
                <th style="padding:10px 12px;border:1px solid #d9dde3;background:#eef2f7;text-align:left;">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}