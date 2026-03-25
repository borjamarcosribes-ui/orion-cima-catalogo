import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { runScheduledJob, type ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BIFIMED_BASE_URL =
  process.env.BIFIMED_BASE_URL?.trim() || 'https://www.sanidad.gob.es/profesionales/medicamentos.do';

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
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForCompare(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractFieldValueFromText(text: string, label: string, nextLabels: string[] = []): string | null {
  const normalizedText = normalizeWhitespace(text);
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedNext = nextLabels
    .map((next) => next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const pattern = escapedNext
    ? new RegExp(`${escapedLabel}\\s*(.*?)\\s*(?=${escapedNext}|$)`, 'i')
    : new RegExp(`${escapedLabel}\\s*(.*)$`, 'i');

  const match = normalizedText.match(pattern);
  if (!match) {
    return null;
  }

  const value = normalizeWhitespace(match[1]);
  return value.length > 0 ? value : null;
}

function mapFundingStatus(rawFundingModality: string | null): string | null {
  const normalized = normalizeForCompare(rawFundingModality ?? '');

  if (normalized === 'si' || normalized === 'sí') {
    return 'FINANCIADO';
  }

  if (normalized.includes('determinadas indicaciones') || normalized.includes('determinadas condiciones')) {
    return 'FINANCIADO';
  }

  if (
    normalized.includes('no incluido') ||
    normalized.includes('excluido') ||
    normalized.includes('no financiado por resolucion') ||
    normalized.includes('no financiado por resolución')
  ) {
    return 'NO_FINANCIADO';
  }

  if (
    normalized.includes('estudio') ||
    normalized.includes('sin peticion financiacion') ||
    normalized.includes('sin petición financiación')
  ) {
    return 'EN_ESTUDIO';
  }

  return null;
}

function buildSummary(input: {
  fundingModality: string | null;
  restrictedConditions: string | null;
  specialFundingConditions: string | null;
  nomenclatorState: string | null;
}): string | null {
  const parts = [];

  if (input.fundingModality) {
    parts.push(input.fundingModality);
  }

  if (input.restrictedConditions) {
    parts.push(`Restricciones: ${input.restrictedConditions}`);
  }

  if (input.specialFundingConditions) {
    parts.push(`Condiciones especiales: ${input.specialFundingConditions}`);
  }

  if (input.nomenclatorState) {
    parts.push(`Estado nomenclátor: ${input.nomenclatorState}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function extractRowsFromTables(html: string): string[][][] {
  const tableMatches = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const tables: string[][][] = [];

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];
    const rowMatches = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const rows: string[][] = [];

    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[1];
      const cellMatches = [...rowHtml.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)];
      const cells = cellMatches
        .map((cellMatch) => stripTags(cellMatch[1]))
        .map((cell) => normalizeWhitespace(cell))
        .filter((cell) => cell.length > 0);

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      tables.push(rows);
    }
  }

  return tables;
}

function extractSummaryFieldsFromTables(html: string): {
  fundingModality: string | null;
  restrictedConditions: string | null;
  specialFundingConditions: string | null;
  nomenclatorState: string | null;
} {
  const tables = extractRowsFromTables(html);
  const labelMap = new Map<string, string>();

  for (const rows of tables) {
    for (const cells of rows) {
      if (cells.length < 2) {
        continue;
      }

      const label = normalizeForCompare(cells[0]);
      const value = normalizeWhitespace(cells.slice(1).join(' '));

      if (!label || !value) {
        continue;
      }

      if (!labelMap.has(label)) {
        labelMap.set(label, value);
      }
    }
  }

  return {
    fundingModality:
      labelMap.get(normalizeForCompare('Situación de financiación')) ??
      labelMap.get(normalizeForCompare('Situacion de financiacion')) ??
      null,
    restrictedConditions:
      labelMap.get(normalizeForCompare('Condiciones financiación restringidas')) ??
      labelMap.get(normalizeForCompare('Condiciones financiacion restringidas')) ??
      null,
    specialFundingConditions:
      labelMap.get(normalizeForCompare('Condiciones especiales de financiación')) ??
      labelMap.get(normalizeForCompare('Condiciones especiales de financiacion')) ??
      null,
    nomenclatorState:
      labelMap.get(normalizeForCompare('Estado de Nomenclátor')) ??
      labelMap.get(normalizeForCompare('Estado de Nomenclator')) ??
      null,
  };
}

function extractIndicationsFromTables(html: string): Array<{
  authorizedIndication: string;
  indicationFileStatus: string | null;
  indicationFundingResolution: string | null;
  rawPayload: string | null;
}> {
  const tables = extractRowsFromTables(html);

  for (const rows of tables) {
    const headerIndex = rows.findIndex((cells) => {
      const joined = normalizeForCompare(cells.join(' '));
      return (
        joined.includes('indicacion autorizada') &&
        joined.includes('situacion expediente indicacion') &&
        joined.includes('resolucion expediente de financiacion indicacion')
      );
    });

    if (headerIndex === -1) {
      continue;
    }

    const indicationRows = [];

    for (const cells of rows.slice(headerIndex + 1)) {
      if (cells.length === 0) {
        continue;
      }

      const firstCell = safeString(cells[0]);
      if (!firstCell) {
        continue;
      }

      indicationRows.push({
        authorizedIndication: firstCell,
        indicationFileStatus: safeString(cells[1]),
        indicationFundingResolution: safeString(cells[2]),
        rawPayload: JSON.stringify(cells),
      });
    }

    if (indicationRows.length > 0) {
      return indicationRows;
    }
  }

  return [];
}

function extractIndicationsFromLinearText(text: string): Array<{
  authorizedIndication: string;
  indicationFileStatus: string | null;
  indicationFundingResolution: string | null;
  rawPayload: string | null;
}> {
  const normalized = normalizeWhitespace(text);

  if (!normalized.includes('Indicaciones autorizadas')) {
    return [];
  }

  const anchor =
    'Indicaciones autorizadas Indicación autorizada Situación expediente indicación Resolución expediente de financiación indicación';
  const start = normalized.indexOf(anchor);

  if (start === -1) {
    return [];
  }

  let tail = normalized.slice(start + anchor.length).trim();

  const endMarkers = [
    'Indicaciones financiadas',
    'Indicaciones no financiadas',
    'Aportación usuario',
    'Genérico',
    'Tipo medicamento',
    'Subgrupo ATC/Descripción',
    'Conjunto de referencia',
    'Agrupación homogénea medicamentos',
  ];

  for (const marker of endMarkers) {
    const markerIndex = tail.indexOf(marker);
    if (markerIndex !== -1) {
      tail = tail.slice(0, markerIndex).trim();
      break;
    }
  }

  if (!tail) {
    return [];
  }

  const rows = [];
  const resolutionMarkers = [
    'Sí, financiada indicación autorizada',
    'Sí, con restricción a la indicación autorizada',
    'No incluida',
    'No financiada',
    'Excluida',
    'Pendiente',
    'Sin petición de financiación',
  ];

  while (tail.length > 0) {
    let splitIndex = -1;
    let matchedResolution: string | null = null;

    for (const marker of resolutionMarkers) {
      const markerIndex = tail.indexOf(marker);
      if (markerIndex !== -1 && (splitIndex === -1 || markerIndex < splitIndex)) {
        splitIndex = markerIndex;
        matchedResolution = marker;
      }
    }

    if (splitIndex === -1 || matchedResolution === null) {
      break;
    }

    const left = tail.slice(0, splitIndex).trim();
    const right = tail.slice(splitIndex).trim();

    const statusMatch = left.match(/(Resuelto|En estudio|Pendiente)\s*$/i);
    let authorizedIndication = left;
    let indicationFileStatus: string | null = null;

    if (statusMatch) {
      indicationFileStatus = statusMatch[1];
      authorizedIndication = left.slice(0, statusMatch.index).trim();
    }

    let nextCut = -1;
    for (const marker of resolutionMarkers) {
      const markerIndex = right.slice(matchedResolution.length).indexOf(marker);
      if (markerIndex !== -1) {
        const absolute = markerIndex + matchedResolution.length;
        if (nextCut === -1 || absolute < nextCut) {
          nextCut = absolute;
        }
      }
    }

    const chunk = nextCut === -1 ? right : right.slice(0, nextCut).trim();
    const nextTail = nextCut === -1 ? '' : right.slice(nextCut).trim();

    let indicationFundingResolution = chunk;
    if (chunk.startsWith(matchedResolution)) {
      indicationFundingResolution = chunk;
    }

    if (authorizedIndication) {
      rows.push({
        authorizedIndication,
        indicationFileStatus,
        indicationFundingResolution,
        rawPayload: JSON.stringify({
          authorizedIndication,
          indicationFileStatus,
          indicationFundingResolution,
        }),
      });
    }

    tail = nextTail;
  }

  return rows;
}

function parseBifimedHtml(html: string, cn: string): {
  summaryRow: {
    cn: string;
    fundingStatus: string;
    fundingModality: string | null;
    restrictedConditions: string | null;
    specialFundingConditions: string | null;
    nomenclatorState: string | null;
    summary: string | null;
    rawPayload: string;
  };
  indications: Array<{
    cn: string;
    sortOrder: number;
    authorizedIndication: string;
    indicationFileStatus: string | null;
    indicationFundingResolution: string | null;
    rawPayload: string | null;
  }>;
} | null {
  const text = normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<\/div>/gi, ' ')
        .replace(/<\/li>/gi, ' ')
        .replace(/<\/td>/gi, ' ')
        .replace(/<\/th>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );

  if (!text || !text.includes('BIFIMED')) {
    return null;
  }

  const summaryFieldsFromTables = extractSummaryFieldsFromTables(html);

  const fundingModality =
    summaryFieldsFromTables.fundingModality ??
    extractFieldValueFromText(text, 'Situación de financiación', [
      'Condiciones financiación restringidas',
      'Condiciones especiales de financiación',
      'Fecha de alta en financiación',
      'Fecha No Financiación/Exclusión',
      'Estado de Nomenclátor',
      'Informe público sobre la decisión de financiación',
      'Indicaciones autorizadas',
    ]);

  if (!fundingModality) {
    return null;
  }

  const fundingStatus = mapFundingStatus(fundingModality);
  if (!fundingStatus) {
    return null;
  }

  const restrictedConditions =
    summaryFieldsFromTables.restrictedConditions ??
    extractFieldValueFromText(text, 'Condiciones financiación restringidas', [
      'Condiciones especiales de financiación',
      'Situación de financiación',
      'Fecha de alta en financiación',
      'Estado de Nomenclátor',
      'Informe público sobre la decisión de financiación',
      'Indicaciones autorizadas',
    ]);

  const specialFundingConditions =
    summaryFieldsFromTables.specialFundingConditions ??
    extractFieldValueFromText(text, 'Condiciones especiales de financiación', [
      'Situación de financiación',
      'Fecha de alta en financiación',
      'Estado de Nomenclátor',
      'Informe público sobre la decisión de financiación',
      'Indicaciones autorizadas',
    ]);

  const nomenclatorState =
    summaryFieldsFromTables.nomenclatorState ??
    extractFieldValueFromText(text, 'Estado de Nomenclátor', [
      'Informe público sobre la decisión de financiación',
      'Medicamento autorizado por procedimiento centralizado',
      'Indicaciones autorizadas',
      'Indicaciones financiadas',
    ]);

  const summary = buildSummary({
    fundingModality,
    restrictedConditions,
    specialFundingConditions,
    nomenclatorState,
  });

  const tableIndications = extractIndicationsFromTables(html);
  const linearIndications = tableIndications.length > 0 ? [] : extractIndicationsFromLinearText(text);
  const indications = (tableIndications.length > 0 ? tableIndications : linearIndications).map((row, index) => ({
    cn,
    sortOrder: index,
    authorizedIndication: row.authorizedIndication,
    indicationFileStatus: row.indicationFileStatus ?? null,
    indicationFundingResolution: row.indicationFundingResolution ?? null,
    rawPayload: row.rawPayload ?? null,
  }));

  return {
    summaryRow: {
      cn,
      fundingStatus,
      fundingModality,
      restrictedConditions,
      specialFundingConditions,
      nomenclatorState,
      summary,
      rawPayload: html,
    },
    indications,
  };
}

async function fetchBifimedHtmlByCn(cn: string): Promise<string | null> {
  const url = new URL(BIFIMED_BASE_URL);
  url.searchParams.set('cn', cn);
  url.searchParams.set('metodo', 'verDetalle');

  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'orion-cima-catalogo/0.1 scheduled-job',
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BIFIMED ${response.status} para CN ${cn}${body ? `: ${body.slice(0, 240)}` : ''}`);
  }

  const html = await response.text();
  return html.trim().length > 0 ? html : null;
}

async function upsertBifimedCache(
  summaryRow: {
    cn: string;
    fundingStatus: string;
    fundingModality: string | null;
    restrictedConditions: string | null;
    specialFundingConditions: string | null;
    nomenclatorState: string | null;
    summary: string | null;
    rawPayload: string;
  },
  indications: Array<{
    cn: string;
    sortOrder: number;
    authorizedIndication: string;
    indicationFileStatus: string | null;
    indicationFundingResolution: string | null;
    rawPayload: string | null;
  }>,
): Promise<void> {
  await prisma.bifimedCache.upsert({
    where: { cn: summaryRow.cn },
    create: {
      cn: summaryRow.cn,
      fundingStatus: summaryRow.fundingStatus,
      fundingModality: summaryRow.fundingModality,
      restrictedConditions: summaryRow.restrictedConditions,
      specialFundingConditions: summaryRow.specialFundingConditions,
      nomenclatorState: summaryRow.nomenclatorState,
      summary: summaryRow.summary,
      rawPayload: summaryRow.rawPayload,
    },
    update: {
      fundingStatus: summaryRow.fundingStatus,
      fundingModality: summaryRow.fundingModality,
      restrictedConditions: summaryRow.restrictedConditions,
      specialFundingConditions: summaryRow.specialFundingConditions,
      nomenclatorState: summaryRow.nomenclatorState,
      summary: summaryRow.summary,
      rawPayload: summaryRow.rawPayload,
    },
  });

  await prisma.bifimedIndicationCache.deleteMany({
    where: { cn: summaryRow.cn },
  });

  if (indications.length > 0) {
    await prisma.bifimedIndicationCache.createMany({
      data: indications,
    });
  }
}

async function resolveTargetCns(limit: number, offset: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ cn: string }>>`
    SELECT DISTINCT n.cn AS cn
    FROM nomenclator_products n
    WHERE n.cn IS NOT NULL AND LENGTH(TRIM(n.cn)) = 6
    ORDER BY n.cn ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map((row) => row.cn);
}

async function executeBifimedCacheRefresh(input: {
  limit: number;
  offset: number;
  delayMs: number;
}): Promise<ScheduledJobExecutionResult> {
  const startedAt = Date.now();
  const targetCns = await resolveTargetCns(input.limit, input.offset);

  const failures: Array<{ cn: string; message: string }> = [];
  let updated = 0;
  let notFound = 0;

  for (const cn of targetCns) {
    try {
      const html = await fetchBifimedHtmlByCn(cn);

      if (!html) {
        notFound += 1;
      } else {
        const parsed = parseBifimedHtml(html, cn);

        if (!parsed) {
          notFound += 1;
        } else {
          await upsertBifimedCache(parsed.summaryRow, parsed.indications);
          updated += 1;
        }
      }
    } catch (error) {
      failures.push({
        cn,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (input.delayMs > 0) {
      await sleep(input.delayMs);
    }
  }

  return {
    status: failures.length > 0 ? 'completed_with_errors' : 'completed',
    summary: {
      scope: 'all',
      limit: input.limit,
      offset: input.offset,
      totalTargets: targetCns.length,
      updated,
      notFound,
      failed: failures.length,
      durationMs: Date.now() - startedAt,
    },
    errors: failures.length > 0 ? failures.slice(0, 50) : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const limit = parsePositiveInt(request.nextUrl.searchParams.get('limit'), 1000);
    const offset = parsePositiveInt(request.nextUrl.searchParams.get('offset'), 0);
    const delayMs = parsePositiveInt(request.nextUrl.searchParams.get('delayMs'), 200);

    const response = await runScheduledJob({
      jobName: 'BIFIMED_CACHE_REFRESH_ALL',
      triggerType: 'scheduled_http',
      requestedBy: request.headers.get('user-agent') ?? 'http',
      idempotencyKey: request.headers.get('x-idempotency-key'),
      handler: async () =>
        executeBifimedCacheRefresh({
          limit,
          offset,
          delayMs,
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
        error: error instanceof Error ? error.message : 'Error inesperado al ejecutar el refresco de BIFIMED.',
      },
      { status: 500 },
    );
  }
}