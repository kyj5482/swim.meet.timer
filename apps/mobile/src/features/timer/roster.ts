import type { CandidateStats, SlotState, Target } from '@splitlane/timer-core';

/**
 * T-103(expo-sqlite) 전까지 쓰는 인메모리 저장소.
 * 인터페이스는 common/data-model.md의 Swimmer/TrainingRecord를 따른다 —
 * T-103에서 구현만 sqlite로 교체한다.
 */
export interface Swimmer {
  id: string;
  name: string;
  group?: string;
}

export interface SavedRecord {
  id: string;
  swimmerId: string;
  date: number;
  target: Target;
  totalMs: number;
  splits: { segmentIndex: number; cumulativeMs: number; splitMs: number }[];
  status: 'finished' | 'dnf';
  slot: number;
}

const swimmers: Swimmer[] = [
  { id: 'sw1', name: 'Minjun' },
  { id: 'sw2', name: 'Seoyeon' },
  { id: 'sw3', name: 'Jiho' },
  { id: 'sw4', name: 'Haeun' },
];
const records: SavedRecord[] = [];

export function listSwimmers(): Swimmer[] {
  return swimmers;
}

export function addSwimmer(name: string): Swimmer {
  const s = { id: `sw${Date.now()}`, name };
  swimmers.push(s);
  return s;
}

function eventKey(t: Target): string {
  return `${t.distance}${t.stroke}${t.course}`;
}

/** 같은 종목·거리·코스 기준 best/last/typical (§3.6 추천 입력). */
export function swimmerStats(swimmerId: string, target: Target): CandidateStats {
  const evs = records
    .filter((r) => r.swimmerId === swimmerId && r.status === 'finished' && eventKey(r.target) === eventKey(target))
    .sort((a, b) => a.date - b.date);
  if (evs.length === 0) return { swimmerId, typicalMs: Number.MAX_SAFE_INTEGER, bestMs: null, lastMs: null };
  const bestMs = Math.min(...evs.map((r) => r.totalMs));
  const lastMs = evs[evs.length - 1]!.totalMs;
  return { swimmerId, typicalMs: lastMs, bestMs, lastMs };
}

/** ASSIGN 확정: 슬롯별 TrainingRecord 생성(전부 또는 전무). */
export function saveSession(slots: readonly SlotState[], target: Target): number {
  const now = Date.now();
  const toSave = slots
    .filter((s) => s.swimmerId && s.splits.length > 0)
    .map((s, i) => ({
      id: `rec${now}-${i}`,
      swimmerId: s.swimmerId!,
      date: now,
      target,
      totalMs: s.lastCumMs,
      splits: s.splits,
      status: (s.status === 'dnf' ? 'dnf' : 'finished') as 'finished' | 'dnf',
      slot: s.idx + 1,
    }));
  records.push(...toSave);
  return toSave.length;
}

export function listRecords(): SavedRecord[] {
  return records;
}
