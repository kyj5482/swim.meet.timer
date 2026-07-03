import { AGE_GROUPS, LEVELS_ASC, type Course, type Gender, type StandardRecord } from './parse.js';

/** records → 중첩 테이블 [course][gender][ageGroup][event][level] = ms (키 정렬 고정). */
export function toTable(records: StandardRecord[]) {
  const table: Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>> = {};
  const courses: Course[] = ['SCY', 'SCM', 'LCM'];
  const genders: Gender[] = ['F', 'M'];
  for (const c of courses) {
    for (const g of genders) {
      for (const ag of AGE_GROUPS) {
        const evs = records.filter((r) => r.course === c && r.gender === g && r.ageGroup === ag);
        if (evs.length === 0) continue;
        const events = [...new Set(evs.map((r) => r.event))].sort(byEvent);
        for (const ev of events) {
          const lv: Record<string, number> = {};
          for (const level of LEVELS_ASC) {
            const rec = evs.find((r) => r.event === ev && r.level === level);
            if (rec) lv[level] = rec.timeMs;
          }
          (((table[c] ??= {})[g] ??= {})[ag] ??= {})[ev] = lv;
        }
      }
    }
  }
  return table;
}

/** 종목 정렬: 스트로크(FR,BK,BR,FL,IM) → 거리. */
function byEvent(a: string, b: string): number {
  const order = ['FR', 'BK', 'BR', 'FL', 'IM'];
  const parse = (e: string) => {
    const m = /^(\d+)([A-Z]+)$/.exec(e)!;
    return { d: parseInt(m[1]!, 10), s: order.indexOf(m[2]!) };
  };
  const pa = parse(a);
  const pb = parse(b);
  return pa.s - pb.s || pa.d - pb.d;
}

/** common/standards/seed JSON 파일 내용. */
export function seedJson(records: StandardRecord[], source: string): string {
  return `${JSON.stringify(
    {
      authority: 'usa-swimming',
      season: '2024-2028',
      source,
      generatedBy: 'tools/standards-import',
      records: [...records].sort(
        (a, b) => a.course.localeCompare(b.course) || a.gender.localeCompare(b.gender)
          || a.ageGroup.localeCompare(b.ageGroup) || byEvent(a.event, b.event)
          || LEVELS_ASC.indexOf(a.level) - LEVELS_ASC.indexOf(b.level),
      ),
    },
    null,
    2,
  )}\n`;
}

/** apps/mobile 온디바이스 데이터셋(standards.data.ts) 파일 내용. */
export function mobileDataTs(records: StandardRecord[], source: string): string {
  const table = toTable(records);
  return `/**
 * 자동 생성 파일 — 직접 수정 금지. 재생성: \`npm run import -w tools/standards-import -- --write\`
 * 소스: USA Swimming 2024-2028 Motivational Time Standards
 * (${source})
 *
 * MOTIVATIONAL[course][gender][ageGroup][eventCode][level] = 컷타임(ms)
 */
export const MOTIVATIONAL: Record<string, Record<string, Record<string, Record<string, Record<string, number>>>>> =
  ${JSON.stringify(table, null, 2).replace(/\n/g, '\n  ')} as const;
`;
}
