import type { CandidateStats, SlotState, Target } from '@splitlane/timer-core';

import { getDb } from './database';
import { newId } from './ids';
import { computeStats, rowToRecord, type RecordRow, type TrainingRecord } from './mapping';

/**
 * ASSIGN 확정 저장 (§3.7): 배정된 슬롯마다 TrainingRecord 1개, 트랜잭션
 * (전부 저장 또는 전부 롤백). 반환된 sessionId로 저장 취소(deleteSession) 가능.
 */
export async function saveSession(
  slots: readonly SlotState[], target: Target,
): Promise<{ sessionId: string; count: number }> {
  const db = await getDb();
  const now = Date.now();
  const sessionId = newId(now);
  const toSave = slots.filter((s) => s.swimmerId && s.splits.length > 0);
  await db.withTransactionAsync(async () => {
    for (const s of toSave) {
      await db.runAsync(
        `INSERT INTO records
           (id, swimmerId, sessionId, date, stroke, distance, course, splitInterval,
            totalMs, status, slot, splitsJson, updatedAt, deleted)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [
          newId(now), s.swimmerId!, sessionId, now,
          target.stroke, target.distance, target.course, target.splitInterval,
          s.lastCumMs, s.status === 'dnf' ? 'dnf' : 'finished', s.idx + 1,
          JSON.stringify(s.splits), now,
        ],
      );
    }
  });
  return { sessionId, count: toSave.length };
}

/** 저장 취소 / 세션 삭제 — tombstone (동기화 대비, 물리 삭제 금지). */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE records SET deleted = 1, updatedAt = ? WHERE sessionId = ?', [Date.now(), sessionId]);
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE records SET deleted = 1, updatedAt = ? WHERE id = ?', [Date.now(), id]);
}

/** 한 선수의 종목별 기록(날짜순) — 기록지 화면(T-104). */
export async function listRecords(swimmerId: string, target?: Target): Promise<TrainingRecord[]> {
  const db = await getDb();
  const rows = target
    ? await db.getAllAsync<RecordRow>(
        `SELECT * FROM records WHERE deleted = 0 AND swimmerId = ?
           AND stroke = ? AND distance = ? AND course = ? ORDER BY date`,
        [swimmerId, target.stroke, target.distance, target.course],
      )
    : await db.getAllAsync<RecordRow>(
        'SELECT * FROM records WHERE deleted = 0 AND swimmerId = ? ORDER BY date',
        [swimmerId],
      );
  return rows.map(rowToRecord);
}

/** 현재 종목의 전 선수 best/last/typical — ASSIGN 추천 입력 (§3.6). */
export async function statsForEvent(swimmerIds: string[], target: Target): Promise<CandidateStats[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Pick<RecordRow, 'swimmerId' | 'totalMs' | 'date'>>(
    `SELECT swimmerId, totalMs, date FROM records
      WHERE deleted = 0 AND status = 'finished'
        AND stroke = ? AND distance = ? AND course = ?`,
    [target.stroke, target.distance, target.course],
  );
  return computeStats(swimmerIds, rows);
}
