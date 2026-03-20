'use client';

import { useState, useTransition, type ChangeEvent } from 'react';

import type {
  PersistedTsvImportHistoryEntry,
  SaveTsvImportPayload,
  SaveTsvImportResult,
} from '@/lib/import/persistence';
import type { OrionCatalogItem, ParseError, ParseResult, ParseWarning } from '@/lib/import/types';
import { parseOrionCatalogTsv } from '@/lib/orion-tsv';

type OrionCatalogParseResult = ParseResult<OrionCatalogItem>;

type ImportsClientProps = {
  initialHistory: PersistedTsvImportHistoryEntry[];
  saveImportAction: (payload: SaveTsvImportPayload) => Promise<SaveTsvImportResult>;
};

type LoadState =
  | {
      status: 'idle';
      fileName: null;
      result: null;
      fileError: null;
    }
  | {
      status: 'ready';
      fileName: string;
      result: OrionCatalogParseResult;
      fileError: null;
    }
  | {
      status: 'failed';
      fileName: string;
      result: null;
      fileError: string;
    };

const initialState: LoadState = {
  status: 'idle',
  fileName: null,
  result: null,
  fileError: null,
};

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
      <article className="card" style={{ boxShadow: 'none' }}>
        <div className="badge primary">Filas leídas</div>
        <div className="metric">{result.rowCount}</div>
        <div className="muted">Filas de datos no vacías procesadas desde el TSV.</div>
      </article>
      <article className="card" style={{ boxShadow: 'none' }}>
        <div className="badge success">Items válidos</div>
        <div className="metric">{result.items.length}</div>
        <div className="muted">Items consolidados tras validación estructural y deduplicación.</div>
      </article>
      <article className="card" style={{ boxShadow: 'none' }}>
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
    <article className="card">
      <div className="section-title">
        <h2>{title}</h2>
        <span className={`badge ${tone}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
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

function ImportHistory({ history }: { history: PersistedTsvImportHistoryEntry[] }) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Histórico de importaciones</h2>
        <span className="badge primary">{history.length}</span>
      </div>
      {history.length === 0 ? (
        <p className="muted">Todavía no hay importaciones TSV guardadas.</p>
      ) : (
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
              {history.map((entry) => (
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
      )}
    </section>
  );
}

export default function ImportsClient({ initialHistory, saveImportAction }: ImportsClientProps) {
  const [loadState, setLoadState] = useState<LoadState>(initialState);
  const [history, setHistory] = useState(initialHistory);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const result = loadState.result;
  const hasErrors = result ? result.errors.length > 0 : false;
  const canSave = loadState.status === 'ready' && !hasErrors && loadState.result.items.length > 0 && !isPending;
  const resultFileName = loadState.status === 'ready' ? loadState.fileName : null;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSaveMessage(null);

    if (!file) {
      setLoadState(initialState);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.tsv')) {
      setLoadState({
        status: 'failed',
        fileName: file.name,
        result: null,
        fileError: 'El fichero seleccionado no es un .tsv válido.',
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseOrionCatalogTsv(buffer, { sourceFile: file.name });
      setLoadState({
        status: 'ready',
        fileName: file.name,
        result: parsed,
        fileError: null,
      });
    } catch (error) {
      setLoadState({
        status: 'failed',
        fileName: file.name,
        result: null,
        fileError: error instanceof Error ? error.message : 'No se pudo leer o parsear el fichero TSV.',
      });
    }
  }

  function handleSaveImport() {
    if (loadState.status !== 'ready' || loadState.result.errors.length > 0) {
      return;
    }

    const payload: SaveTsvImportPayload = {
      fileName: loadState.fileName,
      rowCount: loadState.result.rowCount,
      duplicateCount: loadState.result.duplicateCount,
      warnings: loadState.result.warnings,
      errors: loadState.result.errors,
      items: loadState.result.items,
    };

    startTransition(async () => {
      const response = await saveImportAction(payload);
      setHistory(response.history);
      setSaveMessage(response.ok ? `Importación guardada: ${response.savedImport.fileName}.` : response.message);
    });
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Importaciones</div>
            <h1>Importación TSV Orion con vista previa</h1>
          </div>
          <span className="badge success">Persistencia básica activada</span>
        </div>
        <p className="muted">
          Sube un fichero TSV de catálogo Orion para parsearlo en cliente con{' '}
          <small className="code-inline">parseOrionCatalogTsv</small>, revisa el resultado y guarda la importación de
          forma explícita en base de datos.
        </p>

        <label className="file-picker" htmlFor="orion-tsv-input">
          <span className="badge primary">Seleccionar TSV</span>
          <strong>{loadState.fileName ?? 'Ningún fichero cargado'}</strong>
          <span className="muted">Acepta únicamente ficheros con extensión .tsv.</span>
        </label>
        <input
          id="orion-tsv-input"
          accept=".tsv,text/tab-separated-values"
          className="sr-only"
          onChange={handleFileChange}
          type="file"
        />

        <div className="actions-row">
          <button className="primary-button" disabled={!canSave} onClick={handleSaveImport} type="button">
            {isPending ? 'Guardando…' : 'Guardar importación'}
          </button>
          <span className="muted">
            {hasErrors
              ? 'No se puede guardar mientras existan errores de parser.'
              : 'El guardado crea cabecera e items en transacción.'}
          </span>
        </div>

        {saveMessage ? <p className="muted">{saveMessage}</p> : null}
      </section>

      {loadState.status === 'idle' ? (
        <section className="card empty-state">
          <div className="badge primary">Estado vacío</div>
          <h2>Sin fichero cargado</h2>
          <p className="muted">
            Selecciona un fichero <small className="code-inline">.tsv</small> para ver el resumen del parsing y una
            vista previa de los items detectados.
          </p>
        </section>
      ) : null}

      {loadState.fileError ? (
        <section className="card error-panel">
          <div className="section-title">
            <h2>Error al cargar el fichero</h2>
            <span className="badge danger">Error</span>
          </div>
          <p>{loadState.fileError}</p>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="card">
            <div className="section-title">
              <h2>Resumen del fichero</h2>
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
                <h2>Vista previa bloqueada</h2>
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

      <ImportHistory history={history} />
    </div>
  );
}