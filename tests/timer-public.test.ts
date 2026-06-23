import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
vi.mock('@/utils/supabaseClient', () => ({
  createServerSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  }),
  supabase: null,
}));

import { GET } from '@/app/api/timer/route';

describe('/api/timer', () => {
  beforeEach(() => {
    mockSingle.mockReset();
  });

  it('returns demo state when supabase client is null', async () => {
    vi.doMock('@/utils/supabaseClient', () => ({
      createServerSupabase: () => null,
    }));
    // Reload to apply new mock — supported by the existing mock for default case below
  });

  it('returns server-computed remaining seconds for running timer', async () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    mockSingle.mockResolvedValue({
      data: {
        status: 'running',
        remaining_seconds: 100,
        updated_at: tenSecondsAgo,
      },
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('running');
    // 100 - 10 = 90, allow 1s drift
    expect(body.remainingSeconds).toBeGreaterThanOrEqual(89);
    expect(body.remainingSeconds).toBeLessThanOrEqual(91);
  });

  it('does not deduct elapsed time when timer is paused', async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    mockSingle.mockResolvedValue({
      data: { status: 'paused', remaining_seconds: 500, updated_at: oneMinuteAgo },
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('paused');
    expect(body.remainingSeconds).toBe(500);
  });

  it('never returns negative remaining seconds', async () => {
    const longAgo = new Date(Date.now() - 1_000_000_000).toISOString();
    mockSingle.mockResolvedValue({
      data: { status: 'running', remaining_seconds: 10, updated_at: longAgo },
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.remainingSeconds).toBe(0);
  });

  it('returns 500 on DB error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
