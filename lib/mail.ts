export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

export type SendMailResult = {
  ok: boolean;
  provider: 'resend';
  messageId: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return value;
}

function normalizeRecipients(to: string): string[] {
  return to
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = requireEnv('RESEND_API_KEY');
  const from = requireEnv('MAIL_FROM');
  const recipients = normalizeRecipients(input.to);

  if (recipients.length === 0) {
    throw new Error('No se ha indicado ningún destinatario válido.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text ?? undefined,
    }),
    cache: 'no-store',
  });

  const responseText = await response.text();
  let payload: { id?: string; message?: string } = {};

  try {
    payload = responseText ? (JSON.parse(responseText) as { id?: string; message?: string }) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.message
        ? `Error enviando email con Resend: ${payload.message}`
        : `Error enviando email con Resend: ${response.status} ${response.statusText}`,
    );
  }

  return {
    ok: true,
    provider: 'resend',
    messageId: payload.id ?? null,
  };
}