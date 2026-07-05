import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';

import { claimsOf, docClient, HttpError, ok } from '@splitlane/svc-shared';

/**
 * common/api-spec.md §game — Sharks in the Water! 리더보드.
 * 저장: 이벤트 파티션 1개 아이템/사용자(베스트만 유지) — 스캔 없이 Query 1회.
 *   pk = GAME#<stroke>#<distance>#<courseUnit>, sk = USER#<userId>
 */
const TABLE = () => process.env.RECORDS_TABLE ?? '';

export const gameScoreSchema = z.object({
  scoreId: z.string().min(1),
  stroke: z.enum(['free', 'back', 'breast', 'fly', 'im']),
  distance: z.number().int().min(25).max(1650),
  courseUnit: z.enum(['y', 'm']),
  timeMs: z.number().finite().transform((v) => Math.round(v)).pipe(z.number().int().min(1000).max(3_600_000)),
  character: z.string().nullable().optional(),
});

export type GameBadge = 'AAAA' | 'AAA' | 'AA' | 'A' | 'BB' | 'B';

/** 상위 백분위 사다리 (docs/09 §3): AAAA≤1%, AAA≤5%, AA≤15%, A≤30%, BB≤50%, 나머지 B. */
export function badgeFor(percentile: number): GameBadge {
  if (percentile <= 1) return 'AAAA';
  if (percentile <= 5) return 'AAA';
  if (percentile <= 15) return 'AA';
  if (percentile <= 30) return 'A';
  if (percentile <= 50) return 'BB';
  return 'B';
}

/** competition ranking: 더 빠른 기록 수 + 1 (동률은 같은 rank). */
export function rankOf(timeMs: number, allTimesMs: number[]): number {
  return allTimesMs.filter((t) => t < timeMs).length + 1;
}

export function gamePk(q: { stroke: string; distance: number; courseUnit: string }): string {
  return `GAME#${q.stroke}#${q.distance}#${q.courseUnit}`;
}

interface GameScoreItem {
  pk: string;
  sk: string;
  userId: string;
  displayName: string;
  character: string | null;
  timeMs: number;
  scoreId: string;
  updatedAt: number;
}

/** PUT /game/scores — 멱등, 사용자당 이벤트별 베스트만 유지(더 느리면 no-op). */
export async function putGameScore(e: APIGatewayProxyEventV2, cid: string) {
  const claims = claimsOf(e);
  const parsed = gameScoreSchema.safeParse(JSON.parse(e.body ?? '{}'));
  if (!parsed.success) throw new HttpError('VALIDATION', parsed.error.message);
  const s = parsed.data;
  const pk = gamePk(s);
  const sk = `USER#${claims.userId}`;

  const existing = await docClient().send(new GetCommand({ TableName: TABLE(), Key: { pk, sk } }));
  const prev = existing.Item as GameScoreItem | undefined;
  if (prev && prev.timeMs <= s.timeMs) return ok({ ok: true, bestMs: prev.timeMs }, cid);

  const displayName = claims.email ? claims.email.split('@')[0]! : `Swimmer-${claims.userId.slice(0, 6)}`;
  const item: GameScoreItem = {
    pk, sk, userId: claims.userId, displayName,
    character: s.character ?? null, timeMs: s.timeMs, scoreId: s.scoreId, updatedAt: Date.now(),
  };
  await docClient().send(new PutCommand({ TableName: TABLE(), Item: item }));
  return ok({ ok: true, bestMs: s.timeMs }, cid);
}

/** GET /game/leaderboard?stroke=&distance=&courseUnit= — top10 + 내 순위/배지. */
export async function getGameLeaderboard(e: APIGatewayProxyEventV2, cid: string) {
  const claims = claimsOf(e);
  const q = e.queryStringParameters ?? {};
  const query = gameScoreSchema.pick({ stroke: true, courseUnit: true }).extend({
    distance: z.coerce.number().int().min(25).max(1650),
  }).safeParse({ stroke: q.stroke, distance: q.distance, courseUnit: q.courseUnit });
  if (!query.success) throw new HttpError('VALIDATION', query.error.message);

  const res = await docClient().send(new QueryCommand({
    TableName: TABLE(),
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': gamePk(query.data) },
  }));
  const scores = (res.Items ?? []) as GameScoreItem[];
  scores.sort((a, b) => a.timeMs - b.timeMs);
  const times = scores.map((s) => s.timeMs);
  const total = scores.length;

  const items = scores.slice(0, 10).map((s) => ({
    rank: rankOf(s.timeMs, times),
    displayName: s.displayName,
    character: s.character ?? undefined,
    timeMs: s.timeMs,
    badge: badgeFor((rankOf(s.timeMs, times) / total) * 100),
  }));

  const mine = scores.find((s) => s.userId === claims.userId);
  const me = mine
    ? (() => {
        const rank = rankOf(mine.timeMs, times);
        const percentile = (rank / total) * 100;
        return { rank, total, percentile: Math.round(percentile * 10) / 10, badge: badgeFor(percentile), timeMs: mine.timeMs };
      })()
    : undefined;

  return ok({ items, ...(me ? { me } : {}) }, cid);
}
