import './globals.css';
import type { Metadata } from 'next';

import { NavLink } from '@/components/nav-link';
import { auth, signOut } from '@/auth';

export const metadata: Metadata = {
  title: 'Integramécum | Catálogo integrado',
  description: 'Catálogo Integrado CIMA + BIFIMED + Orion Logis.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="es">
      <body>
        <header className="header">
          <div className="nav" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: '1.5rem', lineHeight: 1.1 }}>Integramécum</strong>
              <div className="muted">Catálogo Integrado CIMA + BIFIMED + Orion Logis</div>
            </div>

            <nav
              className="nav-links"
              aria-label="Principal"
              style={{ display: 'flex', flexWrap: 'nowrap', gap: 16, whiteSpace: 'nowrap', overflowX: 'auto' }}
            >
              <NavLink href="/">Inicio</NavLink>
              <NavLink href="/importaciones">Importación Orion Logis</NavLink>
              <NavLink href="/catalogo">CIMA Integrada</NavLink>
              <NavLink href="/suministro">Gestor de Roturas</NavLink>
              <NavLink href="/automatizacion">Panel de Automatizaciones</NavLink>
            </nav>

            {session?.user ? (
              <div className="actions-row" style={{ marginTop: 0 }}>
                <span className="badge primary">{session.user.role}</span>
                <span className="muted">{session.user.email}</span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/login' });
                  }}
                >
                  <button className="secondary-button" type="submit">
                    Salir
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}