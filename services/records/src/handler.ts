import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';

import {
  claimsOf, correlationIdOf, docClient, fail, HttpError, makeLogger, ok, withCorrelation,
} from '@splitlane/svc-shared';
import { batchSchema, recPk, recSk } from './model.js';

const logger = makeLogger('records');
const TABLE = process.env.RECORDS_TABLE ?? '';

/**
 * PUT  /records/batch   기록 멱등 업서트(클라 UUID PK). last-write-wins.
 * GET  /records?swimmerId=&since=   델타 동기화(tombstone 포함).
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const e = event as APIGatewayProxyEventV2;
  const cid = correlationIdOf(e);
  const log = withCorrelation(logger, cid);
  try {
    claimsOf(e); // 인증 확인(소유권은 Relation 검사 — 후속 T-206)
    const method = e.requestContext.http.method;
    if (method === 'PUT') return await upsert(e, cid, log);
    if (method === 'GET') return await list(e, cid, log);
    return fail('VALIDATION', `unsupported method ${method}`, cid);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.code, err.message, cid);
    log.error('unhandled', { err: String(err) });
    return fail('INTERNAL', 'internal error', cid);
  }
};

async function upsert(e: APIGatewayProxyEventV2, cid: string, log: ReturnType<typeof withCorrelation>) {
  const parsed = batchSchema.safeParse(JSON.parse(e.body ?? '{}'));
  if (!parsed.success) throw new HttpError('VALIDATION', parsed.error.message);
  const items = parsed.data.records.map((r) => ({
    pk: recPk(r.swimmerId), sk: recSk(r), ...r, deleted: r.deleted ?? false,
  }));
  for (let i = 0; i < items.length; i += 25) {
    await docClient().send(new BatchWriteCommand({
      RequestItems: { [TABLE]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) },
    }));
  }
  log.info('records upsert', { count: items.length });
  return ok({ upserted: items.length }, cid);
}

async function list(e: APIGatewayProxyEventV2, cid: string, log: ReturnType<typeof withCorrelation>) {
  const q = e.queryStringParameters ?? {};
  const swimmerId = q.swimmerId;
  if (!swimmerId) throw new HttpError('VALIDATION', 'swimmerId required');
  const since = q.since ? Number(q.since) : 0;
  const res = await docClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk AND sk > :since',
    ExpressionAttributeValues: { ':pk': recPk(swimmerId), ':since': `REC#${String(since).padStart(15, '0')}#` },
  }));
  const records = (res.Items ?? []).map(({ pk, sk, ...r }) => r);
  log.info('records list', { swimmerId, since, count: records.length });
  return ok({ records, nextSince: Date.now() }, cid);
}
