'use client';

import { useActionState } from 'react';

import { loginAction } from '@/app/login/actions';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <form action={formAction} className="grid" style={{ gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <small className="muted">Email</small>
        <input name="email" type="email" required />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <small className="muted">Contraseña</small>
        <input name="password" type="password" required />
      </label>

      {state.error ? <div className="badge danger">{state.error}</div> : null}

      <div className="actions-row" style={{ marginTop: 4 }}>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}