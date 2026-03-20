import {
  currentDuplicateConflicts,
  currentSnapshot,
  dashboardMetrics,
  importConfigTemplate,
  sampleRows,
} from '@/lib/demo-data';

export default function ImportsPage() {
  const validRows = sampleRows.filter((row) => row.isValidMedicine);
  const discardedRows = sampleRows.filter((row) => !row.isValidMedicine);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Importaciones</div>
            <h1>Demo del flujo de importación XLS/XLSX</h1>
          </div>
          <span className="badge warning">Sin subida real de ficheros en esta iteración</span>
        </div>
        <p className="muted">
          Esta pantalla no procesa todavía un Excel real desde la interfaz. Solo demuestra el flujo esperado de
          mapeo, validación y generación de snapshot usando datos semilla mientras se espera el XLS real de Orion.
        </p>
        <div className="grid cols-3">
          <div className="card" style={{ boxShadow: 'none' }}>
            <strong>Formato objetivo</strong>
            <p className="muted">El dominio ya contempla XLS/XLSX para medicamentos y TSV para catálogo de artículos Orion.</p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <strong>Mapeo demo</strong>
            <p className="muted">codeColumn={importConfigTemplate.codeColumn}, descriptionColumn={importConfigTemplate.descriptionColumn}</p>
          </div>
          <div className="card" style={{ boxShadow: 'none' }}>
            <strong>Política de deduplicación</strong>
            <p className="muted">Gana la primera fila válida observada para cada CN y las duplicadas se reportan como conflicto.</p>
          </div>
        </div>
      </section>

      <section className="grid cols-3">
        <article className="card">
          <div className="badge primary">Filas válidas</div>
          <div className="metric">{dashboardMetrics.latestValidRows}</div>
          <div className="muted">Filas del batch que cumplen ^\d{6}\.CNA$.</div>
        </article>
        <article className="card">
          <div className="badge success">CN únicos en snapshot</div>
          <div className="metric">{dashboardMetrics.latestUniqueNationalCodes}</div>
          <div className="muted">medicines_snapshot conserva una sola fila ganadora por CN.</div>
        </article>
        <article className="card">
          <div className="badge warning">Filas duplicadas colapsadas</div>
          <div className="metric">{dashboardMetrics.duplicateValidRowsCollapsed}</div>
          <div className="muted">Filas válidas posteriores con un CN ya visto que no pasan al snapshot.</div>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title">
            <h2>Filas válidas detectadas en la demo</h2>
            <span className="badge success">{validRows.length} filas válidas</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Código</th>
                <th>CN</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {validRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.orionCode}-${row.description}`}>
                  <td>{row.rowNumber}</td>
                  <td>{row.orionCode}</td>
                  <td>{row.nationalCode}</td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Filas descartadas en la demo</h2>
            <span className="badge danger">{discardedRows.length} descartadas</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Código</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {discardedRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.orionCode || 'sin-codigo'}`}>
                  <td>{row.rowNumber}</td>
                  <td>{row.orionCode || '—'}</td>
                  <td>{row.discardReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title">
            <h2>Snapshot demo (CN únicos por batch)</h2>
            <span className="badge primary">{currentSnapshot.length} CN únicos</span>
          </div>
          <ul className="list">
            {currentSnapshot.map((item) => (
              <li key={`${item.importBatchId}-${item.nationalCode}`}>
                <strong>{item.nationalCode}</strong>
                <div className="muted">{item.localDescription} · código Orion {item.orionCode} · fila ganadora {item.sourceRowNumber}</div>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Conflictos de duplicados por CN</h2>
            <span className="badge warning">{dashboardMetrics.duplicateNationalCodes} CN con conflicto</span>
          </div>
          {currentDuplicateConflicts.length === 0 ? (
            <p className="muted">No hay duplicados válidos en esta demo.</p>
          ) : (
            <ul className="list">
              {currentDuplicateConflicts.map((conflict) => (
                <li key={conflict.nationalCode}>
                  <strong>{conflict.nationalCode}</strong>
                  <div className="muted">
                    Gana la fila {conflict.keptRowNumber} ({conflict.keptLocalDescription}). Se descartan las filas{' '}
                    {conflict.discardedRowNumbers.join(', ')}.
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
