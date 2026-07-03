import { applyPulledRecords, listSwimmers, recordsForPush, type SyncPayload } from '@/db';
import { apiGet, apiPut, type ApiConfig } from './client';

export interface SyncResult {
  swimmers: number;
  pushed: number;
  pulled: number;
}

/**
 * 전 선수 기록을 서버와 동기화: 로컬 전체 푸시(멱등 업서트) → since 이후
 * 서버 변경분 풀(last-write-wins). common/api-spec.md §records.
 */
export async function syncAll(cfg: ApiConfig, since: number): Promise<SyncResult> {
  const swimmers = await listSwimmers();
  let pushed = 0;
  let pulled = 0;

  for (const sw of swimmers) {
    const toPush = await recordsForPush(sw.id);
    if (toPush.length > 0) {
      await apiPut<{ upserted: number }>(cfg, '/records/batch', { records: toPush });
      pushed += toPush.length;
    }
    const res = await apiGet<{ records: SyncPayload[] }>(
      cfg, `/records?swimmerId=${encodeURIComponent(sw.id)}&since=${since}`,
    );
    pulled += await applyPulledRecords(res.records);
  }

  return { swimmers: swimmers.length, pushed, pulled };
}
