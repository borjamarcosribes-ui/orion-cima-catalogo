import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApiKey } from '@/lib/admin-api-key';
import { prisma } from '@/lib/prisma';
import { runScheduledJob, type ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CIMA_REST_BASE_URL = process.env.CIMA_REST_BASE_URL?.trim() || 'https://cima.aemps.es/cima/rest';

type RefreshScope = 'watched' | 'all';
type LooseRecord = Record<string, unknown>;

type NormalizedCharacteristic = {
  label: string;
  normalizedLabel: string;
  sortOrder: number;
  rawPayload: string | null;
};

type NormalizedCimaPayload = {
  nationalCode: string;
  officialName: string | null;
  activeIngredient: string | null;
  atcCode: string | null;
  laboratory: string | null;
  commercializationStatus: string | null;
  supplyStatus: string | null;
  technicalSheetUrl: string | null;
  leafletUrl: string | null;
  leafletHtmlUrl: string | null;
  htmlUrl: string | null;
  pdfUrl: string | null;
  rawPayload: string;
  fetchedAt: Date;
  updatedAt: Date;
  characteristics: NormalizedCharacteristic[];
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as LooseRecord;
}

function asRecordArray(value: unknown): LooseRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => asRecord(item)).filter((item): item is LooseRecord => item !== null);
}


function parseScope(value: string | null): RefreshScope | null {
  if (value === 'watched' || value === 'all') {
    return value;
  }

  return null;
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = stripAccents(value.trim().toLowerCase());
    if (['1', 'true', 's', 'si', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'n', 'no'].includes(normalized)) return false;
  }

  return null;
}

function normalizeCharacteristicLabel(label: string): string {
  return stripAccents(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickMatchingPresentation(medicamento: LooseRecord, cn: string): LooseRecord | null {
  const presentations = asRecordArray(medicamento['presentaciones']);
  return presentations.find((presentation) => safeString(presentation['cn']) === cn) ?? null;
}

function pickActiveIngredient(medicamento: LooseRecord, presentation: LooseRecord | null): string | null {
  const direct = safeString(presentation?.['pactivos']) ?? safeString(medicamento['pactivos']);
  if (direct) {
    return direct;
  }

  const principles = asRecordArray(medicamento['principiosActivos']);
  const names = principles
    .map((principle) => safeString(principle['nombre']))
    .filter((value): value is string => Boolean(value));

  return names.length > 0 ? names.join(', ') : null;
}

function pickAtcCode(medicamento: LooseRecord): string | null {
  const atcs = asRecordArray(medicamento['atcs']);

  for (const atc of atcs) {
    const code = safeString(atc['codigo']);
    if (code) {
      return code;
    }
  }

  return null;
}

function pickDocumentUrls(medicamento: LooseRecord, presentation: LooseRecord | null) {
  const presentationDocs = asRecordArray(presentation?.['docs']);
  const medicineDocs = asRecordArray(medicamento['docs']);
  const docs = presentationDocs.length > 0 ? presentationDocs : medicineDocs;

  const technicalSheet = docs.find((document) => Number(document['tipo']) === 1) ?? null;
  const leaflet = docs.find((document) => Number(document['tipo']) === 2) ?? null;

  return {
    technicalSheetUrl: safeString(technicalSheet?.['url']),
    leafletUrl: safeString(leaflet?.['url']),
    leafletHtmlUrl: safeString(leaflet?.['urlHtml']),
    htmlUrl: safeString(technicalSheet?.['urlHtml']) ?? safeString(leaflet?.['urlHtml']),
    pdfUrl: safeString(technicalSheet?.['url']) ?? safeString(leaflet?.['url']),
  };
}

function normalizeCommercializationStatus(medicamento: LooseRecord, presentation: LooseRecord | null): string | null {
  const commercialized = normalizeBoolean(presentation?.['comerc']);
  if (commercialized === true) return 'COMERCIALIZADO';
  if (commercialized === false) return 'NO_COMERCIALIZADO';

  const medicineCommercialized = normalizeBoolean(medicamento['comerc']);
  if (medicineCommercialized === true) return 'COMERCIALIZADO';
  if (medicineCommercialized === false) return 'NO_COMERCIALIZADO';

  return null;
}

function normalizeSupplyStatus(medicamento: LooseRecord, presentation: LooseRecord | null): string | null {
  const hasSupplyIssue = normalizeBoolean(presentation?.['psum']);
  if (hasSupplyIssue === true) return 'Con problemas de suministro';
  if (hasSupplyIssue === false) return 'Sin problemas de suministro';

  const medicineSupplyIssue = normalizeBoolean(medicamento['psum']);
  if (medicineSupplyIssue === true) return 'Con problemas de suministro';
  if (medicineSupplyIssue === false) return 'Sin problemas de suministro';

  return null;
}

function readCharacteristicLabel(value: unknown): string | null {
  const direct = safeString(value);
  if (direct) {
    return normalizeWhitespace(direct);
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const candidate =
    safeString(record['label']) ??
    safeString(record['nombre']) ??
    safeString(record['descripcion']) ??
    safeString(record['description']) ??
    safeString(record['literal']) ??
    safeString(record['titulo']) ??
    safeString(record['title']) ??
    safeString(record['texto']) ??
    safeString(record['text']) ??
    safeString(record['caracteristica']) ??
    safeString(record['value']);

  return candidate ? normalizeWhitespace(candidate) : null;
}

function isDiscardableCharacteristicLabel(label: string): boolean {
  const normalized = stripAccents(label).toLowerCase().trim();
  return ['n/a', 'na', 'no aplica', 'ninguna', 'ninguno'].includes(normalized);
}

function addCharacteristic(
  target: Map<string, NormalizedCharacteristic>,
  label: string | null,
  rawPayload: string | null,
): void {
  if (!label || isDiscardableCharacteristicLabel(label)) {
    return;
  }

  const normalizedLabel = normalizeCharacteristicLabel(label);
  if (!normalizedLabel || target.has(normalizedLabel)) {
    return;
  }

  target.set(normalizedLabel, {
    label,
    normalizedLabel,
    sortOrder: target.size,
    rawPayload,
  });
}

function addCharacteristicsFromArray(
  target: Map<string, NormalizedCharacteristic>,
  source: unknown,
): void {
  if (!Array.isArray(source)) {
    return;
  }

  for (const item of source) {
    const label = readCharacteristicLabel(item);
    const rawPayload =
      item === null || item === undefined
        ? null
        : (() => {
            try {
              return JSON.stringify(item);
            } catch {
              return null;
            }
          })();

    addCharacteristic(target, label, rawPayload);
  }
}

function addCharacteristicsFromScalarKeys(
  target: Map<string, NormalizedCharacteristic>,
  sources: Array<LooseRecord | null>,
  keys: string[],
): void {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const label = readCharacteristicLabel(source[key]);
      if (!label) {
        continue;
      }

      let rawPayload: string | null = null;
      try {
        rawPayload = JSON.stringify({ source: 'scalar_key', key, value: source[key] });
      } catch {
        rawPayload = null;
      }

      addCharacteristic(target, label, rawPayload);
    }
  }
}

function pickFirstBooleanFromKeys(sources: Array<LooseRecord | null>, keys: string[]): boolean | null {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const value = normalizeBoolean(source[key]);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function extractCharacteristics(medicamento: LooseRecord, presentation: LooseRecord | null): NormalizedCharacteristic[] {
  const characteristics = new Map<string, NormalizedCharacteristic>();

  addCharacteristicsFromArray(characteristics, presentation?.['caracteristicas']);
  addCharacteristicsFromArray(characteristics, presentation?.['characteristics']);
  addCharacteristicsFromArray(characteristics, presentation?.['caracts']);
  addCharacteristicsFromArray(characteristics, medicamento['caracteristicas']);
  addCharacteristicsFromArray(characteristics, medicamento['characteristics']);
  addCharacteristicsFromArray(characteristics, medicamento['caracts']);

  addCharacteristicsFromScalarKeys(characteristics, [presentation, medicamento], [
    'cpresc',
    'condicionesPrescripcion',
    'condiciones_prescripcion',
    'prescriptionCategory',
    'dispensacion',
  ]);

  const presentationNoSubstitutable = asRecord(presentation?.['nosustituible']);
  const medicineNoSubstitutable = asRecord(medicamento['nosustituible']);
  const noSubstitutableName =
    safeString(presentationNoSubstitutable?.['nombre']) ?? safeString(medicineNoSubstitutable?.['nombre']);

  if (noSubstitutableName && !isDiscardableCharacteristicLabel(noSubstitutableName)) {
    addCharacteristic(
      characteristics,
      noSubstitutableName === 'No sustituible'
        ? noSubstitutableName
        : `No sustituible${noSubstitutableName ? ` (${noSubstitutableName})` : ''}`,
      JSON.stringify({ source: 'object_flag', key: 'nosustituible' }),
    );
  }

  const booleanCharacteristicDefinitions = [
    {
      label: 'Biosimilar',
      keys: ['biosimilar'],
    },
    {
      label: 'Estupefaciente',
      keys: ['estupefaciente', 'narcotico', 'narcotic'],
    },
    {
      label: 'Medicamento huérfano',
      keys: ['huerfano', 'huérfano', 'medicamentoHuerfano', 'medicamento_huerfano', 'orphanDrug'],
    },
    {
      label: 'Medicamento sujeto a prescripción médica',
      keys: [
        'requiereReceta',
        'requiere_receta',
        'conReceta',
        'con_receta',
        'prescriptionRequired',
        'prescription_required',
        'receta',
      ],
    },
    {
      label: 'Seguimiento adicional',
      keys: [
        'seguimientoAdicional',
        'seguimiento_adicional',
        'additionalMonitoring',
        'additional_monitoring',
        'trianguloNegro',
        'triangulo_negro',
        'triangulo',
        'blackTriangle',
        'black_triangle',
      ],
    },
    {
      label: 'Medicamento genérico',
      keys: ['generico', 'generic', 'esGenerico', 'es_generico'],
    },
  ] as const;

  for (const definition of booleanCharacteristicDefinitions) {
    const value = pickFirstBooleanFromKeys([presentation, medicamento], [...definition.keys]);
    if (value === true) {
      addCharacteristic(
        characteristics,
        definition.label,
        JSON.stringify({ source: 'boolean_flag', keys: definition.keys }),
      );
    }
  }

  return Array.from(characteristics.values()).map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function normalizeCimaPayload(medicamento: LooseRecord, cn: string): NormalizedCimaPayload {
  const presentation = pickMatchingPresentation(medicamento, cn);
  const docs = pickDocumentUrls(medicamento, presentation);
  const now = new Date();

  return {
    nationalCode: cn,
    officialName: safeString(presentation?.['nombre']) ?? safeString(medicamento['nombre']),
    activeIngredient: pickActiveIngredient(medicamento, presentation),
    atcCode: pickAtcCode(medicamento),
    laboratory: safeString(presentation?.['labtitular']) ?? safeString(medicamento['labtitular']),
    commercializationStatus: normalizeCommercializationStatus(medicamento, presentation),
    supplyStatus: normalizeSupplyStatus(medicamento, presentation),
    technicalSheetUrl: docs.technicalSheetUrl,
    leafletUrl: docs.leafletUrl,
    leafletHtmlUrl: docs.leafletHtmlUrl,
    htmlUrl: docs.htmlUrl,
    pdfUrl: docs.pdfUrl,
    rawPayload: JSON.stringify(medicamento),
    fetchedAt: now,
    updatedAt: now,
    characteristics: extractCharacteristics(medicamento, presentation),
  };
}

async function fetchMedicamentoByCn(cn: string): Promise<LooseRecord | null> {
  const url = new URL(`${CIMA_REST_BASE_URL}/medicamento`);
  url.searchParams.set('cn', cn);

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'orion-cima-catalogo/0.1 scheduled-job',
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`CIMA ${response.status} para CN ${cn}${body ? `: ${body.slice(0, 240)}` : ''}`);
  }

  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }

  const payload: unknown = JSON.parse(rawText);

  if (Array.isArray(payload)) {
    return asRecord(payload[0]) ?? null;
  }

  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    return null;
  }

  const resultados = asRecordArray(payloadRecord['resultados']);
  if (resultados.length > 0) {
    return resultados[0];
  }

  return payloadRecord;
}

async function ensureMedicineMasterRow(cn: string, preferredLabel: string | null, now: Date): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "medicines_master" (
        "nationalCode",
        "preferredLabel",
        "firstSeenAt",
        "lastSeenAt",
        "isCurrentlyActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${cn},
        ${preferredLabel},
        ${now},
        ${now},
        ${true},
        ${now},
        ${now}
      )
      ON CONFLICT("nationalCode") DO UPDATE SET
        "preferredLabel" = COALESCE(excluded."preferredLabel", "medicines_master"."preferredLabel"),
        "lastSeenAt" = ${now},
        "updatedAt" = ${now}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('no such table: medicines_master')) {
      return;
    }

    throw error;
  }
}

async function upsertCimaCacheRow(entry: NormalizedCimaPayload): Promise<void> {
  await ensureMedicineMasterRow(entry.nationalCode, entry.officialName, entry.updatedAt);

  await prisma.$executeRaw`
    INSERT INTO "cima_cache" (
      "nationalCode",
      "officialName",
      "activeIngredient",
      "atcCode",
      "laboratory",
      "commercializationStatus",
      "supplyStatus",
      "technicalSheetUrl",
      "leafletUrl",
      "leafletHtmlUrl",
      "htmlUrl",
      "pdfUrl",
      "rawPayload",
      "fetchedAt",
      "updatedAt"
    )
    VALUES (
      ${entry.nationalCode},
      ${entry.officialName},
      ${entry.activeIngredient},
      ${entry.atcCode},
      ${entry.laboratory},
      ${entry.commercializationStatus},
      ${entry.supplyStatus},
      ${entry.technicalSheetUrl},
      ${entry.leafletUrl},
      ${entry.leafletHtmlUrl},
      ${entry.htmlUrl},
      ${entry.pdfUrl},
      ${entry.rawPayload},
      ${entry.fetchedAt},
      ${entry.updatedAt}
    )
    ON CONFLICT("nationalCode") DO UPDATE SET
      "officialName" = excluded."officialName",
      "activeIngredient" = excluded."activeIngredient",
      "atcCode" = excluded."atcCode",
      "laboratory" = excluded."laboratory",
      "commercializationStatus" = excluded."commercializationStatus",
      "supplyStatus" = excluded."supplyStatus",
      "technicalSheetUrl" = excluded."technicalSheetUrl",
      "leafletUrl" = excluded."leafletUrl",
      "leafletHtmlUrl" = excluded."leafletHtmlUrl",
      "htmlUrl" = excluded."htmlUrl",
      "pdfUrl" = excluded."pdfUrl",
      "rawPayload" = excluded."rawPayload",
      "fetchedAt" = excluded."fetchedAt",
      "updatedAt" = excluded."updatedAt"
  `;

  await prisma.cimaCharacteristicCache.deleteMany({
    where: { nationalCode: entry.nationalCode },
  });

  if (entry.characteristics.length > 0) {
    await prisma.cimaCharacteristicCache.createMany({
      data: entry.characteristics.map((item) => ({
        nationalCode: entry.nationalCode,
        label: item.label,
        normalizedLabel: item.normalizedLabel,
        sortOrder: item.sortOrder,
        rawPayload: item.rawPayload,
      })),
    });
  }
}

async function resolveTargetCns(scope: RefreshScope, limit: number, offset: number): Promise<string[]> {
  if (scope === 'all') {
    const rows = await prisma.$queryRaw<Array<{ cn: string }>>`
      SELECT DISTINCT n.cn AS cn
      FROM nomenclator_products n
      WHERE n.cn IS NOT NULL AND LENGTH(TRIM(n.cn)) = 6
      ORDER BY n.cn ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return rows.map((row: { cn: string }) => row.cn);
  }

  const rows = await prisma.$queryRaw<Array<{ cn: string }>>`
    SELECT DISTINCT w.cn AS cn
    FROM watched_medicines w
    WHERE w.cn IS NOT NULL AND LENGTH(TRIM(w.cn)) = 6
    ORDER BY w.cn ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map((row: { cn: string }) => row.cn);
}

async function executeCimaCacheRefresh(input: {
  scope: RefreshScope;
  limit: number;
  offset: number;
  delayMs: number;
}): Promise<ScheduledJobExecutionResult> {
  const startedAt = Date.now();
  const targetCns = await resolveTargetCns(input.scope, input.limit, input.offset);

  const failures: Array<{ cn: string; message: string }> = [];
  let updated = 0;
  let notFound = 0;

  for (const cn of targetCns) {
    try {
      const medicamento = await fetchMedicamentoByCn(cn);

      if (!medicamento) {
        notFound += 1;
      } else {
        const entry = normalizeCimaPayload(medicamento, cn);
        await upsertCimaCacheRow(entry);
        updated += 1;
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
      scope: input.scope,
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
    const adminCheck = requireAdminApiKey(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const scope = parseScope(request.nextUrl.searchParams.get('scope')) ?? 'watched';
    const limit = parsePositiveInt(request.nextUrl.searchParams.get('limit'), scope === 'watched' ? 5000 : 1000);
    const offset = parsePositiveInt(request.nextUrl.searchParams.get('offset'), 0);
    const delayMs = parsePositiveInt(request.nextUrl.searchParams.get('delayMs'), 0);

    const jobName = scope === 'all' ? 'CIMA_CACHE_REFRESH_ALL' : 'CIMA_CACHE_REFRESH_WATCHED';

    const response = await runScheduledJob({
      jobName,
      triggerType: 'scheduled_http',
      requestedBy: request.headers.get('user-agent') ?? 'http',
      idempotencyKey: request.headers.get('x-idempotency-key'),
      handler: async () =>
        executeCimaCacheRefresh({
          scope,
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
        error: error instanceof Error ? error.message : 'Error inesperado al ejecutar el refresco de CIMA.',
      },
      { status: 500 },
    );
  }
}