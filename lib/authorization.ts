import { auth } from '@/auth';

export async function requireAdminThrowing() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('No autorizado: solo ADMIN.');
  }

  return session;
}

export async function getAdminAuthorizationResult(): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false,
      message: 'No autorizado: sesión requerida.',
    };
  }

  if (session.user.role !== 'ADMIN') {
    return {
      ok: false,
      message: 'No autorizado: solo ADMIN.',
    };
  }

  return { ok: true };
}