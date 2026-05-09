import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type CountRow = {
  totalIncluded: bigint | number | string | null;
  totalActive: bigint | number | string | null;
  totalLab: bigint | number | string | null;
  totalInactive: bigint | number | string | null;
  totalOther: bigint | number | string | null;
};

type ActiveIssueRow = {
  totalActiveShortages: bigint | number | string | null;
  activeStatusShortages: bigint | number | string | null;
  labStatusShortages: bigint | number | string | null;
};

type ActiveShortageRow = {
  cn: string;
  displayName: string | null;
  hospitalStatusOriginal: string | null;
  startedAt: Date | string | null;
};

type EnrichedActiveShortageRow = {
  cn: string;
  displayName: string | null;
  hospitalStatusOriginal: string | null;
  daysInIssue: number;
};

function toNumber(value: bigint | number | string | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return '0 %';
  }

  return `${((numerator / denominator) * 100).toFixed(1)} %`;
}

function formatDays(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 días';
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('es-ES', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} días`;
}

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateDaysInIssue(startedAt: Date | string | null, now: Date): number {
  const started = toDate(startedAt);
  if (!started) {
    return 0;
  }

  const diffMs = now.getTime() - started.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [counts, activeIssues, activeShortages, recentEvents] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS "totalIncluded",
        SUM(
          CASE
            WHEN UPPER(TRIM(COALESCE(w."statusNormalized", ''))) = 'ACTIVO'
            THEN 1
            ELSE 0
          END
        ) AS "totalActive",
        SUM(
          CASE
            WHEN UPPER(TRIM(COALESCE(w."statusNormalized", ''))) = 'LAB'
            THEN 1
            ELSE 0
          END
        ) AS "totalLab",
        SUM(
          CASE
            WHEN UPPER(TRIM(COALESCE(w."statusNormalized", ''))) = 'INACTIVO'
            THEN 1
            ELSE 0
          END
        ) AS "totalInactive",
        SUM(
          CASE
            WHEN UPPER(TRIM(COALESCE(w."statusNormalized", ''))) NOT IN ('ACTIVO', 'LAB', 'INACTIVO')
            THEN 1
            ELSE 0
          END
        ) AS "totalOther"
      FROM watched_medicines w
      WHERE w.cn IS NOT NULL
        AND LENGTH(TRIM(w.cn)) = 6
    `,
    prisma.$queryRaw<ActiveIssueRow[]>`
      SELECT
        SUM(
          CASE
            WHEN s."hasActiveSupplyIssue" = TRUE
            THEN 1
            ELSE 0
          END
        ) AS "totalActiveShortages",
        SUM(
          CASE
            WHEN s."hasActiveSupplyIssue" = TRUE
             AND UPPER(TRIM(COALESCE(w."statusNormalized", ''))) = 'ACTIVO'
            THEN 1
            ELSE 0
          END
        ) AS "activeStatusShortages",
        SUM(
          CASE
            WHEN s."hasActiveSupplyIssue" = TRUE
             AND UPPER(TRIM(COALESCE(w."statusNormalized", ''))) = 'LAB'
            THEN 1
            ELSE 0
          END
        ) AS "labStatusShortages"
      FROM watched_medicines w
      LEFT JOIN supply_statuses s
        ON s."watchedMedicineId" = w.id
      WHERE w.cn IS NOT NULL
        AND LENGTH(TRIM(w.cn)) = 6
    `,
    prisma.$queryRaw<ActiveShortageRow[]>`
      SELECT
        w.cn AS cn,
        COALESCE(
          c."officialName",
          n."officialName",
          n.presentation,
          w."shortDescription"
        ) AS "displayName",
        w."statusOriginal" AS "hospitalStatusOriginal",
        s."startedAt" AS "startedAt"
      FROM supply_statuses s
      INNER JOIN watched_medicines w
        ON w.id = s."watchedMedicineId"
      LEFT JOIN nomenclator_products n
        ON n.cn = w.cn
      LEFT JOIN cima_cache c
        ON c."nationalCode" = w.cn
      WHERE s."hasActiveSupplyIssue" = TRUE
        AND s."startedAt" IS NOT NULL
        AND w.cn IS NOT NULL
        AND LENGTH(TRIM(w.cn)) = 6
    `,
    prisma.supplyMonitoringEvent.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
        watchedMedicine: {
          is: {
            isWatched: true,
          },
        },
      },
      select: {
        eventType: true,
      },
    }),
  ]);

  const now = new Date();

  const countRow = counts[0];
  const activeIssueRow = activeIssues[0];

  const totalIncluded = toNumber(countRow?.totalIncluded);
  const totalActive = toNumber(countRow?.totalActive);
  const totalLab = toNumber(countRow?.totalLab);
  const totalInactive = toNumber(countRow?.totalInactive);
  const totalOther = toNumber(countRow?.totalOther);

  const totalActiveShortages = toNumber(activeIssueRow?.totalActiveShortages);
  const activeStatusShortages = toNumber(activeIssueRow?.activeStatusShortages);
  const labStatusShortages = toNumber(activeIssueRow?.labStatusShortages);

  const newIssues7d = recentEvents.filter(
    (event: { eventType: string }) => event.eventType === 'NEW_ISSUE',
  ).length;

  const resolvedIssues7d = recentEvents.filter(
    (event: { eventType: string }) => event.eventType === 'RESOLVED',
  ).length;

  const enrichedActiveShortages: EnrichedActiveShortageRow[] = activeShortages
    .map((item: ActiveShortageRow): EnrichedActiveShortageRow => ({
      cn: item.cn,
      displayName: item.displayName,
      hospitalStatusOriginal: item.hospitalStatusOriginal,
      daysInIssue: calculateDaysInIssue(item.startedAt, now),
    }))
    .sort(
      (a: EnrichedActiveShortageRow, b: EnrichedActiveShortageRow) =>
        b.daysInIssue - a.daysInIssue || a.cn.localeCompare(b.cn),
    );

  const averageAge =
    enrichedActiveShortages.length > 0
      ? enrichedActiveShortages.reduce(
          (sum: number, item: EnrichedActiveShortageRow) => sum + item.daysInIssue,
          0,
        ) / enrichedActiveShortages.length
      : 0;

  const longestShortages = enrichedActiveShortages.slice(0, 10);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <h1>Bienvenid@ a Integramécum</h1>
          </div>
        </div>

        <p className="muted" style={{ marginBottom: 10 }}>
          Aplicación operativa para Farmacia Hospitalaria que integra catálogo local Orion, nomenclátor, CIMA,
          BIFIMED y monitor de suministro.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Esta pantalla ofrece una visión general del estado del catálogo hospitalario y de las incidencias activas de
          suministro sobre los medicamentos incluidos en el hospital.
        </p>
      </section>

      <section className="grid cols-3">
        <article className="card">
          <div className="muted">Productos incluidos en hospital</div>
          <div className="metric" style={{ fontSize: '2rem' }}>
            {totalIncluded.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">Roturas activas</div>
          <div className="metric" style={{ fontSize: '2rem' }}>
            {totalActiveShortages.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">% rotura entre incluidos</div>
          <div className="metric" style={{ fontSize: '2rem' }}>
            {formatPercent(totalActiveShortages, totalIncluded)}
          </div>
        </article>

        <article className="card">
          <div className="muted">% rotura entre ACTIVO</div>
          <div className="metric" style={{ fontSize: '2rem' }}>
            {formatPercent(activeStatusShortages, totalActive)}
          </div>
        </article>

        <article className="card">
          <div className="muted">% rotura entre LAB</div>
          <div className="metric" style={{ fontSize: '2rem' }}>
            {formatPercent(labStatusShortages, totalLab)}
          </div>
        </article>

        <article className="card">
          <div className="muted">Antigüedad media de incidencias activas</div>
          <div className="metric" style={{ fontSize: '2rem' }}>{formatDays(averageAge)}</div>
        </article>
      </section>

      <section className="grid cols-3">
        <article className="card">
          <div className="muted">Nuevas roturas últimos 7 días</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {newIssues7d.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">Roturas resueltas últimos 7 días</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {resolvedIssues7d.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">Productos ACTIVO en rotura</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {activeStatusShortages.toLocaleString('es-ES')}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Productos con mayor tiempo en rotura</h2>
          <span className="badge primary">Top 10</span>
        </div>

        {longestShortages.length === 0 ? (
          <p className="muted">No hay incidencias activas con fecha de inicio registrada.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>CN</th>
                  <th>Medicamento</th>
                  <th>Estado hospitalario</th>
                  <th>Días en rotura</th>
                </tr>
              </thead>
              <tbody>
                {longestShortages.map((item) => (
                  <tr key={item.cn}>
                    <td>{item.cn}</td>
                    <td>{item.displayName ?? 'Sin descripción'}</td>
                    <td>{item.hospitalStatusOriginal ?? 'Sin dato Orion'}</td>
                    <td>{item.daysInIssue.toLocaleString('es-ES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid cols-2">
        <article className="card">
          <div className="muted">ACTIVO</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {totalActive.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">LAB</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {totalLab.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">INACTIVO</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {totalInactive.toLocaleString('es-ES')}
          </div>
        </article>

        <article className="card">
          <div className="muted">Otros estados</div>
          <div className="metric" style={{ fontSize: '1.8rem' }}>
            {totalOther.toLocaleString('es-ES')}
          </div>
        </article>
      </section>
    </div>
  );
}