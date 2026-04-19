'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

type AppRole = 'ADMIN' | 'LECTURA';

async function requireAdminSession() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('No autorizado.');
  }

  const role =
    ((session.user as typeof session.user & { role?: AppRole }).role ??
      'LECTURA') as AppRole;

  if (role !== 'ADMIN') {
    throw new Error('No autorizado.');
  }

  return session;
}

function getUserId(formData: FormData): string {
  const userId = formData.get('userId');

  if (typeof userId !== 'string') {
    return '';
  }

  return userId.trim();
}

export async function approveUserAction(formData: FormData) {
  const session = await requireAdminSession();
  const userId = getUserId(formData);

  if (!userId) {
    throw new Error('Solicitud inválida.');
  }

  await prisma.appUser.update({
    where: { id: userId },
    data: {
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedAt: new Date(),
      approvedByEmail: session.user.email ?? null,
      rejectedAt: null,
      rejectedByEmail: null,
    },
  });

  revalidatePath('/usuarios');
}

export async function rejectUserAction(formData: FormData) {
  const session = await requireAdminSession();
  const userId = getUserId(formData);

  if (!userId) {
    throw new Error('Solicitud inválida.');
  }

  await prisma.appUser.update({
    where: { id: userId },
    data: {
      approvalStatus: 'REJECTED',
      isActive: false,
      approvedAt: null,
      approvedByEmail: null,
      rejectedAt: new Date(),
      rejectedByEmail: session.user.email ?? null,
    },
  });

  revalidatePath('/usuarios');
}