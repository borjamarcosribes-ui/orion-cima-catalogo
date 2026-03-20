'use client';

import { useMemo, useState } from 'react';

import { parseOrionCatalogTsv } from '@/lib/orion-tsv';
import type { ParseResult, OrionCatalogItem } from '@/lib/import/types';

type ImportState = {
  fileName: string;
  result: ParseResult<OrionCatalogItem> | null;
  extensionError: string | null;
};

const emptyState: ImportState = {
  fileName: '',
  result: null,
  extensionError: null,
};

export default function ImportsPage() {
  const [state, setState] = useState<ImportState>(emptyState);
  const [isLoading, setIsLoading] = useState(false);

  const summary = useMemo(() => {
    if (!state.result) return null;

    return {
      rowCount: state.result.rowCount,
      validItems: state.result.items.length,
      duplicateCount: state.result.duplicateCount,
      warningCount: state.result.warnings.length,
      errorCount: state.result.errors.length,
    };
  }, [state.result]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setState(emptyState);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.tsv')) {
      setState({
        fileName: file.name,
        result: null,
        extensionError: 'Solo se permiten ficheros .tsv en esta pantalla.',
      });
      return;
    }

    try {
      setIsLoading(true);

      const buffer = await file.arrayBuffer();
      const result = parseOrionCatalogTsv(buffer, { sourceFile: file.name });

      setState({
        fileName: file.name,
        result,
        extensionError: null,
      });
    } catch (error) {
      setState({
        fileName: file.name,
        result: {
          headers: [],
          items: [],
          warnings: [],
          errors: [
            {
              code: 'INVALID_STRUCTURE',
              message:
                error instanceof Error
                  ? error.message
                  : 'Se produjo un error inesperado al procesar el fichero TSV.',
            },
          ],
          rowCount: 0,
          duplicateCount: 0,
        },
        extensionError: null,
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  }

  const hasErrors = Boolean(state.result && state.result.errors.length > 0);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Importaciones</div>
            <h1>Importación real de catálogo Orion TSV</h1>
          </div>
          <span className="badge success">Vista previa sin persistencia</span>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Selecciona un fichero TSV exportado desde Orion Logis para validarlo y ver una vista previa antes de guardar
          nada en base de datos.
        </p>

        <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          <label htmlFor="tsv-file" style={{ fontWeight: 600 }}>
            Seleccionar fichero TSV
          </label>
          <input
            id="tsv-file"
            type="file"
            accept=".tsv,text/tab-separated-values"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <p className="muted" style={{ margin: 0 }}>
            Solo se aceptan archivos <strong>.tsv</strong>.
          </p>
        </div>
      </section>

      {!state.fileName && !state.extensionError && !state.result ? (
        <section className="card">
          <div className="section-title">
            <h2>Estado inicial</h2>
            <span className="badge primary">Sin fichero</span>
          </div>
          <p className="muted">
            Todavía no has cargado ningún archivo. Prueba con un export real de Orion o con uno de los fixtures de
            tests.
          </p>
        </section>
      ) : null}

      {state.extensionError ? (
        <section className="card" style={{ border: '1px solid #dc2626' }}>
          <div className="section-title">
            <h2>Error de extensión</h2>
            <span className="badge danger">Bloqueado</span>
          </div>
          <p>{state.extensionError}</p>
        </section>
      ) : null}

      {state.fileName && summary ? (
        <section className="grid cols-3">
          <article className="card">
            <div className="badge primary">Fichero cargado</div>
            <div style={{ marginTop: 12, fontWeight: 700, wordBreak: 'break-word' }}>{state.fileName}</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Archivo procesado en cliente.
            </div>
          </article>

          <article className="card">
            <div className="badge success">Resumen</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              <div>
                <strong>Filas leídas:</strong> {summary.rowCount}
              </div>
              <div>
                <strong>Items válidos:</strong> {summary.validItems}
              </div>
              <div>
                <strong>Duplicados detectados:</strong> {summary.duplicateCount}
              </div>
            </div>
          </article>

          <article className="card">
            <div className="badge warning">Mensajes</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              <div>
                <strong>Warnings:</strong> {summary.warningCount}
              </div>
              <div>
                <strong>Errors:</strong> {summary.errorCount}
              </div>
              <div className="muted">{hasErrors ? 'La tabla se bloquea si hay errores.' : 'Vista previa disponible.'}</div>
            </div>
          </article>
        </section>
      ) : null}

      {state.result?.warnings.length ? (
        <section className="card" style={{ border: '1px solid #f59e0b' }}>
          <div className="section-title">
            <h2>Warnings</h2>
            <span className="badge warning">{state.result.warnings.length}</span>
          </div>
          <ul className="list">
            {state.result.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <strong>{warning.code}</strong>
                <div className="muted">{warning.message}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.result?.errors.length ? (
        <section className="card" style={{ border: '1px solid #dc2626' }}>
          <div className="section-title">
            <h2>Errores</h2>
            <span className="badge danger">{state.result.errors.length}</span>
          </div>
          <ul className="list">
            {state.result.errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                <strong>{error.code}</strong>
                <div className="muted">{error.message}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.result && !hasErrors ? (
        <section className="card">
          <div className="section-title">
            <h2>Vista previa de items válidos</h2>
            <span className="badge success">{state.result.items.length} items</span>
          </div>

          {state.result.items.length === 0 ? (
            <p className="muted">El parser no ha producido items válidos para este fichero.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>articleCode</th>
                    <th>shortDescription</th>
                    <th>unit</th>
                    <th>statusOriginal</th>
                    <th>statusNormalized</th>
                  </tr>
                </thead>
                <tbody>
                  {state.result.items.map((item) => (
                    <tr key={`${item.articleCode}-${item.rowNumber}`}>
                      <td>{item.articleCode}</td>
                      <td>{item.shortDescription}</td>
                      <td>{item.unit ?? '—'}</td>
                      <td>{item.statusOriginal}</td>
                      <td>{item.statusNormalized}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}