'use server';

import { revalidatePath } from 'next/cache';

import { executeNomenclatorUpdate } from '@/lib/nomenclator-update';
import {
  getMedicineAlternatives,
  type GetMedicineAlternativesInput,
  type GetMedicineAlternativesOutput,
} from '@/lib/medicine-alternatives';
import { runScheduledJob, type ScheduledJobExecutionResult } from '@/lib/scheduled-jobs';
import { executeSupplyMonitor } from '@/lib/supply-monitor';

export type RunNomenclatorUpdateActionResult = {
  runId: string;
  lockKey: string;
  result: ScheduledJobExecutionResult;
};

export async function runSupplyMonitorAction() {
  await executeSupplyMonitor();
  revalidatePath('/suministro');
}

export async function runNomenclatorUpdateAction(): Promise<RunNomenclatorUpdateActionResult> {
  const execution = await runScheduledJob({
    jobName: 'NOMENCLATOR_UPDATE',
    triggerType: 'manual_http',
    requestedBy: 'suministro-ui',
    handler: async () => executeNomenclatorUpdate(),
  });

  revalidatePath('/suministro');

  return execution;
}

export async function getMedicineAlternativesAction(
  input: GetMedicineAlternativesInput,
): Promise<GetMedicineAlternativesOutput> {
  return getMedicineAlternatives(input);
}