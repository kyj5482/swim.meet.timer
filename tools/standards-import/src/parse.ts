/**
 * USA Swimming 2024-2028 Motivational Time Standards 공식 PDF(연령그룹판)
 * 텍스트 파서. 실제 pdf-parse 추출 레이아웃(Mac에서 확인, 줄 단위):
 *
 *   [헤더]     "USA Swimming 2024-2028 Motivational Standards" / 날짜 / 컬럼헤더(잡음)
 *   [연령 헤더] "10 & under GirlsEvent10 & under Boys"  (공백 없이 붙어 나옴)
 *              "11-12 GirlsEvent11-12 Boys"
 *   [여자 줄]   "39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *50 FR SCY"
 *              (여자 시간 6개 + 거리+스트로크+코스, 한 줄)
 *   [남자 줄]   "27.49 *28.69 *29.89 *31.09 *34.59 *38.19 *"
 *              (남자 시간 6개만, 별도 줄 — 여자 줄 바로 다음)
 *
 * 실측 특이사항(방어적으로 처리):
 * - 시간 사이 공백/별표가 종종 사라져 여러 값이 그대로 붙어 나옴
 *   (예: "59.491:02.791:05.991:09.29 *1:15.691:22.19"). 공백 분리 대신
 *   시간 패턴을 전역 매칭해 스캔 — 각 토큰이 자기 길이로 경계를 이루므로
 *   구분자 없이도 정확히 분리된다.
 * - "200 MED-R" 같은 릴레이 종목은 코스가 다음 줄로 줄바꿈되기도 함 —
 *   "SCY"/"SCM"/"LCM" 단독 줄은 앞 줄에 병합 후 처리. 릴레이 자체는
 *   개인 종목이 아니므로 스트로크 화이트리스트에 없어 자동 스킵.
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
  /** 파싱 실패·비단조·중복 등 사람이 봐야 하는 문제. 비어있지 않으면 --write 거부. */
  errors: string[];
  /** 컨텍스트 없이 스킵된 줄 등 경고(치명적이진 않음). */
  warnings: string[];
}

/** 개인 종목 스트로크 코드만 — 릴레이(FR-R, MED-R 등)는 의도적으로 제외. */
const STROKES = new Set(['FR', 'BK', 'BR', 'FL', 'IM']);

/** "1:08.79" | "31.79" | "31.79*" → ms. 형식이 아니면 null(단일 토큰 전체 매치). */
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

/**
 * 문자열 안의 모든 시간 패턴을 순서대로 스캔해 ms 배열로. 공백·별표가
 * 사라져 값이 그대로 이어 붙어도(예 "28.1929.6931.1934.1937.09") 각
 * 토큰이 `\d{1,2}(:\d{1,2})?\.\d{2}` 형태로 자기 길이를 이루므로 정확히
 * 분리된다 — split 대신 반드시 이 함수를 쓴다.
 */
export function extractTimes(s: string): number[] {
  const re = /(?:(\d{1,2}):)?(\d{1,2})\.(\d{2})/g;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const min = m[1] ? parseInt(m[1], 10) : 0;
    const sec = parseInt(m[2]!, 10);
    const cs = parseInt(m[3]!, 10);
    out.push((min * 60 + sec) * 1000 + cs * 10);
  }
  return out;
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

function normalizeAgeGroup(raw: string): AgeGroup | null {
  const s = raw.trim();
  if (/^10\s*(&|and)\s*under$/i.test(s)) return '10U';
  if (/^11-12$/.test(s)) return '11-12';
  if (/^13-14$/.test(s)) return '13-14';
  if (/^15-16$/.test(s)) return '15-16';
  if (/^17-18$/.test(s)) return '17-18';
  return null;
}

/** "{연령} GirlsEvent{연령} Boys" 헤더 — 백레퍼런스로 양쪽 연령 텍스트가 같은지 확인. */
const AGE_HEADER_RE = /^(.*?)\s*Girls\s*Event\s*\1\s*Boys\s*$/;

/** 여자 줄 끝: "...시간들 {거리} {스트로크} {코스}". */
const EVENT_SUFFIX_RE = /^(.*?)\s*(\d{2,4})\s*([A-Za-z-]{2,6})\s*(SCY|SCM|LCM)\s*\*?\s*$/;

/** PDF 전체 텍스트 → 표준기록 레코드. */
export function parsePdfText(text: string): ParseResult {
  const records: StandardRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  // 공백 정규화 + "SCY"/"SCM"/"LCM" 단독 줄(줄바꿈된 코스)은 앞 줄에 병합.
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  for (const l of rawLines) {
    if (/^(SCY|SCM|LCM)$/.test(l) && lines.length > 0) {
      lines[lines.length - 1] += ` ${l}`;
    } else {
      lines.push(l);
    }
  }

  let age: AgeGroup | null = null;
  let pendingGirls: { course: Course; event: string; times: number[]; line: string } | null = null;

  for (const line of lines) {
    if (!line) continue;

    const ageMatch = AGE_HEADER_RE.exec(line);
    if (ageMatch) {
      if (pendingGirls) {
        warnings.push(`여자 줄에 대응하는 남자 줄을 찾지 못함 — 스킵: "${pendingGirls.line}"`);
        pendingGirls = null;
      }
      const ag = normalizeAgeGroup(ageMatch[1]!);
      if (ag) age = ag;
      else warnings.push(`알 수 없는 연령 헤더 — 무시: "${line}"`);
      continue;
    }

    const suffixMatch = EVENT_SUFFIX_RE.exec(line);
    if (suffixMatch) {
      if (pendingGirls) {
        warnings.push(`여자 줄에 대응하는 남자 줄을 찾지 못함 — 스킵: "${pendingGirls.line}"`);
        pendingGirls = null;
      }
      const strokeRaw = suffixMatch[3]!.toUpperCase();
      if (!STROKES.has(strokeRaw)) continue; // 릴레이 등 개인 종목 아님 — 조용히 스킵
      if (!age) {
        warnings.push(`연령 컨텍스트 없이 데이터 줄 발견 — 스킵: "${line}"`);
        continue;
      }
      const times = extractTimes(suffixMatch[1]!);
      if (times.length !== 6) {
        warnings.push(`여자 시간 6개가 아님(${times.length}개) — 스킵: "${line}"`);
        continue;
      }
      pendingGirls = {
        course: suffixMatch[4] as Course,
        event: `${suffixMatch[2]}${strokeRaw}`,
        times,
        line,
      };
      continue;
    }

    if (pendingGirls) {
      const boysTimes = extractTimes(line);
      if (boysTimes.length !== 6) {
        warnings.push(`남자 시간 6개가 아님(${boysTimes.length}개) — 짝 스킵: "${pendingGirls.line}" / "${line}"`);
        pendingGirls = null;
        continue;
      }
      const girlsLevels = levelsFromBlock(pendingGirls.times);
      const boysLevels = levelsFromBlock(boysTimes);
      if (!girlsLevels || !boysLevels) {
        errors.push(`비단조 시간 블록(오파싱 가능성): "${pendingGirls.line}" / "${line}"`);
        pendingGirls = null;
        continue;
      }
      for (const [gender, levels] of [['F', girlsLevels], ['M', boysLevels]] as const) {
        const key = `${pendingGirls.course}/${age}/${gender}/${pendingGirls.event}`;
        if (seen.has(key)) {
          errors.push(`중복 종목: ${key}`);
          continue;
        }
        seen.add(key);
        for (const lv of LEVELS_ASC) {
          records.push({
            course: pendingGirls.course, gender, ageGroup: age!, event: pendingGirls.event,
            level: lv, timeMs: levels[lv],
          });
        }
      }
      pendingGirls = null;
      continue;
    }
    // 그 외(페이지 헤더·날짜·컬럼헤더 잡음)는 무시
  }

  if (pendingGirls) {
    warnings.push(`문서 끝: 여자 줄에 대응하는 남자 줄을 찾지 못함 — 스킵: "${pendingGirls.line}"`);
  }

  return { records, errors, warnings };
}

/**
 * 앵커 검증: 공식 PDF에서 실제로 확인한 값과 파싱 결과가 정확히 일치해야
 * 한다(2026-07 Mac에서 실행한 공식 PDF 텍스트 원문 대조 — 이전에 웹 요약으로
 * 하드코딩했던 값은 틀렸었다. 이 값들이 정본).
 */
export const ANCHORS: StandardRecord[] = [
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '50FR', level: 'B', timeMs: 33990 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '50FR', level: 'AAAA', timeMs: 25790 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '100FR', level: 'B', timeMs: 74690 },
  { course: 'SCY', gender: 'F', ageGroup: '11-12', event: '100FR', level: 'AAAA', timeMs: 55990 },
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
