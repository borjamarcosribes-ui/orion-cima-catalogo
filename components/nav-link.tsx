'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';

type NavLinkProps = {
  href: Route;
  children: React.ReactNode;
};

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link className={`nav-link${active ? ' active' : ''}`} href={href}>
      {children}
    </Link>
  );
}