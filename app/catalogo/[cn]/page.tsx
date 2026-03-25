import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getCatalogDetailByCn } from '@/lib/catalog';

type PageProps = {
  params: Promise<{ cn: string }>;
};

function formatDate(value: string | null): string {
  if (!value) {
    return 'Sin dato';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function renderDocLink(label: string, href: string | null): JSX.Element {
  if (!href) {
    return <span className="muted">{label}: no disponible</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="secondary-button">
      {label}
    </a>
  );
}

export default async function CatalogDetailPage({ params }: PageProps) {
  const { cn } = await params;
  const detail = await getCatalogDetailByCn(cn);

  if (!detail) {
    notFound();
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Ficha de medicamento</div>
            <h1>{detail.officialName ?? detail.presentation}</h1>
          </div>
          <span className="badge">CN {detail.cn}</span>
        </div>

        <div className="grid cols-3" style={{ gap: 12 }}>
          <div>
            <small className="muted">Principio activo</small>
            <div>{detail.activeIngredient ?? 'Sin dato CIMA'}</div>
          </div>
          <div>
            <small className="muted">Laboratorio</small>
            <div>{detail.laboratory ?? 'Sin dato CIMA'}</div>
          </div>
          <div>
            <small className="muted">ATC</small>
            <div>{detail.atcCode ?? 'Sin dato CIMA'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Bloque hospitalario</h2>
          <span className={detail.includedInHospital ? 'badge success' : 'badge warning'}>
            Incluido en hospital: {detail.includedInHospital ? 'Sí' : 'No'}
          </span>
        </div>

        <div className="grid cols-2" style={{ gap: 10 }}>
          <div>
            <small className="muted">Estado Orion</small>
            <div>{detail.hospitalStatusOriginal ?? 'No detectado en Orion'}</div>
          </div>
          <div>
            <small className="muted">Código Orion</small>
            <div>{detail.orionCode ?? 'No detectado en Orion'}</div>
          </div>
          <div>
            <small className="muted">Descripción local</small>
            <div>{detail.localDescription ?? 'Sin descripción local'}</div>
          </div>
          <div>
            <small className="muted">Última detección Orion</small>
            <div>{formatDate(detail.lastDetectedAt)}</div>
          </div>
          <div>
            <small className="muted">Última importación Orion</small>
            <div>{formatDate(detail.lastImportedAt)}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Datos regulatorios</h2>
          <span className="badge">CIMA / Nomenclátor</span>
        </div>

        <div className="grid cols-3" style={{ gap: 10 }}>
          <div>
            <small className="muted">Estado de comercialización</small>
            <div>{detail.commercializationStatus}</div>
          </div>
          <div>
            <small className="muted">Estado de suministro</small>
            <div>{detail.supplyStatus ?? 'Sin dato CIMA'}</div>
          </div>
          <div>
            <small className="muted">Código DCP</small>
            <div>{detail.codDcp}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Documentación</h2>
          <span className="badge">CIMA</span>
        </div>
        <p className="muted">
          Estos enlaces dependen de que la caché local CIMA tenga cargados los campos documentales para este CN.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {renderDocLink('Ficha técnica', detail.technicalSheetUrl)}
          {renderDocLink('Prospecto', detail.leafletUrl)}
          {renderDocLink('HTML', detail.docsHtmlUrl)}
          {renderDocLink('PDF', detail.docsPdfUrl)}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Financiación BIFIMED</h2>
          <span className="badge primary">Resumen</span>
        </div>
        <p className="muted">
          La financiación mostrada depende de tener importado BIFIMED en caché local; si no existe, se refleja como
          pendiente / sin dato.
        </p>

        <div className="grid cols-2" style={{ gap: 10 }}>
          <div>
            <small className="muted">Estado financiación</small>
            <div>{detail.bifimedFundingStatus ?? 'En estudio'}</div>
          </div>
          <div>
            <small className="muted">Situación de financiación</small>
            <div>{detail.bifimedModality ?? 'Sin dato BIFIMED'}</div>
          </div>
          <div>
            <small className="muted">Condiciones financiación restringidas</small>
            <div>{detail.bifimedRestrictedConditions ?? 'Sin dato BIFIMED'}</div>
          </div>
          <div>
            <small className="muted">Condiciones especiales de financiación</small>
            <div>{detail.bifimedSpecialFundingConditions ?? 'Sin dato BIFIMED'}</div>
          </div>
          <div>
            <small className="muted">Estado de nomenclátor</small>
            <div>{detail.bifimedNomenclatorState ?? 'Sin dato BIFIMED'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <small className="muted">Resumen</small>
            <div>{detail.bifimedSummary ?? 'No hay datos de financiación persistidos para este CN.'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Indicaciones BIFIMED</h2>
          <span className="badge">Detalle por indicación</span>
        </div>

        {detail.bifimedIndications.length === 0 ? (
          <p className="muted">No hay detalle BIFIMED por indicación persistido para este CN.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderBottom: '1px solid #d9dde3',
                    }}
                  >
                    Indicación autorizada
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderBottom: '1px solid #d9dde3',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Situación expediente indicación
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderBottom: '1px solid #d9dde3',
                    }}
                  >
                    Resolución expediente de financiación indicación
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.bifimedIndications.map((item, index) => (
                  <tr key={`${detail.cn}-${index}`}>
                    <td style={{ verticalAlign: 'top', padding: '10px 12px', borderBottom: '1px solid #eceff3' }}>
                      {item.authorizedIndication}
                    </td>
                    <td style={{ verticalAlign: 'top', padding: '10px 12px', borderBottom: '1px solid #eceff3' }}>
                      {item.indicationFileStatus ?? 'Sin dato'}
                    </td>
                    <td style={{ verticalAlign: 'top', padding: '10px 12px', borderBottom: '1px solid #eceff3' }}>
                      {item.indicationFundingResolution ?? 'Sin dato'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div>
        <Link href="/catalogo" className="secondary-button">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}