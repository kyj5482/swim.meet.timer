import { describe, expect, it } from 'vitest';
import { idTime, newId } from './ids';
import { computeStats, rowToRecord, type RecordRow } from './mapping';
import { MIGRATIONS } from './schema';

describe('id 생성', () => {
  it('시간순 정렬 가능 + 생성 시각 복원', () => {
    const a = newId(1_000);
    const b = newId(2_000);
    expect(a < b).toBe(true);
    expect(idTime(a)).toBe(1_000);
    expect(newId(1_000)).not.toBe(a); // 랜덤 suffix
  });
});

describe('행 매핑', () => {
  it('RecordRow → TrainingRecord (splits JSON 복원)', () => {
    const row: RecordRow = {
      id: 'r1', swimmerId: 's1', sessionId: 'ss1', date: 123,
      stroke: 'free', distance: 100, course: '25y', splitInterval: 25,
      totalMs: 62_340, status: 'finished', slot: 2,
      splitsJson: JSON.stringify([{ segmentIndex: 0, cumulativeMs: 30_000, splitMs: 30_000 }]),
      updatedAt: 123, deleted: 0,
    };
    const rec = rowToRecord(row);
    expect(rec.target).toEqual({ stroke: 'free', distance: 100, course: '25y', splitInterval: 25 });
    expect(rec.splits[0]!.cumulativeMs).toBe(30_000);
    expect(rec.slot).toBe(2);
  });
});

describe('종목 통계 집계 (§3.6 추천 입력)', () => {
  const recs = [
    { swimmerId: 'a', totalMs: 55_000, date: 1 },
    { swimmerId: 'a', totalMs: 53_000, date: 3 },
    { swimmerId: 'a', totalMs: 54_000, date: 2 },
    { swimmerId: 'b', totalMs: 60_000, date: 1 },
  ];
  it('best=최소, last/typical=최신 날짜', () => {
    const [a, b, c] = computeStats(['a', 'b', 'c'], recs);
    expect(a).toEqual({ swimmerId: 'a', bestMs: 53_000, lastMs: 53_000, typicalMs: 53_000 });
    expect(b!.bestMs).toBe(60_000);
    // 이력 없는 선수도 후보 포함(남는 슬롯 배정용)
    expect(c!.bestMs).toBeNull();
    expect(c!.typicalMs).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('스키마', () => {
  it('v1은 필수 테이블·인덱스를 생성한다', () => {
    const v1 = MIGRATIONS[0]!;
    for (const t of ['swimmers', 'records', 'prefs', 'idx_records_swimmer_event']) {
      expect(v1).toContain(t);
    }
    expect(MIGRATIONS.length).toBeGreaterThan(0);
  });
});
