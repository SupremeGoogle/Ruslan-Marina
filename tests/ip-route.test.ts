import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/ip/route';

function makeReq(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/ip', {
    method: 'GET',
    headers,
  }) as any;
}

describe('/api/ip', () => {
  it('returns the first x-forwarded-for IP when present', async () => {
    const res = await GET(makeReq({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' }));
    const body = await res.json();
    expect(body.ip).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    const res = await GET(makeReq({ 'x-real-ip': '198.51.100.7' }));
    const body = await res.json();
    expect(body.ip).toBe('198.51.100.7');
  });

  it('returns localhost fallback when no headers are present', async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.ip).toBe('127.0.0.1');
  });

  it('never throws on malformed headers', async () => {
    const res = await GET(makeReq({ 'x-forwarded-for': '   ,  ' }));
    const body = await res.json();
    expect(typeof body.ip).toBe('string');
  });
});
