'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') ?? '')
        .trim()
        .toLowerCase();
      const password = String(formData.get('password') ?? '');
      const callbackUrl = searchParams.get('from') || '/';

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError('Credenciales inválidas o usuario inactivo.');
        return;
      }

      router.push(result.url || callbackUrl);
      router.refresh();
    } catch {
      setError('No se pudo iniciar sesión.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <small className="muted">Email</small>
        <input name="email" type="email" required />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <small className="muted">Contraseña</small>
        <input name="password" type="password" required />
      </label>

      {error ? <div className="badge danger">{error}</div> : null}

      <div className="actions-row" style={{ marginTop: 4 }}>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}