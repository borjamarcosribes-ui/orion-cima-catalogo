'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link className={`nav-link${active ? ' active' : ''}`} href={href}>
      {children}
    </Link>
  );
}
