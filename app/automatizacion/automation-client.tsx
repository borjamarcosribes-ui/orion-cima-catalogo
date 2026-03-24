'use client';

import { Fragment, useMemo, useState } from 'react';

import type {
  AutomationDashboardData,
  AutomationOriginFilter,
  AutomationStatusFilter,
} from '@/lib/automation-runs';

type AutomationClientProps = {
  data: AutomationDashboardData;
};

type ProcessFilter = 'ALL' | 'NOMENCLATOR' | 'SUPPLY_MONITOR';

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'completed_with_errors':
    case 'skipped_locked':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'primary';
  }
}

export default function AutomationClient({ data }: AutomationClientProps) {
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<AutomationOriginFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AutomationStatusFilter>('all');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    return data.recentRuns.filter((run) => {
      if (processFilter !== 'ALL' && run.processKey !== processFilter) {
        return false;
      }

      if (originFilter === 'manual' && run.displayOrigin !== 'Manual') {
        return false;
      }

      if (originFilter === 'scheduled' && run.displayOrigin !== 'Programado') {
        return false;
      }

      if (statusFilter === 'failed' && run.status !== 'failed') {
        return false;
      }

      return true;
    });
  }, [data.recentRuns, originFilter, processFilter, statusFilter]);

  function toggleRun(runId: string) {
    setExpandedRunId((current: string | null) => (current === runId ? null : runId));
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="grid cols-2">
        <article className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">
            <div>
              <div className="badge primary">Automatización</div>
              <h1 style={{ marginBottom: 8 }}>Histórico de ejecuciones</h1>
              <p className="muted" style={{ margin: 0 }}>
                Trazabilidad operativa de los procesos automáticos de Nomenclátor y del monitor AEMPS / CIMA.
              </p>
            </div>
          </div>
        </article>

        {data.summaryCards.map((card) => (
          <article className="card" key={card.processKey}>
            <div className="section-title">
              <h2 style={{ marginBottom: 0 }}>{card.processLabel}</h2>
              <span className={`badge ${card.status ? getStatusBadgeClass(card.status) : 'primary'}`}>
                {card.status ? card.status : 'Sin ejecuciones'}
              </span>
            </div>
            <div className="muted">Última ejecución</div>
            <div className="metric" style={{ fontSize: '1.5rem' }}>
              {card.lastRunAt ? formatDateTime(card.lastRunAt) : '—'}
            </div>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="section-title">
          <h2 style={{ marginBottom: 0 }}>Locks activos</h2>
          <span className="badge primary">Estado actual</span>
        </div>
        <div className="grid cols-2">
          {data.locks.map((lock) => (
            <div className="list" key={lock.key} style={{ gap: 0 }}>
              <li>
                <strong>{lock.label}</strong>
                <div className="muted">
                  {lock.status === 'active' ? `Activo hasta ${formatDateTime(lock.expiresAt)}` : 'Libre'}
                </div>
              </li>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2 style={{ marginBottom: 0 }}>Ejecuciones recientes</h2>
          <span className="badge primary">{filteredRuns.length}</span>
        </div>

        <div className="actions-row" style={{ marginTop: 0, marginBottom: 16 }}>
          <select onChange={(event) => setProcessFilter(event.target.value as ProcessFilter)} value={processFilter}>
            <option value="ALL">Todos</option>
            <option value="NOMENCLATOR">Nomenclátor</option>
            <option value="SUPPLY_MONITOR">Monitor AEMPS / CIMA</option>
          </select>
          <select onChange={(event) => setOriginFilter(event.target.value as AutomationOriginFilter)} value={originFilter}>
            <option value="all">Todos los orígenes</option>
            <option value="manual">Solo manuales</option>
            <option value="scheduled">Solo programados</option>
          </select>
          <select onChange={(event) => setStatusFilter(event.target.value as AutomationStatusFilter)} value={statusFilter}>
            <option value="all">Todos los estados</option>
            <option value="failed">Solo fallidos</option>
          </select>
        </div>

        {filteredRuns.length === 0 ? (
          <p className="muted">No hay ejecuciones que coincidan con los filtros seleccionados.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha/hora</th>
                  <th>Proceso</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Resumen</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const isExpanded = expandedRunId === run.detail.runId;

                  return (
                    <Fragment key={run.detail.runId}>
                      <tr>
                        <td>{formatDateTime(run.sortDate)}</td>
                        <td>{run.displayProcess}</td>
                        <td>{run.displayOrigin}</td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(run.status)}`}>{run.displayStatus}</span>
                        </td>
                        <td>{run.shortSummary}</td>
                        <td>
                          <button className="secondary-button" onClick={() => toggleRun(run.detail.runId)} type="button">
                            {isExpanded ? 'Ocultar' : 'Ver detalle'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr>
                          <td colSpan={6}>
                            <div className="inline-panel">
                              <div className="grid cols-2" style={{ gap: 12 }}>
                                <div>
                                  <strong>Run ID</strong>
                                  <div className="muted">{run.detail.runId}</div>
                                </div>
                                <div>
                                  <strong>Lock key</strong>
                                  <div className="muted">{run.detail.lockKey ?? '—'}</div>
                                </div>
                                <div>
                                  <strong>Requested at</strong>
                                  <div className="muted">{formatDateTime(run.detail.requestedAt)}</div>
                                </div>
                                <div>
                                  <strong>Requested by</strong>
                                  <div className="muted">{run.detail.requestedBy ?? '—'}</div>
                                </div>
                                <div>
                                  <strong>Started at</strong>
                                  <div className="muted">{formatDateTime(run.detail.startedAt)}</div>
                                </div>
                                <div>
                                  <strong>Finished at</strong>
                                  <div className="muted">{formatDateTime(run.detail.finishedAt)}</div>
                                </div>
                                <div>
                                  <strong>Origen técnico</strong>
                                  <div className="muted">{run.detail.triggerType}</div>
                                </div>
                              </div>

                              <div>
                                <strong>Resumen completo</strong>
                                <pre className="automation-pre">{JSON.stringify(run.detail.summary, null, 2)}</pre>
                              </div>

                              <div>
                                <strong>Errores</strong>
                                {run.detail.errors.length === 0 ? (
                                  <div className="muted">Sin errores registrados.</div>
                                ) : (
                                  <pre className="automation-pre">{JSON.stringify(run.detail.errors, null, 2)}</pre>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}