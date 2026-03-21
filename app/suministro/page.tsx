import MonitorClient from '@/app/suministro/monitor-client';
import { runSupplyMonitorAction } from '@/app/suministro/actions';
import { getSupplyMonitorOverview } from '@/lib/supply-monitor';

export const dynamic = 'force-dynamic';

export default async function SupplyPage() {
  const overview = await getSupplyMonitorOverview();

  return <MonitorClient overview={overview} runMonitorAction={runSupplyMonitorAction} />;
}