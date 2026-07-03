import type { CandidateStats, SlotState, Target } from '@splitlane/timer-core';

import { getDb } from './database';
import { newId } from './ids';
import { computeStats, rowToRecord, type RecordRow, type TrainingRecord } from './mapping';

/** 탭 이벤트 타임스탬프는 소수(ms)일 수 있어 저장·동기화 전 정수로 반올림. */
function roundSplit<T extends { cumulativeMs: number; splitMs: number }>(sp: T): T {
  return { ...sp, cumulativeMs: Math.round(sp.cumulativeMs), splitMs: Math.round(sp.splitMs) };
}

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
          Math.round(s.lastCumMs), s.status === 'dnf' ? 'dnf' : 'finished', s.idx + 1,
          JSON.stringify(s.splits.map(roundSplit)), now,
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

/** 서버 동기화 페이로드(services/records/src/model.ts recordSchema와 동일 shape). */
export interface SyncPayload {
  id: string; swimmerId: string; sessionId: string; date: number;
  stroke: string; distance: number; course: string; splitInterval: number;
  totalMs: number; status: 'finished' | 'dnf'; slot: number;
  splits: { segmentIndex: number; cumulativeMs: number; splitMs: number }[];
  updatedAt: number; deleted: boolean;
}

/** 한 선수의 전체 기록(삭제 포함, tombstone 전파용) — 서버로 푸시할 페이로드. */
export async function recordsForPush(swimmerId: string): Promise<SyncPayload[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecordRow>('SELECT * FROM records WHERE swimmerId = ?', [swimmerId]);
  return rows.map((r) => ({
    id: r.id, swimmerId: r.swimmerId, sessionId: r.sessionId, date: r.date,
    stroke: r.stroke, distance: r.distance, course: r.course, splitInterval: r.splitInterval,
    totalMs: Math.round(r.totalMs), status: r.status as 'finished' | 'dnf', slot: r.slot,
    splits: (JSON.parse(r.splitsJson) as SyncPayload['splits']).map(roundSplit),
    updatedAt: r.updatedAt, deleted: r.deleted === 1,
  }));
}

/**
 * 서버에서 받은 기록을 로컬에 반영(last-write-wins by updatedAt).
 * 서버가 더 최신이거나 로컬에 없으면 덮어쓴다. 반영된 개수 반환.
 */
export async function applyPulledRecords(records: SyncPayload[]): Promise<number> {
  if (records.length === 0) return 0;
  const db = await getDb();
  let applied = 0;
  await db.withTransactionAsync(async () => {
    for (const r of records) {
      const local = await db.getFirstAsync<{ updatedAt: number }>('SELECT updatedAt FROM records WHERE id = ?', [r.id]);
      if (local && local.updatedAt >= r.updatedAt) continue; // 로컬이 더 최신
      await db.runAsync(
        `INSERT INTO records
           (id, swimmerId, sessionId, date, stroke, distance, course, splitInterval,
            totalMs, status, slot, splitsJson, updatedAt, deleted, seed)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET
           swimmerId=excluded.swimmerId, sessionId=excluded.sessionId, date=excluded.date,
           stroke=excluded.stroke, distance=excluded.distance, course=excluded.course,
           splitInterval=excluded.splitInterval, totalMs=excluded.totalMs, status=excluded.status,
           slot=excluded.slot, splitsJson=excluded.splitsJson, updatedAt=excluded.updatedAt,
           deleted=excluded.deleted`,
        [
          r.id, r.swimmerId, r.sessionId, r.date, r.stroke, r.distance, r.course, r.splitInterval,
          r.totalMs, r.status, r.slot, JSON.stringify(r.splits), r.updatedAt, r.deleted ? 1 : 0,
        ],
      );
      applied++;
    }
  });
  return applied;
}
