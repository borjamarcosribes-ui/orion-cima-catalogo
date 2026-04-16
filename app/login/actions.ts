'use server';

export type LoginState = {
  error?: string;
};

export async function loginAction(): Promise<LoginState> {
  return {};
}