'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

type LoginFormProps = {
  callbackUrl?: string;
};

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedCallbackUrl = useMemo(() => {
    return callbackUrl ?? searchParams.get('callbackUrl') ?? '/';
  }, [callbackUrl, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn('credentials', {
          username,
          password,
          redirect: false,
          callbackUrl: resolvedCallbackUrl,
        });

        if (!result) {
          setError('No se pudo iniciar sesión.');
          return;
        }

        if (result.error) {
          setError('Usuario o contraseña incorrectos.');
          return;
        }

        const targetUrl = result.url || resolvedCallbackUrl;
        window.location.href = targetUrl;
      } catch {
        setError('No se pudo iniciar sesión.');
      }
    });
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
              required
            />
          </div>

          {error ? (
            <p style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div className="actions-row">
            <button type="submit" className="primary-button" disabled={isPending}>
              {isPending ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}