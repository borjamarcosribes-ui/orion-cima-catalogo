import { prisma } from '@/lib/prisma';

export type AlternativeCommercializationStatus = 'COMERCIALIZADO' | 'NO_COMERCIALIZADO' | 'DESCONOCIDO';

export type NomenclatorProductRecord = {
  cn: string;
  codDcp: string;
  presentation: string;
  officialName: string | null;
  commercializationStatus: AlternativeCommercializationStatus;
};

function normalizeCommercializationStatus(value: string | number | null | undefined): AlternativeCommercializationStatus {
  if (value === 'COMERCIALIZADO' || value === 1 || value === '1') {
    return 'COMERCIALIZADO';
  }

  if (value === 'NO_COMERCIALIZADO' || value === 0 || value === '0') {
    return 'NO_COMERCIALIZADO';
  }

  if (value === 'DESCONOCIDO') {
    return 'DESCONOCIDO';
  }

  return 'DESCONOCIDO';
}

function mapNomenclatorProduct(value: {
  cn: string;
  codDcp: string;
  presentation: string;
  officialName: string | null;
  commercializationStatus: string;
}): NomenclatorProductRecord {
  return {
    cn: value.cn,
    codDcp: value.codDcp,
    presentation: value.presentation,
    officialName: value.officialName,
    commercializationStatus: normalizeCommercializationStatus(value.commercializationStatus),
  };
}

export async function getNomenclatorProductByCn(cn: string): Promise<NomenclatorProductRecord | null> {
  const product = await prisma.nomenclatorProduct.findUnique({
    where: { cn },
    select: {
      cn: true,
      codDcp: true,
      presentation: true,
      officialName: true,
      commercializationStatus: true,
    },
  });

  return product ? mapNomenclatorProduct(product) : null;
}

export async function listNomenclatorAlternativesByCodDcp(
  codDcp: string,
  excludedCn: string,
): Promise<NomenclatorProductRecord[]> {
  const rows = await prisma.nomenclatorProduct.findMany({
    where: {
      codDcp,
      cn: {
        not: excludedCn,
      },
    },
    orderBy: [{ commercializationStatus: 'asc' }, { presentation: 'asc' }, { cn: 'asc' }],
    select: {
      cn: true,
      codDcp: true,
      presentation: true,
      officialName: true,
      commercializationStatus: true,
    },
  });

  return rows.map(mapNomenclatorProduct);
}