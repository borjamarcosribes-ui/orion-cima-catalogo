'use server';

export type LoginState = {
  error?: string;
};

export async function loginAction(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  void previousState;
  void formData;

  return {};
}