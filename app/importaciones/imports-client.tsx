'use client';

import { useEffect, useMemo, useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

import type {
  PersistedTsvImportHistoryEntry,
  PersistedTsvImportPreview,
  SaveTsvImportPayload,
  SaveTsvImportResult,
} from '@/lib/import/persistence';
import type { OrionCatalogItem, ParseError, ParseResult, ParseWarning } from '@/lib/import/types';
import { parseOrionCatalogTsv } from '@/lib/orion-tsv';

type OrionCatalogParseResult = ParseResult<OrionCatalogItem>;

type PreviewState = {
  fileName: string;
  result: OrionCatalogParseResult;
  source: 'local' | 'persisted';
  importId?: string;
  importedAt?: string;
};

type ImportsClientProps = {
  initialHistory: PersistedTsvImportHistoryEntry[];
  initialPersistedImport: PersistedTsvImportPreview | null;
  saveImportAction: (payload: SaveTsvImportPayload) => Promise<SaveTsvImportResult>;
};

type LoadState =
  | {
      status: 'idle';
      preview: null;
      fileError: null;
    }
  | {
      status: 'ready';
      preview: PreviewState;
      fileError: null;
    }
  | {
      status: 'failed';
      preview: null;
      fileError: string;
    };

const initialState: LoadState = {
  status: 'idle',
  preview: null,
  fileError: null,
};

const HISTORY_PAGE_SIZE = 10;

function buildPreviewStateFromPersistedImport(importData: PersistedTsvImportPreview): PreviewState {
  return {
    fileName: importData.fileName,
    result: importData.result,
    source: 'persisted',
    importId: importData.id,
    importedAt: importData.importedAt,
  };
}

function formatRowNumbers(rowNumbers?: number[]): string {
  return rowNumbers && rowNumbers.length > 0 ? ` · filas ${rowNumbers.join(', ')}` : '';
}

function formatImportedAt(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ResultSummary({ result }: { result: OrionCatalogParseResult }) {
  return (
    <div className="grid cols-3">
      <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
        <div className="badge primary">Filas leídas</div>
        <div className="metric">{result.rowCount}</div>
        <div className="muted">Filas de datos no vacías procesadas desde el TSV.</div>
      </article>
      <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
        <div className="badge success">Items válidos</div>
        <div className="metric">{result.items.length}</div>
        <div className="muted">Items consolidados tras validación estructural y deduplicación.</div>
      </article>
      <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
        <div className="badge warning">Duplicados detectados</div>
        <div className="metric">{result.duplicateCount}</div>
        <div className="muted">Duplicados idénticos o conflictivos detectados durante el parsing.</div>
      </article>
    </div>
  );
}

function MessageList({
  title,
  emptyMessage,
  items,
  tone,
}: {
  title: string;
  emptyMessage: string;
  items: ParseWarning[] | ParseError[];
  tone: 'warning' | 'danger';
}) {
  return (
    <article className="card" style={{ borderColor: items.length > 0 ? `var(--${tone})` : 'var(--border)' }}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Revisión de incidencias detectadas durante el análisis del fichero.
          </p>
        </div>
        <span className={`badge ${tone}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="inline-panel" style={{ background: 'var(--surface)', textAlign: 'center' }}>
          <strong>Sin incidencias</strong>
          <p className="muted" style={{ margin: 0 }}>{emptyMessage}</p>
        </div>
      ) : (
        <ul className="list compact-list">
          {items.map((item, index) => (
            <li key={`${item.code}-${index}`}>
              <strong>{item.code}</strong>
              <div className="muted">
                {item.message}
                {formatRowNumbers(item.rowNumbers)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ItemsPreviewTable({ items }: { items: OrionCatalogItem[] }) {
  return (
    <article className="card">
      <div className="section-title">
        <h2>Vista previa de items</h2>
        <span className="badge success">{items.length} items</span>
      </div>
      <div className="table-scroll">
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
            {items.map((item) => (
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
    </article>
  );
}

function ImportHistory({
  history,
  currentPage,
  onPageChange,
}: {
  history: PersistedTsvImportHistoryEntry[];
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), pageCount);
  const startIndex = (safeCurrentPage - 1) * HISTORY_PAGE_SIZE;
  const visibleHistory = history.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h2>Histórico de importaciones</h2>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Importaciones TSV guardadas, con los mismos totales de filas, items válidos e incidencias registradas.
          </p>
        </div>
        <span className="badge primary">{history.length} importaciones</span>
      </div>
      {history.length === 0 ? (
        <div className="inline-panel" style={{ background: 'var(--surface)', textAlign: 'center' }}>
          <strong>Sin importaciones guardadas</strong>
          <p className="muted" style={{ margin: 0 }}>Todavía no hay importaciones TSV guardadas.</p>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha/hora</th>
                  <th>Fichero</th>
                  <th>Filas</th>
                  <th>Items válidos</th>
                  <th>Duplicados</th>
                  <th>Warnings</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatImportedAt(entry.importedAt)}</td>
                    <td>{entry.fileName}</td>
                    <td>{entry.rowCount}</td>
                    <td>{entry.validItems}</td>
                    <td>{entry.duplicateCount}</td>
                    <td>{entry.warningCount}</td>
                    <td>{entry.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="actions-row" style={{ marginTop: 16 }}>
              <button
                className="secondary-button"
                disabled={safeCurrentPage <= 1}
                onClick={() => onPageChange(safeCurrentPage - 1)}
                type="button"
              >
                Anteriores
              </button>
              <span className="muted">
                Página {safeCurrentPage} de {pageCount}
              </span>
              <button
                className="secondary-button"
                disabled={safeCurrentPage >= pageCount}
                onClick={() => onPageChange(safeCurrentPage + 1)}
                type="button"
              >
                Siguientes
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function ImportsClient({
  initialHistory,
  initialPersistedImport,
  saveImportAction,
}: ImportsClientProps) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>(
    initialPersistedImport
      ? {
          status: 'ready',
          preview: buildPreviewStateFromPersistedImport(initialPersistedImport),
          fileError: null,
        }
      : initialState,
  );
  const [history, setHistory] = useState(initialHistory);
  const [historyPage, setHistoryPage] = useState(1);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    if (initialPersistedImport) {
      setLoadState({
        status: 'ready',
        preview: buildPreviewStateFromPersistedImport(initialPersistedImport),
        fileError: null,
      });
      return;
    }

    setLoadState((currentState) =>
      currentState.status === 'ready' && currentState.preview.source === 'local' ? currentState : initialState,
    );
  }, [initialPersistedImport]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE)), [history]);

  useEffect(() => {
    setHistoryPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  const preview = loadState.preview;
  const result = preview?.result ?? null;
  const hasErrors = result ? result.errors.length > 0 : false;
  const canSave = preview?.source === 'local' && result !== null && !hasErrors && result.items.length > 0 && !isPending;
  const resultFileName = preview?.fileName ?? null;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSaveMessage(null);
    router.replace('/importaciones', { scroll: false });

    if (!file) {
      setLoadState(initialState);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.tsv')) {
      setLoadState({
        status: 'failed',
        preview: null,
        fileError: 'El fichero seleccionado no es un .tsv válido.',
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseOrionCatalogTsv(buffer, { sourceFile: file.name });
      setLoadState({
        status: 'ready',
        preview: {
          fileName: file.name,
          result: parsed,
          source: 'local',
        },
        fileError: null,
      });
    } catch (error) {
      setLoadState({
        status: 'failed',
        preview: null,
        fileError: error instanceof Error ? error.message : 'No se pudo leer o parsear el fichero TSV.',
      });
    }
  }

  function handleSaveImport() {
    if (loadState.status !== 'ready' || loadState.preview.source !== 'local' || loadState.preview.result.errors.length > 0) {
      return;
    }

    const payload: SaveTsvImportPayload = {
      fileName: loadState.preview.fileName,
      rowCount: loadState.preview.result.rowCount,
      duplicateCount: loadState.preview.result.duplicateCount,
      warnings: loadState.preview.result.warnings,
      errors: loadState.preview.result.errors,
      items: loadState.preview.result.items,
    };

    startTransition(async () => {
      const response = await saveImportAction(payload);
      setHistory(response.history);
      setHistoryPage(1);

      if (response.ok) {
        setSaveMessage(`Importación guardada: ${response.savedImport.fileName}.`);
        router.replace(`/importaciones?importId=${response.savedImport.id}`, { scroll: false });
        return;
      }

      setSaveMessage(response.message);
    });
  }

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
        <div className="section-title" style={{ alignItems: 'flex-start', gap: 18, marginBottom: 0, position: 'relative' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <span className="badge primary" style={{ width: 'fit-content' }}>Importaciones Orion</span>
            <div>
              <h1 style={{ letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0 }}>Importación TSV con vista previa</h1>
              <p className="muted" style={{ margin: '10px 0 0', maxWidth: 760 }}>
                Sube un fichero .tsv resultante de la exportación de la Consulta de Catálogo de Artículos, revisa el
                parsing y guarda la importación para almacenarla en base de datos.
              </p>
            </div>
          </div>
          {result ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
              <div
                style={{
                  background: 'var(--surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  minWidth: 112,
                  padding: '10px 12px',
                }}
              >
                <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>Filas leídas</div>
                <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{result.rowCount}</div>
              </div>
              <div
                style={{
                  background: 'var(--surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  minWidth: 112,
                  padding: '10px 12px',
                }}
              >
                <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>Items válidos</div>
                <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{result.items.length}</div>
              </div>
              <div
                style={{
                  background: result.duplicateCount > 0 ? '#fff8e7' : 'var(--surface-alt)',
                  border: `1px solid ${result.duplicateCount > 0 ? 'rgba(154, 103, 0, 0.24)' : 'var(--border)'}`,
                  borderRadius: 14,
                  minWidth: 112,
                  padding: '10px 12px',
                }}
              >
                <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>Duplicados</div>
                <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{result.duplicateCount}</div>
              </div>
              <div
                style={{
                  background: result.errors.length > 0 ? '#fff7f6' : 'var(--surface-alt)',
                  border: `1px solid ${result.errors.length > 0 ? 'rgba(161, 42, 47, 0.22)' : 'var(--border)'}`,
                  borderRadius: 14,
                  minWidth: 112,
                  padding: '10px 12px',
                }}
              >
                <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>Errores</div>
                <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{result.errors.length}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="inline-panel" style={{ position: 'relative' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 0 }}>1. Seleccionar TSV</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Carga el fichero exportado de Orion para generar una vista previa local antes de guardar.
              </p>
            </div>
            <span className="badge primary">{resultFileName ? 'Fichero cargado' : 'Pendiente'}</span>
          </div>
          <label className="file-picker" htmlFor="orion-tsv-input">
            <span className="badge primary">Seleccionar TSV</span>
            <strong>{resultFileName ?? 'Ningún fichero cargado'}</strong>
            <span className="muted">Acepta únicamente ficheros con extensión .tsv.</span>
          </label>
          <input
            id="orion-tsv-input"
            accept=".tsv,text/tab-separated-values"
            className="sr-only"
            onChange={handleFileChange}
            type="file"
          />
        </div>

        <div className="inline-panel" style={{ position: 'relative' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ marginBottom: 0 }}>2. Revisar y guardar</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                La importación solo se habilita si la vista previa local no tiene errores de parser.
              </p>
            </div>
            <span className={`badge ${hasErrors ? 'danger' : result ? 'success' : 'primary'}`}>
              {hasErrors ? 'Bloqueado por errores' : result ? 'Listo para revisar' : 'Sin vista previa'}
            </span>
          </div>
          <div className="actions-row" style={{ marginTop: 0 }}>
            <button className="primary-button" disabled={!canSave} onClick={handleSaveImport} type="button">
              {isPending ? 'Guardando…' : 'Guardar importación'}
            </button>
            <span className="muted">
              {preview?.source === 'persisted'
                ? `Vista previa cargada desde una importación guardada${preview.importedAt ? ` · ${formatImportedAt(preview.importedAt)}` : ''}.`
                : hasErrors
                  ? 'No se puede guardar mientras existan errores de parser.'
                  : 'El guardado crea cabecera e items en transacción.'}
            </span>
          </div>

          {saveMessage ? <p className="muted" style={{ margin: 0 }}>{saveMessage}</p> : null}
        </div>
      </section>

      {loadState.status === 'idle' ? (
        <section className="card empty-state">
          <div className="badge primary">Estado vacío</div>
          <h2>Sin fichero cargado</h2>
          <p className="muted">
            Selecciona un fichero <small className="code-inline">.tsv</small> para ver el resumen del parsing y una
            vista previa de los items detectados.
          </p>
          <div className="inline-panel" style={{ background: 'var(--surface)', marginTop: 12 }}>
            <strong>Secuencia esperada</strong>
            <p className="muted" style={{ margin: 0 }}>Seleccionar TSV → revisar warnings/errors → guardar importación.</p>
          </div>
        </section>
      ) : null}

      {loadState.fileError ? (
        <section className="card error-panel">
          <div className="section-title">
            <div>
              <h2>Error al cargar el fichero</h2>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                No se ha generado vista previa. Selecciona un TSV válido para continuar.
              </p>
            </div>
            <span className="badge danger">Error</span>
          </div>
          <p>{loadState.fileError}</p>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="card">
            <div className="section-title">
              <div>
                <h2>Resumen del fichero</h2>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Resultado agregado del parsing previo al guardado.
                </p>
              </div>
              <span className="badge primary">{resultFileName}</span>
            </div>
            <ResultSummary result={result} />
          </section>

          <section className="grid cols-2">
            <MessageList
              emptyMessage="No se han detectado warnings en este fichero."
              items={result.warnings}
              title="Warnings"
              tone="warning"
            />
            <MessageList
              emptyMessage="No se han detectado errores en este fichero."
              items={result.errors}
              title="Errors"
              tone="danger"
            />
          </section>

          {hasErrors ? (
            <section className="card error-panel">
              <div className="section-title">
                <div>
                  <h2>Vista previa bloqueada</h2>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    Revisa la lista de errores antes de intentar guardar o visualizar los items válidos.
                  </p>
                </div>
                <span className="badge danger">{result.errors.length} errores</span>
              </div>
              <p>
                El parser ha detectado errores y por eso no se muestra la tabla de items válidos hasta corregir el
                fichero.
              </p>
            </section>
          ) : (
            <ItemsPreviewTable items={result.items} />
          )}
        </>
      ) : null}

      <ImportHistory history={history} currentPage={historyPage} onPageChange={setHistoryPage} />
    </div>
  );
}
