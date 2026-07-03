import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { handler } from '../src/handler.js';
import { recPk, recSk } from '../src/model.js';

const ddb = mockClient(DynamoDBDocumentClient);

function evt(method: 'PUT' | 'GET', over: Record<string, unknown> = {}) {
  return {
    requestContext: {
      requestId: 'r1', http: { method },
      authorizer: { jwt: { claims: { sub: 'u1', 'custom:role': 'coach' } } },
    },
    headers: {},
    ...over,
  } as never;
}

const rec = {
  id: 'r-1', swimmerId: 's1', sessionId: 'ss1', date: 1_000, stroke: 'free',
  distance: 100, course: '25y', splitInterval: 25, totalMs: 62_340, status: 'finished',
  slot: 1, splits: [{ segmentIndex: 0, cumulativeMs: 62_340, splitMs: 62_340 }], updatedAt: 2_000,
};

describe('키', () => {
  it('선수 파티션 + updatedAt#id 정렬', () => {
    expect(recPk('s1')).toBe('SWIMMER#s1');
    expect(recSk(rec)).toBe('REC#000000000002000#r-1');
  });
});

describe('PUT /records/batch', () => {
  beforeEach(() => ddb.reset());
  it('멱등 업서트', async () => {
    ddb.on(BatchWriteCommand).resolves({});
    const res = await handler(evt('PUT', { body: JSON.stringify({ records: [rec] }) }), {} as never, () => {}) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).upserted).toBe(1);
  });
  it('소수(ms float) 값은 반올림해 수용 — iOS 이벤트 타임스탬프 대응', async () => {
    ddb.on(BatchWriteCommand).resolves({});
    const floaty = {
      ...rec, totalMs: 62_340.4179992,
      splits: [{ segmentIndex: 0, cumulativeMs: 62_340.4179992, splitMs: 62_340.4179992 }],
    };
    const res = await handler(evt('PUT', { body: JSON.stringify({ records: [floaty] }) }), {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });
  it('스키마 위반 400', async () => {
    const res = await handler(evt('PUT', { body: JSON.stringify({ records: [{ id: 'x' }] }) }), {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(400);
  });
  it('인증 없으면 401', async () => {
    const bad = { requestContext: { requestId: 'r', http: { method: 'PUT' } }, headers: {}, body: '{}' } as never;
    const res = await handler(bad, {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /records (델타)', () => {
  beforeEach(() => ddb.reset());
  it('since 이후 기록 반환', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ pk: 'SWIMMER#s1', sk: 'REC#..', ...rec }] });
    const res = await handler(evt('GET', { queryStringParameters: { swimmerId: 's1', since: '1000' } }), {} as never, () => {}) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.records[0].id).toBe('r-1');
    expect(body.records[0].pk).toBeUndefined(); // 내부 키는 노출 안 함
  });
  it('swimmerId 없으면 400', async () => {
    const res = await handler(evt('GET', { queryStringParameters: {} }), {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(400);
  });
});
