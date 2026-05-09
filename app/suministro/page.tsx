import MonitorClient from '@/app/suministro/monitor-client';
import {
  getMedicineAlternativesAction,
  runNomenclatorUpdateAction,
  runSupplyMonitorAction,
} from '@/app/suministro/actions';
import { getLatestNomenclatorJobRun } from '@/lib/nomenclator-update';
import { getActiveSupplyIssues, getSupplyMonitorOverview } from '@/lib/supply-monitor';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function SupplyPage() {
  const session = await auth();
  const canManageManualActions = session?.user?.role === 'ADMIN';

  const [overview, activeIssues, latestNomenclatorRun] = await Promise.all([
    getSupplyMonitorOverview(),
    getActiveSupplyIssues(),
    getLatestNomenclatorJobRun(),
  ]);

  return (
    <MonitorClient
      overview={overview}
      activeIssues={activeIssues}
      latestNomenclatorRun={latestNomenclatorRun}
      getMedicineAlternativesAction={getMedicineAlternativesAction}
      runMonitorAction={runSupplyMonitorAction}
      runNomenclatorUpdateAction={runNomenclatorUpdateAction}
      canManageManualActions={canManageManualActions}
    />
  );
}