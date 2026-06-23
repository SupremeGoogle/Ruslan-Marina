import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/supabaseClient', () => ({
  createServerSupabase: () => null,
  supabase: null,
}));

import { POST } from '@/app/api/guest/register/route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/guest/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('/api/guest/register validation', () => {
  it('rejects empty names with 400', async () => {
    const res = await POST(makeReq({ firstName: '', lastName: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects whitespace-only names with 400', async () => {
    const res = await POST(makeReq({ firstName: '   ', lastName: '   ' }));
    expect(res.status).toBe(400);
  });

  it('rejects non-string names without throwing', async () => {
    const res = await POST(makeReq({ firstName: 123, lastName: null }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON without throwing', async () => {
    const req = new Request('http://localhost/api/guest/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 503 when supabase is not configured', async () => {
    const res = await POST(makeReq({ firstName: 'Ivan', lastName: 'Ivanov' }));
    expect(res.status).toBe(503);
  });
});
