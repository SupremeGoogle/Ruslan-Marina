import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/supabaseClient', () => ({
  createServerSupabase: () => null,
  supabase: null,
}));

import { POST } from '@/app/api/guest/rename/route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/guest/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('/api/guest/rename validation', () => {
  it('rejects empty firstName/lastName with 400', async () => {
    const res = await POST(makeReq({ guestId: 'x', firstName: '', lastName: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects whitespace-only names with 400', async () => {
    const res = await POST(makeReq({ guestId: 'x', firstName: '   ', lastName: '   ' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing guestId with 400', async () => {
    const res = await POST(makeReq({ firstName: 'Ivan', lastName: 'Ivanov' }));
    expect(res.status).toBe(400);
  });

  it('rejects non-string names without crashing', async () => {
    const res = await POST(makeReq({ guestId: 'x', firstName: 123, lastName: null }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when supabase not configured', async () => {
    const res = await POST(makeReq({ guestId: 'x', firstName: 'Ivan', lastName: 'Ivanov' }));
    expect(res.status).toBe(503);
  });
});
