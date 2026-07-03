/**
 * USA Swimming 2024-2028 Motivational Time Standards 공식 PDF(클래식 포맷)
 * 텍스트 파서. 레이아웃(줄 단위):
 *
 *   [연령 그룹 헤더]  예: "11-12 Age Group"  /  "10 & Under"
 *   [코스 헤더]       예: "SCY" | "Short Course Yards" | "LCM" ...
 *   [컬럼 헤더]       "B BB A AA AAA AAAA   AAAA AAA AA A BB B" (여자 왼쪽 · 남자 오른쪽)
 *   [데이터 줄]       "31.79 29.49 27.29 26.09 24.99 23.89 50 FR 21.99 22.99 ..."
 *
 * 방어적으로 만든다:
 * - 시간 6개 + (거리 스트로크) + 시간 6개 패턴이 아닌 줄은 데이터로 취급하지 않음.
 * - 각 6개 블록의 레벨 순서(B→AAAA vs AAAA→B)는 단조 방향으로 추론 —
 *   단조가 아니면 그 줄은 오류로 수집(조용히 버리지 않음).
 * - 같은 (코스·연령·성별·종목) 중복 등장은 오류.
 */

export type Course = 'SCY' | 'SCM' | 'LCM';
export type Gender = 'F' | 'M';
export type Level = 'B' | 'BB' | 'A' | 'AA' | 'AAA' | 'AAAA';

/** 느린 → 빠른 순. */
export const LEVELS_ASC: Level[] = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

export const AGE_GROUPS = ['10U', '11-12', '13-14', '15-16', '17-18'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface StandardRecord {
  course: Course;
  gender: Gender;
  ageGroup: AgeGroup;
  /** 예 '50FR', '100BK', '400IM'. */
  event: string;
  level: Level;
  timeMs: number;
}

export interface ParseResult {
  records: StandardRecord[];
  /** 파싱 실패·비단조 등 사람이 봐야 하는 줄. 비어있지 않으면 --write 거부. */
  errors: string[];
  /** 컨텍스트 없이 스킵된 데이터 줄 등 경고. */
  warnings: string[];
}

const DISTANCES = new Set(['25', '50', '100', '200', '400', '500', '800', '1000', '1500', '1650']);
const STROKES = new Set(['FR', 'BK', 'BR', 'FL', 'IM']);

/** "1:08.79" | "31.79" | "31.79*" → ms. 형식이 아니면 null. */
export function parseTimeToken(tok: string): number | null {
  const clean = tok.replace(/[*#]/g, '');
  const m = /^(?:(\d{1,2}):)?(\d{1,2})\.(\d{2})$/.exec(clean);
  if (!m) return null;
  const min = m[1] ? parseInt(m[1], 10) : 0;
  const sec = parseInt(m[2]!, 10);
  const cs = parseInt(m[3]!, 10);
  if (sec >= 60 && m[1]) return null;
  return (min * 60 + sec) * 1000 + cs * 10;
}

/** 6개 시간 블록의 레벨 순서를 단조 방향으로 추론해 레벨→ms 매핑. 비단조면 null. */
export function levelsFromBlock(times: number[]): Record<Level, number> | null {
  if (times.length !== 6) return null;
  const desc = times.every((t, i) => i === 0 || times[i - 1]! > t); // B(느림) 먼저
  const asc = times.every((t, i) => i === 0 || times[i - 1]! < t); // AAAA(빠름) 먼저
  if (!desc && !asc) return null;
  const out = {} as Record<Level, number>;
  LEVELS_ASC.forEach((lv, j) => {
    out[lv] = desc ? times[j]! : times[5 - j]!;
  });
  return out;
}

export interface DataLine {
  event: string;
  girls: Record<Level, number>;
  boys: Record<Level, number>;
}

/**
 * 데이터 줄 파싱: 시간 6 + 거리 + 스트로크 + 시간 6. 아니면 null.
 * 반환의 girls/boys는 각각 단조 방향으로 레벨이 확정된 매핑.
 * 블록이 6개인데 비단조면 Error를 던진다(오파싱을 조용히 넘기지 않음).
 */
export function parseDataLine(line: string): DataLine | null {
  const toks = line.trim().split(/\s+/).filter((t) => t !== '*' && t !== '#');
  for (let i = 0; i < toks.length - 1; i++) {
    const dist = toks[i]!;
    const stroke = toks[i + 1]!.toUpperCase();
    if (!DISTANCES.has(dist) || !STROKES.has(stroke)) continue;
    const left = toks.slice(0, i).map(parseTimeToken);
    const right = toks.slice(i + 2).map(parseTimeToken);
    if (left.length !== 6 || right.length !== 6) continue;
    if (left.some((t) => t == null) || right.some((t) => t == null)) continue;
    const girls = levelsFromBlock(left as number[]);
    const boys = levelsFromBlock(right as number[]);
    if (!girls || !boys) {
      throw new Error(`비단조 시간 블록(오파싱 가능성): "${line.trim()}"`);
    }
    return { event: `${dist}${stroke}`, girls, boys };
  }
  return null;
}

const AGE_PATTERNS: [RegExp, AgeGroup][] = [
  [/10\s*(&|and)\s*under/i, '10U'],
  [/\b11\s*-\s*12\b/, '11-12'],
  [/\b13\s*-\s*14\b/, '13-14'],
  [/\b15\s*-\s*16\b/, '15-16'],
  [/\b17\s*-\s*18\b/, '17-18'],
];

const COURSE_PATTERNS: [RegExp, Course][] = [
  [/short\s*course\s*yards|\bSCY\b/i, 'SCY'],
  [/short\s*course\s*meters|\bSCM\b/i, 'SCM'],
  [/long\s*course\s*meters|\bLCM\b/i, 'LCM'],
];

/** PDF 전체 텍스트 → 표준기록 레코드. */
export function parsePdfText(text: string): ParseResult {
  const records: StandardRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  let age: AgeGroup | null = null;
  let course: Course | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let data: DataLine | null = null;
    try {
      data = parseDataLine(line);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }

    if (!data) {
      // 컨텍스트 헤더 스캔 (한 줄에 연령+코스가 같이 있을 수 있음)
      for (const [re, ag] of AGE_PATTERNS) if (re.test(line)) age = ag;
      for (const [re, c] of COURSE_PATTERNS) if (re.test(line)) course = c;
      continue;
    }

    if (!age || !course) {
      warnings.push(`컨텍스트(연령/코스) 없이 데이터 줄 발견 — 스킵: "${line}"`);
      continue;
    }

    for (const [gender, levels] of [['F', data.girls], ['M', data.boys]] as const) {
      const key = `${course}/${age}/${gender}/${data.event}`;
      if (seen.has(key)) {
        errors.push(`중복 종목: ${key}`);
        continue;
      }
      seen.add(key);
      for (const lv of LEVELS_ASC) {
        records.push({ course, gender, ageGroup: age, event: data.event, level: lv, timeMs: levels[lv] });
      }
    }
  }

  return { records, errors, warnings };
}

/**
 * 앵커 검증: 이미 독립 검증된 값과 파싱 결과가 정확히 일치해야 한다.
 * (여자 11-12 SCY 50/100 Free — apps/mobile 기존 verified 값과 동일 소스)
 */
export const ANCHORS: StandardRecord[] = [
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '50FR', level: 'B', timeMs: 31790 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '50FR', level: 'AAAA', timeMs: 23890 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '100FR', level: 'B', timeMs: 68790 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '100FR', level: 'AAAA', timeMs: 51590 },
];

export function checkAnchors(records: StandardRecord[]): string[] {
  const failures: string[] = [];
  for (const a of ANCHORS) {
    const hit = records.find(
      (r) => r.course === a.course && r.gender === a.gender && r.ageGroup === a.ageGroup
        && r.event === a.event && r.level === a.level,
    );
    if (!hit) failures.push(`앵커 누락: ${a.course}/${a.ageGroup}/${a.gender}/${a.event}/${a.level}`);
    else if (hit.timeMs !== a.timeMs) {
      failures.push(`앵커 불일치: ${a.event} ${a.level} — 기대 ${a.timeMs}ms, 파싱 ${hit.timeMs}ms`);
    }
  }
  return failures;
}
