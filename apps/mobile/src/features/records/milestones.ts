import type { LadderStep } from '@splitlane/timer-core';

/**
 * 세션 목록에서 표준 레벨이 **처음으로 올라간** 세션을 찾는다.
 * 최초 기록이 B면 그 세션에 B 배지, 이후 BB 컷을 처음 깬 세션에 BB 배지 —
 * 그 사이 세션에는 배지가 없다(세션 행 우측 시간 아래 두 번째 줄로 표시).
 */
export interface MilestoneSession {
  id: string;
  date: number;
  totalMs: number;
}

/** sessionId → 그 세션에서 새로 달성한 레벨 코드. */
export function levelMilestones(
  sessions: MilestoneSession[], ladder: LadderStep[] | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!ladder || ladder.length === 0 || sessions.length === 0) return out;

  // 빠른 컷(작은 ms) 먼저 — 인덱스가 작을수록 높은 레벨
  const cuts = [...ladder].sort((a, b) => a.timeMs - b.timeMs);
  const rankOf = (totalMs: number): number => {
    const idx = cuts.findIndex((c) => totalMs <= c.timeMs);
    return idx === -1 ? Infinity : idx; // Infinity = 어떤 컷도 못 미침
  };

  let bestRank = Infinity;
  for (const s of [...sessions].sort((a, b) => a.date - b.date)) {
    const r = rankOf(s.totalMs);
    if (r < bestRank) {
      bestRank = r;
      out.set(s.id, cuts[r]!.level);
    }
  }
  return out;
}
