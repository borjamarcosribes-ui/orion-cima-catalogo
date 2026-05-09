import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';

type AppRole = 'ADMIN' | 'LECTURA';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === 'string'
            ? credentials.email.trim().toLowerCase()
            : '';

        const password =
          typeof credentials?.password === 'string'
            ? credentials.password
            : '';

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
            approvalStatus: true,
          },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        if (!user.isActive || user.approvalStatus !== 'APPROVED') {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.email,
          role: user.role as AppRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as typeof token & { role?: AppRole }).role =
          (user as { role?: AppRole }).role ?? 'LECTURA';
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { role?: AppRole }).role =
          ((token as { role?: AppRole }).role ?? 'LECTURA') as AppRole;
      }

      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}