'use server';

import { revalidatePath } from 'next/cache';

import { requireAdminThrowing } from '@/lib/authorization';
import { executeNomenclatorUpdate } from '@/lib/nomenclator-update';
import {
  getMedicineAlternatives,
  type GetMedicineAlternativesInput,
  type GetMedicineAlternativesOutput,
} from '@/lib/medicine-alternatives';
import { runScheduledJob, type ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';
import { executeSupplyMonitor } from '@/lib/supply-monitor';

export type RunSupplyMonitorActionResult = {
  runId: string;
  lockKey: string;
  result: ScheduledJobExecutionResult;
};

export type RunNomenclatorUpdateActionResult = {
  runId: string;
  lockKey: string;
  result: ScheduledJobExecutionResult;
};

export async function runSupplyMonitorAction(): Promise<RunSupplyMonitorActionResult> {
  await requireAdminThrowing();

  const execution = await runScheduledJob({
    jobName: 'SUPPLY_MONITOR',
    triggerType: 'manual_http',
    requestedBy: 'suministro-ui',
    handler: async () => {
      const monitorResult = await executeSupplyMonitor({ source: 'manual' });

      return {
        status: 'completed',
        summary: {
          supplyMonitorRunId: monitorResult.runId,
        },
        errors: null,
      };
    },
  });

  revalidatePath('/suministro');
  revalidatePath('/automatizacion');

  return execution;
}

export async function runNomenclatorUpdateAction(): Promise<RunNomenclatorUpdateActionResult> {
  await requireAdminThrowing();

  const execution = await runScheduledJob({
    jobName: 'NOMENCLATOR_UPDATE',
    triggerType: 'manual_http',
    requestedBy: 'suministro-ui',
    handler: async () => executeNomenclatorUpdate(),
  });

  revalidatePath('/suministro');
  revalidatePath('/automatizacion');

  return execution;
}

export async function getMedicineAlternativesAction(
  input: GetMedicineAlternativesInput,
): Promise<GetMedicineAlternativesOutput> {
  return getMedicineAlternatives(input);
}