import type { LadderStep } from '@splitlane/timer-core';

/**
 * 추세 차트 수학(순수 함수, TrendChart에서 사용).
 * Y 도메인은 선수 기록이 아니라 **표준기록 컷타임에 맞춰** 잡는다:
 * 아래(빠른 쪽) 경계 = 베스트보다 한 단계 빠른 컷(다음 목표 레벨),
 * 위(느린 쪽) 경계 = 최악 기록보다 한 단계 느린 컷. 컷이 없으면 데이터 ±여백.
 */
export interface TrendDomain {
  /** 빠른 쪽(작은 ms) 경계 */
  lo: number;
  /** 느린 쪽(큰 ms) 경계 */
  hi: number;
  /** 도메인 안에 들어와 그려야 하는 컷 라인들(빠른 순) */
  cuts: LadderStep[];
}

/** 컷으로 확장을 허용하는 최대 거리 — 데이터 폭의 1.5배(최소 3초). 초보 선수가
 * B 컷에서 아주 멀 때 차트가 짜부라지는 것을 방지. */
function allowance(yMin: number, yMax: number): number {
  return Math.max(3000, (yMax - yMin) * 1.5);
}

export function trendDomain(tots: number[], ladder?: LadderStep[] | null): TrendDomain {
  const yMin = Math.min(...tots);
  const yMax = Math.max(...tots);

  if (!ladder || ladder.length === 0) {
    const m = (yMax - yMin) * 0.1 || 300;
    return { lo: yMin - m, hi: yMax + m, cuts: [] };
  }

  const sorted = [...ladder].sort((a, b) => a.timeMs - b.timeMs);
  const allow = allowance(yMin, yMax);

  // 다음 목표(베스트보다 빠른 컷 중 가장 느린 것) — 너무 멀면 포기
  const faster = sorted.filter((s) => s.timeMs < yMin);
  const nextCut = faster.length > 0 ? faster[faster.length - 1]! : null;
  const lo0 = nextCut && yMin - nextCut.timeMs <= allow ? nextCut.timeMs : yMin;

  // 위 경계(최악 기록보다 느린 컷 중 가장 빠른 것) — 너무 멀면 포기
  const slower = sorted.filter((s) => s.timeMs > yMax);
  const upCut = slower.length > 0 ? slower[0]! : null;
  const hi0 = upCut && upCut.timeMs - yMax <= allow ? upCut.timeMs : yMax;

  const pad = Math.max(300, (hi0 - lo0) * 0.06);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  return { lo, hi, cuts: sorted.filter((s) => s.timeMs >= lo && s.timeMs <= hi) };
}

/**
 * X 좌표: 날짜 기반 시간축 + 좌우 패딩(기본 8%) — 시작/끝 점이 축 가장자리에
 * 붙지 않아 점 아래 시간 라벨이 잘리지 않는다. 반환은 0..1 정규화 위치.
 */
export function xScale(dates: number[], padFrac = 0.08): (d: number) => number {
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const span = max - min;
  if (span === 0) return () => 0.5;
  const x0 = min - span * padFrac;
  const x1 = max + span * padFrac;
  return (d) => (d - x0) / (x1 - x0);
}

/**
 * 점 아래 값 라벨을 붙일 인덱스. 점이 적으면(≤6) 전부, 많으면
 * 처음·베스트·마지막만(라벨 과밀 방지).
 */
export function labelIndices(n: number, bestIdx: number): Set<number> {
  if (n <= 6) return new Set(Array.from({ length: n }, (_, i) => i));
  return new Set([0, bestIdx, n - 1]);
}
