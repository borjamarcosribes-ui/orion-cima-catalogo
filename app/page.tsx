import { MetricCard } from '@/components/metric-card';
import { cimaIntegrationChecklist, dashboardMetrics, importConfigTemplate, sampleRows, snapshotDiff } from '@/lib/demo-data';

export default function DashboardPage() {
  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="hero">
        <div className="hero-panel">
          <div className="badge success">Segunda iteración: limpieza conceptual y consistencia interna</div>
          <h1>Catálogo operativo Orion + CIMA</h1>
          <p>
            La base actual sigue siendo una demo funcional del dominio: valida códigos Orion con patrón{' '}
            <span className="code">^\d{'{6}'}\.CNA$</span>, separa filas válidas y descartadas, y construye un
            snapshot conceptual de <strong>CN únicos por batch</strong>.
          </p>
          <div className="kpi-row">
            <div className="kpi-chip">
              <strong>Mapeo configurable</strong>
              <div>Sin fijar columnas definitivas del Excel real.</div>
            </div>
            <div className="kpi-chip">
              <strong>Snapshot definido</strong>
              <div>CN únicos por batch, deduplicados sobre filas válidas.</div>
            </div>
            <div className="kpi-chip">
              <strong>CIMA pendiente</strong>
              <div>Solo modelo y checklist, sin integración real todavía.</div>
            </div>
          </div>
        </div>
        <aside className="card">
          <div className="section-title">
            <h2>Configuración demo del importador</h2>
            <span className="badge warning">Pendiente XLS real</span>
          </div>
          <ul className="list">
            <li>
              <strong>Columna de código Orion</strong>
              <div className="muted">{importConfigTemplate.codeColumn}</div>
            </li>
            <li>
              <strong>Columna de descripción</strong>
              <div className="muted">{importConfigTemplate.descriptionColumn}</div>
            </li>
            <li>
              <strong>Hoja por defecto</strong>
              <div className="muted">{importConfigTemplate.sheetName}</div>
            </li>
          </ul>
        </aside>
      </section>

      <section className="grid cols-3">
        <MetricCard label="Filas válidas" value={dashboardMetrics.latestValidRows} hint="Filas del batch que cumplen exactamente ^\d{6}\.CNA$." />
        <MetricCard label="CN únicos en snapshot" value={dashboardMetrics.latestUniqueNationalCodes} hint="medicines_snapshot se interpreta como CN únicos por batch." />
        <MetricCard label="Descartadas" value={dashboardMetrics.latestDiscardedRows} hint="Filas sin .CNA o con formato no válido." />
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title">
            <h2>Filas demo de la última carga</h2>
            <span className="badge primary">Batch de ejemplo</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Código Orion</th>
                <th>CN</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.orionCode || 'sin-codigo'}`}>
                  <td>{row.rowNumber}</td>
                  <td><small className="code-inline">{row.orionCode || '—'}</small></td>
                  <td>{row.nationalCode ?? '—'}</td>
                  <td>
                    {row.isValidMedicine ? (
                      <span className="badge success">Válido</span>
                    ) : (
                      <span className="badge danger">{row.discardReason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Cambios por CN frente al batch anterior</h2>
            <span className="badge primary">Diff por presencia de CN</span>
          </div>
          <ul className="list">
            <li>
              <strong>Añadidos</strong>
              <div className="muted">{snapshotDiff.added.join(', ') || 'Sin cambios'}</div>
            </li>
            <li>
              <strong>Eliminados</strong>
              <div className="muted">{snapshotDiff.removed.join(', ') || 'Sin cambios'}</div>
            </li>
            <li>
              <strong>Sin cambios</strong>
              <div className="muted">{snapshotDiff.unchanged.join(', ') || 'Sin coincidencias'}</div>
            </li>
            <li>
              <strong>Limitación actual</strong>
              <div className="muted">El diff no detecta cambios de descripción para un mismo CN; solo altas, bajas y permanencias por Código Nacional.</div>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title">
            <h2>Base preparada para CIMA</h2>
            <span className="badge success">Modelo listo, integración no implementada</span>
          </div>
          <ul className="list">
            {cimaIntegrationChecklist.map((item) => (
              <li key={item.objective}>
                <strong>{item.objective}</strong>
                <div className="muted">{item.notes}</div>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Validaciones pendientes con el XLS real</h2>
            <span className="badge warning">Pendiente</span>
          </div>
          <ul className="list">
            <li>Confirmar nombres exactos de las columnas exportadas desde Orion.</li>
            <li>Verificar si conviene conservar más campos brutos para auditoría y trazabilidad.</li>
            <li>Validar si habrá múltiples pestañas por exportación y qué mapeos reales necesita cada una.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
