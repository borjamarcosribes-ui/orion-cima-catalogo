'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ActiveSupplyIssue, SupplyMonitorOverview } from '@/lib/supply-monitor';

type MonitorClientProps = {
  overview: SupplyMonitorOverview;
  activeIssues: ActiveSupplyIssue[];
  runMonitorAction: () => Promise<void>;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
  }).format(new Date(value));
}

export default function MonitorClient({ overview, activeIssues, runMonitorAction }: MonitorClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showActivo, setShowActivo] = useState(true);
  const [showLab, setShowLab] = useState(true);

  const filteredActiveIssues = useMemo(() => {
    if ((!showActivo && !showLab) || (showActivo && showLab)) {
      return activeIssues;
    }

    return activeIssues.filter((issue) => {
      if (showActivo) {
        return issue.status === 'ACTIVO';
      }

      return issue.status === 'LAB';
    });
  }, [activeIssues, showActivo, showLab]);

  function handleRunMonitor() {
    setMessage(null);

    startTransition(async () => {
      try {
        await runMonitorAction();
        setMessage('Monitor AEMPS ejecutado correctamente.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo ejecutar el monitor AEMPS.');
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Suministro</div>
            <h1>Monitor AEMPS / CIMA</h1>
          </div>
          <span className="badge success">Consulta manual por CN</span>
        </div>
        <p className="muted">
          Esta vista monitoriza los medicamentos vigilables ya conocidos por la app. El TSV solo refresca el universo de
          productos vigilados; la vigilancia sigue funcionando sobre los CN ya guardados.
        </p>
        <div className="actions-row">
          <button className="primary-button" disabled={isPending} onClick={handleRunMonitor} type="button">
            {isPending ? 'Ejecutando…' : 'Ejecutar monitor AEMPS ahora'}
          </button>
          <span className="muted">
            El monitor consulta CIMA por CN, actualiza estado, registra cambios y conserva los errores por producto sin
            abortar todo el run.
          </span>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </section>

      <section className="grid cols-3">
        <article className="card">
          <div className="badge primary">Productos vigilados</div>
          <div className="metric">{overview.watchedProducts}</div>
          <div className="muted">Medicamentos vigilables derivados de Orion con código exacto XXXXXX.CNA.</div>
        </article>
        <article className="card">
          <div className="badge warning">CN con rotura activa</div>
          <div className="metric">{overview.activeIssues}</div>
          <div className="muted">Estado actual conocido tras la última consulta realizada.</div>
        </article>
        <article className="card">
          <div className="badge success">Última ejecución</div>
          <div className="metric">
            {overview.latestRun ? formatDateTime(overview.latestRun.finishedAt ?? overview.latestRun.startedAt) : '—'}
          </div>
          <div className="muted">Último run del monitor guardado en la base local.</div>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title">
            <h2>Resumen del último run</h2>
            <span className="badge primary">{overview.latestRun?.status ?? 'sin runs'}</span>
          </div>
          {overview.latestRun ? (
            <ul className="list compact-list">
              <li>
                <strong>Nuevas roturas</strong>
                <div className="muted">{overview.newIssues}</div>
              </li>
              <li>
                <strong>Roturas resueltas</strong>
                <div className="muted">{overview.resolvedIssues}</div>
              </li>
              <li>
                <strong>Productos revisados</strong>
                <div className="muted">{overview.latestRun.checkedProducts}</div>
              </li>
              <li>
                <strong>Cambios detectados</strong>
                <div className="muted">{overview.latestRun.changedProducts}</div>
              </li>
            </ul>
          ) : (
            <p className="muted">Todavía no se ha ejecutado el monitor.</p>
          )}
        </article>

        <article className="card">
          <div className="section-title">
            <h2>Última ejecución</h2>
            <span className="badge warning">manual</span>
          </div>
          {overview.latestRun ? (
            <ul className="list compact-list">
              <li>
                <strong>Inicio</strong>
                <div className="muted">{formatDateTime(overview.latestRun.startedAt)}</div>
              </li>
              <li>
                <strong>Fin</strong>
                <div className="muted">{formatDateTime(overview.latestRun.finishedAt)}</div>
              </li>
              <li>
                <strong>Estado</strong>
                <div className="muted">{overview.latestRun.status}</div>
              </li>
              <li>
                <strong>Roturas activas</strong>
                <div className="muted">{overview.latestRun.activeIssues}</div>
              </li>
            </ul>
          ) : (
            <p className="muted">Sin ejecuciones todavía.</p>
          )}
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Roturas activas</h2>
          <span className="badge warning">{filteredActiveIssues.length}</span>
        </div>
        {activeIssues.length === 0 ? (
          <p className="muted">No hay roturas activas persistidas en este momento.</p>
        ) : (
          <>
            <div className="actions-row" style={{ marginBottom: 16 }}>
              <label style={{ alignItems: 'center', display: 'inline-flex', gap: 8 }}>
                <input checked={showActivo} onChange={(event) => setShowActivo(event.target.checked)} type="checkbox" />
                <span>ACTIVO</span>
              </label>
              <label style={{ alignItems: 'center', display: 'inline-flex', gap: 8 }}>
                <input checked={showLab} onChange={(event) => setShowLab(event.target.checked)} type="checkbox" />
                <span>LAB</span>
              </label>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>CN</th>
                    <th>Estado</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Fin esperado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveIssues.map((issue) => (
                    <tr key={`${issue.cn}-${issue.articleCode}`}>
                      <td>{issue.cn}</td>
                      <td>{issue.status}</td>
                      <td>{issue.shortDescription}</td>
                      <td>{issue.issueType ?? '—'}</td>
                      <td>{formatDateOnly(issue.startedAt)}</td>
                      <td>{formatDateOnly(issue.expectedEndAt)}</td>
                      <td>{issue.observations ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Eventos recientes</h2>
          <span className="badge primary">{overview.recentEvents.length}</span>
        </div>
        {overview.recentEvents.length === 0 ? (
          <p className="muted">Todavía no hay eventos relevantes de suministro.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>CN</th>
                  <th>Artículo</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>{event.eventType}</td>
                    <td>{event.cn}</td>
                    <td>{event.articleCode}</td>
                    <td>{event.shortDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}