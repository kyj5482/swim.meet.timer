import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildStandardRows, standardPk, standardSk, CLUB_GROUPS } from '../src/data.js';
import { handler } from '../src/handler.js';

const ddb = mockClient(DynamoDBDocumentClient);

function evt(over: Record<string, unknown>) {
  return { rawPath: '/standards', requestContext: { requestId: 'r1' }, headers: {}, ...over } as never;
}

describe('데이터 시드', () => {
  it('여자 11-12 50/100 Free 6레벨씩 = 12행, 확인값', () => {
    const rows = buildStandardRows();
    expect(rows).toHaveLength(12);
    const aa50 = rows.find((r) => r.event === '50FR' && r.level === 'AA');
    expect(aa50?.timeMs).toBe(26_090);
    expect(rows.every((r) => r.verified)).toBe(true);
  });
  it('키 구성', () => {
    expect(standardPk({ authority: 'usa-swimming', season: '2024-2028', course: 'SCY', gender: 'F', ageGroup: '11-12' }))
      .toBe('STD#usa-swimming#2024-2028#SCY#F#11-12');
    expect(standardSk({ event: '50FR', level: 'AA' })).toBe('50FR#AA');
  });
});

describe('GET /standards', () => {
  beforeEach(() => ddb.reset());

  it('age 없으면 400 VALIDATION', async () => {
    const res = await handler(evt({ queryStringParameters: {} }), {} as never, () => {}) as { statusCode: number };
    expect(res.statusCode).toBe(400);
  });

  it('레벨 목록 반환', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ event: '50FR', level: 'AA', timeMs: 26_090, verified: true }] });
    const res = await handler(
      evt({ queryStringParameters: { gender: 'F', age: '11-12', course: 'SCY' } }),
      {} as never, () => {},
    ) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).items[0].timeMs).toBe(26_090);
  });
});

describe('GET /standards/clubs/{clubId}/groups', () => {
  beforeEach(() => ddb.reset());
  it('클럽 그룹 조건 반환', async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ groupId: 'AGD-SILVER', name: 'Silver', requirements: CLUB_GROUPS[0]!.requirements }] });
    const res = await handler(
      evt({ rawPath: '/standards/clubs/nova-va/groups', pathParameters: { clubId: 'nova-va' } }),
      {} as never, () => {},
    ) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).groups[0].groupId).toBe('AGD-SILVER');
  });
});
