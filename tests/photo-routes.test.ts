import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/supabaseClient', () => ({
  createServerSupabase: () => null,
  supabase: null,
}));

import { POST as uploadPOST } from '@/app/api/photo/upload/route';
import { POST as deletePOST } from '@/app/api/photo/delete/route';
import { GET as listGET } from '@/app/api/photo/list/route';

function jsonReq(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('/api/photo/upload validation', () => {
  it('rejects request without form data', async () => {
    const res = await uploadPOST(jsonReq('/api/photo/upload', { foo: 'bar' }));
    expect([400, 503]).toContain(res.status);
  });

  it('rejects form data missing the file', async () => {
    const form = new FormData();
    form.append('guestId', 'g1');
    form.append('guestName', 'Ivan');
    const req = new Request('http://localhost/api/photo/upload', {
      method: 'POST',
      body: form,
    }) as any;
    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
  });

  it('rejects non-image file', async () => {
    const form = new FormData();
    form.append('file', new File(['hello'], 'note.txt', { type: 'text/plain' }));
    form.append('guestId', 'g1');
    form.append('guestName', 'Ivan');
    const req = new Request('http://localhost/api/photo/upload', {
      method: 'POST',
      body: form,
    }) as any;
    const res = await uploadPOST(req);
    expect(res.status).toBe(415);
  });

  it('rejects file over 10 MB', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', big);
    form.append('guestId', 'g1');
    form.append('guestName', 'Ivan');
    const req = new Request('http://localhost/api/photo/upload', {
      method: 'POST',
      body: form,
    }) as any;
    const res = await uploadPOST(req);
    expect(res.status).toBe(413);
  });

  it('rejects when guestId missing', async () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    form.append('guestName', 'Ivan');
    const req = new Request('http://localhost/api/photo/upload', {
      method: 'POST',
      body: form,
    }) as any;
    const res = await uploadPOST(req);
    expect(res.status).toBe(400);
  });
});

describe('/api/photo/delete validation', () => {
  it('rejects missing photoId/guestId with 400', async () => {
    const res = await deletePOST(jsonReq('/api/photo/delete', {}));
    expect(res.status).toBe(400);
  });

  it('returns 503 when supabase not configured', async () => {
    const res = await deletePOST(jsonReq('/api/photo/delete', { photoId: 'p1', guestId: 'g1' }));
    expect(res.status).toBe(503);
  });
});

describe('/api/photo/list', () => {
  it('returns empty list when supabase unconfigured (demo)', async () => {
    const res = await listGET();
    const data = await res.json();
    expect(Array.isArray(data.photos)).toBe(true);
    expect(data.photos.length).toBe(0);
  });
});
