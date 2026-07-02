import type { SlotState } from './types';

/** 두 슬롯 총기록이 이 이내면 시간만으로 구분 불가 → 저신뢰 (§3.5a) */
export const CLOSE_MS = 400;

export interface CandidateStats {
  swimmerId: string;
  /** 같은 종목·거리·코스 최근 기록 기준 typical(ms). 이력 없으면 Infinity. */
  typicalMs: number;
  bestMs: number | null;
  lastMs: number | null;
}

/**
 * 측정 후 슬롯→선수 추천 (§3.6). 전역 최소비용 그리디 매칭:
 * 모든 (슬롯, 선수) 쌍을 |총기록-typical| 오름차순으로 중복 없이 배정.
 */
export function recommend(slots: SlotState[], candidates: CandidateStats[]): void {
  const pairs: { s: SlotState; c: CandidateStats; d: number }[] = [];
  for (const s of slots)
    for (const c of candidates) pairs.push({ s, c, d: Math.abs(s.lastCumMs - c.typicalMs) });
  pairs.sort((a, b) => a.d - b.d);
  const usedSlot = new Set<number>();
  const usedSwimmer = new Set<string>();
  for (const p of pairs) {
    if (usedSlot.has(p.s.idx) || usedSwimmer.has(p.c.swimmerId)) continue;
    p.s.swimmerId = p.c.swimmerId;
    usedSlot.add(p.s.idx);
    usedSwimmer.add(p.c.swimmerId);
  }
  markLowConfidence(slots);
}

/** 다른 슬롯과 CLOSE_MS 이내면 lowConfidence 표시. */
export function markLowConfidence(slots: SlotState[], closeMs = CLOSE_MS): void {
  for (const s of slots)
    s.lowConfidence = slots.some((o) => o !== s && Math.abs(o.lastCumMs - s.lastCumMs) < closeMs);
}

/** 가장 기록이 가까운 다른 슬롯(맞바꾸기 대상)과 그 격차. */
export function nearestSibling(slots: SlotState[], slot: SlotState): { sibling: SlotState; gapMs: number } | null {
  let best: SlotState | null = null;
  let bd = Infinity;
  for (const o of slots) {
    if (o === slot) continue;
    const d = Math.abs(o.lastCumMs - slot.lastCumMs);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { sibling: best, gapMs: bd } : null;
}

/** 원탭 맞바꾸기: 두 슬롯의 swimmerId 교환. */
export function swapSwimmers(a: SlotState, b: SlotState): void {
  const t = a.swimmerId;
  a.swimmerId = b.swimmerId;
  b.swimmerId = t;
}

export interface Improvement {
  kind: 'first' | 'improved' | 'regressed' | 'same';
  deltaMs: number;      // 오늘 - 이전 (음수 = 향상)
  isPB: boolean;
}

/** 이전 대비 향상·PB 판정 (§3.6-2). */
export function improvement(totalMs: number, stats: Pick<CandidateStats, 'bestMs' | 'lastMs'>): Improvement {
  if (stats.lastMs == null || stats.bestMs == null)
    return { kind: 'first', deltaMs: 0, isPB: true };
  const deltaMs = totalMs - stats.lastMs;
  return {
    kind: deltaMs < 0 ? 'improved' : deltaMs > 0 ? 'regressed' : 'same',
    deltaMs,
    isPB: totalMs < stats.bestMs - 1, // 1ms 여유(부동소수 방지)
  };
}
