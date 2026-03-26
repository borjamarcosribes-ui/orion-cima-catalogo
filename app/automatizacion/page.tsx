import AutomationClient from '@/app/automatizacion/automation-client';
import {
  createSupplyNotificationSubscriptionAction,
  deleteSupplyNotificationSubscriptionAction,
  toggleSupplyNotificationSubscriptionAction,
} from '@/app/automatizacion/actions';
import { getAutomationDashboardData } from '@/lib/automation-runs';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const data = await getAutomationDashboardData();

  return (
    <AutomationClient
      data={data}
      createSupplyNotificationSubscriptionAction={createSupplyNotificationSubscriptionAction}
      toggleSupplyNotificationSubscriptionAction={toggleSupplyNotificationSubscriptionAction}
      deleteSupplyNotificationSubscriptionAction={deleteSupplyNotificationSubscriptionAction}
    />
  );
}