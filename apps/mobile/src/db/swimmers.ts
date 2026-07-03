import { getDb } from './database';
import { newId } from './ids';
import { rowToSwimmer, type Swimmer, type SwimmerRow } from './mapping';

export async function listSwimmers(): Promise<Swimmer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SwimmerRow>(
    'SELECT * FROM swimmers WHERE archived = 0 ORDER BY name',
  );
  return rows.map(rowToSwimmer);
}

export async function addSwimmer(name: string, group?: string, birthYear?: number, gender?: 'F' | 'M'): Promise<Swimmer> {
  const db = await getDb();
  const now = Date.now();
  const id = newId(now);
  await db.runAsync(
    'INSERT INTO swimmers (id, name, grp, birthYear, gender, createdAt, updatedAt, archived) VALUES (?,?,?,?,?,?,?,0)',
    [id, name.trim(), group ?? null, birthYear ?? null, gender ?? null, now, now],
  );
  return { id, name: name.trim(), group, birthYear, gender, createdAt: now, archived: false };
}

export async function updateSwimmer(
  id: string,
  fields: { name?: string; group?: string | null; birthYear?: number | null; gender?: 'F' | 'M' | null },
): Promise<void> {
  const db = await getDb();
  const cur = await db.getFirstAsync<SwimmerRow>('SELECT * FROM swimmers WHERE id = ?', [id]);
  if (!cur) return;
  await db.runAsync(
    'UPDATE swimmers SET name = ?, grp = ?, birthYear = ?, gender = ?, updatedAt = ? WHERE id = ?',
    [
      fields.name ?? cur.name,
      fields.group === undefined ? cur.grp : fields.group,
      fields.birthYear === undefined ? cur.birthYear : fields.birthYear,
      fields.gender === undefined ? cur.gender : fields.gender,
      Date.now(), id,
    ],
  );
}

/** 삭제는 아카이브(기록 보존, 동기화 tombstone 대비). */
export async function archiveSwimmer(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE swimmers SET archived = 1, updatedAt = ? WHERE id = ?', [Date.now(), id]);
}
