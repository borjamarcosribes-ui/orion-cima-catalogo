import './globals.css';
import type { Metadata } from 'next';
import { NavLink } from '@/components/nav-link';

export const metadata: Metadata = {
  title: 'Integramécum | Catálogo integrado',
  description: 'Catálogo Integrado CIMA + BIFIMED + Orion Logis.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}