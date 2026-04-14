'use server';

import { AuthError } from 'next-auth';

import { signIn } from '@/auth';

export type LoginState = {
  error?: string;
};

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/',
    });

    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: 'Credenciales inválidas o usuario inactivo.',
      };
    }

    throw error;
  }
}