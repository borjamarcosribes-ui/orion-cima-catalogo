import AutomationClient from '@/app/automatizacion/automation-client';
import {
  createSupplyNotificationSubscriptionAction,
  deleteSupplyNotificationSubscriptionAction,
  toggleSupplyNotificationSubscriptionAction,
} from '@/app/automatizacion/actions';
import { getAutomationDashboardData } from '@/lib/automation-runs';
import { getAdminAuthorizationResult } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const [data, authorization] = await Promise.all([getAutomationDashboardData(), getAdminAuthorizationResult()]);

  return (
    <AutomationClient
      data={data}
      createSupplyNotificationSubscriptionAction={createSupplyNotificationSubscriptionAction}
      toggleSupplyNotificationSubscriptionAction={toggleSupplyNotificationSubscriptionAction}
      deleteSupplyNotificationSubscriptionAction={deleteSupplyNotificationSubscriptionAction}
      readOnly={!authorization.ok}
    />
  );
}