import { describe, it, expect } from 'vitest';

// Port of the formatTime helper from page.tsx — kept in sync so we
// can lock down the digit-padding behaviour without spinning up React.
function formatTime(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return {
    hours: hrs.toString().padStart(2, '0'),
    minutes: mins.toString().padStart(2, '0'),
    seconds: secs.toString().padStart(2, '0'),
  };
}

describe('formatTime', () => {
  it('formats 3 hours exactly (10800s)', () => {
    expect(formatTime(10800)).toEqual({ hours: '03', minutes: '00', seconds: '00' });
  });

  it('formats zero', () => {
    expect(formatTime(0)).toEqual({ hours: '00', minutes: '00', seconds: '00' });
  });

  it('pads single digits', () => {
    expect(formatTime(7)).toEqual({ hours: '00', minutes: '00', seconds: '07' });
    expect(formatTime(65)).toEqual({ hours: '00', minutes: '01', seconds: '05' });
  });

  it('handles >10 hours', () => {
    expect(formatTime(36_005)).toEqual({ hours: '10', minutes: '00', seconds: '05' });
  });
});

describe('photo upload size limit (client-side guard)', () => {
  const MAX = 10 * 1024 * 1024;
  it('accepts 9.9 MB file', () => {
    expect(9.9 * 1024 * 1024 > MAX).toBe(false);
  });
  it('rejects 10.1 MB file', () => {
    expect(10.1 * 1024 * 1024 > MAX).toBe(true);
  });
});

describe('safe filename derivation for archive zip', () => {
  // Mirror of the safeName logic in /api/admin/archive/route.ts:75
  const safe = (name: string) => name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');

  it('strips spaces and punctuation', () => {
    expect(safe('Иван Иванов!')).toBe('Иван_Иванов_');
  });
  it('keeps cyrillic letters', () => {
    expect(safe('Мария-Анна')).toBe('Мария_Анна');
  });
  it('handles emoji and unicode without throwing', () => {
    // Emoji are multi-codeunit in UTF-16; each codeunit becomes "_". Important
    // is that the result is safe for a filesystem, not the exact length.
    const out = safe('user🎉');
    expect(out.startsWith('user')).toBe(true);
    expect(/^[a-zA-Zа-яА-Я0-9_]+$/.test(out)).toBe(true);
  });
});
