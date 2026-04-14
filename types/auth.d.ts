import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: 'ADMIN' | 'LECTURA';
  }

  interface Session {
    user: DefaultSession['user'] & {
      role: 'ADMIN' | 'LECTURA';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'ADMIN' | 'LECTURA';
  }
}