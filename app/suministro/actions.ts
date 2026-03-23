'use server';

import { revalidatePath } from 'next/cache';

import {
  getMedicineAlternatives,
  type GetMedicineAlternativesInput,
  type GetMedicineAlternativesOutput,
} from '@/lib/medicine-alternatives';
import { executeSupplyMonitor } from '@/lib/supply-monitor';

export async function runSupplyMonitorAction() {
  await executeSupplyMonitor();
  revalidatePath('/suministro');
}

export async function getMedicineAlternativesAction(
  input: GetMedicineAlternativesInput,
): Promise<GetMedicineAlternativesOutput> {
  return getMedicineAlternatives(input);
}