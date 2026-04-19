'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';

export type RegisterState = {
  status: 'idle' | 'error' | 'success';
  message?: string;
};

export async function registerAction(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  try {
    const displayNameValue = formData.get('displayName');
    const emailValue = formData.get('email');
    const passwordValue = formData.get('password');
    const confirmPasswordValue = formData.get('confirmPassword');

    const displayName =
      typeof displayNameValue === 'string' ? displayNameValue.trim() : '';
    const email =
      typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    const confirmPassword =
      typeof confirmPasswordValue === 'string' ? confirmPasswordValue : '';

    if (displayName.length < 3) {
      return {
        status: 'error',
        message: 'Introduce un nombre identificable.',
      };
    }

    if (!email || !email.includes('@')) {
      return {
        status: 'error',
        message: 'Introduce un email válido.',
      };
    }

    if (password.length < 8) {
      return {
        status: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      };
    }

    if (password !== confirmPassword) {
      return {
        status: 'error',
        message: 'La confirmación de contraseña no coincide.',
      };
    }

    const existingUser = await prisma.appUser.findUnique({
      where: { email },
      select: {
        approvalStatus: true,
      },
    });

    if (existingUser) {
      if (existingUser.approvalStatus === 'PENDING') {
        return {
          status: 'error',
          message: 'Ya existe una solicitud pendiente para este email.',
        };
      }

      return {
        status: 'error',
        message: 'Ya existe una cuenta registrada con este email.',
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.appUser.create({
      data: {
        email,
        displayName,
        passwordHash,
        role: 'LECTURA',
        isActive: false,
        approvalStatus: 'PENDING',
        requestedAt: new Date(),
      },
    });

    revalidatePath('/usuarios');

    return {
      status: 'success',
      message:
        'Solicitud enviada correctamente. Un administrador debe activarla antes de que puedas iniciar sesión.',
    };
  } catch (error) {
    console.error('No se pudo registrar la solicitud de cuenta.', error);

    return {
      status: 'error',
      message: 'No se pudo registrar la solicitud. Inténtalo de nuevo.',
    };
  }
}