import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        if (!email || !password) {
          return null;
        }

        const user = await prisma.appUser.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as { role?: 'ADMIN' | 'LECTURA' }).role ?? 'LECTURA';
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.role = (token.role as 'ADMIN' | 'LECTURA') ?? 'LECTURA';
      }
      return session;
    },
  },
});