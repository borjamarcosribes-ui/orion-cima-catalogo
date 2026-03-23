import MonitorClient from '@/app/suministro/monitor-client';
import { getMedicineAlternativesAction, runSupplyMonitorAction } from '@/app/suministro/actions';
import { getActiveSupplyIssues, getSupplyMonitorOverview } from '@/lib/supply-monitor';

export const dynamic = 'force-dynamic';

export default async function SupplyPage() {
  const [overview, activeIssues] = await Promise.all([getSupplyMonitorOverview(), getActiveSupplyIssues()]);

  return (
    <MonitorClient
      overview={overview}
      activeIssues={activeIssues}
      getMedicineAlternativesAction={getMedicineAlternativesAction}
      runMonitorAction={runSupplyMonitorAction}
    />
  );
}