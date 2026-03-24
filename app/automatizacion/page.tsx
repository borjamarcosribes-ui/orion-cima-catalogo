import AutomationClient from '@/app/automatizacion/automation-client';
import { getAutomationDashboardData } from '@/lib/automation-runs';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const data = await getAutomationDashboardData();

  return <AutomationClient data={data} />;
}