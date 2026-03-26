'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';

export type SupplyNotificationActionResult = {
  ok: boolean;
  message: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseInclusiveEndDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('La fecha fin no tiene un formato válido.');
  }

  const parsed = new Date(`${trimmed}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('La fecha fin no es válida.');
  }

  return parsed;
}

export async function createSupplyNotificationSubscriptionAction(input: {
  email: string;
  endDate?: string | null;
}): Promise<SupplyNotificationActionResult> {
  const email = normalizeEmail(input.email);

  if (!email) {
    return {
      ok: false,
      message: 'Debes indicar un email.',
    };
  }

  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: 'El email no tiene un formato válido.',
    };
  }

  let endDate: Date | null;
  try {
    endDate = parseInclusiveEndDate(input.endDate);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo interpretar la fecha fin.',
    };
  }

  const existing = await prisma.supplyNotificationSubscription.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    await prisma.supplyNotificationSubscription.update({
      where: { email },
      data: {
        enabled: true,
        endDate,
      },
    });

    revalidatePath('/automatizacion');
    return {
      ok: true,
      message: 'Suscripción actualizada correctamente.',
    };
  }

  await prisma.supplyNotificationSubscription.create({
    data: {
      email,
      enabled: true,
      endDate,
    },
  });

  revalidatePath('/automatizacion');
  return {
    ok: true,
    message: 'Suscripción creada correctamente.',
  };
}

export async function toggleSupplyNotificationSubscriptionAction(input: {
  id: string;
  enabled: boolean;
}): Promise<SupplyNotificationActionResult> {
  const id = input.id.trim();
  if (!id) {
    return {
      ok: false,
      message: 'Identificador de suscripción no válido.',
    };
  }

  await prisma.supplyNotificationSubscription.update({
    where: { id },
    data: {
      enabled: input.enabled,
    },
  });

  revalidatePath('/automatizacion');
  return {
    ok: true,
    message: input.enabled ? 'Suscripción activada.' : 'Suscripción desactivada.',
  };
}

export async function deleteSupplyNotificationSubscriptionAction(input: {
  id: string;
}): Promise<SupplyNotificationActionResult> {
  const id = input.id.trim();
  if (!id) {
    return {
      ok: false,
      message: 'Identificador de suscripción no válido.',
    };
  }

  await prisma.supplyNotificationSubscription.delete({
    where: { id },
  });

  revalidatePath('/automatizacion');
  return {
    ok: true,
    message: 'Suscripción eliminada.',
  };
}