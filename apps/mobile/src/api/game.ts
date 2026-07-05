/** common/api-spec.md §game — 이스터 에그 게임 리더보드 클라이언트. */
import { apiGet, apiPut, type ApiConfig } from './client';

export interface GameScoreSubmit {
  scoreId: string;
  stroke: string;
  distance: number;
  courseUnit: 'y' | 'm';
  timeMs: number;
  character: string | null;
}

export type GameBadge = 'AAAA' | 'AAA' | 'AA' | 'A' | 'BB' | 'B';

export interface GameLeaderboardItem {
  rank: number;
  displayName: string;
  character?: string;
  timeMs: number;
  badge: GameBadge;
}

export interface GameLeaderboard {
  items: GameLeaderboardItem[];
  me?: { rank: number; total: number; percentile: number; badge: GameBadge; timeMs: number };
}

export function submitGameScore(cfg: ApiConfig, body: GameScoreSubmit): Promise<{ ok: boolean; bestMs: number }> {
  return apiPut(cfg, '/game/scores', body);
}

export function getGameLeaderboard(
  cfg: ApiConfig,
  q: { stroke: string; distance: number; courseUnit: string },
): Promise<GameLeaderboard> {
  const params = `stroke=${encodeURIComponent(q.stroke)}&distance=${q.distance}&courseUnit=${encodeURIComponent(q.courseUnit)}`;
  return apiGet(cfg, `/game/leaderboard?${params}`);
}
