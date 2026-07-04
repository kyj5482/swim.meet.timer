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

/**
 * 로버스트 개선 기울기(ms/일) — Theil-Sen(쌍별 기울기의 중앙값).
 * 수영 훈련 기록은 그날 컨디션에 따라 1~2% 출렁이는 게 정상이라
 * 최소제곱(OLS)은 이상치 하나에 기울기가 크게 왜곡된다(스포츠 과학에서
 * 시즌 진행 분석에 중앙값 기반 추정을 쓰는 이유). 점이 2개 미만이면 null.
 */
export function robustSlopePerDay(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const day = 86_400_000;
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = (points[j]!.date - points[i]!.date) / day;
      if (dx === 0) continue;
      slopes.push((points[j]!.totalMs - points[i]!.totalMs) / dx);
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 ? slopes[mid]! : (slopes[mid - 1]! + slopes[mid]!) / 2;
}

export type PaceState = 'improving' | 'plateau' | 'regressing';

export interface PaceInsight {
  state: PaceState;
  /** 30일당 로버스트 변화량(ms). 음수 = 빨라지는 중. 판정 불가면 null. */
  perMonthMs: number | null;
  /**
   * 표시해도 되는 수치인지. 점이 적고 몰려 있으면 기울기가 수 분/주 같은
   * 비현실적 값이 되는데(예: '10:45.10/wk'), 그런 값은 숫자 없이 상태만 보여준다.
   */
  plausible: boolean;
}

/** 상태 판정 임계 — 베스트 대비 월 0.15% 이상 움직여야 유의미한 변화로 본다. */
const MEANINGFUL_FRAC_PER_MONTH = 0.0015;
/** 표시 가능 상한 — 월 10% 초과 단축 기울기는 실제 향상이 아니라 점이 몰려
 * 생긴 수치(데이터 부족)로 본다. 초보 급성장(월 ~5%)은 통과시킨다. */
const PLAUSIBLE_FRAC_PER_MONTH = 0.10;
/** 최근성 창 — 어린 선수 시즌 진행 분석 관행에 맞춰 최근 ~4개월만 본다. */
const WINDOW_DAYS = 120;

/**
 * 부모·선수용 페이스 요약. 장기 기록은 계단식(정체 → 돌파)이 정상이므로
 * 'steady pace' 같은 모호한 말 대신 세 상태로 판정한다:
 * - improving: 최근 창에서 베스트 대비 유의미하게 빨라지는 중
 * - plateau:   변화가 컨디션 노이즈 범위 — 돌파 전 정체는 정상
 * - regressing: 특정 종목을 안 쓰다 보면 PB 대비 지속적으로 밀리는 상태
 */
export function paceInsight(points: TrendPoint[], now?: number): PaceInsight {
  if (points.length < 2) return { state: 'plateau', perMonthMs: null, plausible: false };
  const sorted = [...points].sort((a, b) => a.date - b.date);
  const latest = now ?? sorted[sorted.length - 1]!.date;
  let recent = sorted.filter((p) => latest - p.date <= WINDOW_DAYS * 86_400_000);
  if (recent.length < 3) recent = sorted; // 창 안에 점이 적으면 전체 이력으로 판정
  const bestMs = Math.min(...sorted.map((p) => p.totalMs));

  const slope = robustSlopePerDay(recent);
  if (slope == null) return { state: 'plateau', perMonthMs: null, plausible: false };
  const perMonthMs = slope * 30;
  const meaningful = bestMs * MEANINGFUL_FRAC_PER_MONTH;
  const plausible = Math.abs(perMonthMs) <= bestMs * PLAUSIBLE_FRAC_PER_MONTH;

  let state: PaceState = 'plateau';
  if (perMonthMs <= -meaningful) state = 'improving';
  else if (perMonthMs >= meaningful) state = 'regressing';
  return { state, perMonthMs, plausible };
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
  // 로버스트 기울기 + 비현실적 기울기 차단: 점이 몰려 있을 때 OLS가 만드는
  // '주당 10분' 같은 예측을 사용자에게 보여주지 않는다(예측 불가로 처리).
  let slope = robustSlopePerDay(points);
  if (slope != null && Math.abs(slope * 30) > bestMs * PLAUSIBLE_FRAC_PER_MONTH) slope = null;
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
