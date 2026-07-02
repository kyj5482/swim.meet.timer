export { getDb } from './database';
export { newId, idTime } from './ids';
export type { Swimmer, TrainingRecord } from './mapping';
export { listSwimmers, addSwimmer, updateSwimmer, archiveSwimmer } from './swimmers';
export { saveSession, deleteSession, deleteRecord, listRecords, statsForEvent } from './records';
export { getPref, setPref } from './prefs';
