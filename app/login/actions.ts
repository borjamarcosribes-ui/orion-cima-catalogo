'use server';

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';

type LoginInput = {
  email?: string;
  password?: string;
};

export type LoginActionResult = {
  ok: boolean;
  error?: string;
};

export async function loginAction(input: LoginInput): Promise<LoginActionResult> {
  const email =
    typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password =
    typeof input.password === 'string' ? input.password : '';

  if (!email || !password) {
    return {
      ok: false,
      error: 'Introduce email y contraseña.',
    };
  }

  const user = await prisma.appUser.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      isActive: true,
      approvalStatus: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      error: 'Usuario o contraseña incorrectos.',
    };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return {
      ok: false,
      error: 'Usuario o contraseña incorrectos.',
    };
  }

  if (user.approvalStatus === 'PENDING') {
    return {
      ok: false,
      error: 'Tu cuenta todavía no ha sido activada por un administrador.',
    };
  }

  if (user.approvalStatus === 'REJECTED' || !user.isActive) {
    return {
      ok: false,
      error: 'Tu cuenta no está activa. Contacta con un administrador.',
    };
  }

  return { ok: true };
}