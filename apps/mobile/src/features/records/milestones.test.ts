import { describe, expect, it } from 'vitest';

import { levelMilestones } from './milestones';

const LADDER = [
  { level: 'B', timeMs: 31790 },
  { level: 'BB', timeMs: 29490 },
  { level: 'A', timeMs: 27290 },
];

const s = (id: string, day: number, sec: number) => ({ id, date: day * 86_400_000, totalMs: sec * 1000 });

describe('levelMilestones — 레벨 승급 세션 배지', () => {
  it('최초 기록이 B면 그 세션에 B, BB 돌파 세션에 BB', () => {
    const m = levelMilestones([
      s('s1', 0, 31.0),  // B 달성
      s('s2', 10, 30.5), // 여전히 B — 배지 없음
      s('s3', 20, 29.2), // BB 돌파
      s('s4', 30, 29.4), // 여전히 BB — 배지 없음
    ], LADDER);
    expect(m.get('s1')).toBe('B');
    expect(m.has('s2')).toBe(false);
    expect(m.get('s3')).toBe('BB');
    expect(m.has('s4')).toBe(false);
  });

  it('첫 세션이 어떤 컷도 못 미치면 배지 없음, 이후 B 돌파 때 표시', () => {
    const m = levelMilestones([s('s1', 0, 33.0), s('s2', 5, 31.5)], LADDER);
    expect(m.has('s1')).toBe(false);
    expect(m.get('s2')).toBe('B');
  });

  it('한 세션에서 두 단계를 건너뛰면 최고 레벨만', () => {
    const m = levelMilestones([s('s1', 0, 32.0), s('s2', 5, 27.0)], LADDER);
    expect(m.get('s2')).toBe('A');
  });

  it('입력 순서와 무관 — 날짜순으로 판정', () => {
    const m = levelMilestones([s('late', 20, 29.2), s('early', 0, 31.0)], LADDER);
    expect(m.get('early')).toBe('B');
    expect(m.get('late')).toBe('BB');
  });

  it('사다리가 없으면 빈 맵', () => {
    expect(levelMilestones([s('s1', 0, 30)], null).size).toBe(0);
    expect(levelMilestones([s('s1', 0, 30)], []).size).toBe(0);
  });
});
