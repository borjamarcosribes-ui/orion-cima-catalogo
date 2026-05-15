import { afterEach, describe, expect, it } from 'vitest';

import { requireAdminApiKey } from '@/lib/admin-api-key';

const ORIGINAL_ADMIN_API_KEY = process.env.ADMIN_API_KEY;

afterEach(() => {
  process.env.ADMIN_API_KEY = ORIGINAL_ADMIN_API_KEY;
});

async function parseResult(request: Request) {
  const result = requireAdminApiKey(request);

  if (result.ok) {
    return { ok: true as const, status: 200, body: null };
  }

  return {
    ok: false as const,
    status: result.response.status,
    body: await result.response.json(),
  };
}

describe('requireAdminApiKey', () => {
  it('returns 503 when ADMIN_API_KEY is not configured', async () => {
    delete process.env.ADMIN_API_KEY;

    const result = await parseResult(new Request('https://example.test/api/jobs/cima-cache'));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ ok: false, error: 'ADMIN_API_KEY no está configurada.' });
  });

  it('returns 401 when the admin header is missing', async () => {
    process.env.ADMIN_API_KEY = 'secret-admin-key';

    const result = await parseResult(new Request('https://example.test/api/jobs/cima-cache'));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, error: 'X-Admin-API-Key requerida.' });
  });

  it('returns 403 when the admin header is invalid', async () => {
    process.env.ADMIN_API_KEY = 'secret-admin-key';

    const result = await parseResult(
      new Request('https://example.test/api/jobs/bifimed-cache', {
        headers: { 'x-admin-api-key': 'wrong-key' },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, error: 'X-Admin-API-Key inválida.' });
  });

  it('allows the request when the admin header is valid', async () => {
    process.env.ADMIN_API_KEY = 'secret-admin-key';

    const result = requireAdminApiKey(
      new Request('https://example.test/api/jobs/cima-cache', {
        headers: { 'x-admin-api-key': 'secret-admin-key' },
      }),
    );

    expect(result).toEqual({ ok: true });
  });
});
