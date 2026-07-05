import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { badgeFor, gamePk, rankOf } from '../src/game.js';
import { handler } from '../src/handler.js';

const ddb = mockClient(DynamoDBDocumentClient);

function evt(method: 'PUT' | 'GET', path: string, over: Record<string, unknown> = {}, user = 'u1', email = 'kim@x.com') {
  return {
    rawPath: path,
    requestContext: {
      requestId: 'r1', http: { method },
      authorizer: { jwt: { claims: { sub: user, 'custom:role': 'swimmer', email } } },
    },
    headers: {},
    ...over,
  } as never;
}

const score = { scoreId: 'g-1', stroke: 'fly', distance: 50, courseUnit: 'y', timeMs: 41_230, character: 'phelps' };

describe('배지 사다리 (docs/09 §3)', () => {
  it('백분위 경계', () => {
    expect(badgeFor(0.5)).toBe('AAAA');
    expect(badgeFor(1)).toBe('AAAA');
    expect(badgeFor(4.9)).toBe('AAA');
    expect(badgeFor(15)).toBe('AA');
    expect(badgeFor(29.9)).toBe('A');
    expect(badgeFor(50)).toBe('BB');
    expect(badgeFor(80)).toBe('B');
  });
  it('competition ranking — 동률은 같은 rank', () => {
    expect(rankOf(100, [90, 100, 100, 110])).toBe(2);
    expect(rankOf(90, [90, 100, 100, 110])).toBe(1);
    expect(rankOf(110, [90, 100, 100, 110])).toBe(4);
  });
  it('이벤트 파티션 키', () => {
    expect(gamePk({ stroke: 'fly', distance: 50, courseUnit: 'y' })).toBe('GAME#fly#50#y');
  });
});

describe('PUT /game/scores', () => {
  beforeEach(() => ddb.reset());

  it('신규 기록 저장', async () => {
    ddb.on(GetCommand).resolves({});
    ddb.on(PutCommand).resolves({});
    const res = await handler(evt('PUT', '/v1/game/scores', { body: JSON.stringify(score) }), {} as never, () => {}) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, bestMs: 41_230 });
    const put = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.Item!.pk).toBe('GAME#fly#50#y');
    expect(put.Item!.sk).toBe('USER#u1');
    expect(put.Item!.displayName).toBe('kim');
  });

  it('기존 베스트보다 느리면 no-op (베스트 유지)', async () => {
    ddb.on(GetCommand).resolves({ Item: { pk: 'GAME#fly#50#y', sk: 'USER#u1', timeMs: 39_000 } });
    const res = await handler(evt('PUT', '/v1/game/scores', { body: JSON.stringify(score) }), {} as never, () => {}) as { statusCode: number; body: string };
    expect(JSON.parse(res.body).bestMs).toBe(39_000);
    expect(ddb.commandCalls(PutCommand).length).toBe(0);
  });

  it('베스트 갱신이면 덮어쓴다', async () => {
    ddb.on(GetCommand).resolves({ Item: { pk: 'GAME#fly#50#y', sk: 'USER#u1', timeMs: 45_000 } });
    ddb.on(PutCommand).resolves({});
    const res = await handler(evt('PUT', '/v1/game/scores', { body: JSON.stringify(score) }), {} as never, () => {}) as { body: string };
    expect(JSON.parse(res.body).bestMs).toBe(41_230);
    expect(ddb.commandCalls(PutCommand).length).toBe(1);
  });

  it('스키마 위반 400 (음수 시간)', async () => {
    const res = await handler(evt('PUT', '/v1/game/scores', { body: JSON.stringify({ ...score, timeMs: -5 }) }), {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(400);
  });

  it('인증 없으면 401', async () => {
    const bad = { rawPath: '/v1/game/scores', requestContext: { requestId: 'r', http: { method: 'PUT' } }, headers: {}, body: '{}' } as never;
    const res = await handler(bad, {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /game/leaderboard', () => {
  beforeEach(() => ddb.reset());

  const item = (userId: string, timeMs: number, name = userId) => ({
    pk: 'GAME#fly#50#y', sk: `USER#${userId}`, userId, displayName: name, character: 'phelps', timeMs,
  });

  it('top10 + 내 순위·배지·백분위', async () => {
    // 20명 — u1은 2등 → percentile 10 → AA
    const items = [item('u0', 40_000)];
    for (let i = 2; i <= 20; i++) items.push(item(`u${i - 1}`, 40_000 + i * 500));
    // u1을 2등 시간으로
    items[1] = item('u1', 41_000);
    ddb.on(QueryCommand).resolves({ Items: items });
    const res = await handler(
      evt('GET', '/v1/game/leaderboard', { queryStringParameters: { stroke: 'fly', distance: '50', courseUnit: 'y' } }),
      {} as never, () => {},
    ) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.length).toBe(10);
    expect(body.items[0].rank).toBe(1);
    expect(body.me).toEqual({ rank: 2, total: 20, percentile: 10, badge: 'AA', timeMs: 41_000 });
  });

  it('참가자 1명이면 rank1/100% → BB 아님 B', async () => {
    ddb.on(QueryCommand).resolves({ Items: [item('u1', 50_000)] });
    const res = await handler(
      evt('GET', '/v1/game/leaderboard', { queryStringParameters: { stroke: 'fly', distance: '50', courseUnit: 'y' } }),
      {} as never, () => {},
    ) as { body: string };
    const body = JSON.parse(res.body);
    expect(body.me.rank).toBe(1);
    expect(body.me.badge).toBe('B'); // 1/1 = 100%
  });

  it('쿼리 파라미터 누락 400', async () => {
    const res = await handler(
      evt('GET', '/v1/game/leaderboard', { queryStringParameters: { stroke: 'fly' } }),
      {} as never, () => {},
    ) as { statusCode: number };
    expect(res.statusCode).toBe(400);
  });
});
