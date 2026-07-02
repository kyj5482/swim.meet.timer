import { describe, expect, it } from 'vitest';
import type { TrainingRecord } from '../../db/mapping';
import { eventKeyOf, eventLabel, recordsToCsv } from './csv';

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

describe('CSV 내보내기', () => {
  it('헤더 + 스플릿 평면화 + 1/100초·ms 병기', () => {
    const csv = recordsToCsv('Minjun', [rec({})]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('swimmer,date,stroke,distance,course,status,total,totalMs,split1,split2');
    expect(row).toBe('Minjun,2026-07-01,free,100,25y,finished,01:02.34,62340,30.00,32.34');
  });
  it('쉼표·따옴표 이스케이프, 날짜순 정렬', () => {
    const a = rec({ id: 'a', date: Date.UTC(2026, 6, 2), splits: [] , totalMs: 60_000 });
    const b = rec({ id: 'b', date: Date.UTC(2026, 6, 1) });
    const csv = recordsToCsv('Kim, "MJ"', [a, b]);
    const rows = csv.split('\n');
    expect(rows[1]).toContain('2026-07-01');
    expect(rows[2]).toContain('2026-07-02');
    expect(rows[1]!.startsWith('"Kim, ""MJ"""')).toBe(true);
  });
  it('종목 라벨/키', () => {
    const t = rec({}).target;
    expect(eventLabel(t)).toBe('100 free · 25y');
    expect(eventKeyOf(t)).toBe('100|free|25y');
  });
});
