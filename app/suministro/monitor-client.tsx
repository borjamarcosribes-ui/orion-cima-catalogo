'use client';

import { Fragment, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import type {
  RunNomenclatorUpdateActionResult,
  RunSupplyMonitorActionResult,
} from '@/app/suministro/actions';
import type {
  GetMedicineAlternativesOutput,
  MedicineAlternative,
  MedicineAlternativesResult,
} from '@/lib/medicine-alternatives';
import type { NomenclatorJobRunOverview } from '@/lib/nomenclator-update';
import type { ActiveSupplyIssue, SupplyMonitorOverview } from '@/lib/supply-monitor';

type MonitorClientProps = {
  overview: SupplyMonitorOverview;
  activeIssues: ActiveSupplyIssue[];
  runMonitorAction: () => Promise<RunSupplyMonitorActionResult>;
  runNomenclatorUpdateAction: () => Promise<RunNomenclatorUpdateActionResult>;
  getMedicineAlternativesAction: (input: { cn: string }) => Promise<GetMedicineAlternativesOutput>;
  latestNomenclatorRun: NomenclatorJobRunOverview | null;
  canManageManualActions: boolean;
};

type SortColumn = 'cn' | 'status' | 'shortDescription' | 'issueType' | 'startedAt' | 'expectedEndAt';
type SortDirection = 'asc' | 'desc';
type PendingAction = 'monitor' | 'nomenclator' | null;

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

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('es');
}

function getRunStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'completed_with_errors':
    case 'skipped_locked':
    case 'running':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'primary';
  }
}

export default function MonitorClient({
  overview,
  activeIssues,
  runMonitorAction,
  runNomenclatorUpdateAction,
  getMedicineAlternativesAction,
  latestNomenclatorRun,
  canManageManualActions,
}: MonitorClientProps) {
  const router = useRouter();
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [nomenclatorMessage, setNomenclatorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [, startTransition] = useTransition();
  const [showActivo, setShowActivo] = useState(true);
  const [showLab, setShowLab] = useState(true);
  const [activeIssueSearch, setActiveIssueSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('startedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedCn, setExpandedCn] = useState<string | null>(null);
  const [showNonCommercialized, setShowNonCommercialized] = useState(false);
  const [alternativesByCn, setAlternativesByCn] = useState<Record<string, MedicineAlternativesResult>>({});
  const [alternativesErrorByCn, setAlternativesErrorByCn] = useState<Record<string, string>>({});
  const [loadingAlternativesCn, setLoadingAlternativesCn] = useState<string | null>(null);

  const isMonitorRunning = pendingAction === 'monitor';
  const isNomenclatorRunning = pendingAction === 'nomenclator';

  const filteredActiveIssues = useMemo(() => {
    const searchValue = normalizeSearchValue(activeIssueSearch);

    return activeIssues.filter((issue) => {
      const matchesStatus =
        (!showActivo && !showLab) ||
        (showActivo && showLab) ||
        (showActivo && issue.status === 'ACTIVO') ||
        (showLab && issue.status === 'LAB');

      if (!matchesStatus) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const normalizedCn = normalizeSearchValue(issue.cn);
      const normalizedDescription = normalizeSearchValue(issue.shortDescription);
      const normalizedActiveIngredient = issue.activeIngredient ? normalizeSearchValue(issue.activeIngredient) : '';

      return (
        normalizedCn.includes(searchValue) ||
        normalizedDescription.includes(searchValue) ||
        normalizedActiveIngredient.includes(searchValue)
      );
    });
  }, [activeIssues, showActivo, showLab, activeIssueSearch]);

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

  async function handleRunMonitor() {
    if (!canManageManualActions) {
      return;
    }

    setMonitorMessage(null);
    setPendingAction('monitor');

    try {
      const response = await runMonitorAction();

      switch (response.result.status) {
        case 'completed':
          setMonitorMessage('Monitor AEMPS ejecutado correctamente.');
          break;
        case 'completed_with_errors':
          setMonitorMessage('Monitor AEMPS completado con avisos. Revisa el historial.');
          break;
        case 'skipped_locked':
          setMonitorMessage('Ya hay una ejecución del monitor AEMPS / CIMA en curso.');
          break;
        default:
          setMonitorMessage('No se pudo ejecutar el monitor AEMPS.');
          break;
      }

      router.refresh();
    } catch (error) {
      setMonitorMessage(error instanceof Error ? error.message : 'No se pudo ejecutar el monitor AEMPS.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRunNomenclatorUpdate() {
    if (!canManageManualActions) {
      return;
    }

    setNomenclatorMessage(null);
    setPendingAction('nomenclator');

    try {
      const response = await runNomenclatorUpdateAction();

      switch (response.result.status) {
        case 'completed':
          setNomenclatorMessage('Nomenclátor actualizado correctamente.');
          break;
        case 'completed_with_errors':
          setNomenclatorMessage('Actualización completada con avisos. Revisa el último resumen.');
          break;
        case 'skipped_locked':
          setNomenclatorMessage('Ya hay una actualización de Nomenclátor en curso.');
          break;
        default:
          setNomenclatorMessage('No se pudo actualizar el Nomenclátor.');
          break;
      }

      router.refresh();
    } catch (error) {
      setNomenclatorMessage(error instanceof Error ? error.message : 'No se pudo actualizar el Nomenclátor.');
    } finally {
      setPendingAction(null);
    }
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
            <span className="badge primary" style={{ width: 'fit-content' }}>Suministro</span>
            <div>
              <h1 style={{ letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0 }}>Monitor operativo de suministro</h1>
              <p className="muted" style={{ margin: '10px 0 0', maxWidth: 760 }}>
                Esta vista monitoriza los medicamentos vigilables ya conocidos por la app. El TSV solo refresca el universo de
                productos vigilados; la vigilancia sigue funcionando sobre los CN ya guardados.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                minWidth: 130,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Productos vigilados</small>
              <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{overview.watchedProducts}</div>
            </div>
            <div
              style={{
                background: overview.activeIssues > 0 ? '#fff8e7' : 'var(--surface-alt)',
                border: `1px solid ${overview.activeIssues > 0 ? 'rgba(154, 103, 0, 0.24)' : 'var(--border)'}`,
                borderRadius: 14,
                minWidth: 130,
                padding: '10px 12px',
              }}
            >
              <small className="muted">CN con rotura activa</small>
              <div className="metric" style={{ fontSize: '1.35rem', margin: '4px 0 0' }}>{overview.activeIssues}</div>
            </div>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                minWidth: 170,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Última ejecución</small>
              <div style={{ color: '#0b2337', fontSize: '1.1rem', fontWeight: 850, marginTop: 4 }}>
                {overview.latestRun ? formatDateTime(overview.latestRun.finishedAt ?? overview.latestRun.startedAt) : '—'}
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                minWidth: 130,
                padding: '10px 12px',
              }}
            >
              <small className="muted">Estado último run</small>
              <div style={{ marginTop: 8 }}>
                <span className={`badge ${getRunStatusBadgeClass(overview.latestRun?.status)}`}>
                  {overview.latestRun?.status ?? 'sin runs'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="section-title" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="badge primary">Monitor AEMPS / CIMA</div>
              <h2 style={{ marginBottom: 0 }}>Consulta de roturas por CN</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Ejecuta la vigilancia contra CIMA y registra cambios de suministro sobre los productos vigilados.
              </p>
            </div>
            <span className="badge success">Consulta manual por CN</span>
          </div>
          <div className="inline-panel">
            <div className="actions-row" style={{ marginTop: 0 }}>
              <button
                className="primary-button"
                disabled={!canManageManualActions || isMonitorRunning}
                onClick={handleRunMonitor}
                style={
                  isMonitorRunning
                    ? {
                        opacity: 0.72,
                        background: '#6f89c9',
                        transform: 'scale(0.985)',
                        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.22)',
                      }
                    : undefined
                }
                type="button"
              >
                {isMonitorRunning ? 'Ejecutando…' : 'Ejecutar monitor AEMPS ahora'}
              </button>
              <span className="muted">
                El monitor consulta CIMA por CN, actualiza estado, registra cambios y conserva los errores por producto sin
                abortar todo el run.
              </span>
            </div>
            {monitorMessage ? <p className="muted" style={{ marginBottom: 0 }}>{monitorMessage}</p> : null}
          </div>

          {overview.latestRun ? (
            <div className="grid cols-2" style={{ gap: 12, marginTop: 18 }}>
              <div className="inline-panel" style={{ background: 'var(--surface)' }}>
                <strong>Inicio</strong>
                <div className="muted">{formatDateTime(overview.latestRun.startedAt)}</div>
              </div>
              <div className="inline-panel" style={{ background: 'var(--surface)' }}>
                <strong>Fin</strong>
                <div className="muted">{formatDateTime(overview.latestRun.finishedAt)}</div>
              </div>
              <div className="inline-panel" style={{ background: 'var(--surface)' }}>
                <strong>Estado</strong>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${getRunStatusBadgeClass(overview.latestRun.status)}`}>{overview.latestRun.status}</span>
                </div>
              </div>
              <div className="inline-panel" style={{ background: 'var(--surface)' }}>
                <strong>Roturas activas</strong>
                <div className="muted">{overview.latestRun.activeIssues}</div>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 18 }}>
              Todavía no se ha ejecutado el monitor.
            </p>
          )}
        </article>

        <article className="card">
          <div className="section-title" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="badge primary">Nomenclátor de prescripción</div>
              <h2 style={{ marginBottom: 0 }}>Base local de equivalencias</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Actualiza la base local de especialidades equivalentes desde el fichero de Nomenclátor disponible en disco.
              </p>
            </div>
            <span className="badge success">Actualización manual</span>
          </div>
          <div className="inline-panel">
            <div className="actions-row" style={{ marginTop: 0 }}>
              <button
                className="primary-button"
                disabled={!canManageManualActions || isNomenclatorRunning}
                onClick={handleRunNomenclatorUpdate}
                style={
                  isNomenclatorRunning
                    ? {
                        opacity: 0.72,
                        background: '#6f89c9',
                        transform: 'scale(0.985)',
                        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.22)',
                      }
                    : undefined
                }
                type="button"
              >
                {isNomenclatorRunning ? 'Actualizando…' : 'Actualizar Nomenclátor ahora'}
              </button>
              <span className="muted">Importa el XML local configurado y refresca el resumen operativo al terminar.</span>
            </div>
            {nomenclatorMessage ? <p className="muted" style={{ marginBottom: 0 }}>{nomenclatorMessage}</p> : null}
          </div>
          {latestNomenclatorRun ? (
            <ul className="list compact-list" style={{ marginTop: 18 }}>
              <li>
                <strong>Última ejecución</strong>
                <div className="muted">
                  {formatDateTime(latestNomenclatorRun.finishedAt ?? latestNomenclatorRun.startedAt)}
                </div>
              </li>
              <li>
                <strong>Estado</strong>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${getRunStatusBadgeClass(latestNomenclatorRun.status)}`}>
                    {latestNomenclatorRun.status}
                  </span>
                </div>
              </li>
              <li>
                <strong>Productos procesados</strong>
                <div className="muted">{latestNomenclatorRun.processed ?? '—'}</div>
              </li>
              <li>
                <strong>Insertados / actualizados</strong>
                <div className="muted">{latestNomenclatorRun.insertedOrUpdated ?? '—'}</div>
              </li>
              <li>
                <strong>Descartados</strong>
                <div className="muted">{latestNomenclatorRun.discarded ?? '—'}</div>
              </li>
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: 18 }}>
              Todavía no se ha ejecutado la actualización del Nomenclátor.
            </p>
          )}
        </article>
      </section>

      <section className="card">
        <div className="section-title" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginBottom: 0 }}>Resumen del último run</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Lectura rápida de resultados del último ciclo de monitorización guardado.
            </p>
          </div>
          <span className={`badge ${getRunStatusBadgeClass(overview.latestRun?.status)}`}>
            {overview.latestRun?.status ?? 'sin runs'}
          </span>
        </div>
        {overview.latestRun ? (
          <div className="grid cols-4" style={{ gap: 12 }}>
            <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
              <div className="badge warning">Nuevas roturas</div>
              <div className="metric">{overview.newIssues}</div>
              <div className="muted">Altas detectadas durante el run.</div>
            </article>
            <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
              <div className="badge success">Roturas resueltas</div>
              <div className="metric">{overview.resolvedIssues}</div>
              <div className="muted">Alertas cerradas tras la consulta.</div>
            </article>
            <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
              <div className="badge primary">Productos revisados</div>
              <div className="metric">{overview.latestRun.checkedProducts}</div>
              <div className="muted">CN evaluados por el monitor.</div>
            </article>
            <article className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
              <div className="badge primary">Cambios detectados</div>
              <div className="metric">{overview.latestRun.changedProducts}</div>
              <div className="muted">Productos con variación registrada.</div>
            </article>
          </div>
        ) : (
          <p className="muted">Todavía no se ha ejecutado el monitor.</p>
        )}
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
              <input
                aria-label="Buscar por CN, descripción o principio activo"
                onChange={(event) => setActiveIssueSearch(event.target.value)}
                placeholder="Buscar por CN, descripción o principio activo"
                style={{ maxWidth: 320 }}
                type="text"
                value={activeIssueSearch}
              />
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
                      <button
                        onClick={() => handleSort('shortDescription')}
                        style={sortableHeaderButtonStyle}
                        type="button"
                      >
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
                      <button
                        onClick={() => handleSort('expectedEndAt')}
                        style={sortableHeaderButtonStyle}
                        type="button"
                      >
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
                                      Cruce a través de nomenclator de especialidades equivalentes (mismo principio
                                      activo, misma dosis y misma forma farmacéutica).
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
                                        <div className="muted">
                                          {formatDateOnly(panelData.sourceMedicine.expectedEndAt)}
                                        </div>
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