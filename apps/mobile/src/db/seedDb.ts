import { getDb } from './database';
import { buildSeedRecords, birthYearFromAge, SEED_SWIMMERS } from './seed';

const SEEDED_FLAG = 'demoSeeded.v1';

/**
 * 첫 실행에 데모 선수·기록을 채운다(멱등 — 플래그로 1회만).
 * 사용자가 clearSeed()로 지운 뒤에는 다시 넣지 않는다.
 */
export async function seedIfFirstRun(): Promise<void> {
  const db = await getDb();
  const flag = await db.getFirstAsync<{ value: string }>('SELECT value FROM prefs WHERE key = ?', [SEEDED_FLAG]);
  if (flag) return; // 이미 시드했거나 사용자가 비운 상태

  const now = Date.now();
  const records = buildSeedRecords();
  await db.withTransactionAsync(async () => {
    for (const sw of SEED_SWIMMERS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO swimmers (id, name, grp, birthYear, gender, createdAt, updatedAt, archived, seed)
         VALUES (?,?,?,?,?,?,?,0,1)`,
        [sw.id, sw.name, sw.group, birthYearFromAge(sw.age), sw.gender, now, now],
      );
    }
    for (const r of records) {
      await db.runAsync(
        `INSERT OR IGNORE INTO records
           (id, swimmerId, sessionId, date, stroke, distance, course, splitInterval,
            totalMs, status, slot, splitsJson, updatedAt, deleted, seed)
         VALUES (?,?,?,?,?,?,?,?,?,'finished',1,?,?,0,1)`,
        [
          r.id, r.swimmerId, r.sessionId, r.date, r.stroke, r.distance, r.course,
          r.splitInterval, r.totalMs, JSON.stringify(r.splits), now,
        ],
      );
    }
    await db.runAsync('INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)', [SEEDED_FLAG, '"done"']);
  });
}

/** 데모 데이터 전체 삭제(설정에서 호출). 사용자 데이터는 건드리지 않는다. */
export async function clearSeed(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM records WHERE seed = 1');
    await db.runAsync('DELETE FROM swimmers WHERE seed = 1');
    // 플래그는 남겨 두어 재시드 방지
    await db.runAsync('INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)', [SEEDED_FLAG, '"cleared"']);
  });
}

/** 데모 데이터가 아직 남아 있는지(설정 화면에서 "데모 지우기" 노출 여부용). */
export async function hasSeedData(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM swimmers WHERE seed = 1');
  return (row?.n ?? 0) > 0;
}
