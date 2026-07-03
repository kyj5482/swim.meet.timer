import { z } from 'zod';

/** ms 값은 클라 타이머 특성상 소수(float)로 올 수 있어 정수로 반올림해 수용. */
const roundedMs = z.number().finite().transform((v) => Math.round(v));

/** common/data-model.md TrainingRecord (동기화 페이로드). id=UUIDv7(클라 생성). */
export const splitSchema = z.object({
  segmentIndex: z.number().int().nonnegative(),
  cumulativeMs: roundedMs.pipe(z.number().int().nonnegative()),
  splitMs: roundedMs.pipe(z.number().int()),
});

export const recordSchema = z.object({
  id: z.string().min(1),
  swimmerId: z.string().min(1),
  sessionId: z.string().min(1),
  date: z.number().int(),
  stroke: z.string(),
  distance: z.number().int().positive(),
  course: z.string(),
  splitInterval: z.number().int().positive(),
  totalMs: roundedMs.pipe(z.number().int().nonnegative()),
  status: z.enum(['finished', 'dnf']),
  slot: z.number().int(),
  splits: z.array(splitSchema),
  updatedAt: z.number().int(),
  deleted: z.boolean().optional(),
});

export type TrainingRecord = z.infer<typeof recordSchema>;

export const batchSchema = z.object({ records: z.array(recordSchema).max(500) });

/** DynamoDB 키: 선수별 파티션 + updatedAt#id 정렬(델타 동기화). */
export function recPk(swimmerId: string): string {
  return `SWIMMER#${swimmerId}`;
}
export function recSk(r: Pick<TrainingRecord, 'updatedAt' | 'id'>): string {
  return `REC#${String(r.updatedAt).padStart(15, '0')}#${r.id}`;
}
