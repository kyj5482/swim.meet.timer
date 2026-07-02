import { describe, expect, it } from 'vitest';
import { fmtClock, fmtSplit, fmtTotal, parseTime } from '../src/format';

describe('TE-10: 전 구간 1/100초 표시', () => {
  it('fmtClock', () => {
    expect(fmtClock(0)).toBe('00:00.00');
    expect(fmtClock(62_340)).toBe('01:02.34');
    expect(fmtClock(59_999)).toBe('01:00.00'); // 센티초 반올림
  });
  it('fmtSplit / fmtTotal', () => {
    expect(fmtSplit(31_270)).toBe(':31.27');
    expect(fmtTotal(58_210)).toBe('58.21');
    expect(fmtTotal(62_340)).toBe('01:02.34');
  });
  it('parseTime 왕복', () => {
    expect(parseTime('1:02.34')).toBe(62_340);
    expect(parseTime('58.21')).toBe(58_210);
    expect(parseTime('58.2')).toBe(58_200);
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('1:75.00')).toBeNull();
  });
});
