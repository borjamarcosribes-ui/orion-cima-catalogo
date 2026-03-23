'use client';

import { Fragment, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import type {
  GetMedicineAlternativesOutput,
  MedicineAlternative,
  MedicineAlternativesResult,
} from '@/lib/medicine-alternatives';
import type { ActiveSupplyIssue, SupplyMonitorOverview } from '@/lib/supply-monitor';

type MonitorClientProps = {
  overview: SupplyMonitorOverview;
  activeIssues: ActiveSupplyIssue[];
  runMonitorAction: () => Promise<void>;
  getMedicineAlternativesAction: (input: { cn: string }) => Promise<GetMedicineAlternativesOutput>;
};

type SortColumn = 'cn' | 'status' | 'shortDescription' | 'issueType' | 'startedAt' | 'expectedEndAt';
type SortDirection = 'asc' | 'desc';

const sortableHeaderButtonStyle: CSSProperties = {
  WebkitAppearance: 'none',
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 'inherit',
  margin: 0,
  padding: 0,
  textAlign: 'left',
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

function compareNullableStrings(left: string | null, right: string | null, direction: SortDirection): number {
  if (left && right) {
    return direction === 'asc' ? left.localeCompare(right, 'es') : right.localeCompare(left, 'es');
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

function parseNumericSortValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  return /^\d+$/.test(trimmedValue) ? Number(trimmedValue) : null;
}

function compareIssueType(left: string | null, right: string | null, direction: SortDirection): number {
  const leftNumeric = parseNumericSortValue(left);
  const rightNumeric = parseNumericSortValue(right);

  if (leftNumeric !== null && rightNumeric !== null) {
    return direction === 'asc' ? leftNumeric - rightNumeric : rightNumeric - leftNumeric;
  }

  return compareNullableStrings(left, right, direction);
}

function compareActiveIssues(
  left: ActiveSupplyIssue,
  right: ActiveSupplyIssue,
  column: SortColumn,
  direction: SortDirection,
): number {
  const primaryComparison = (() => {
    switch (column) {
      case 'cn':
        return direction === 'asc' ? left.cn.localeCompare(right.cn) : right.cn.localeCompare(left.cn);
      case 'status':
        return direction === 'asc'
          ? left.status.localeCompare(right.status, 'es')
          : right.status.localeCompare(left.status, 'es');
      case 'shortDescription':
        return direction === 'asc'
          ? left.shortDescription.localeCompare(right.shortDescription, 'es')
          : right.shortDescription.localeCompare(left.shortDescription, 'es');
      case 'issueType':
        return compareIssueType(left.issueType, right.issueType, direction);
      case 'startedAt':
        return compareNullableStrings(left.startedAt, right.startedAt, direction);
      case 'expectedEndAt':
        return compareNullableStrings(left.expectedEndAt, right.expectedEndAt, direction);
    }
  })();

  if (primaryComparison !== 0) {
    return primaryComparison;
  }

  return left.cn.localeCompare(right.cn);
}

function getCommercializationLabel(value: MedicineAlternative['commercializationStatus']): string {
  switch (value) {
    case 'COMERCIALIZADO':
      return 'Comercializado';
    case 'NO_COMERCIALIZADO':
      return 'No comercializado';
    default:
      return 'Desconocido';
  }
}

function getSupplyLabel(value: MedicineAlternative['supplyStatus']): string {
  switch (value) {
    case 'CON_ROTURA':
      return 'Sí';
    case 'SIN_ROTURA':
      return 'No';
    default:
      return 'Desconocido';
  }
}

function getHospitalPresenceLabel(value: MedicineAlternative['hospitalPresenceStatus']): string {
  return value === 'NO_PRESENTE' ? 'No' : 'Sí';
}

export default function MonitorClient({
  overview,
  activeIssues,
  runMonitorAction,
  getMedicineAlternativesAction,
}: MonitorClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showActivo, setShowActivo] = useState(true);
  const [showLab, setShowLab] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('startedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedCn, setExpandedCn] = useState<string | null>(null);
  const [showNonCommercialized, setShowNonCommercialized] = useState(false);
  const [alternativesByCn, setAlternativesByCn] = useState<Record<string, MedicineAlternativesResult>>({});
  const [alternativesErrorByCn, setAlternativesErrorByCn] = useState<Record<string, string>>({});
  const [loadingAlternativesCn, setLoadingAlternativesCn] = useState<string | null>(null);

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

  const sortedActiveIssues = useMemo(
    () => [...filteredActiveIssues].sort((left, right) => compareActiveIssues(left, right, sortColumn, sortDirection)),
    [filteredActiveIssues, sortColumn, sortDirection],
  );

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === 'startedAt' || column === 'expectedEndAt' ? 'desc' : 'asc');
  }

  function getSortIndicator(column: SortColumn): string {
    if (column !== sortColumn) {
      return '';
    }

    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

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

  function getVisibleAlternatives(cn: string): MedicineAlternative[] {
    const panelData = alternativesByCn[cn];
    if (!panelData) {
      return [];
    }

    return showNonCommercialized
      ? panelData.alternatives
      : panelData.alternatives.filter((item) => item.commercializationStatus === 'COMERCIALIZADO');
  }

  function handleToggleAlternatives(issue: ActiveSupplyIssue) {
    if (expandedCn === issue.cn) {
      setExpandedCn(null);
      return;
    }

    setExpandedCn(issue.cn);
    setShowNonCommercialized(false);

    if (alternativesByCn[issue.cn] || loadingAlternativesCn === issue.cn) {
      return;
    }

    setLoadingAlternativesCn(issue.cn);
    setAlternativesErrorByCn((current) => {
      const next = { ...current };
      delete next[issue.cn];
      return next;
    });

    startTransition(async () => {
      try {
        const response = await getMedicineAlternativesAction({ cn: issue.cn });

        if (!response.ok) {
          setAlternativesErrorByCn((current) => ({ ...current, [issue.cn]: response.message }));
          return;
        }

        setAlternativesByCn((current) => ({ ...current, [issue.cn]: response.data }));
      } catch (error) {
        setAlternativesErrorByCn((current) => ({
          ...current,
          [issue.cn]: error instanceof Error ? error.message : 'No se pudieron cargar las alternativas.',
        }));
      } finally {
        setLoadingAlternativesCn((current) => (current === issue.cn ? null : current));
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
          <span className="badge warning">{sortedActiveIssues.length}</span>
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
                    <th>
                      <button onClick={() => handleSort('cn')} style={sortableHeaderButtonStyle} type="button">
                        CN{getSortIndicator('cn')}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('status')} style={sortableHeaderButtonStyle} type="button">
                        Estado{getSortIndicator('status')}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('shortDescription')} style={sortableHeaderButtonStyle} type="button">
                        Descripción{getSortIndicator('shortDescription')}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('issueType')} style={sortableHeaderButtonStyle} type="button">
                        Tipo{getSortIndicator('issueType')}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('startedAt')} style={sortableHeaderButtonStyle} type="button">
                        Inicio{getSortIndicator('startedAt')}
                      </button>
                    </th>
                    <th>
                      <button onClick={() => handleSort('expectedEndAt')} style={sortableHeaderButtonStyle} type="button">
                        Fin esperado{getSortIndicator('expectedEndAt')}
                      </button>
                    </th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActiveIssues.map((issue) => {
                    const panelData = alternativesByCn[issue.cn] ?? null;
                    const visibleAlternatives = getVisibleAlternatives(issue.cn);
                    const panelError = alternativesErrorByCn[issue.cn] ?? null;
                    const isExpanded = expandedCn === issue.cn;
                    const isLoadingAlternatives = loadingAlternativesCn === issue.cn;

                    return (
                      <Fragment key={`${issue.cn}-${issue.articleCode}`}>
                        <tr>
                          <td>{issue.cn}</td>
                          <td>{issue.status}</td>
                          <td>{issue.shortDescription}</td>
                          <td>{issue.issueType ?? '—'}</td>
                          <td>{formatDateOnly(issue.startedAt)}</td>
                          <td>{formatDateOnly(issue.expectedEndAt)}</td>
                          <td>{issue.observations ?? '—'}</td>
                          <td>
                            <button className="secondary-button" onClick={() => handleToggleAlternatives(issue)} type="button">
                              {isExpanded ? 'Ocultar alternativas' : 'Consultar alternativas'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={8}>
                              <div className="inline-panel">
                                <div className="section-title">
                                  <div>
                                    <h3 style={{ marginBottom: 8 }}>Alternativas equivalentes</h3>
                                    <div className="muted">
                                      Cruce a través de nomenclator de especialidades equivalentes (mismo principio activo,
                                      misma dosis y misma forma farmacéutica).
                                    </div>
                                  </div>
                                  <span className="badge primary">{issue.cn}</span>
                                </div>

                                {isLoadingAlternatives ? <p className="muted">Consultando alternativas…</p> : null}
                                {panelError ? <p className="muted">{panelError}</p> : null}

                                {panelData ? (
                                  <div className="grid" style={{ gap: 16 }}>
                                    <div className="grid cols-2" style={{ gap: 12 }}>
                                      <div>
                                        <strong>CN origen</strong>
                                        <div className="muted">{panelData.sourceMedicine.cn}</div>
                                      </div>
                                      <div>
                                        <strong>Estado local</strong>
                                        <div className="muted">{panelData.sourceMedicine.localStatus}</div>
                                      </div>
                                      <div>
                                        <strong>Descripción</strong>
                                        <div className="muted">{panelData.sourceMedicine.shortDescription}</div>
                                      </div>
                                      <div>
                                        <strong>Tipo</strong>
                                        <div className="muted">{panelData.sourceMedicine.issueType ?? '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Inicio</strong>
                                        <div className="muted">{formatDateOnly(panelData.sourceMedicine.startedAt)}</div>
                                      </div>
                                      <div>
                                        <strong>Fin esperado</strong>
                                        <div className="muted">{formatDateOnly(panelData.sourceMedicine.expectedEndAt)}</div>
                                      </div>
                                      <div>
                                        <strong>Observaciones</strong>
                                        <div className="muted">{panelData.sourceMedicine.observations ?? '—'}</div>
                                      </div>
                                      <div>
                                        <strong>codDcp</strong>
                                        <div className="muted">{panelData.sourceMedicine.codDcp ?? '—'}</div>
                                      </div>
                                    </div>

                                    <label style={{ alignItems: 'center', display: 'inline-flex', gap: 8 }}>
                                      <input
                                        checked={showNonCommercialized}
                                        onChange={(event) => setShowNonCommercialized(event.target.checked)}
                                        type="checkbox"
                                      />
                                      <span>Mostrar también no comercializados</span>
                                    </label>

                                    {visibleAlternatives.length === 0 ? (
                                      <p className="muted">No hay alternativas visibles con el filtro actual.</p>
                                    ) : (
                                      <div className="table-scroll">
                                        <table className="table">
                                          <thead>
                                            <tr>
                                              <th>CN</th>
                                              <th>Presentación</th>
                                              <th>Comercializado</th>
                                              <th>Rotura</th>
                                              <th>Inicio</th>
                                              <th>Fin esperado</th>
                                              <th>Observaciones</th>
                                              <th>En tu hospital</th>
                                              <th>Estado Orion</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {visibleAlternatives.map((alternative) => (
                                              <tr key={alternative.cn}>
                                                <td>{alternative.cn}</td>
                                                <td>{alternative.presentation}</td>
                                                <td>{getCommercializationLabel(alternative.commercializationStatus)}</td>
                                                <td>{getSupplyLabel(alternative.supplyStatus)}</td>
                                                <td>{formatDateOnly(alternative.supplyStartedAt)}</td>
                                                <td>{formatDateOnly(alternative.supplyExpectedEndAt)}</td>
                                                <td>{alternative.supplyObservations ?? '—'}</td>
                                                <td>{getHospitalPresenceLabel(alternative.hospitalPresenceStatus)}</td>
                                                <td>
                                                  {alternative.hospitalPresenceStatus === 'NO_PRESENTE'
                                                    ? '—'
                                                    : alternative.hospitalStatusNormalized ?? '—'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
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