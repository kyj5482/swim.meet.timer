import { describe, expect, it } from 'vitest';
import { buildSeedRecords, birthYearFromAge, SEED_SWIMMERS } from './seed';

describe('데모 시드 생성', () => {
  const recs = buildSeedRecords();

  it('5명 × 6종목 × 6세션 = 180개 기록', () => {
    expect(SEED_SWIMMERS).toHaveLength(5);
    expect(recs).toHaveLength(5 * 6 * 6);
  });

  it('스플릿 합 = totalMs, cumulative 단조 증가 (불변식)', () => {
    for (const r of recs) {
      const sum = r.splits.reduce((a, s) => a + s.splitMs, 0);
      expect(sum).toBe(r.totalMs);
      expect(r.splits[r.splits.length - 1]!.cumulativeMs).toBe(r.totalMs);
      for (let i = 1; i < r.splits.length; i++) {
        expect(r.splits[i]!.cumulativeMs).toBeGreaterThan(r.splits[i - 1]!.cumulativeMs);
      }
    }
  });

  it('종목별 최신 세션이 가장 빠르다(개선 궤적)', () => {
    // 서연 100 Free
    const ev = recs
      .filter((r) => r.swimmerId === 'seed-seoyeon' && r.stroke === 'free' && r.distance === 100)
      .sort((a, b) => a.date - b.date);
    expect(ev).toHaveLength(6);
    for (let i = 1; i < ev.length; i++) {
      expect(ev[i]!.totalMs).toBeLessThan(ev[i - 1]!.totalMs); // 뒤로 갈수록 빠름
    }
  });

  it('id는 결정적(재실행해도 동일) — 멱등 시드', () => {
    const again = buildSeedRecords();
    expect(again.map((r) => r.id)).toEqual(recs.map((r) => r.id));
  });

  it('birthYear 계산', () => {
    expect(birthYearFromAge(13)).toBe(2013);
    expect(birthYearFromAge(11)).toBe(2015);
  });
});
