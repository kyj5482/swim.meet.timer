/**
 * 타겟 진행률 엔진 (제품 핵심 — myswimio 차별점 + AI 코치의 결정적 기반).
 * 수영은 시간이 낮을수록 좋다. 모든 함수는 순수·결정적으로 테스트된다.
 * LLM은 여기 수치를 계산하지 않는다(환각 방지) — 문장 생성에만 쓴다.
 */

/** 표준기록 레벨 사다리의 한 칸. ms는 그 레벨의 컷타임(이보다 빠르면 달성). */
export interface LadderStep {
  level: string;   // 'B' | 'BB' | 'A' | ... | 'AAAA' | 커스텀
  timeMs: number;
}

export interface Achievement {
  /** 달성률 % = 100 * target / best. 100 이상이면 타겟 도달. 소수1자리. */
  percent: number;
  /** 타겟까지 남은 시간(ms). 음수/0이면 이미 달성. */
  remainingMs: number;
  reached: boolean;
}

/** 현재 베스트 대비 타겟 달성률. best/target 모두 ms. */
export function achievement(bestMs: number, targetMs: number): Achievement {
  const percent = Math.round((1000 * targetMs) / bestMs) / 10;
  const remainingMs = bestMs - targetMs;
  return { percent, remainingMs, reached: remainingMs <= 0 };
}

export interface LadderPosition {
  /** 현재 베스트가 통과한 최고 레벨(없으면 null). */
  reached: LadderStep | null;
  /** 다음으로 노려볼 레벨(최고 레벨 달성 시 null). */
  next: LadderStep | null;
  /** 다음 레벨까지 남은 시간(ms, next 없으면 null). */
  toNextMs: number | null;
}

/**
 * 사다리에서 현재 위치. steps는 느린→빠른(컷타임 내림차순) 어떤 순서든 허용 —
 * 내부에서 정렬한다. best가 어떤 레벨의 컷보다 빠르면 그 레벨 달성.
 */
export function ladderPosition(bestMs: number, steps: LadderStep[]): LadderPosition {
  // 빠른 순(작은 ms 먼저)으로 정렬
  const sorted = [...steps].sort((a, b) => a.timeMs - b.timeMs);
  let reached: LadderStep | null = null;
  let next: LadderStep | null = null;
  // 가장 빠른 것부터 보며 best가 통과한(<=) 가장 빠른 레벨을 reached로
  for (const s of sorted) {
    if (bestMs <= s.timeMs) { reached = s; break; }
  }
  // next = reached보다 한 칸 더 빠른 레벨 (아직 못 미친 것 중 가장 느린 것)
  const notYet = sorted.filter((s) => bestMs > s.timeMs);
  if (notYet.length) next = notYet[notYet.length - 1]!; // 가장 가까운(느린) 미달 레벨
  return { reached, next, toNextMs: next ? bestMs - next.timeMs : null };
}

export interface TrendPoint {
  /** epoch ms */
  date: number;
  totalMs: number;
}

/**
 * 개선 기울기(ms/일). 음수 = 빨라지는 중(개선). 단순 최소제곱 회귀.
 * 점이 2개 미만이면 null.
 */
export function improvementSlopePerDay(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const day = 86_400_000;
  const xs = points.map((p) => p.date / day);
  const ys = points.map((p) => p.totalMs);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export type Accel = 'improving' | 'steady' | 'slowing';

/**
 * 향상 가속도: 전반부 기울기 대비 후반부 기울기 변화.
 * 후반부가 더 가파르게 빨라지면 'improving', 둔화되면 'slowing'.
 */
export function acceleration(points: TrendPoint[]): Accel {
  if (points.length < 4) return 'steady';
  const sorted = [...points].sort((a, b) => a.date - b.date);
  const mid = Math.floor(sorted.length / 2);
  const early = improvementSlopePerDay(sorted.slice(0, mid + 1));
  const late = improvementSlopePerDay(sorted.slice(mid));
  if (early == null || late == null) return 'steady';
  // 기울기는 음수가 개선. late가 early보다 더 음수 = 가속.
  const delta = late - early;
  const eps = Math.abs(early) * 0.15 + 1; // 15% + 1ms/day 여유
  if (delta < -eps) return 'improving';
  if (delta > eps) return 'slowing';
  return 'steady';
}

/**
 * 현재 기울기로 타겟 도달 예상일(epoch ms). 이미 달성이면 fromDate.
 * 개선 중이 아니거나(기울기 ≥ 0) 데이터 부족이면 null(예측 불가).
 */
export function projectTargetDate(
  bestMs: number, targetMs: number, slopePerDay: number | null, fromDate: number,
): number | null {
  if (bestMs <= targetMs) return fromDate;
  if (slopePerDay == null || slopePerDay >= 0) return null; // 개선 없음 → 도달 불가
  const daysNeeded = (targetMs - bestMs) / slopePerDay; // 둘 다 음수 → 양수
  return fromDate + daysNeeded * 86_400_000;
}

/**
 * 종합 궤적 판정. targetDate가 있으면 예상 도달일과 비교해 on-track 여부.
 */
export interface Trajectory {
  achievement: Achievement;
  slopePerWeekMs: number | null;   // 주당 개선(ms). 음수 = 개선.
  accel: Accel;
  projectedDate: number | null;
  onTrack: boolean | null;         // targetDate 없으면 null
}

export function trajectory(
  bestMs: number, targetMs: number, points: TrendPoint[], targetDate: number | null, now: number,
): Trajectory {
  const slope = improvementSlopePerDay(points);
  const projectedDate = projectTargetDate(bestMs, targetMs, slope, now);
  let onTrack: boolean | null = null;
  if (targetDate != null) {
    if (bestMs <= targetMs) onTrack = true;
    else onTrack = projectedDate != null && projectedDate <= targetDate;
  }
  return {
    achievement: achievement(bestMs, targetMs),
    slopePerWeekMs: slope == null ? null : slope * 7,
    accel: acceleration(points),
    projectedDate,
    onTrack,
  };
}
