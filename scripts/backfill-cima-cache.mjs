import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SCOPE = 'watched';
const DEFAULT_LIMIT = 250;
const DEFAULT_OFFSET = 0;
const DEFAULT_DELAY_MS = 0;
const CIMA_REST_BASE_URL = process.env.CIMA_REST_BASE_URL?.trim() || 'https://cima.aemps.es/cima/rest';

function parseArgs(argv) {
  const parsed = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const body = arg.slice(2);
    const separatorIndex = body.indexOf('=');

    if (separatorIndex === -1) {
      parsed[body] = 'true';
      continue;
    }

    const key = body.slice(0, separatorIndex);
    const value = body.slice(separatorIndex + 1);
    parsed[key] = value;
  }

  return parsed;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') return true;
    if (normalized === '0' || normalized === 'false') return false;
  }

  return null;
}

function pickMatchingPresentation(medicamento, cn) {
  const presentations = Array.isArray(medicamento?.presentaciones) ? medicamento.presentaciones : [];
  return presentations.find((presentation) => safeString(presentation?.cn) === cn) ?? null;
}

function pickActiveIngredient(medicamento, presentation) {
  const direct = safeString(presentation?.pactivos) ?? safeString(medicamento?.pactivos);
  if (direct) {
    return direct;
  }

  const principles = Array.isArray(medicamento?.principiosActivos) ? medicamento.principiosActivos : [];
  const names = principles
    .map((principle) => safeString(principle?.nombre))
    .filter((value) => Boolean(value));

  return names.length > 0 ? names.join(', ') : null;
}

function pickAtcCode(medicamento) {
  const atcs = Array.isArray(medicamento?.atcs) ? medicamento.atcs : [];
  for (const atc of atcs) {
    const code = safeString(atc?.codigo);
    if (code) {
      return code;
    }
  }

  return null;
}

function pickDocumentUrls(medicamento, presentation) {
  const docs =
    Array.isArray(presentation?.docs) && presentation.docs.length > 0
      ? presentation.docs
      : Array.isArray(medicamento?.docs)
        ? medicamento.docs
        : [];

  const technicalSheet = docs.find((document) => Number(document?.tipo) === 1) ?? null;
  const leaflet = docs.find((document) => Number(document?.tipo) === 2) ?? null;
  const preferredHtml = safeString(technicalSheet?.urlHtml) ?? safeString(leaflet?.urlHtml);
  const preferredPdf = safeString(technicalSheet?.url) ?? safeString(leaflet?.url);

  return {
    technicalSheetUrl: safeString(technicalSheet?.url),
    leafletUrl: safeString(leaflet?.url),
    htmlUrl: preferredHtml,
    pdfUrl: preferredPdf,
  };
}

function normalizeCommercializationStatus(medicamento, presentation) {
  const commercialized = normalizeBoolean(presentation?.comerc);
  if (commercialized === true) return 'COMERCIALIZADO';
  if (commercialized === false) return 'NO_COMERCIALIZADO';

  const medicineCommercialized = normalizeBoolean(medicamento?.comerc);
  if (medicineCommercialized === true) return 'COMERCIALIZADO';
  if (medicineCommercialized === false) return 'NO_COMERCIALIZADO';

  return null;
}

function normalizeSupplyStatus(medicamento, presentation) {
  const hasSupplyIssue = normalizeBoolean(presentation?.psum);
  if (hasSupplyIssue === true) return 'Con problemas de suministro';
  if (hasSupplyIssue === false) return 'Sin problemas de suministro';

  const medicineSupplyIssue = normalizeBoolean(medicamento?.psum);
  if (medicineSupplyIssue === true) return 'Con problemas de suministro';
  if (medicineSupplyIssue === false) return 'Sin problemas de suministro';

  return null;
}

function normalizeCimaPayload(medicamento, cn) {
  const presentation = pickMatchingPresentation(medicamento, cn);
  const docs = pickDocumentUrls(medicamento, presentation);
  const now = new Date();

  return {
    nationalCode: cn,
    officialName: safeString(presentation?.nombre) ?? safeString(medicamento?.nombre),
    activeIngredient: pickActiveIngredient(medicamento, presentation),
    atcCode: pickAtcCode(medicamento),
    laboratory: safeString(presentation?.labtitular) ?? safeString(medicamento?.labtitular),
    commercializationStatus: normalizeCommercializationStatus(medicamento, presentation),
    supplyStatus: normalizeSupplyStatus(medicamento, presentation),
    technicalSheetUrl: docs.technicalSheetUrl,
    leafletUrl: docs.leafletUrl,
    htmlUrl: docs.htmlUrl,
    pdfUrl: docs.pdfUrl,
    rawPayload: JSON.stringify(medicamento),
    fetchedAt: now,
    updatedAt: now,
  };
}

async function fetchMedicamentoByCn(cn) {
  const url = new URL(`${CIMA_REST_BASE_URL}/medicamento`);
  url.searchParams.set('cn', cn);

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'orion-cima-catalogo/0.1 local-backfill',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`CIMA ${response.status} para CN ${cn}${body ? `: ${body.slice(0, 240)}` : ''}`);
  }

  const payload = await response.json();

  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  if (Array.isArray(payload?.resultados)) {
    return payload.resultados[0] ?? null;
  }

  return payload ?? null;
}

async function ensureMedicineMasterRow(cn, preferredLabel, now) {
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

async function upsertCimaCacheRow(entry) {
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
      "htmlUrl" = excluded."htmlUrl",
      "pdfUrl" = excluded."pdfUrl",
      "rawPayload" = excluded."rawPayload",
      "fetchedAt" = excluded."fetchedAt",
      "updatedAt" = excluded."updatedAt"
  `;
}

async function resolveTargetCns(options) {
  if (options.cns.length > 0) {
    return options.cns;
  }

  if (options.scope === 'all') {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT n.cn AS cn
      FROM nomenclator_products n
      WHERE n.cn IS NOT NULL AND LENGTH(TRIM(n.cn)) = 6
      ORDER BY n.cn ASC
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `;

    return rows.map((row) => row.cn);
  }

  const rows = await prisma.$queryRaw`
    SELECT DISTINCT w.cn AS cn
    FROM watched_medicines w
    WHERE w.cn IS NOT NULL AND LENGTH(TRIM(w.cn)) = 6
    ORDER BY w.cn ASC
    LIMIT ${options.limit}
    OFFSET ${options.offset}
  `;

  return rows.map((row) => row.cn);
}

async function backfillCimaCache(options) {
  const targetCns = await resolveTargetCns(options);

  const summary = {
    scope: options.cns.length > 0 ? 'explicit' : options.scope,
    totalTargets: targetCns.length,
    updated: 0,
    notFound: 0,
    failed: 0,
    failures: [],
  };

  for (const cn of targetCns) {
    try {
      const medicamento = await fetchMedicamentoByCn(cn);

      if (!medicamento) {
        summary.notFound += 1;
        console.log(`[CIMA] ${cn} -> no encontrado`);
      } else {
        const entry = normalizeCimaPayload(medicamento, cn);
        await upsertCimaCacheRow(entry);
        summary.updated += 1;
        console.log(`[CIMA] ${cn} -> cache actualizado`);
      }
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      summary.failures.push({ cn, message });
      console.error(`[CIMA] ${cn} -> ERROR: ${message}`);
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const explicitCns = safeString(args.cn)
    ? args.cn
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^\d{6}$/.test(value))
    : [];

  const scope = safeString(args.scope) === 'all' ? 'all' : DEFAULT_SCOPE;
  const options = {
    scope,
    limit: toPositiveInt(args.limit, DEFAULT_LIMIT),
    offset: toPositiveInt(args.offset, DEFAULT_OFFSET),
    delayMs: toPositiveInt(args.delay, DEFAULT_DELAY_MS),
    cns: explicitCns,
  };

  console.log('Backfill CIMA iniciado con opciones:', options);
  console.log('Base URL CIMA:', CIMA_REST_BASE_URL);

  const summary = await backfillCimaCache(options);

  console.log('\nResumen final');
  console.table({
    scope: summary.scope,
    totalTargets: summary.totalTargets,
    updated: summary.updated,
    notFound: summary.notFound,
    failed: summary.failed,
  });

  if (summary.failures.length > 0) {
    console.log('\nFallos (primeros 20)');
    console.table(summary.failures.slice(0, 20));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });