import Link from 'next/link';

import { listCatalogByCn, type CatalogFilters } from '@/lib/catalog';

const EMPTY_VALUE = '';

function toUrlSearchParams(filters: CatalogFilters): string {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.activeIngredient) params.set('activeIngredient', filters.activeIngredient);
  if (filters.cn) params.set('cn', filters.cn);
  if (filters.laboratory) params.set('laboratory', filters.laboratory);
  if (filters.atc) params.set('atc', filters.atc);
  if (filters.commercializationStatus) params.set('commercialized', filters.commercializationStatus);
  if (filters.includedInHospital) params.set('included', filters.includedInHospital);
  if (filters.hospitalStatus) params.set('hospitalStatus', filters.hospitalStatus);
  if (filters.bifimedFundingStatus) params.set('bifimed', filters.bifimedFundingStatus);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));

  return params.toString();
}

function normalizeQuery(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  return EMPTY_VALUE;
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

  const filters: CatalogFilters = {
    q: normalizeQuery(query.q),
    activeIngredient: normalizeQuery(query.activeIngredient),
    cn: normalizeQuery(query.cn),
    laboratory: normalizeQuery(query.laboratory),
    atc: normalizeQuery(query.atc),
    commercializationStatus: normalizeQuery(query.commercialized),
    includedInHospital: normalizeQuery(query.included) === 'SI' ? 'SI' : normalizeQuery(query.included) === 'NO' ? 'NO' : undefined,
    hospitalStatus: normalizeQuery(query.hospitalStatus),
    bifimedFundingStatus: normalizeQuery(query.bifimed),
    page: Number(normalizeQuery(query.page)) || 1,
  };

  const data = await listCatalogByCn(filters);
  const previousParams = toUrlSearchParams({ ...filters, page: Math.max(data.page - 1, 1) });
  const nextParams = toUrlSearchParams({ ...filters, page: data.page + 1 });

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Catálogo operativo</div>
            <h1>Listado real por CN</h1>
          </div>
          <span className="badge success">Base local: nomenclátor + CIMA + Orion + BIFIMED</span>
        </div>

        <form method="get" className="grid cols-3" style={{ gap: 12, marginTop: 16 }}>
          <label>
            <small className="muted">Nombre del medicamento</small>
            <input name="q" defaultValue={filters.q ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">Principio activo</small>
            <input name="activeIngredient" defaultValue={filters.activeIngredient ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">CN</small>
            <input name="cn" defaultValue={filters.cn ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">Laboratorio</small>
            <input name="laboratory" defaultValue={filters.laboratory ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">ATC</small>
            <input name="atc" defaultValue={filters.atc ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">Comercializado</small>
            <select name="commercialized" defaultValue={filters.commercializationStatus ?? ''} className="input">
              <option value="">Todos</option>
              <option value="COMERCIALIZADO">Comercializado</option>
              <option value="NO_COMERCIALIZADO">No comercializado</option>
              <option value="DESCONOCIDO">Desconocido</option>
            </select>
          </label>

          <label>
            <small className="muted">Incluido en hospital</small>
            <select name="included" defaultValue={filters.includedInHospital ?? ''} className="input">
              <option value="">Todos</option>
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </select>
          </label>

          <label>
            <small className="muted">Estado en hospital</small>
            <input name="hospitalStatus" defaultValue={filters.hospitalStatus ?? ''} className="input" />
          </label>

          <label>
            <small className="muted">BIFIMED</small>
            <select name="bifimed" defaultValue={filters.bifimedFundingStatus ?? ''} className="input">
              <option value="">Todos</option>
              <option value="FINANCIADO">Financiado</option>
              <option value="NO_FINANCIADO">No financiado</option>
              <option value="EN_ESTUDIO">En estudio</option>
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
            <button type="submit" className="button">Aplicar filtros</button>
            <Link className="button button-ghost" href="/catalogo">Limpiar</Link>
          </div>
        </form>
      </section>

      <section className="grid" style={{ gap: 14 }}>
        <p className="muted">Resultados: {data.total}</p>

        {data.rows.map((medicine) => {
          const financing = bifimedBadge(medicine.bifimedFundingStatus);
          const commercialization = commercializationBadge(medicine.commercializationStatus);

          return (
            <Link href={`/catalogo/${medicine.cn}`} key={medicine.cn} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="section-title">
                <div>
                  <h2 style={{ marginBottom: 4 }}>{medicine.displayName}</h2>
                  <div className="muted">CN {medicine.cn}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={commercialization.className}>{commercialization.label}</span>
                  <span className={financing.className}>{financing.label}</span>
                </div>
              </div>

              <div className="grid cols-3" style={{ gap: 10 }}>
                <div>
                  <small className="muted">Principio activo</small>
                  <div>{medicine.activeIngredient ?? 'Sin dato CIMA'}</div>
                </div>
                <div>
                  <small className="muted">Laboratorio</small>
                  <div>{medicine.laboratory ?? 'Sin dato CIMA'}</div>
                </div>
                <div>
                  <small className="muted">ATC</small>
                  <div>{medicine.atcCode ?? 'Sin dato CIMA'}</div>
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
            </Link>
          );
        })}

        {data.rows.length === 0 && (
          <article className="card">
            <p>No hay resultados con los filtros aplicados.</p>
          </article>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Link className="button button-ghost" href={`/catalogo?${previousParams}`} aria-disabled={data.page <= 1}>
            Página anterior
          </Link>
          <span className="muted">Página {data.page}</span>
          <Link className="button button-ghost" href={`/catalogo?${nextParams}`}>
            Página siguiente
          </Link>
        </div>
      </section>
    </div>
  );
}
