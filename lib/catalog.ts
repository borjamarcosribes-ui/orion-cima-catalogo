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

type CatalogBaseRow = {
  cn: string;
  codDcp: string;
  presentation: string;
  officialName: string | null;
  commercializationStatus: string;
};

type CatalogCimaRow = {
  nationalCode: string;
  officialName: string | null;
  activeIngredient: string | null;
  laboratory: string | null;
  atcCode: string | null;
  commercializationStatus: string | null;
  supplyStatus: string | null;
  technicalSheetUrl: string | null;
  leafletUrl: string | null;
  leafletHtmlUrl: string | null;
  htmlUrl: string | null;
  pdfUrl: string | null;
};

type CatalogWatchedRow = {
  cn: string;
  articleCode: string;
  shortDescription: string;
  statusOriginal: string;
  lastSeenAt: Date;
};

type CatalogBifimedRow = {
  cn: string;
  fundingStatus: string;
  fundingModality: string | null;
  summary: string | null;
  restrictedConditions: string | null;
  specialFundingConditions: string | null;
  nomenclatorState: string | null;
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

function normalizeIso(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }

  return date.toISOString();
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function includesSearch(
  haystack: string | null | undefined,
  needle?: string,
): boolean {
  if (!needle || needle.trim().length === 0) {
    return true;
  }

  return normalizeSearchValue(haystack).includes(normalizeSearchValue(needle));
}

function matchesHospitalStatus(
  statusOriginal: string | null,
  requestedStatus?: string,
): boolean {
  if (!requestedStatus || requestedStatus.trim().length === 0) {
    return true;
  }

  const normalized = normalizeSearchValue(statusOriginal);

  switch (requestedStatus) {
    case 'ACTIVO':
      return normalized === 'activo';
    case 'INACTIVO':
      return normalized === 'inactivo';
    case 'LAB':
      return normalized === 'lab';
    case 'OTROS':
      return (
        normalized.length > 0 &&
        !['activo', 'inactivo', 'lab'].includes(normalized)
      );
    default:
      return true;
  }
}

export async function listCatalogByCn(
  filters: CatalogFilters,
): Promise<CatalogListResult> {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);

  const [nomenclatorRows, cimaRows, watchedRows, bifimedRows] =
    await Promise.all([
      prisma.nomenclatorProduct.findMany({
        select: {
          cn: true,
          codDcp: true,
          presentation: true,
          officialName: true,
          commercializationStatus: true,
        },
        orderBy: { cn: 'asc' },
      }),
      prisma.cimaCache.findMany({
        select: {
          nationalCode: true,
          officialName: true,
          activeIngredient: true,
          laboratory: true,
          atcCode: true,
          commercializationStatus: true,
          supplyStatus: true,
          technicalSheetUrl: true,
          leafletUrl: true,
          leafletHtmlUrl: true,
          htmlUrl: true,
          pdfUrl: true,
        },
      }),
      prisma.watchedMedicine.findMany({
        select: {
          cn: true,
          articleCode: true,
          shortDescription: true,
          statusOriginal: true,
          lastSeenAt: true,
        },
      }),
      prisma.bifimedCache.findMany({
        select: {
          cn: true,
          fundingStatus: true,
          fundingModality: true,
          summary: true,
          restrictedConditions: true,
          specialFundingConditions: true,
          nomenclatorState: true,
        },
      }),
    ]);

  const cimaByCn = new Map<string, CatalogCimaRow>(
    cimaRows.map((row: CatalogCimaRow) => [row.nationalCode, row] as const),
  );

  const watchedByCn = new Map<string, CatalogWatchedRow>(
    watchedRows.map((row: CatalogWatchedRow) => [row.cn, row] as const),
  );

  const bifimedByCn = new Map<string, CatalogBifimedRow>(
    bifimedRows.map((row: CatalogBifimedRow) => [row.cn, row] as const),
  );

  const mergedRows: CatalogListItem[] = nomenclatorRows.map(
    (row: CatalogBaseRow) => {
      const cima = cimaByCn.get(row.cn) ?? null;
      const watched = watchedByCn.get(row.cn) ?? null;
      const bifimed = bifimedByCn.get(row.cn) ?? null;

      return {
        cn: row.cn,
        displayName:
          cima?.officialName ?? row.officialName ?? row.presentation,
        officialName: cima?.officialName ?? row.officialName,
        presentation: row.presentation,
        activeIngredient: cima?.activeIngredient ?? null,
        laboratory: cima?.laboratory ?? null,
        atcCode: cima?.atcCode ?? null,
        commercializationStatus:
          cima?.commercializationStatus ?? row.commercializationStatus,
        includedInHospital: Boolean(watched),
        hospitalStatusOriginal: watched?.statusOriginal ?? null,
        hospitalDescription: watched?.shortDescription ?? null,
        bifimedFundingStatus: bifimed?.fundingStatus ?? null,
        bifimedSummary: bifimed?.summary ?? null,
      };
    },
  );

  const filteredRows = mergedRows.filter((row: CatalogListItem) => {
    if (
      filters.commercializationStatus &&
      filters.commercializationStatus.trim().length > 0 &&
      row.commercializationStatus !== filters.commercializationStatus
    ) {
      return false;
    }

    if (filters.includedInHospital === 'SI' && !row.includedInHospital) {
      return false;
    }

    if (filters.includedInHospital === 'NO' && row.includedInHospital) {
      return false;
    }

    if (
      filters.includedInHospital === 'SI' &&
      !matchesHospitalStatus(
        row.hospitalStatusOriginal,
        filters.hospitalStatus,
      )
    ) {
      return false;
    }

    if (
      filters.bifimedFundingStatus &&
      filters.bifimedFundingStatus.trim().length > 0 &&
      row.bifimedFundingStatus !== filters.bifimedFundingStatus
    ) {
      return false;
    }

    if (!includesSearch(row.cn, filters.cn)) {
      return false;
    }

    if (!includesSearch(row.activeIngredient, filters.activeIngredient)) {
      return false;
    }

    if (!includesSearch(row.laboratory, filters.laboratory)) {
      return false;
    }

    if (!includesSearch(row.atcCode, filters.atc)) {
      return false;
    }

    if (filters.q && filters.q.trim().length > 0) {
      const q = filters.q;
      const matchesQ =
        includesSearch(row.cn, q) ||
        includesSearch(row.displayName, q) ||
        includesSearch(row.officialName, q) ||
        includesSearch(row.presentation, q) ||
        includesSearch(row.hospitalDescription, q);

      if (!matchesQ) {
        return false;
      }
    }

    return true;
  });

  filteredRows.sort((left: CatalogListItem, right: CatalogListItem) =>
    left.cn.localeCompare(right.cn),
  );

  const total = filteredRows.length;
  const offset = (page - 1) * pageSize;
  const rows = filteredRows.slice(offset, offset + pageSize);

  return {
    rows,
    total,
    page,
    pageSize,
  };
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
      cima?.officialName ??
      nomenclator.officialName ??
      nomenclator.presentation,
    presentation: nomenclator.presentation,
    activeIngredient: cima?.activeIngredient ?? null,
    laboratory: cima?.laboratory ?? null,
    atcCode: cima?.atcCode ?? null,
    codDcp: nomenclator.codDcp,
    commercializationStatus:
      cima?.commercializationStatus ?? nomenclator.commercializationStatus,
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
    bifimedSpecialFundingConditions:
      bifimed?.specialFundingConditions ?? null,
    bifimedNomenclatorState: bifimed?.nomenclatorState ?? null,
    bifimedIndications: bifimedIndications.map(
      (item: {
        authorizedIndication: string;
        indicationFileStatus: string | null;
        indicationFundingResolution: string | null;
      }) => ({
        authorizedIndication: item.authorizedIndication,
        indicationFileStatus: item.indicationFileStatus ?? null,
        indicationFundingResolution:
          item.indicationFundingResolution ?? null,
      }),
    ),
    technicalSheetUrl: cima?.technicalSheetUrl ?? null,
    leafletUrl: cima?.leafletUrl ?? null,
    leafletHtmlUrl: cima?.leafletHtmlUrl ?? null,
    docsHtmlUrl: cima?.htmlUrl ?? null,
    docsPdfUrl: cima?.pdfUrl ?? null,
    cimaCharacteristics: cimaCharacteristics.map(
      (item: { label: string; normalizedLabel: string }) => ({
        label: item.label,
        normalizedLabel: item.normalizedLabel,
      }),
    ),
  };
}