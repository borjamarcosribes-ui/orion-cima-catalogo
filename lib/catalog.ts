import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type CatalogFilters = {
  q?: string;
  activeIngredient?: string;
  cn?: string;
  laboratory?: string;
  atc?: string;
  commercializationStatus?: string;
  includedInHospital?: 'SI' | 'NO';
  hospitalStatus?: string;
  bifimedFundingStatus?: string;
  page?: number;
  pageSize?: number;
};

export type CatalogListItem = {
  cn: string;
  displayName: string;
  officialName: string | null;
  presentation: string;
  activeIngredient: string | null;
  laboratory: string | null;
  atcCode: string | null;
  commercializationStatus: string;
  includedInHospital: boolean;
  hospitalStatusOriginal: string | null;
  hospitalDescription: string | null;
  bifimedFundingStatus: string | null;
  bifimedSummary: string | null;
};

export type CatalogListResult = {
  rows: CatalogListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CatalogDetail = {
  cn: string;
  officialName: string | null;
  presentation: string;
  activeIngredient: string | null;
  laboratory: string | null;
  atcCode: string | null;
  codDcp: string;
  commercializationStatus: string;
  supplyStatus: string | null;
  includedInHospital: boolean;
  hospitalStatusOriginal: string | null;
  orionCode: string | null;
  localDescription: string | null;
  lastDetectedAt: string | null;
  lastImportedAt: string | null;
  bifimedFundingStatus: string | null;
  bifimedSummary: string | null;
  bifimedModality: string | null;
  bifimedRestrictedConditions: string | null;
  bifimedSpecialFundingConditions: string | null;
  bifimedNomenclatorState: string | null;
  bifimedIndications: Array<{
    authorizedIndication: string;
    indicationFileStatus: string | null;
    indicationFundingResolution: string | null;
  }>;
  technicalSheetUrl: string | null;
  leafletUrl: string | null;
  leafletHtmlUrl: string | null;
  docsHtmlUrl: string | null;
  docsPdfUrl: string | null;
  cimaCharacteristics: Array<{
    label: string;
    normalizedLabel: string;
  }>;
};

type CatalogSqlRow = {
  cn: string;
  displayName: string | null;
  officialName: string | null;
  presentation: string;
  activeIngredient: string | null;
  laboratory: string | null;
  atcCode: string | null;
  commercializationStatus: string;
  watchedCn: string | null;
  statusOriginal: string | null;
  shortDescription: string | null;
  fundingStatus: string | null;
  summary: string | null;
};

function normalizePage(input?: number): number {
  if (!input || Number.isNaN(input) || input < 1) {
    return 1;
  }

  return Math.trunc(input);
}

function normalizePageSize(input?: number): number {
  if (!input || Number.isNaN(input) || input < 1) {
    return 24;
  }

  return Math.min(Math.trunc(input), 60);
}

function toLike(value: string): string {
  return `%${value.trim().toLowerCase()}%`;
}

function pushLikeClause(clauses: any[], sqlField: any, value?: string): void {
  if (!value || value.trim().length === 0) {
    return;
  }

  clauses.push(Prisma.sql`LOWER(${sqlField}) LIKE ${toLike(value)}`);
}

function buildCatalogWhere(filters: CatalogFilters): any {
  const clauses: any[] = [];

  if (filters.q && filters.q.trim().length > 0) {
    const likeValue = toLike(filters.q);
    clauses.push(
      Prisma.sql`(
        LOWER(n.cn) LIKE ${likeValue}
        OR LOWER(COALESCE(c.officialName, n.officialName, n.presentation)) LIKE ${likeValue}
        OR LOWER(n.presentation) LIKE ${likeValue}
        OR LOWER(COALESCE(w.shortDescription, '')) LIKE ${likeValue}
      )`,
    );
  }

  pushLikeClause(clauses, Prisma.sql`n.cn`, filters.cn);
  pushLikeClause(
    clauses,
    Prisma.sql`COALESCE(c.activeIngredient, '')`,
    filters.activeIngredient,
  );
  pushLikeClause(
    clauses,
    Prisma.sql`COALESCE(c.laboratory, '')`,
    filters.laboratory,
  );
  pushLikeClause(clauses, Prisma.sql`COALESCE(c.atcCode, '')`, filters.atc);

  if (
    filters.commercializationStatus &&
    filters.commercializationStatus.trim().length > 0
  ) {
    clauses.push(
      Prisma.sql`n.commercializationStatus = ${filters.commercializationStatus}`,
    );
  }

  if (filters.includedInHospital === 'SI') {
    clauses.push(Prisma.sql`w.cn IS NOT NULL`);
  }

  if (filters.includedInHospital === 'NO') {
    clauses.push(Prisma.sql`w.cn IS NULL`);
  }

  if (filters.includedInHospital === 'SI') {
    switch (filters.hospitalStatus) {
      case 'ACTIVO':
        clauses.push(
          Prisma.sql`LOWER(TRIM(COALESCE(w.statusOriginal, ''))) = 'activo'`,
        );
        break;
      case 'INACTIVO':
        clauses.push(
          Prisma.sql`LOWER(TRIM(COALESCE(w.statusOriginal, ''))) = 'inactivo'`,
        );
        break;
      case 'LAB':
        clauses.push(
          Prisma.sql`LOWER(TRIM(COALESCE(w.statusOriginal, ''))) = 'lab'`,
        );
        break;
      case 'OTROS':
        clauses.push(
          Prisma.sql`(
            TRIM(COALESCE(w.statusOriginal, '')) <> ''
            AND LOWER(TRIM(COALESCE(w.statusOriginal, ''))) NOT IN ('activo', 'inactivo', 'lab')
          )`,
        );
        break;
      default:
        break;
    }
  }

  if (
    filters.bifimedFundingStatus &&
    filters.bifimedFundingStatus.trim().length > 0
  ) {
    clauses.push(Prisma.sql`b.fundingStatus = ${filters.bifimedFundingStatus}`);
  }

  if (clauses.length === 0) {
    return Prisma.sql`1 = 1`;
  }

  return Prisma.join(clauses, ' AND ');
}

export async function listCatalogByCn(
  filters: CatalogFilters,
): Promise<CatalogListResult> {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;
  const whereClause = buildCatalogWhere(filters);

  const rows = await prisma.$queryRaw<CatalogSqlRow[]>`
    SELECT
      n.cn,
      COALESCE(c.officialName, n.officialName, n.presentation) AS displayName,
      c.officialName,
      n.presentation,
      c.activeIngredient,
      c.laboratory,
      c.atcCode,
      n.commercializationStatus,
      w.cn AS "watchedCn",
      w.statusOriginal,
      w.shortDescription,
      b.fundingStatus,
      b.summary
    FROM nomenclator_products n
    LEFT JOIN cima_cache c ON c.nationalCode = n.cn
    LEFT JOIN watched_medicines w ON w.cn = n.cn
    LEFT JOIN bifimed_cache b ON b.cn = n.cn
    WHERE ${whereClause}
    ORDER BY n.cn ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*) as total
    FROM nomenclator_products n
    LEFT JOIN cima_cache c ON c.nationalCode = n.cn
    LEFT JOIN watched_medicines w ON w.cn = n.cn
    LEFT JOIN bifimed_cache b ON b.cn = n.cn
    WHERE ${whereClause}
  `;

  return {
    rows: rows.map((row) => ({
      cn: row.cn,
      displayName: row.displayName ?? row.presentation,
      officialName: row.officialName,
      presentation: row.presentation,
      activeIngredient: row.activeIngredient,
      laboratory: row.laboratory,
      atcCode: row.atcCode,
      commercializationStatus: row.commercializationStatus,
      includedInHospital: Boolean(row.watchedCn),
      hospitalStatusOriginal: row.statusOriginal,
      hospitalDescription: row.shortDescription,
      bifimedFundingStatus: row.fundingStatus,
      bifimedSummary: row.summary,
    })),
    total: Number(countResult[0]?.total ?? 0),
    page,
    pageSize,
  };
}

function normalizeIso(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }

  return date.toISOString();
}

export async function getCatalogDetailByCn(
  cn: string,
): Promise<CatalogDetail | null> {
  const normalizedCn = cn.trim();
  if (!/^\d{6}$/.test(normalizedCn)) {
    return null;
  }

  const [
    nomenclator,
    cima,
    watched,
    lastImport,
    bifimed,
    bifimedIndications,
    cimaCharacteristics,
  ] = await Promise.all([
    prisma.nomenclatorProduct.findUnique({
      where: { cn: normalizedCn },
    }),
    prisma.cimaCache.findUnique({
      where: { nationalCode: normalizedCn },
    }),
    prisma.watchedMedicine.findUnique({
      where: { cn: normalizedCn },
    }),
    prisma.tsvImport.findFirst({
      where: { watchedRows: { some: { cn: normalizedCn } } },
      orderBy: { importedAt: 'desc' },
      select: { importedAt: true },
    }),
    prisma.bifimedCache.findUnique({
      where: { cn: normalizedCn },
    }),
    prisma.bifimedIndicationCache.findMany({
      where: { cn: normalizedCn },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.cimaCharacteristicCache.findMany({
      where: { nationalCode: normalizedCn },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!nomenclator) {
    return null;
  }

  return {
    cn: nomenclator.cn,
    officialName:
      cima?.officialName ?? nomenclator.officialName ?? nomenclator.presentation,
    presentation: nomenclator.presentation,
    activeIngredient: cima?.activeIngredient ?? null,
    laboratory: cima?.laboratory ?? null,
    atcCode: cima?.atcCode ?? null,
    codDcp: nomenclator.codDcp,
    commercializationStatus: nomenclator.commercializationStatus,
    supplyStatus: cima?.supplyStatus ?? null,
    includedInHospital: Boolean(watched),
    hospitalStatusOriginal: watched?.statusOriginal ?? null,
    orionCode: watched?.articleCode ?? null,
    localDescription: watched?.shortDescription ?? null,
    lastDetectedAt: normalizeIso(watched?.lastSeenAt),
    lastImportedAt: normalizeIso(lastImport?.importedAt),
    bifimedFundingStatus: bifimed?.fundingStatus ?? null,
    bifimedSummary: bifimed?.summary ?? null,
    bifimedModality: bifimed?.fundingModality ?? null,
    bifimedRestrictedConditions: bifimed?.restrictedConditions ?? null,
    bifimedSpecialFundingConditions: bifimed?.specialFundingConditions ?? null,
    bifimedNomenclatorState: bifimed?.nomenclatorState ?? null,
    bifimedIndications: bifimedIndications.map((item) => ({
      authorizedIndication: item.authorizedIndication,
      indicationFileStatus: item.indicationFileStatus ?? null,
      indicationFundingResolution: item.indicationFundingResolution ?? null,
    })),
    technicalSheetUrl: cima?.technicalSheetUrl ?? null,
    leafletUrl: cima?.leafletUrl ?? null,
    leafletHtmlUrl: cima?.leafletHtmlUrl ?? null,
    docsHtmlUrl: cima?.htmlUrl ?? null,
    docsPdfUrl: cima?.pdfUrl ?? null,
    cimaCharacteristics: cimaCharacteristics.map((item) => ({
      label: item.label,
      normalizedLabel: item.normalizedLabel,
    })),
  };
}