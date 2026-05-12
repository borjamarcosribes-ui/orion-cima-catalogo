import { fetchSupplyStatusByCn } from '@/lib/cima-supply';
import {
  getNomenclatorProductByCn,
  listNomenclatorAlternativesByCodDcp,
  type AlternativeCommercializationStatus,
} from '@/lib/nomenclator';
import { prisma } from '@/lib/prisma';

export type HospitalPresenceStatus = 'ACTIVO' | 'LAB' | 'INACTIVO' | 'OTRO' | 'NO_PRESENTE';
export type SupplyIssueAvailability = 'CON_ROTURA' | 'SIN_ROTURA' | 'DESCONOCIDO';

function mapSupplyPriority(status: SupplyIssueAvailability): 1 | 2 | 3 {
  switch (status) {
    case 'SIN_ROTURA':
      return 1;
    case 'DESCONOCIDO':
      return 2;
    case 'CON_ROTURA':
    default:
      return 3;
  }
}

export type SupplyIssueAlternativeContext = {
  cn: string;
  shortDescription: string;
  localStatus: 'ACTIVO' | 'LAB';
  issueType: string | null;
  startedAt: string | null;
  expectedEndAt: string | null;
  observations: string | null;
  codDcp: string | null;
};

export type MedicineAlternative = {
  cn: string;
  codDcp: string;
  presentation: string;
  officialName: string | null;
  commercializationStatus: AlternativeCommercializationStatus;
  supplyStatus: SupplyIssueAvailability;
  hasActiveSupplyIssue: boolean | null;
  supplyStartedAt: string | null;
  supplyExpectedEndAt: string | null;
  supplyObservations: string | null;
  inHospital: boolean;
  hospitalStatusOriginal: string | null;
  hospitalStatusNormalized: string | null;
  hospitalPresenceStatus: HospitalPresenceStatus;
  hospitalPriority: 1 | 2 | 3 | 4 | 5;
  isUnitDose: boolean | null;
  unitDoseRaw: string | null;
};

export type MedicineAlternativesResult = {
  sourceMedicine: SupplyIssueAlternativeContext;
  alternatives: MedicineAlternative[];
  limitations: {
    hospitalSource: 'watched_medicines_by_cn';
    hospitalCoverage: 'proxy_mvp_not_full_orion_catalog';
    cimaStrategy: 'per_cn_tolerant_failures';
  };
};

export type GetMedicineAlternativesInput = {
  cn: string;
};

export type GetMedicineAlternativesErrorCode =
  | 'EMPTY_CN'
  | 'SOURCE_NOT_FOUND'
  | 'NOMENCLATOR_NOT_FOUND'
  | 'NO_ALTERNATIVES_FOUND'
  | 'UNEXPECTED_ERROR';

export type GetMedicineAlternativesOutput =
  | {
      ok: true;
      data: MedicineAlternativesResult;
    }
  | {
      ok: false;
      code: GetMedicineAlternativesErrorCode;
      message: string;
    };

type AlternativeSupplyLookupResult = {
  cn: string;
  supplyStatus: SupplyIssueAvailability;
  hasActiveSupplyIssue: boolean | null;
  supplyStartedAt: string | null;
  supplyExpectedEndAt: string | null;
  supplyObservations: string | null;
};

type UnitDoseState = {
  cn: string;
  isUnitDose: boolean;
  unitDoseRaw: string | null;
};

type LocalHospitalState = {
  cn: string;
  statusOriginal: string | null;
  statusNormalized: string | null;
};

function mapHospitalPresenceStatus(statusNormalized: string | null): HospitalPresenceStatus {
  switch (statusNormalized) {
    case 'ACTIVO':
      return 'ACTIVO';
    case 'LAB':
      return 'LAB';
    case 'INACTIVO':
      return 'INACTIVO';
    case null:
      return 'NO_PRESENTE';
    default:
      return 'OTRO';
  }
}

function mapHospitalPriority(status: HospitalPresenceStatus): 1 | 2 | 3 | 4 | 5 {
  switch (status) {
    case 'ACTIVO':
      return 1;
    case 'LAB':
      return 2;
    case 'INACTIVO':
      return 3;
    case 'OTRO':
      return 4;
    case 'NO_PRESENTE':
    default:
      return 5;
  }
}

async function getSourceMedicineContext(cn: string, codDcp: string | null): Promise<SupplyIssueAlternativeContext | null> {
  const row = await prisma.supplyStatus.findUnique({
    where: { cn },
    select: {
      cn: true,
      issueType: true,
      startedAt: true,
      expectedEndAt: true,
      observations: true,
      watchedMedicine: {
        select: {
          shortDescription: true,
          statusNormalized: true,
        },
      },
    },
  });

  if (
    !row ||
    !row.watchedMedicine ||
    (row.watchedMedicine.statusNormalized !== 'ACTIVO' && row.watchedMedicine.statusNormalized !== 'LAB')
  ) {
    return null;
  }

  return {
    cn: row.cn,
    shortDescription: row.watchedMedicine.shortDescription,
    localStatus: row.watchedMedicine.statusNormalized,
    issueType: row.issueType,
    startedAt: row.startedAt?.toISOString() ?? null,
    expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
    observations: row.observations,
    codDcp,
  };
}

async function loadUnitDoseStateByCn(cns: string[]): Promise<Map<string, UnitDoseState>> {
  const rows = await prisma.unitDoseCache.findMany({
    where: {
      cn: {
        in: cns,
      },
    },
    select: {
      cn: true,
      isUnitDose: true,
      unitDoseRaw: true,
    },
  });

  return new Map(rows.map((row: UnitDoseState) => [row.cn, row]));
}

async function loadLocalHospitalStateByCn(cns: string[]): Promise<Map<string, LocalHospitalState>> {
  const rows = await prisma.watchedMedicine.findMany({
    where: {
      cn: {
        in: cns,
      },
    },
    select: {
      cn: true,
      statusOriginal: true,
      statusNormalized: true,
    },
  });

  return new Map(rows.map((row: LocalHospitalState) => [row.cn, row]));
}

async function lookupSupplyStatusesWithConcurrency(
  cns: string[],
  batchSize = 5,
): Promise<Map<string, AlternativeSupplyLookupResult>> {
  const results = new Map<string, AlternativeSupplyLookupResult>();

  for (let index = 0; index < cns.length; index += batchSize) {
    const batch = cns.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map(async (cn) => ({ cn, response: await fetchSupplyStatusByCn(cn) })));

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        const { cn, response } = item.value;
        results.set(cn, {
          cn,
          supplyStatus: response.hasActiveSupplyIssue ? 'CON_ROTURA' : 'SIN_ROTURA',
          hasActiveSupplyIssue: response.hasActiveSupplyIssue,
          supplyStartedAt: response.startedAt,
          supplyExpectedEndAt: response.expectedEndAt,
          supplyObservations: response.observations,
        });
      } else {
        const failedCn = batch[settled.indexOf(item)];
        results.set(failedCn, {
          cn: failedCn,
          supplyStatus: 'DESCONOCIDO',
          hasActiveSupplyIssue: null,
          supplyStartedAt: null,
          supplyExpectedEndAt: null,
          supplyObservations: null,
        });
      }
    }
  }

  return results;
}

export async function getMedicineAlternatives(
  input: GetMedicineAlternativesInput,
): Promise<GetMedicineAlternativesOutput> {
  const normalizedCn = input.cn.trim();

  if (normalizedCn.length === 0) {
    return {
      ok: false,
      code: 'EMPTY_CN',
      message: 'Debes indicar un CN para consultar alternativas.',
    };
  }

  try {
    const sourceNomenclatorProduct = await getNomenclatorProductByCn(normalizedCn);
    const sourceContext = await getSourceMedicineContext(normalizedCn, sourceNomenclatorProduct?.codDcp ?? null);

    if (!sourceContext) {
      return {
        ok: false,
        code: 'SOURCE_NOT_FOUND',
        message: 'No se ha encontrado el medicamento origen en las roturas activas persistidas.',
      };
    }

    if (!sourceNomenclatorProduct) {
      return {
        ok: false,
        code: 'NOMENCLATOR_NOT_FOUND',
        message: 'No existe equivalencia en Nomenclátor para el CN indicado.',
      };
    }

    const nomenclatorAlternatives = await listNomenclatorAlternativesByCodDcp(sourceNomenclatorProduct.codDcp, normalizedCn);

    if (nomenclatorAlternatives.length === 0) {
      return {
        ok: false,
        code: 'NO_ALTERNATIVES_FOUND',
        message: 'No se han encontrado alternativas para el codDcp del medicamento seleccionado.',
      };
    }

    const alternativeCns = nomenclatorAlternatives.map((item) => item.cn);
    const [localHospitalState, supplyStatuses, unitDoseState] = await Promise.all([
      loadLocalHospitalStateByCn(alternativeCns),
      lookupSupplyStatusesWithConcurrency(alternativeCns),
      loadUnitDoseStateByCn(alternativeCns),
    ]);

    const alternatives = nomenclatorAlternatives
      .map<MedicineAlternative>((item) => {
        const localState = localHospitalState.get(item.cn) ?? null;
        const hospitalPresenceStatus = mapHospitalPresenceStatus(localState?.statusNormalized ?? null);
        const supplyState = supplyStatuses.get(item.cn) ?? {
          cn: item.cn,
          supplyStatus: 'DESCONOCIDO' as const,
          hasActiveSupplyIssue: null,
          supplyStartedAt: null,
          supplyExpectedEndAt: null,
          supplyObservations: null,
        };
        const unitDose = unitDoseState.get(item.cn) ?? null;

        return {
          cn: item.cn,
          codDcp: item.codDcp,
          presentation: item.presentation,
          officialName: item.officialName,
          commercializationStatus: item.commercializationStatus,
          supplyStatus: supplyState.supplyStatus,
          hasActiveSupplyIssue: supplyState.hasActiveSupplyIssue,
          supplyStartedAt: supplyState.supplyStartedAt,
          supplyExpectedEndAt: supplyState.supplyExpectedEndAt,
          supplyObservations: supplyState.supplyObservations,
          inHospital: localState !== null,
          hospitalStatusOriginal: localState?.statusOriginal ?? null,
          hospitalStatusNormalized: localState?.statusNormalized ?? null,
          hospitalPresenceStatus,
          hospitalPriority: mapHospitalPriority(hospitalPresenceStatus),
          isUnitDose: unitDose?.isUnitDose ?? null,
          unitDoseRaw: unitDose?.unitDoseRaw ?? null,
        };
      })
      .sort((left, right) => {
        const bySupplyPriority = mapSupplyPriority(left.supplyStatus) - mapSupplyPriority(right.supplyStatus);
        if (bySupplyPriority !== 0) {
          return bySupplyPriority;
        }

        const byHospitalPriority = left.hospitalPriority - right.hospitalPriority;
        if (byHospitalPriority !== 0) {
          return byHospitalPriority;
        }

        const leftCommercialized =
          left.commercializationStatus === 'COMERCIALIZADO'
            ? 1
            : left.commercializationStatus === 'NO_COMERCIALIZADO'
              ? 2
              : 3;
        const rightCommercialized =
          right.commercializationStatus === 'COMERCIALIZADO'
            ? 1
            : right.commercializationStatus === 'NO_COMERCIALIZADO'
              ? 2
              : 3;
        const byCommercialization = leftCommercialized - rightCommercialized;
        if (byCommercialization !== 0) {
          return byCommercialization;
        }

        return left.cn.localeCompare(right.cn);
      });

    return {
      ok: true,
      data: {
        sourceMedicine: sourceContext,
        alternatives,
        limitations: {
          hospitalSource: 'watched_medicines_by_cn',
          hospitalCoverage: 'proxy_mvp_not_full_orion_catalog',
          cimaStrategy: 'per_cn_tolerant_failures',
        },
      },
    };
  } catch (error) {
    console.error(`No se pudieron consultar alternativas para el CN ${normalizedCn}.`, error);
    return {
      ok: false,
      code: 'UNEXPECTED_ERROR',
      message: 'Se produjo un error inesperado al consultar alternativas.',
    };
  }
}