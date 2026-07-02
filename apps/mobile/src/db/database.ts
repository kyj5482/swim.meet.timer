import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './schema';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** 앱 전역 단일 DB 핸들. 첫 호출에서 열고 마이그레이션 적용(PRAGMA user_version). */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('splitlane.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const from = row?.user_version ?? 0;
      for (let v = from; v < MIGRATIONS.length; v++) {
        await db.execAsync(MIGRATIONS[v]!);
      }
      if (from < MIGRATIONS.length) {
        await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
      }
      return db;
    })();
  }
  return dbPromise;
}
