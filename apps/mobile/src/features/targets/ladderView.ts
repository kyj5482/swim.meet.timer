import { ladderPosition, type LadderStep } from '@splitlane/timer-core';

/**
 * 타겟 카드에 보여줄 **3칸 창** — 전체 사다리(B…NCAA D1 A) 대신 지금 의미 있는
 * 세 레벨만: 이미 달성한 레벨 · 현재 타겟 · 다음 타겟. 전체는 "더보기" 팝업으로.
 * 아직 아무것도 달성하지 못했으면 가장 낮은 3단계(B·BB·A)를 보여준다.
 *
 * step에 role을 달아 UI가 강조를 다르게 준다:
 * - 'reached'  현재 best가 통과한 가장 빠른 레벨
 * - 'target'   현재 타겟 레벨
 * - 'next'     타겟 바로 위(더 빠른) 레벨
 * - 'base'     아무것도 달성 못했을 때의 하위 시드(B/BB/A)
 */
export type RungRole = 'reached' | 'target' | 'next' | 'base';
export interface Rung extends LadderStep { role: RungRole; }

/** best 대비 다음 레벨(자동 타겟) — 없으면(최고 레벨) 가장 빠른 레벨. */
export function autoTargetStep(ladder: LadderStep[], bestMs: number): LadderStep | null {
  if (ladder.length === 0) return null;
  const lp = ladderPosition(bestMs, ladder);
  if (lp.next) return lp.next;
  // 최고 레벨까지 달성 — 타겟은 가장 빠른 레벨(유지 목표)
  return [...ladder].sort((a, b) => a.timeMs - b.timeMs)[0]!;
}

/**
 * 3칸 창을 slow→fast(B가 위) 순으로 반환. targetMs는 현재 타겟의 컷타임.
 */
export function ladderWindow(ladder: LadderStep[], bestMs: number, targetMs: number): Rung[] {
  if (ladder.length === 0) return [];
  const fast = [...ladder].sort((a, b) => a.timeMs - b.timeMs); // idx0 = 가장 빠름
  const reachedIdx = fast.findIndex((s) => bestMs <= s.timeMs);  // 가장 빠른 달성 레벨

  // 아무것도 달성 못함 → 하위 3단계(가장 느린 3개 = B·BB·A), slow→fast 순
  if (reachedIdx === -1) {
    return fast.slice(-3)
      .map((s) => ({ ...s, role: 'base' as RungRole }))
      .sort((a, b) => b.timeMs - a.timeMs);
  }

  const targetIdx = fast.findIndex((s) => s.timeMs === targetMs);
  const idxs = new Set<number>();
  idxs.add(reachedIdx);
  if (targetIdx !== -1) { idxs.add(targetIdx); idxs.add(targetIdx - 1); } // 타겟 + 다음(더 빠른)
  else idxs.add(reachedIdx - 1); // 타겟 정보 없으면 reached 바로 위

  const picked = [...idxs].filter((i) => i >= 0 && i < fast.length).sort((a, b) => a - b);
  return picked.map((i) => {
    const s = fast[i]!;
    const role: RungRole = bestMs <= s.timeMs ? 'reached' : s.timeMs === targetMs ? 'target' : 'next';
    return { ...s, role };
  }).sort((a, b) => b.timeMs - a.timeMs); // slow→fast (B 위)
}
