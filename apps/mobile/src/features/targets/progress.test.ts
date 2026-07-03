import { describe, expect, it } from 'vitest';

import { eventProgress } from './progress';

const LADDER = [
  { level: 'B', timeMs: 31790 },
  { level: 'BB', timeMs: 29490 },
  { level: 'A', timeMs: 27290 },
  { level: 'AA', timeMs: 26090 },
  { level: 'AAA', timeMs: 24990 },
  { level: 'AAAA', timeMs: 23890 },
];

describe('eventProgress', () => {
  it('중간 레벨: BB 통과, 다음은 A, 단축률 계산', () => {
    const p = eventProgress(28500, LADDER);
    expect(p.reached?.level).toBe('BB');
    expect(p.next?.level).toBe('A');
    expect(p.toNextMs).toBe(28500 - 27290);
    // (28500-27290)/28500 = 4.245..% → 4.2
    expect(p.dropPct).toBe(4.2);
  });
  it('아직 B 미달: reached null, 다음은 B', () => {
    const p = eventProgress(35000, LADDER);
    expect(p.reached).toBeNull();
    expect(p.next?.level).toBe('B');
  });
  it('최고 레벨 달성: next null, dropPct null', () => {
    const p = eventProgress(23000, LADDER);
    expect(p.reached?.level).toBe('AAAA');
    expect(p.next).toBeNull();
    expect(p.dropPct).toBeNull();
  });
});
