import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the supabase client BEFORE importing route handlers
vi.mock('@/utils/supabaseClient', () => ({
  createServerSupabase: () => null,
  supabase: null,
}));

import { POST as authPOST } from '@/app/api/admin/auth/route';
import { POST as timerPOST } from '@/app/api/admin/timer/route';
import { POST as deletePhotoPOST } from '@/app/api/admin/delete-photo/route';
import { POST as deleteGuestPOST } from '@/app/api/admin/delete-guest/route';
import { POST as archivePOST } from '@/app/api/admin/archive/route';

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/admin/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as any;
}

describe('Admin authentication security', () => {
  beforeEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  describe('/api/admin/auth', () => {
    it('returns 503 when ADMIN_PASSWORD env var is missing (fail closed)', async () => {
      const res = await authPOST(makeReq({ password: 'anything' }));
      expect(res.status).toBe(503);
    });

    it('rejects hardcoded legacy password "akbar123!" when env not set', async () => {
      const res = await authPOST(makeReq({ password: 'akbar123!' }));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.authenticated).toBeUndefined();
    });

    it('rejects wrong password with 401', async () => {
      process.env.ADMIN_PASSWORD = 'correct-secret';
      const res = await authPOST(makeReq({ password: 'wrong' }));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.authenticated).toBe(false);
    });

    it('accepts correct password with 200', async () => {
      process.env.ADMIN_PASSWORD = 'correct-secret';
      const res = await authPOST(makeReq({ password: 'correct-secret' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
    });

    it('does not crash on non-string password (e.g. number)', async () => {
      process.env.ADMIN_PASSWORD = 'correct-secret';
      const res = await authPOST(makeReq({ password: 12345 }));
      expect(res.status).toBe(401);
    });

    it('does not crash on missing password field', async () => {
      process.env.ADMIN_PASSWORD = 'correct-secret';
      const res = await authPOST(makeReq({}));
      expect(res.status).toBe(401);
    });
  });

  describe('write endpoints require ADMIN_PASSWORD header', () => {
    const endpoints: Array<[string, (r: any) => Promise<Response>, unknown]> = [
      ['timer', (r) => timerPOST(r), { action: 'start' }],
      ['delete-photo', (r) => deletePhotoPOST(r), { photoId: 'x', storagePath: 'y' }],
      ['delete-guest', (r) => deleteGuestPOST(r), { guestId: 'x' }],
      ['archive', (r) => archivePOST(r), { action: 'create' }],
    ];

    for (const [name, handler, body] of endpoints) {
      it(`${name}: returns 503 when env var missing`, async () => {
        const res = await handler(makeReq(body, { 'x-admin-password': 'akbar123!' }));
        expect(res.status).toBe(503);
      });

      it(`${name}: rejects missing header with 401`, async () => {
        process.env.ADMIN_PASSWORD = 'correct-secret';
        const res = await handler(makeReq(body));
        expect(res.status).toBe(401);
      });

      it(`${name}: rejects wrong password with 401`, async () => {
        process.env.ADMIN_PASSWORD = 'correct-secret';
        const res = await handler(makeReq(body, { 'x-admin-password': 'wrong' }));
        expect(res.status).toBe(401);
      });
    }
  });
});
