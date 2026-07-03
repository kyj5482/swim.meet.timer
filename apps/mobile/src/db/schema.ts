/**
 * 스키마 마이그레이션. 배열 인덱스+1 = PRAGMA user_version.
 * 규칙: 배포된 마이그레이션은 절대 수정하지 않는다 — 항상 새 항목을 추가.
 * 모델 정의는 common/data-model.md와 docs/04-data-model.md를 따른다.
 */
export const MIGRATIONS: string[] = [
  // v1: 선수 · 훈련 기록 · 환경설정
  `
  CREATE TABLE IF NOT EXISTS swimmers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grp TEXT,
    birthYear INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    swimmerId TEXT NOT NULL,
    sessionId TEXT NOT NULL,
    date INTEGER NOT NULL,
    stroke TEXT NOT NULL,
    distance INTEGER NOT NULL,
    course TEXT NOT NULL,
    splitInterval INTEGER NOT NULL,
    totalMs INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('finished','dnf')),
    slot INTEGER NOT NULL,
    splitsJson TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_records_swimmer_event
    ON records (swimmerId, stroke, distance, course, date);
  CREATE INDEX IF NOT EXISTS idx_records_session ON records (sessionId);
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v2: 데모 시드 여부 표시 컬럼 (시드 데이터는 사용자가 언제든 비울 수 있게 구분)
  `
  ALTER TABLE swimmers ADD COLUMN seed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE records ADD COLUMN seed INTEGER NOT NULL DEFAULT 0;
  `,
];
