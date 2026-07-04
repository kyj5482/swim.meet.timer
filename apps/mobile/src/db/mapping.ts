import type { CandidateStats, Split, Target } from '@splitlane/timer-core';

/** common/data-model.md의 Swimmer/TrainingRecord — 로컬 표현. */
export interface Swimmer {
  id: string;
  name: string;
  group?: string;
  birthYear?: number;
  gender?: 'F' | 'M';
  /** USA Swimming 회원 ID(SWIMS) — 공인 기록 열람 링크용(myswimio). */
  usaId?: string;
  createdAt: number;
  archived: boolean;
}

/** 만 나이(연도 기준 근사 — currentDate 2026). birthYear 없으면 null. */
export function ageOf(s: Pick<Swimmer, 'birthYear'>, baseYear = 2026): number | null {
  return s.birthYear ? baseYear - s.birthYear : null;
}

export interface TrainingRecord {
  id: string;
  swimmerId: string;
  sessionId: string;
  date: number;
  target: Target;
  splits: Split[];
  totalMs: number;
  status: 'finished' | 'dnf';
  slot: number;
}

export interface SwimmerRow {
  id: string; name: string; grp: string | null; birthYear: number | null;
  gender: string | null; usaId: string | null; createdAt: number; updatedAt: number; archived: number;
}

export interface RecordRow {
  id: string; swimmerId: string; sessionId: string; date: number;
  stroke: string; distance: number; course: string; splitInterval: number;
  totalMs: number; status: string; slot: number; splitsJson: string;
  updatedAt: number; deleted: number;
}

export function rowToSwimmer(r: SwimmerRow): Swimmer {
  return {
    id: r.id, name: r.name, group: r.grp ?? undefined,
    birthYear: r.birthYear ?? undefined,
    gender: (r.gender === 'F' || r.gender === 'M') ? r.gender : undefined,
    usaId: r.usaId ?? undefined,
    createdAt: r.createdAt, archived: r.archived === 1,
  };
}

export function rowToRecord(r: RecordRow): TrainingRecord {
  return {
    id: r.id, swimmerId: r.swimmerId, sessionId: r.sessionId, date: r.date,
    target: {
      stroke: r.stroke as Target['stroke'], distance: r.distance,
      course: r.course as Target['course'], splitInterval: r.splitInterval,
    },
    splits: JSON.parse(r.splitsJson) as Split[],
    totalMs: r.totalMs, status: r.status as 'finished' | 'dnf', slot: r.slot,
  };
}

/**
 * 종목별 best/last/typical 집계 (§3.6 추천 입력).
 * records는 같은 종목(stroke·distance·course)의 finished 기록만 넘긴다.
 * 이력 없는 선수도 후보에 포함(typical = MAX → 남는 슬롯에 배정 가능).
 */
export function computeStats(
  swimmerIds: string[],
  records: Pick<TrainingRecord, 'swimmerId' | 'totalMs' | 'date'>[],
): CandidateStats[] {
  return swimmerIds.map((swimmerId) => {
    const mine = records.filter((r) => r.swimmerId === swimmerId).sort((a, b) => a.date - b.date);
    if (mine.length === 0) {
      return { swimmerId, typicalMs: Number.MAX_SAFE_INTEGER, bestMs: null, lastMs: null };
    }
    const bestMs = Math.min(...mine.map((r) => r.totalMs));
    const lastMs = mine[mine.length - 1]!.totalMs;
    return { swimmerId, typicalMs: lastMs, bestMs, lastMs };
  });
}
