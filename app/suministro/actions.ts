'use server';

import { revalidatePath } from 'next/cache';

import { executeSupplyMonitor } from '@/lib/supply-monitor';

export async function runSupplyMonitorAction() {
  await executeSupplyMonitor();
  revalidatePath('/suministro');
}