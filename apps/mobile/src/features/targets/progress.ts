import { ladderPosition, type LadderStep } from '@splitlane/timer-core';

/**
 * 전체 종목 화면(종목별 진행 요약)용: 현재 베스트가 표준 사다리에서 어디에
 * 있고, 다음 레벨까지 몇 % 단축이 필요한지(myswimio의 "% drop needed").
 */
export interface EventProgress {
  /** 통과한 최고 레벨(하나도 못 넘었으면 null). */
  reached: LadderStep | null;
  /** 다음 목표 레벨(최고 레벨 달성 시 null). */
  next: LadderStep | null;
  /** 다음 레벨까지 남은 시간(ms). */
  toNextMs: number | null;
  /** 다음 레벨까지 필요한 단축률 %(베스트 대비, 소수 1자리). */
  dropPct: number | null;
}

export function eventProgress(bestMs: number, ladder: LadderStep[]): EventProgress {
  const lp = ladderPosition(bestMs, ladder);
  const dropPct = lp.next != null && lp.toNextMs != null
    ? Math.round((1000 * lp.toNextMs) / bestMs) / 10
    : null;
  return { reached: lp.reached, next: lp.next, toNextMs: lp.toNextMs, dropPct };
}
