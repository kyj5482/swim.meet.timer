import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGameLeaderboard, submitGameScore } from './game';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300, status,
    text: async () => JSON.stringify(body),
  } as Response);
}

const cfg = { baseUrl: 'http://x/v1', token: 'tok' };

describe('game leaderboard client (api-spec §game)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submitGameScore — PUT /game/scores + Bearer 토큰', async () => {
    const fetchMock = mockFetch(200, { ok: true, bestMs: 41230 });
    vi.stubGlobal('fetch', fetchMock);
    const res = await submitGameScore(cfg, {
      scoreId: 'g1', stroke: 'fly', distance: 50, courseUnit: 'y', timeMs: 41230, character: 'phelps',
    });
    expect(res.bestMs).toBe(41230);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/v1/game/scores',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      }),
    );
  });

  it('getGameLeaderboard — 쿼리 인코딩 + me/items 형태 그대로 반환', async () => {
    const board = {
      items: [{ rank: 1, displayName: 'Ace', timeMs: 40000, badge: 'AAAA' }],
      me: { rank: 2, total: 20, percentile: 10, badge: 'AA', timeMs: 41230 },
    };
    const fetchMock = mockFetch(200, board);
    vi.stubGlobal('fetch', fetchMock);
    const res = await getGameLeaderboard(cfg, { stroke: 'fly', distance: 50, courseUnit: 'y' });
    expect(res).toEqual(board);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/v1/game/leaderboard?stroke=fly&distance=50&courseUnit=y',
      expect.anything(),
    );
  });
});
