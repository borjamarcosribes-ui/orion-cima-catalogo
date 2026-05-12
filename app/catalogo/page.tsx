import Link from 'next/link';

import { CatalogFiltersForm } from './catalog-filters';
import { listCatalogByCn, type CatalogFilters } from '@/lib/catalog';

const EMPTY_VALUE = '';

type CommercializedValue = '' | 'COMERCIALIZADO' | 'NO_COMERCIALIZADO';
type BifimedValue = '' | 'FINANCIADO' | 'NO_FINANCIADO' | 'EN_ESTUDIO';
type HospitalStatusValue = '' | 'ACTIVO' | 'INACTIVO' | 'LAB' | 'OTROS';

function toUrlSearchParams(filters: CatalogFilters, options?: { forceCommercializedParam?: boolean }): string {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.activeIngredient) params.set('activeIngredient', filters.activeIngredient);
  if (filters.cn) params.set('cn', filters.cn);
  if (filters.laboratory) params.set('laboratory', filters.laboratory);
  if (filters.atc) params.set('atc', filters.atc);
  if (filters.commercializationStatus || options?.forceCommercializedParam) {
    params.set('commercialized', filters.commercializationStatus ?? '');
  }
  if (filters.includedInHospital) params.set('included', filters.includedInHospital);
  if (filters.hospitalStatus) params.set('hospitalStatus', filters.hospitalStatus);
  if (filters.bifimedFundingStatus) params.set('bifimed', filters.bifimedFundingStatus);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));

  return params.toString();
}

function normalizeQuery(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  return EMPTY_VALUE;
}

function parseCommercialized(raw: string): { value: CommercializedValue; isValid: boolean } {
  if (raw === '') {
    return { value: '', isValid: true };
  }

  if (raw === 'COMERCIALIZADO') {
    return { value: 'COMERCIALIZADO', isValid: true };
  }

  if (raw === 'NO_COMERCIALIZADO') {
    return { value: 'NO_COMERCIALIZADO', isValid: true };
  }

  return { value: 'COMERCIALIZADO', isValid: false };
}

function parseIncluded(raw: string): 'SI' | 'NO' | undefined {
  if (raw === 'SI' || raw === 'NO') {
    return raw;
  }

  return undefined;
}

function parseHospitalStatus(raw: string): HospitalStatusValue {
  if (raw === '' || raw === 'ACTIVO' || raw === 'INACTIVO' || raw === 'LAB' || raw === 'OTROS') {
    return raw;
  }

  return '';
}

function parseBifimed(raw: string): BifimedValue {
  if (raw === '' || raw === 'FINANCIADO' || raw === 'NO_FINANCIADO' || raw === 'EN_ESTUDIO') {
    return raw;
  }

  return '';
}

function parsePage(raw: string): number {
  const parsed = Number(raw);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return 1;
}

function formatBool(value: boolean): string {
  return value ? 'Sí' : 'No';
}

function bifimedBadge(status: string | null): { label: string; className: string } {
  if (status === 'FINANCIADO') {
    return { label: 'Financiado', className: 'badge success' };
  }

  if (status === 'NO_FINANCIADO') {
    return { label: 'No financiado', className: 'badge danger' };
  }

  if (status === 'EN_ESTUDIO') {
    return { label: 'En estudio', className: 'badge warning' };
  }

  return { label: 'Sin dato BIFIMED', className: 'badge' };
}

function unitDoseBadge(isUnitDose: boolean | null): { label: string; className: string } {
  if (isUnitDose === true) {
    return { label: 'Dosis unitaria: Sí', className: 'badge success' };
  }

  if (isUnitDose === false) {
    return { label: 'No consta unidosis', className: 'badge' };
  }

  return { label: 'Sin dato SCMFH', className: 'badge' };
}

function commercializationBadge(status: string): { label: string; className: string } {
  if (status === 'COMERCIALIZADO') {
    return { label: 'Comercializado', className: 'badge success' };
  }

  if (status === 'NO_COMERCIALIZADO') {
    return { label: 'No comercializado', className: 'badge danger' };
  }

  return { label: status, className: 'badge warning' };
}

function shortText(value: string | null, maxLength = 150): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatalogPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const hasCommercializedParam = Object.prototype.hasOwnProperty.call(query, 'commercialized');
  const commercializedRaw = normalizeQuery(query.commercialized);
  const commercializedParsed = parseCommercialized(commercializedRaw);
  const commercializedHasValidParam = hasCommercializedParam && commercializedParsed.isValid;
  const commercializedExplicitAll = commercializedHasValidParam && commercializedParsed.value === '';
  const includedInHospital = parseIncluded(normalizeQuery(query.included));
  const hospitalStatusParsed = parseHospitalStatus(normalizeQuery(query.hospitalStatus));

  const filters: CatalogFilters = {
    q: normalizeQuery(query.q),
    activeIngredient: normalizeQuery(query.activeIngredient),
    cn: normalizeQuery(query.cn),
    laboratory: normalizeQuery(query.laboratory),
    atc: normalizeQuery(query.atc),
    commercializationStatus: commercializedHasValidParam ? commercializedParsed.value : 'COMERCIALIZADO',
    includedInHospital,
    hospitalStatus: includedInHospital === 'SI' && hospitalStatusParsed !== '' ? hospitalStatusParsed : undefined,
    bifimedFundingStatus: parseBifimed(normalizeQuery(query.bifimed)),
    page: parsePage(normalizeQuery(query.page)),
  };

  const data = await listCatalogByCn(filters);
  const previousParams = toUrlSearchParams(
    { ...filters, page: Math.max(data.page - 1, 1) },
    { forceCommercializedParam: commercializedExplicitAll },
  );
  const nextParams = toUrlSearchParams(
    { ...filters, page: data.page + 1 },
    { forceCommercializedParam: commercializedExplicitAll },
  );
  const totalPages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  const firstResult = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastResult = Math.min(data.page * data.pageSize, data.total);
  const commercializedLabel =
    filters.commercializationStatus === ''
      ? 'Todos'
      : commercializationBadge(filters.commercializationStatus ?? 'COMERCIALIZADO').label;

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section
        className="card"
        style={{
          display: 'grid',
          gap: 20,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 107, 143, 0.16), rgba(8, 122, 85, 0.06))',
            borderRadius: 999,
            height: 180,
            position: 'absolute',
            right: -70,
            top: -110,
            width: 180,
          }}
        />
        <div className="section-title" style={{ alignItems: 'flex-start', gap: 18, position: 'relative' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span className="badge primary" style={{ width: 'fit-content' }}>
              Unidad principal: CN
            </span>
            <div>
              <h1 style={{ letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0 }}>Catálogo operativo por CN</h1>
              <p className="muted" style={{ margin: '10px 0 0', maxWidth: 760 }}>
                Vista de trabajo para revisar medicamentos consolidados por Código Nacional, enriquecidos con CIMA,
                BIFIMED y la inclusión local detectada en Orion/TSV.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                minWidth: 130,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Resultados</small>
              <div style={{ color: '#0b2337', fontSize: '1.35rem', fontWeight: 850 }}>{data.total}</div>
            </div>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                minWidth: 130,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Página actual</small>
              <div style={{ color: '#0b2337', fontSize: '1.35rem', fontWeight: 850 }}>
                {data.page}/{totalPages}
              </div>
            </div>
            <div
              style={{
                background: 'var(--primary-soft)',
                border: '1px solid rgba(15, 107, 143, 0.16)',
                borderRadius: 14,
                minWidth: 170,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Comercialización</small>
              <div style={{ color: 'var(--primary-strong)', fontWeight: 850 }}>{commercializedLabel}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(242, 247, 250, 0.72)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Filtros del catálogo</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                El filtro de comercialización arranca por defecto en comercializado.
              </p>
            </div>
          </div>
          <CatalogFiltersForm
            q={filters.q ?? ''}
            activeIngredient={filters.activeIngredient ?? ''}
            cn={filters.cn ?? ''}
            laboratory={filters.laboratory ?? ''}
            atc={filters.atc ?? ''}
            commercialized={filters.commercializationStatus ?? ''}
            included={filters.includedInHospital ?? ''}
            hospitalStatus={filters.hospitalStatus ?? ''}
            bifimed={filters.bifimedFundingStatus ?? ''}
          />
        </div>
      </section>

      <section className="grid" style={{ gap: 16 }}>
        <div
          className="card"
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            padding: '16px 18px',
          }}
        >
          <div>
            <strong>
              {firstResult}-{lastResult} de {data.total} resultados
            </strong>
            <div className="muted" style={{ fontSize: '0.94rem' }}>
              BIFIMED se muestra como badge y resumen corto cuando existe caché local disponible.
            </div>
          </div>
          <span className="badge primary">Página {data.page}</span>
        </div>

        {data.rows.map((medicine) => {
          const financing = bifimedBadge(medicine.bifimedFundingStatus);
          const commercialization = commercializationBadge(medicine.commercializationStatus);
          const unitDose = unitDoseBadge(medicine.isUnitDose);
          const bifimedSummary = shortText(medicine.bifimedSummary);

          return (
            <Link
              href={`/catalogo/${medicine.cn}`}
              key={medicine.cn}
              className="card"
              style={{
                color: 'inherit',
                display: 'grid',
                gap: 18,
                padding: 0,
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'grid', gap: 18, padding: 22 }}>
                <div className="section-title" style={{ alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div className="muted" style={{ fontSize: '0.86rem', fontWeight: 800, letterSpacing: '0.06em' }}>
                      CN {medicine.cn}
                    </div>
                    <h2 style={{ lineHeight: 1.18, margin: 0 }}>{medicine.displayName}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <span className={medicine.hasActiveSupplyIssue ? 'badge danger' : 'badge success'}>
                        {medicine.hasActiveSupplyIssue ? 'Suministro: incidencia activa' : 'Suministro: sin alerta activa'}
                      </span>
                      <span className={commercialization.className}>{commercialization.label}</span>
                      <span className={financing.className}>BIFIMED: {financing.label}</span>
                      <span className={unitDose.className}>{unitDose.label}</span>
                      <span className={medicine.includedInHospital ? 'badge primary' : 'badge'}>
                        Incluido en hospital: {formatBool(medicine.includedInHospital)}
                      </span>
                    </div>
                  </div>
                  {medicine.hasActiveSupplyIssue ? (
                    <span
                      className="badge danger"
                      title={medicine.supplyStatusLabel ?? 'Problema de suministro declarado'}
                      style={{ maxWidth: 280 }}
                    >
                      {medicine.supplyStatusLabel ?? 'Problema de suministro declarado'}
                    </span>
                  ) : null}
                </div>

                <div className="grid cols-3" style={{ gap: 12 }}>
                  <div
                    style={{
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <small className="muted">Principio activo</small>
                    <div style={{ fontWeight: 750 }}>{medicine.activeIngredient ?? 'Sin dato CIMA'}</div>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <small className="muted">Laboratorio</small>
                    <div style={{ fontWeight: 750 }}>{medicine.laboratory ?? 'Sin dato CIMA'}</div>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <small className="muted">ATC</small>
                    <div style={{ fontWeight: 750 }}>{medicine.atcCode ?? 'Sin dato CIMA'}</div>
                  </div>
                  <div>
                    <small className="muted">Incluido en hospital</small>
                    <div>{formatBool(medicine.includedInHospital)}</div>
                  </div>
                  <div>
                    <small className="muted">Estado hospitalario</small>
                    <div>{medicine.hospitalStatusOriginal ?? 'No detectado en Orion'}</div>
                  </div>
                  <div>
                    <small className="muted">Descripción local</small>
                    <div>{medicine.hospitalDescription ?? 'Sin descripción local'}</div>
                  </div>
                </div>

                {bifimedSummary ? (
                  <div
                    style={{
                      background: '#fffaf0',
                      border: '1px solid rgba(154, 103, 0, 0.18)',
                      borderRadius: 14,
                      color: 'var(--muted-strong)',
                      padding: '10px 12px',
                    }}
                  >
                    <small style={{ color: 'var(--warning)', fontWeight: 850 }}>Resumen BIFIMED</small>
                    <div>{bifimedSummary}</div>
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}

        {data.rows.length === 0 && (
          <article className="card" style={{ display: 'grid', gap: 10, padding: 28, textAlign: 'center' }}>
            <span className="badge warning" style={{ justifySelf: 'center' }}>
              Sin resultados
            </span>
            <h2 style={{ margin: 0 }}>No hay medicamentos para los filtros aplicados</h2>
            <p className="muted" style={{ margin: 0 }}>
              Revisa el CN, principio activo, laboratorio, estado de comercialización o la inclusión hospitalaria. Si
              esperabas ver registros locales, confirma que la última carga Orion/TSV se importó correctamente.
            </p>
          </article>
        )}

        <div
          className="card"
          style={{
            alignItems: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            padding: '16px 18px',
          }}
        >
          <Link
            className="secondary-button"
            href={`/catalogo?${previousParams}`}
            aria-disabled={data.page <= 1}
            style={data.page <= 1 ? { opacity: 0.48, pointerEvents: 'none' } : undefined}
          >
            ← Página anterior
          </Link>
          <div className="muted" style={{ textAlign: 'center' }}>
            Página <strong style={{ color: 'var(--text)' }}>{data.page}</strong> de {totalPages}
            <div style={{ fontSize: '0.9rem' }}>{data.total} resultados totales</div>
          </div>
          <Link
            className="secondary-button"
            href={`/catalogo?${nextParams}`}
            aria-disabled={data.page >= totalPages}
            style={data.page >= totalPages ? { opacity: 0.48, pointerEvents: 'none' } : undefined}
          >
            Página siguiente →
          </Link>
        </div>
      </section>
    </div>
  );
}
