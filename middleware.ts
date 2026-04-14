import { NextResponse } from 'next/server';

import { auth } from '@/auth';

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/jobs/')) {
    return NextResponse.next();
  }

  if (!request.auth) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};