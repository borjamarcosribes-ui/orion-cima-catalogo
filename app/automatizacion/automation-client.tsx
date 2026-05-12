"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SupplyNotificationActionResult } from "@/app/automatizacion/actions";
import type {
  AutomationDashboardData,
  AutomationOriginFilter,
  AutomationStatusFilter,
} from "@/lib/automation-runs";

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
  readOnly?: boolean;
};

type ProcessFilter =
  | "ALL"
  | "NOMENCLATOR"
  | "SUPPLY_MONITOR"
  | "CIMA_WATCHED"
  | "CIMA_ALL"
  | "BIFIMED_ALL"
  | "SUPPLY_EMAIL_DIGEST"
  | "UNIT_DOSE_CACHE";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
  }).format(new Date(value));
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
    case "sent":
      return "success";
    case "completed_with_errors":
    case "skipped_locked":
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "primary";
  }
}

function formatNotificationRunStatus(status: string): string {
  switch (status) {
    case "sent":
      return "Enviado";
    case "failed":
      return "Fallido";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

export default function AutomationClient({
  data,
  createSupplyNotificationSubscriptionAction,
  toggleSupplyNotificationSubscriptionAction,
  deleteSupplyNotificationSubscriptionAction,
  readOnly = false,
}: AutomationClientProps) {
  const router = useRouter();
  const [processFilter, setProcessFilter] = useState<ProcessFilter>("ALL");
  const [originFilter, setOriginFilter] =
    useState<AutomationOriginFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<AutomationStatusFilter>("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [endDate, setEndDate] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(
    null,
  );
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<
    string | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const filteredRuns = useMemo(() => {
    return data.recentRuns.filter((run) => {
      if (processFilter !== "ALL" && run.processKey !== processFilter) {
        return false;
      }

      if (originFilter === "manual" && run.displayOrigin !== "Manual") {
        return false;
      }

      if (originFilter === "scheduled" && run.displayOrigin !== "Programado") {
        return false;
      }

      if (statusFilter === "failed" && run.status !== "failed") {
        return false;
      }

      return true;
    });
  }, [data.recentRuns, originFilter, processFilter, statusFilter]);

  function toggleRun(runId: string) {
    setExpandedRunId((current: string | null) =>
      current === runId ? null : runId,
    );
  }

  function handleCreateSubscription() {
    setSubscriptionMessage(null);
    setPendingSubscriptionAction("create");

    startTransition(async () => {
      try {
        const response = await createSupplyNotificationSubscriptionAction({
          email,
          endDate: endDate || null,
        });

        setSubscriptionMessage(response.message);

        if (response.ok) {
          setEmail("");
          setEndDate("");
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
        const response = await toggleSupplyNotificationSubscriptionAction({
          id,
          enabled,
        });
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
        const response = await deleteSupplyNotificationSubscriptionAction({
          id,
        });
        setSubscriptionMessage(response.message);

        if (response.ok) {
          router.refresh();
        }
      } finally {
        setPendingSubscriptionAction(null);
      }
    });
  }

  const activeLocks = data.locks.filter(
    (lock) => lock.status === "active",
  ).length;
  const failedRecentRuns = data.recentRuns.filter(
    (run) => run.status === "failed",
  ).length;
  const enabledSubscriptions = data.notificationSubscriptions.filter(
    (subscription) => subscription.enabled,
  ).length;

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section
        className="card"
        style={{
          display: "grid",
          gap: 20,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 107, 143, 0.16), rgba(8, 122, 85, 0.06))",
            borderRadius: 999,
            height: 190,
            position: "absolute",
            right: -78,
            top: -118,
            width: 190,
          }}
        />
        <div
          className="section-title"
          style={{ alignItems: "flex-start", gap: 18, position: "relative" }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <span className="badge primary" style={{ width: "fit-content" }}>
              Automatización operativa
            </span>
            <div>
              <h1
                style={{
                  letterSpacing: "-0.04em",
                  lineHeight: 1.05,
                  margin: 0,
                }}
              >
                Panel de automatización
              </h1>
              <p
                className="muted"
                style={{ margin: "10px 0 0", maxWidth: 780 }}
              >
                Trazabilidad de Nomenclátor, monitor AEMPS / CIMA, refrescos de
                caché y notificaciones diarias por email con lectura rápida del
                estado general de procesos.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                minWidth: 130,
                padding: "10px 12px",
              }}
            >
              <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>
                Procesos
              </div>
              <div
                className="metric"
                style={{ fontSize: "1.35rem", margin: "4px 0 0" }}
              >
                {data.summaryCards.length}
              </div>
            </div>
            <div
              style={{
                background: activeLocks > 0 ? "#fff8e7" : "var(--surface-alt)",
                border: `1px solid ${activeLocks > 0 ? "rgba(154, 103, 0, 0.24)" : "var(--border)"}`,
                borderRadius: 14,
                minWidth: 130,
                padding: "10px 12px",
              }}
            >
              <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>
                Locks activos
              </div>
              <div
                className="metric"
                style={{ fontSize: "1.35rem", margin: "4px 0 0" }}
              >
                {activeLocks}
              </div>
            </div>
            <div
              style={{
                background:
                  failedRecentRuns > 0 ? "#fff7f6" : "var(--surface-alt)",
                border: `1px solid ${failedRecentRuns > 0 ? "rgba(161, 42, 47, 0.22)" : "var(--border)"}`,
                borderRadius: 14,
                minWidth: 130,
                padding: "10px 12px",
              }}
            >
              <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>
                Fallidos recientes
              </div>
              <div
                className="metric"
                style={{ fontSize: "1.35rem", margin: "4px 0 0" }}
              >
                {failedRecentRuns}
              </div>
            </div>
            <div
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                minWidth: 130,
                padding: "10px 12px",
              }}
            >
              <div className="muted" style={{ fontSize: 12, fontWeight: 750 }}>
                Suscripciones activas
              </div>
              <div
                className="metric"
                style={{ fontSize: "1.35rem", margin: "4px 0 0" }}
              >
                {enabledSubscriptions}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid cols-2">
        {data.summaryCards.map((card) => (
          <article
            className="card"
            key={card.processKey}
            style={{
              borderTop: `4px solid var(--${card.status === "failed" ? "danger" : card.status ? getStatusBadgeClass(card.status) : "primary"})`,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              className="section-title"
              style={{ alignItems: "flex-start", marginBottom: 0 }}
            >
              <div>
                <p
                  className="muted"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    margin: 0,
                  }}
                >
                  PROCESO
                </p>
                <h2 style={{ marginBottom: 0 }}>{card.processLabel}</h2>
              </div>
              <span
                className={`badge ${card.status ? getStatusBadgeClass(card.status) : "primary"}`}
              >
                {card.status ? card.status : "Sin ejecuciones"}
              </span>
            </div>
            <div>
              <div className="muted">Última ejecución registrada</div>
              <div className="metric" style={{ fontSize: "1.5rem" }}>
                {card.lastRunAt ? formatDateTime(card.lastRunAt) : "—"}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section
        className="card"
        style={{
          borderColor:
            activeLocks > 0 ? "rgba(154, 103, 0, 0.28)" : "var(--border)",
          background:
            activeLocks > 0
              ? "linear-gradient(180deg, #fffaf0 0%, rgba(255, 255, 255, 0.94) 42%)"
              : undefined,
        }}
      >
        <div className="section-title">
          <div>
            <h2 style={{ marginBottom: 0 }}>Locks activos</h2>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Estado de bloqueo de procesos para evitar ejecuciones simultáneas.
            </p>
          </div>
          <span className={`badge ${activeLocks > 0 ? "warning" : "success"}`}>
            {activeLocks > 0 ? `${activeLocks} activos` : "Sin locks activos"}
          </span>
        </div>
        <div className="grid cols-2">
          {data.locks.map((lock) => (
            <div className="inline-panel" key={lock.key} style={{ gap: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                <strong>{lock.label}</strong>
                <span
                  className={`badge ${lock.status === "active" ? "warning" : "success"}`}
                >
                  {lock.status === "active" ? "Activo" : "Libre"}
                </span>
              </div>
              <div className="muted">
                {lock.status === "active"
                  ? `Activo hasta ${formatDateTime(lock.expiresAt)}`
                  : "Disponible para ejecutar"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2 style={{ marginBottom: 0 }}>
              Notificaciones diarias por email
            </h2>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Configura las direcciones que recibirán el resumen diario de
              cambios en problemas de suministro de las últimas 24 horas. Si la
              fecha fin se deja en blanco, la notificación seguirá activa sin
              límite.
            </p>
          </div>
          <span className="badge primary">
            {data.notificationSubscriptions.length} suscripciones
          </span>
        </div>

        <div className="grid" style={{ gap: 18 }}>
          <div className="inline-panel">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <div>
                <h3 style={{ marginBottom: 0 }}>Configuración</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Alta manual de destinatarios del digest diario de suministro.
                </p>
              </div>
              {readOnly ? (
                <span className="badge warning">Solo lectura</span>
              ) : null}
            </div>

            <div
              className="grid cols-3"
              style={{
                gap: 12,
                alignItems: "end",
              }}
            >
              <label
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <small className="muted">Email</small>
                <input
                  type="email"
                  value={email}
                  disabled={readOnly}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="farmacia@hospital.es"
                />
              </label>

              <label
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <small className="muted">Fecha fin de notificaciones</small>
                <input
                  type="date"
                  value={endDate}
                  disabled={readOnly}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>

              <div className="actions-row" style={{ marginTop: 0 }}>
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleCreateSubscription}
                  disabled={
                    readOnly ||
                    (isPending && pendingSubscriptionAction === "create")
                  }
                >
                  {isPending && pendingSubscriptionAction === "create"
                    ? "Guardando…"
                    : "Guardar notificación"}
                </button>
              </div>
            </div>

            {subscriptionMessage ? (
              <p className="muted" style={{ margin: 0 }}>
                {subscriptionMessage}
              </p>
            ) : null}
            {readOnly ? (
              <p className="muted" style={{ margin: 0 }}>
                Modo lectura: solo ADMIN puede gestionar suscripciones.
              </p>
            ) : null}
          </div>

          <div className="inline-panel">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <div>
                <h3 style={{ marginBottom: 0 }}>Suscripciones configuradas</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Destinatarios activos o pausados y fecha del último envío
                  registrado.
                </p>
              </div>
              <span className="badge primary">
                {data.notificationSubscriptions.length}
              </span>
            </div>

            {data.notificationSubscriptions.length === 0 ? (
              <div
                className="inline-panel"
                style={{ background: "var(--surface)", textAlign: "center" }}
              >
                <strong>Sin destinatarios configurados</strong>
                <p className="muted" style={{ margin: 0 }}>
                  Añade una dirección para empezar a recibir el digest diario de
                  problemas de suministro.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
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
                          <td>
                            <span
                              className={`badge ${subscription.enabled ? "success" : "warning"}`}
                            >
                              {subscription.enabled ? "Sí" : "No"}
                            </span>
                          </td>
                          <td>{formatDateOnly(subscription.endDate)}</td>
                          <td>{formatDateTime(subscription.lastSentAt)}</td>
                          <td>
                            <div
                              className="actions-row"
                              style={{ marginTop: 0 }}
                            >
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() =>
                                  handleToggleSubscription(
                                    subscription.id,
                                    !subscription.enabled,
                                  )
                                }
                                disabled={
                                  readOnly ||
                                  (isPending &&
                                    pendingSubscriptionAction === toggleKey)
                                }
                              >
                                {isPending &&
                                pendingSubscriptionAction === toggleKey
                                  ? "Guardando…"
                                  : subscription.enabled
                                    ? "Desactivar"
                                    : "Activar"}
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() =>
                                  handleDeleteSubscription(subscription.id)
                                }
                                disabled={
                                  readOnly ||
                                  (isPending &&
                                    pendingSubscriptionAction === deleteKey)
                                }
                              >
                                {isPending &&
                                pendingSubscriptionAction === deleteKey
                                  ? "Eliminando…"
                                  : "Eliminar"}
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
          </div>

          <div className="inline-panel">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <div>
                <h3 style={{ marginBottom: 0 }}>Últimos envíos</h3>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Registro de ventanas notificadas, eventos incluidos y estado
                  del envío.
                </p>
              </div>
              <span className="badge primary">
                {data.notificationRuns.length}
              </span>
            </div>

            {data.notificationRuns.length === 0 ? (
              <div
                className="inline-panel"
                style={{ background: "var(--surface)", textAlign: "center" }}
              >
                <strong>Sin envíos registrados</strong>
                <p className="muted" style={{ margin: 0 }}>
                  Los envíos aparecerán aquí cuando se ejecute el digest diario
                  por email.
                </p>
              </div>
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
                          <span
                            className={`badge ${getStatusBadgeClass(run.status)}`}
                          >
                            {formatNotificationRunStatus(run.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(run.sentAt)}</td>
                        <td>{run.errorMessage ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2 style={{ marginBottom: 0 }}>Ejecuciones recientes</h2>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Histórico filtrable de procesos manuales y programados con detalle
              técnico desplegable.
            </p>
          </div>
          <span className="badge primary">
            {filteredRuns.length} resultados
          </span>
        </div>

        <div className="inline-panel" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            <div>
              <h3 style={{ marginBottom: 0 }}>Filtros</h3>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                Acota por proceso, origen y estado sin modificar la trazabilidad
                almacenada.
              </p>
            </div>
          </div>
          <div className="grid cols-3" style={{ gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <small className="muted">Proceso</small>
              <select
                onChange={(event) =>
                  setProcessFilter(event.target.value as ProcessFilter)
                }
                value={processFilter}
              >
                <option value="ALL">Todos</option>
                <option value="NOMENCLATOR">Nomenclátor</option>
                <option value="SUPPLY_MONITOR">Monitor AEMPS / CIMA</option>
                <option value="CIMA_WATCHED">Caché CIMA (watched)</option>
                <option value="CIMA_ALL">Caché CIMA (all)</option>
                <option value="BIFIMED_ALL">Caché BIFIMED (all)</option>
                <option value="SUPPLY_EMAIL_DIGEST">
                  Digest diario por email
                </option>
                <option value="UNIT_DOSE_CACHE">SCMFH unidosis</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <small className="muted">Origen</small>
              <select
                onChange={(event) =>
                  setOriginFilter(event.target.value as AutomationOriginFilter)
                }
                value={originFilter}
              >
                <option value="all">Todos los orígenes</option>
                <option value="manual">Solo manuales</option>
                <option value="scheduled">Solo programados</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <small className="muted">Estado</small>
              <select
                onChange={(event) =>
                  setStatusFilter(event.target.value as AutomationStatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">Todos los estados</option>
                <option value="failed">Solo fallidos</option>
              </select>
            </label>
          </div>
        </div>

        {filteredRuns.length === 0 ? (
          <div
            className="inline-panel"
            style={{ background: "var(--surface)", textAlign: "center" }}
          >
            <strong>No hay ejecuciones para la selección actual</strong>
            <p className="muted" style={{ margin: 0 }}>
              Cambia los filtros para consultar otros procesos, orígenes o
              estados registrados.
            </p>
          </div>
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
                          <span
                            className={`badge ${getStatusBadgeClass(run.status)}`}
                          >
                            {run.displayStatus}
                          </span>
                        </td>
                        <td>{run.shortSummary}</td>
                        <td>
                          <button
                            className="secondary-button"
                            onClick={() => toggleRun(run.detail.runId)}
                            type="button"
                          >
                            {isExpanded ? "Ocultar" : "Ver detalle"}
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
                                  <div className="muted">
                                    {run.detail.runId}
                                  </div>
                                </div>
                                <div>
                                  <strong>Lock key</strong>
                                  <div className="muted">
                                    {run.detail.lockKey ?? "—"}
                                  </div>
                                </div>
                                <div>
                                  <strong>Requested at</strong>
                                  <div className="muted">
                                    {formatDateTime(run.detail.requestedAt)}
                                  </div>
                                </div>
                                <div>
                                  <strong>Requested by</strong>
                                  <div className="muted">
                                    {run.detail.requestedBy ?? "—"}
                                  </div>
                                </div>
                                <div>
                                  <strong>Started at</strong>
                                  <div className="muted">
                                    {formatDateTime(run.detail.startedAt)}
                                  </div>
                                </div>
                                <div>
                                  <strong>Finished at</strong>
                                  <div className="muted">
                                    {formatDateTime(run.detail.finishedAt)}
                                  </div>
                                </div>
                                <div>
                                  <strong>Origen técnico</strong>
                                  <div className="muted">
                                    {run.detail.triggerType}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <strong>Resumen completo</strong>
                                <pre className="automation-pre">
                                  {JSON.stringify(run.detail.summary, null, 2)}
                                </pre>
                              </div>

                              <div>
                                <strong>Errores</strong>
                                {run.detail.errors.length === 0 ? (
                                  <div className="muted">
                                    Sin errores registrados.
                                  </div>
                                ) : (
                                  <pre className="automation-pre">
                                    {JSON.stringify(run.detail.errors, null, 2)}
                                  </pre>
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
