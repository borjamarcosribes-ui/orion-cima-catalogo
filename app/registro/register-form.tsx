'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';

import {
  registerAction,
  type RegisterState,
} from '@/app/registro/actions';

const initialRegisterState: RegisterState = {
  status: 'idle',
};

export default function RegisterForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialRegisterState,
  );

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <label htmlFor="displayName">Nombre</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            disabled={isPending}
            required
          />
        </div>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            disabled={isPending}
            required
          />
        </div>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={isPending}
            required
          />
        </div>

        {state.message ? <p style={{ margin: 0 }}>{state.message}</p> : null}

        <div className="actions-row">
          <button type="submit" className="primary-button" disabled={isPending}>
            {isPending ? 'Enviando...' : 'Solicitar cuenta'}
          </button>

          <Link href="/login" className="secondary-button">
            Volver al login
          </Link>
        </div>
      </div>
    </form>
  );
}