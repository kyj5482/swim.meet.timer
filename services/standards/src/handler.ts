import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { correlationIdOf, docClient, fail, HttpError, makeLogger, ok, withCorrelation } from '@splitlane/svc-shared';

const logger = makeLogger('standards');
const TABLE = process.env.STANDARDS_TABLE ?? '';

/**
 * GET /standards?authority=&season=&course=&gender=&age=&event=  → 레벨별 컷타임
 * GET /standards/clubs/{clubId}/groups                            → 클럽 승급 조건
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const cid = correlationIdOf(event as APIGatewayProxyEventV2);
  const log = withCorrelation(logger, cid);
  try {
    const path = event.rawPath ?? '';
    if (path.includes('/clubs/')) return await clubGroups(event as APIGatewayProxyEventV2, cid);
    return await standards(event as APIGatewayProxyEventV2, cid, log);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.code, e.message, cid);
    log.error('unhandled', { err: String(e) });
    return fail('INTERNAL', 'internal error', cid);
  }
};

async function standards(event: APIGatewayProxyEventV2, cid: string, log: ReturnType<typeof withCorrelation>) {
  const q = event.queryStringParameters ?? {};
  const authority = q.authority ?? 'usa-swimming';
  const season = q.season ?? '2024-2028';
  const course = (q.course ?? 'SCY').toUpperCase();
  const gender = (q.gender ?? 'F').toUpperCase();
  const age = q.age;
  if (!age) throw new HttpError('VALIDATION', 'age (ageGroup) required, e.g. 11-12');
  const pk = `STD#${authority}#${season}#${course}#${gender}#${age}`;
  const res = await docClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': pk, ...(q.event ? { ':ev': `${q.event}#` } : {}) },
    ...(q.event ? { FilterExpression: 'begins_with(sk, :ev)' } : {}),
  }));
  const items = (res.Items ?? []).map((i) => ({ event: i.event, level: i.level, timeMs: i.timeMs, verified: i.verified }));
  log.info('standards query', { pk, count: items.length });
  return ok({ items }, cid);
}

async function clubGroups(event: APIGatewayProxyEventV2, cid: string) {
  const clubId = event.pathParameters?.clubId;
  if (!clubId) throw new HttpError('VALIDATION', 'clubId required');
  const res = await docClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `CLUB#${clubId}` },
  }));
  const groups = (res.Items ?? []).map((i) => ({
    groupId: i.groupId, name: i.name, requirements: i.requirements, note: i.note,
  }));
  return ok({ groups }, cid);
}
