import { describe, expect, it } from 'vitest';

import { autoTargetStep, ladderWindow } from './ladderView';

const L = [
  { level: 'B', timeMs: 70000 },
  { level: 'BB', timeMs: 65000 },
  { level: 'A', timeMs: 60000 },
  { level: 'AA', timeMs: 56000 },
  { level: 'AAA', timeMs: 53000 },
  { level: 'AAAA', timeMs: 50000 },
  { level: 'WZ', timeMs: 46000 },
];

describe('autoTargetStep — best 위 다음 레벨(자동 타겟)', () => {
  it('AA 달성 상태면 다음은 AAA', () => {
    expect(autoTargetStep(L, 55000)?.level).toBe('AAA'); // 56k(AA) 통과, 53k(AAA) 미달
  });
  it('아무것도 달성 못하면 가장 낮은 B', () => {
    expect(autoTargetStep(L, 80000)?.level).toBe('B');
  });
  it('최고 레벨까지 달성하면 가장 빠른 레벨 유지', () => {
    expect(autoTargetStep(L, 45000)?.level).toBe('WZ');
  });
});

describe('ladderWindow — 3칸(달성/타겟/다음)', () => {
  it('AA 달성·타겟 AAA → AA·AAA·AAAA 세 칸(B 위 순서)', () => {
    const w = ladderWindow(L, 55000, 53000); // best 55k, target AAA(53k)
    expect(w.map((r) => r.level)).toEqual(['AA', 'AAA', 'AAAA']);
    expect(w.find((r) => r.level === 'AA')!.role).toBe('reached');
    expect(w.find((r) => r.level === 'AAA')!.role).toBe('target');
    expect(w.find((r) => r.level === 'AAAA')!.role).toBe('next');
  });

  it('아무것도 달성 못하면 B·BB·A(하위 3, base)', () => {
    const w = ladderWindow(L, 80000, 70000);
    expect(w.map((r) => r.level)).toEqual(['B', 'BB', 'A']);
    expect(w.every((r) => r.role === 'base')).toBe(true);
  });

  it('타겟이 달성 레벨보다 훨씬 위여도 3칸(달성·다음·타겟)', () => {
    const w = ladderWindow(L, 55000, 46000); // best AA, target WZ(46k)
    const levels = w.map((r) => r.level);
    expect(levels).toContain('AA');   // reached
    expect(levels).toContain('WZ');   // target
    expect(w.length).toBeLessThanOrEqual(3);
  });

  it('빈 사다리는 빈 배열', () => {
    expect(ladderWindow([], 55000, 53000)).toEqual([]);
  });
});
