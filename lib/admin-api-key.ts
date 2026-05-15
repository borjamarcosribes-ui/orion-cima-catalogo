import { NextRequest, NextResponse } from 'next/server';

type AdminApiKeyCheck =
  | { ok: true }
  | {
      ok: false;
      response: NextResponse;
    };

const ADMIN_API_KEY_HEADER = 'x-admin-api-key';

function getConfiguredAdminApiKey(): string | null {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

export function requireAdminApiKey(request: NextRequest | Request): AdminApiKeyCheck {
  const configuredApiKey = getConfiguredAdminApiKey();

  if (!configuredApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'ADMIN_API_KEY no está configurada.' },
        { status: 503 },
      ),
    };
  }

  const providedApiKey = request.headers.get(ADMIN_API_KEY_HEADER)?.trim();

  if (!providedApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'X-Admin-API-Key requerida.' },
        { status: 401 },
      ),
    };
  }

  if (providedApiKey !== configuredApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'X-Admin-API-Key inválida.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
