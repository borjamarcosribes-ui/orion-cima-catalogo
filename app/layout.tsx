import './globals.css';
import type { Metadata } from 'next';
import { NavLink } from '@/components/nav-link';

export const metadata: Metadata = {
  title: 'Orion + CIMA | Catálogo operativo',
  description: 'Primera iteración del catálogo operativo de Farmacia a partir de Orion y CIMA.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="header">
          <div className="nav">
            <div>
              <strong>Orion + CIMA</strong>
              <div className="muted">Catálogo operativo de Farmacia Hospitalaria</div>
            </div>
            <nav className="nav-links" aria-label="Principal">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/importaciones">Importaciones</NavLink>
              <NavLink href="/catalogo">Catálogo operativo</NavLink>
              <NavLink href="/suministro">Suministro</NavLink>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}