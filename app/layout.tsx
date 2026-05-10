import './globals.css';
import type { Metadata } from 'next';

import { auth } from '@/auth';
import { LogoutButton } from '@/components/logout-button';
import { NavLink } from '@/components/nav-link';

type AppRole = 'ADMIN' | 'LECTURA';

export const metadata: Metadata = {
  title: 'Integramécum | Catálogo integrado',
  description: 'Catálogo Integrado CIMA + BIFIMED + Orion Logis.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nosnippet: true,
      noarchive: true,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const role = session?.user
    ? ((session.user as typeof session.user & { role?: AppRole }).role ??
        'LECTURA')
    : null;

  return (
    <html lang="es">
      <body>
        <header className="header">
          <div className="nav">
            <div className="nav-brand">
              <strong className="nav-title">Integramécum</strong>
              <div className="muted nav-subtitle">
                Catálogo Integrado CIMA + BIFIMED + Orion Logis
              </div>
            </div>

            <nav className="nav-links" aria-label="Principal">
              <NavLink href="/">Inicio</NavLink>
              <NavLink href="/importaciones">Importaciones</NavLink>
              <NavLink href="/catalogo">Catálogo</NavLink>
              <NavLink href="/suministro">Suministro</NavLink>
              <NavLink href="/automatizacion">
                Automatización
              </NavLink>
              {role === 'ADMIN' ? <NavLink href="/usuarios">Usuarios</NavLink> : null}
            </nav>

            {session?.user ? (
              <div className="actions-row">
                <span className="badge primary">{role}</span>
                <span className="muted">{session.user.email ?? ''}</span>
                <LogoutButton />
              </div>
            ) : null}
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}