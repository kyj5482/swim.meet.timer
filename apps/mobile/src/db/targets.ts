import { getDb } from './database';

export interface Target {
  swimmerId: string;
  eventKey: string;     // records eventKeyOf 형식: `${distance}|${stroke}|${course}`
  targetMs: number;
  targetDate: number | null;
  label: string;        // 'AA' | 'NOVA Silver' | 'Custom' 등 표시용
}

interface TargetRow {
  swimmerId: string; eventKey: string; targetMs: number;
  targetDate: number | null; label: string; updatedAt: number;
}

export async function getTarget(swimmerId: string, eventKey: string): Promise<Target | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<TargetRow>(
    'SELECT * FROM targets WHERE swimmerId = ? AND eventKey = ?', [swimmerId, eventKey],
  );
  return r ? { swimmerId: r.swimmerId, eventKey: r.eventKey, targetMs: r.targetMs, targetDate: r.targetDate, label: r.label } : null;
}

/** 한 선수의 모든 타겟(전체 종목 화면 — 종목별 목표 진행률 표시용). */
export async function listTargets(swimmerId: string): Promise<Target[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TargetRow>('SELECT * FROM targets WHERE swimmerId = ?', [swimmerId]);
  return rows.map((r) => ({
    swimmerId: r.swimmerId, eventKey: r.eventKey, targetMs: r.targetMs,
    targetDate: r.targetDate, label: r.label,
  }));
}

export async function setTarget(t: Target): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO targets (swimmerId, eventKey, targetMs, targetDate, label, updatedAt)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(swimmerId, eventKey) DO UPDATE SET
       targetMs = excluded.targetMs, targetDate = excluded.targetDate,
       label = excluded.label, updatedAt = excluded.updatedAt`,
    [t.swimmerId, t.eventKey, t.targetMs, t.targetDate, t.label, Date.now()],
  );
}

export async function clearTarget(swimmerId: string, eventKey: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM targets WHERE swimmerId = ? AND eventKey = ?', [swimmerId, eventKey]);
}
