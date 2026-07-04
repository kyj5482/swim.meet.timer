import { describe, expect, it } from 'vitest';

import { swimGuidance, type LevelCut } from '../src/swim-guidance.js';

const cuts50FR: LevelCut[] = [
  { level: 'B', timeMs: 33990 },
  { level: 'BB', timeMs: 31690 },
  { level: 'A', timeMs: 29290 },
  { level: 'AA', timeMs: 28090 },
  { level: 'AAA', timeMs: 26990 },
  { level: 'AAAA', timeMs: 25790 },
];

describe('swimGuidance — 수준 판정 + 나이 맞춤 훈련/영상', () => {
  it('AAAA 통과면 competitive tier + 대표 수준 문장에 레벨 표기', () => {
    const g = swimGuidance([{ event: '50FR', course: 'SCY', totalMs: 25000 }], 12, { '50FR': cuts50FR });
    expect(g.tier).toBe('competitive');
    expect(g.levelSummary).toContain('AAAA');
    expect(g.focusAreas.length).toBeGreaterThan(0);
    expect(g.videos.every((v) => v.url.startsWith('https://'))).toBe(true);
  });

  it('B도 못 미치면 novice + 기초 문구', () => {
    const g = swimGuidance([{ event: '50FR', course: 'SCY', totalMs: 40000 }], 9, { '50FR': cuts50FR });
    expect(g.tier).toBe('novice');
    expect(g.levelSummary).toMatch(/fundamentals|technique/i);
  });

  it('나이대별 주간 플랜이 다르다(어린이 vs 시니어)', () => {
    const kid = swimGuidance([], 9, {});
    const senior = swimGuidance([], 17, {});
    expect(kid.weeklyPlan.length).toBeLessThan(senior.weeklyPlan.length);
    expect(kid.videos.some((v) => /fun|games/i.test(v.title))).toBe(true);
  });

  it('안전 고지가 항상 포함된다', () => {
    const g = swimGuidance([], 14, {});
    expect(g.safetyNote).toMatch(/coach/i);
  });

  it('사다리 없는 종목은 수준 판정에서 제외(크래시 없음)', () => {
    const g = swimGuidance([{ event: '200FL', course: 'SCY', totalMs: 120000 }], 13, {});
    expect(g.tier).toBe('novice');
  });
});
