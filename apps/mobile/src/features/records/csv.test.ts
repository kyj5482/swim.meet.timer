import { describe, expect, it } from 'vitest';
import type { TrainingRecord } from '../../db/mapping';
import { eventKeyOf, eventLabel, eventName } from './csv';

function rec(over: Partial<TrainingRecord>): TrainingRecord {
  return {
    id: 'r', swimmerId: 's', sessionId: 'ss', date: Date.UTC(2026, 6, 1),
    target: { stroke: 'free', distance: 100, course: '25y', splitInterval: 25 },
    splits: [
      { segmentIndex: 0, cumulativeMs: 30_000, splitMs: 30_000 },
      { segmentIndex: 1, cumulativeMs: 62_340, splitMs: 32_340 },
    ],
    totalMs: 62_340, status: 'finished', slot: 1, ...over,
  };
}

describe('종목 라벨', () => {
  it('종목 라벨/키', () => {
    const t = rec({}).target;
    expect(eventLabel(t)).toBe('100 Free · 25 Yard');
    expect(eventKeyOf(t)).toBe('100|free|25y');
  });
  it('미트 표기 종목 이름 — 코스 단위 포함', () => {
    expect(eventName(rec({}).target)).toBe('100 Yard Free');
    expect(eventName({ stroke: 'free', distance: 50, course: '25m', splitInterval: 25 })).toBe('50 Meter Free');
    expect(eventName({ stroke: 'im', distance: 200, course: '50m', splitInterval: 50 })).toBe('200 Meter IM');
  });
});
