'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    try {
      setIsPending(true);
      await signOut({ callbackUrl: '/login' });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      className="secondary-button"
      type="button"
      onClick={handleLogout}
      disabled={isPending}
    >
      {isPending ? 'Saliendo…' : 'Salir'}
    </button>
  );
}