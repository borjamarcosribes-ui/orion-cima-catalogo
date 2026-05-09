const CIMA_BASE_URL = 'https://cima.aemps.es/cima/rest';

type CimaSupplyApiResponse = {
  cn?: unknown;
  nombre?: unknown;
  tipoProblemaSuministro?: unknown;
  fini?: unknown;
  ffin?: unknown;
  activo?: unknown;
  observ?: unknown;
  comerc?: unknown;
};

export type NormalizedSupplyStatus = {
  cn: string;
  foundInCima: boolean;
  hasActiveSupplyIssue: boolean;
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  resolvedAt: string | null;
  observations: string | null;
  rawPayload: string;
};

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  return null;
}

function normalizeEpochToIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim();

    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
      }
    }

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  return null;
}

export async function fetchSupplyStatusByCn(cn: string): Promise<NormalizedSupplyStatus> {
  const response = await fetch(`${CIMA_BASE_URL}/psuministro/v2/cn/${encodeURIComponent(cn)}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return {
      cn,
      foundInCima: false,
      hasActiveSupplyIssue: false,
      issueType: null,
      startedAt: null,
      expectedEndAt: null,
      resolvedAt: null,
      observations: 'CN no reconocido por CIMA',
      rawPayload: JSON.stringify({ error: 'CN_NOT_FOUND_IN_CIMA', cn }),
    };
  }

  if (!response.ok) {
    throw new Error(`CIMA devolvió ${response.status} al consultar suministro para CN ${cn}.`);
  }

  const payload = (await response.json()) as CimaSupplyApiResponse;
  const isActive = normalizeBoolean(payload.activo) === true;
  const expectedEndAt = normalizeEpochToIso(payload.ffin);

  return {
    cn: normalizeText(payload.cn) ?? cn,
    foundInCima: true,
    hasActiveSupplyIssue: isActive,
    issueType:
      payload.tipoProblemaSuministro === null || payload.tipoProblemaSuministro === undefined
        ? null
        : String(payload.tipoProblemaSuministro),
    startedAt: normalizeEpochToIso(payload.fini),
    expectedEndAt,
    resolvedAt: isActive ? null : expectedEndAt,
    observations: normalizeText(payload.observ),
    rawPayload: JSON.stringify(payload),
  };
}