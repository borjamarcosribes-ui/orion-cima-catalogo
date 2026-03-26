'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { SupplyNotificationActionResult } from '@/app/automatizacion/actions';
import type {
  AutomationDashboardData,
  AutomationOriginFilter,
  AutomationStatusFilter,
} from '@/lib/automation-runs';

type AutomationClientProps = {
  data: AutomationDashboardData;
  createSupplyNotificationSubscriptionAction: (input: {
    email: string;
    endDate?: string | null;
  }) => Promise<SupplyNotificationActionResult>;
  toggleSupplyNotificationSubscriptionAction: (input: {
    id: string;
    enabled: boolean;
  }) => Promise<SupplyNotificationActionResult>;
  deleteSupplyNotificationSubscriptionAction: (input: {
    id: string;
  }) => Promise<SupplyNotificationActionResult>;
};

type ProcessFilter =
  | 'ALL'
  | 'NOMENCLATOR'
  | 'SUPPLY_MONITOR'
  | 'CIMA_WATCHED'
  | 'CIMA_ALL'
  | 'BIFIMED_ALL'
  | 'SUPPLY_EMAIL_DIGEST';

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

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
    case 'sent':
      return 'success';
    case 'completed_with_errors':
    case 'skipped_locked':
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'primary';
  }
}

function formatNotificationRunStatus(status: string): string {
  switch (status) {
    case 'sent':
      return 'Enviado';
    case 'failed':
      return 'Fallido';
    case 'pending':
      return 'Pendiente';
    default:
      return status;
  }
}

export default function AutomationClient({
  data,
  createSupplyNotificationSubscriptionAction,
  toggleSupplyNotificationSubscriptionAction,
  deleteSupplyNotificationSubscriptionAction,
}: AutomationClientProps) {
  const router = useRouter();
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<AutomationOriginFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AutomationStatusFilter>('all');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [endDate, setEndDate] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleCreateSubscription() {
    setSubscriptionMessage(null);
    setPendingSubscriptionAction('create');

    startTransition(async () => {
      try {
        const response = await createSupplyNotificationSubscriptionAction({
          email,
          endDate: endDate || null,
        });

        setSubscriptionMessage(response.message);

        if (response.ok) {
          setEmail('');
          setEndDate('');
          router.refresh();
        }
      } finally {
        setPendingSubscriptionAction(null);
      }
    });
  }

  function handleToggleSubscription(id: string, enabled: boolean) {
    setSubscriptionMessage(null);
    setPendingSubscriptionAction(`toggle:${id}`);

    startTransition(async () => {
      try {
        const response = await toggleSupplyNotificationSubscriptionAction({ id, enabled });
        setSubscriptionMessage(response.message);

        if (response.ok) {
          router.refresh();
        }
      } finally {
        setPendingSubscriptionAction(null);
      }
    });
  }

  function handleDeleteSubscription(id: string) {
    setSubscriptionMessage(null);
    setPendingSubscriptionAction(`delete:${id}`);

    startTransition(async () => {
      try {
        const response = await deleteSupplyNotificationSubscriptionAction({ id });
        setSubscriptionMessage(response.message);

        if (response.ok) {
          router.refresh();
        }
      } finally {
        setPendingSubscriptionAction(null);
      }
    });
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
                Trazabilidad operativa de Nomenclátor, monitor AEMPS / CIMA, refrescos de caché y notificaciones
                diarias por email.
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
          <div>
            <h2 style={{ marginBottom: 0 }}>Notificaciones diarias por email</h2>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Configura las direcciones que recibirán el resumen diario de cambios en problemas de suministro de las
              últimas 24 horas. Si la fecha fin se deja en blanco, la notificación seguirá activa sin límite.
            </p>
          </div>
          <span className="badge primary">{data.notificationSubscriptions.length}</span>
        </div>

        <div
          className="grid cols-3"
          style={{
            gap: 12,
            alignItems: 'end',
            marginTop: 16,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <small className="muted">Email</small>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="farmacia@hospital.es"
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <small className="muted">Fecha fin de notificaciones</small>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>

          <div className="actions-row" style={{ marginTop: 0 }}>
            <button
              className="primary-button"
              type="button"
              onClick={handleCreateSubscription}
              disabled={isPending && pendingSubscriptionAction === 'create'}
            >
              {isPending && pendingSubscriptionAction === 'create' ? 'Guardando…' : 'Guardar notificación'}
            </button>
          </div>
        </div>

        {subscriptionMessage ? <p className="muted">{subscriptionMessage}</p> : null}

        {data.notificationSubscriptions.length === 0 ? (
          <p className="muted">Todavía no hay direcciones configuradas para recibir el digest diario.</p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Activa</th>
                  <th>Fecha fin</th>
                  <th>Último envío</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.notificationSubscriptions.map((subscription) => {
                  const toggleKey = `toggle:${subscription.id}`;
                  const deleteKey = `delete:${subscription.id}`;

                  return (
                    <tr key={subscription.id}>
                      <td>{subscription.email}</td>
                      <td>{subscription.enabled ? 'Sí' : 'No'}</td>
                      <td>{formatDateOnly(subscription.endDate)}</td>
                      <td>{formatDateTime(subscription.lastSentAt)}</td>
                      <td>
                        <div className="actions-row" style={{ marginTop: 0 }}>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => handleToggleSubscription(subscription.id, !subscription.enabled)}
                            disabled={isPending && pendingSubscriptionAction === toggleKey}
                          >
                            {isPending && pendingSubscriptionAction === toggleKey
                              ? 'Guardando…'
                              : subscription.enabled
                                ? 'Desactivar'
                                : 'Activar'}
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => handleDeleteSubscription(subscription.id)}
                            disabled={isPending && pendingSubscriptionAction === deleteKey}
                          >
                            {isPending && pendingSubscriptionAction === deleteKey ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h2 style={{ marginBottom: 0 }}>Últimos envíos de notificaciones</h2>
          <span className="badge primary">{data.notificationRuns.length}</span>
        </div>

        {data.notificationRuns.length === 0 ? (
          <p className="muted">Todavía no se han registrado envíos de notificaciones.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Ventana inicio</th>
                  <th>Ventana fin</th>
                  <th>Eventos</th>
                  <th>Estado</th>
                  <th>Enviado</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {data.notificationRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.email}</td>
                    <td>{formatDateTime(run.windowStart)}</td>
                    <td>{formatDateTime(run.windowEnd)}</td>
                    <td>{run.eventsCount}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(run.status)}`}>
                        {formatNotificationRunStatus(run.status)}
                      </span>
                    </td>
                    <td>{formatDateTime(run.sentAt)}</td>
                    <td>{run.errorMessage ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <option value="CIMA_WATCHED">Caché CIMA (watched)</option>
            <option value="CIMA_ALL">Caché CIMA (all)</option>
            <option value="BIFIMED_ALL">Caché BIFIMED (all)</option>
            <option value="SUPPLY_EMAIL_DIGEST">Digest diario por email</option>
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