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

function hospitalIncludedBadge(included: boolean): { label: string; className: string } {
  return included
    ? { label: 'Incluido en hospital', className: 'badge primary' }
    : { label: 'No incluido en hospital', className: 'badge' };
}

function commercializedFilterLabel(status: string | undefined): string {
  if (status === 'COMERCIALIZADO') {
    return 'Comercializado';
  }

  if (status === 'NO_COMERCIALIZADO') {
    return 'No comercializado';
  }

  return 'Todos';
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

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gap: 22,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            alignItems: 'stretch',
          }}
        >
          <div style={{ padding: 28 }}>
            <div className="section-title" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className="badge primary">Catálogo operativo</span>
                <h1 style={{ marginTop: 12 }}>Catálogo operativo por CN</h1>
              </div>
              <span className="badge success">CN como unidad principal</span>
            </div>

            <p className="muted" style={{ maxWidth: 780, marginBottom: 10 }}>
              Listado operativo que cruza el catálogo local detectado en Orion/TSV con información disponible en CIMA,
              BIFIMED y nomenclátor, manteniendo el Código Nacional como referencia principal.
            </p>
            <p className="muted" style={{ maxWidth: 780, margin: 0 }}>
              Los datos externos se muestran únicamente cuando existen en caché local; la ficha detallada se abre desde
              cada resultado por CN.
            </p>

            <div className="kpi-row" aria-label="Resumen de resultados del catálogo">
              <div className="kpi-chip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}>
                <div className="muted">Resultados totales</div>
                <strong>{data.total.toLocaleString('es-ES')}</strong>
              </div>
              <div className="kpi-chip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}>
                <div className="muted">Página actual</div>
                <strong>{data.page.toLocaleString('es-ES')}</strong>
              </div>
              <div className="kpi-chip" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}>
                <div className="muted">Filtro comercializado</div>
                <strong>{commercializedFilterLabel(filters.commercializationStatus)}</strong>
              </div>
            </div>
          </div>

          <aside style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface-alt)', padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>Lectura del listado</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              Cada tarjeta resume un CN: disponibilidad, comercialización, financiación BIFIMED e inclusión local en el
              hospital.
            </p>
            <div className="actions-row">
              <span className="badge primary">Resultados: {data.total.toLocaleString('es-ES')}</span>
              <span className="badge primary">Página {data.page.toLocaleString('es-ES')}</span>
              <span className="badge success">
                Comercializado: {commercializedFilterLabel(filters.commercializationStatus)}
              </span>
            </div>
          </aside>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Filtros de búsqueda</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Acota por nombre, principio activo, CN, laboratorio, ATC, comercialización, inclusión hospitalaria o
              financiación BIFIMED. Por defecto se listan medicamentos comercializados.
            </p>
          </div>
          <span className="badge primary">Búsqueda configurable</span>
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
      </section>

      <section className="grid" style={{ gap: 14 }}>
        <div className="section-title">
          <div>
            <h2>Resultados del catálogo</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {data.total.toLocaleString('es-ES')} resultado{data.total === 1 ? '' : 's'} para los filtros actuales.
            </p>
          </div>
          <span className="badge primary">Página {data.page.toLocaleString('es-ES')}</span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Si no hay datos cargados en caché local de BIFIMED o documentos CIMA, se mostrará “Sin dato” o “En
          estudio” sin completar información no disponible.
        </p>

        {data.rows.map((medicine) => {
          const financing = bifimedBadge(medicine.bifimedFundingStatus);
          const commercialization = commercializationBadge(medicine.commercializationStatus);
          const hospitalIncluded = hospitalIncludedBadge(medicine.includedInHospital);

          return (
            <Link
              href={`/catalogo/${medicine.cn}`}
              key={medicine.cn}
              className="card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="section-title" style={{ alignItems: 'flex-start' }}>
                <div>
                  <span className="badge primary">CN {medicine.cn}</span>
                  <h2 style={{ marginBottom: 4, marginTop: 10 }}>{medicine.displayName}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {medicine.presentation}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {medicine.hasActiveSupplyIssue ? (
                    <span
                      className="badge danger"
                      title={medicine.supplyStatusLabel ?? 'Problema de suministro declarado'}
                    >
                      Problema de suministro
                    </span>
                  ) : (
                    <span className="badge success">Sin rotura activa</span>
                  )}
                  <span className={commercialization.className}>{commercialization.label}</span>
                  <span className={financing.className}>{financing.label}</span>
                  <span className={hospitalIncluded.className}>{hospitalIncluded.label}</span>
                </div>
              </div>

              <div className="grid cols-3" style={{ gap: 14 }}>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">Principio activo</small>
                  <div>{medicine.activeIngredient ?? 'Sin dato CIMA'}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">Laboratorio</small>
                  <div>{medicine.laboratory ?? 'Sin dato CIMA'}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">ATC</small>
                  <div>{medicine.atcCode ?? 'Sin dato CIMA'}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">Incluido en hospital</small>
                  <div>{formatBool(medicine.includedInHospital)}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">Estado hospitalario</small>
                  <div>{medicine.hospitalStatusOriginal ?? 'No detectado en Orion'}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <small className="muted">Descripción local</small>
                  <div>{medicine.hospitalDescription ?? 'Sin descripción local'}</div>
                </div>
              </div>
            </Link>
          );
        })}

        {data.rows.length === 0 && (
          <article className="card empty-state">
            <span className="badge warning">Sin resultados</span>
            <h2>No hay medicamentos que coincidan con los filtros aplicados.</h2>
            <p className="muted" style={{ maxWidth: 720, margin: '0 auto' }}>
              Revisa los criterios de búsqueda, cambia el filtro de comercialización o comprueba si las cachés locales de
              CIMA/BIFIMED y las cargas Orion/TSV tienen datos disponibles para el CN buscado.
            </p>
          </article>
        )}

        <nav className="card" aria-label="Paginación del catálogo">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <Link
              className="secondary-button"
              href={`/catalogo?${previousParams}`}
              aria-disabled={data.page <= 1}
              style={data.page <= 1 ? { opacity: 0.55 } : undefined}
            >
              Página anterior
            </Link>
            <span className="muted">
              Página {data.page.toLocaleString('es-ES')} · {data.total.toLocaleString('es-ES')} resultado
              {data.total === 1 ? '' : 's'}
            </span>
            <Link className="secondary-button" href={`/catalogo?${nextParams}`}>
              Página siguiente
            </Link>
          </div>
        </nav>
      </section>
    </div>
  );
}
