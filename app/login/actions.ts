'use server';

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _: LoginState,
  __: FormData,
): Promise<LoginState> {
  return {};
}