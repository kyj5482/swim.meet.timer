import { describe, expect, it } from 'vitest';

import { labelIndices, trendDomain, xScale } from './chartMath';

const LADDER = [
  { level: 'B', timeMs: 31790 },
  { level: 'BB', timeMs: 29490 },
  { level: 'A', timeMs: 27290 },
  { level: 'AA', timeMs: 26090 },
  { level: 'AAA', timeMs: 24990 },
  { level: 'AAAA', timeMs: 23890 },
];

describe('trendDomain', () => {
  it('표준 있음: 다음 레벨 컷(아래)과 한 단계 느린 컷(위)으로 도메인 고정', () => {
    // 기록 28.5~30.5초: 베스트 28.5 → 다음 레벨 A(27.29), 최악 30.5 → 위는 B(31.79)
    const d = trendDomain([30500, 29800, 28500], LADDER);
    expect(d.lo).toBeLessThan(27290);
    expect(d.hi).toBeGreaterThan(31790);
    expect(d.cuts.map((c) => c.level)).toEqual(['A', 'BB', 'B']);
  });
  it('최고 레벨(AAAA)보다 빠르면 아래 경계는 데이터', () => {
    const d = trendDomain([23000, 23500], LADDER);
    expect(d.lo).toBeLessThanOrEqual(23000);
    expect(d.cuts.some((c) => c.level === 'AAAA')).toBe(true);
  });
  it('컷이 데이터 폭 대비 너무 멀면 확장하지 않음(차트 짜부 방지)', () => {
    // 베스트 60초, 데이터 폭 1초 — A컷(27.29)은 32초 밖이라 확장 금지
    const d = trendDomain([61000, 60000], LADDER);
    expect(d.lo).toBeGreaterThan(50000);
  });
  it('표준 없음: 데이터 ±10% 여백', () => {
    const d = trendDomain([30000, 40000]);
    expect(d.lo).toBe(29000);
    expect(d.hi).toBe(41000);
    expect(d.cuts).toEqual([]);
  });
  it('기록 1개(폭 0)도 유한 도메인', () => {
    const d = trendDomain([30000]);
    expect(d.hi - d.lo).toBeGreaterThan(0);
  });
});

describe('xScale', () => {
  it('시작/끝 날짜가 가장자리에 붙지 않음(패딩)', () => {
    const day = 86_400_000;
    const X = xScale([0, 10 * day]);
    expect(X(0)).toBeGreaterThan(0.05);
    expect(X(10 * day)).toBeLessThan(0.95);
    expect(X(5 * day)).toBeCloseTo(0.5, 5);
  });
  it('단일 날짜는 중앙', () => {
    expect(xScale([1000])(1000)).toBe(0.5);
  });
});

describe('labelIndices', () => {
  it('6개 이하는 전부 라벨', () => {
    expect(labelIndices(4, 2)).toEqual(new Set([0, 1, 2, 3]));
  });
  it('많으면 처음·베스트·마지막만', () => {
    expect(labelIndices(12, 7)).toEqual(new Set([0, 7, 11]));
  });
});
