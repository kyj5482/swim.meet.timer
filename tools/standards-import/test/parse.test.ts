import { describe, expect, it } from 'vitest';

import { mobileDataTs, seedJson, toTable } from '../src/generate.js';
import {
  checkAnchors, extractTimes, levelsFromBlock, parsePdfText, parseTimeToken,
} from '../src/parse.js';

describe('parseTimeToken', () => {
  it('초.센티초', () => expect(parseTimeToken('31.79')).toBe(31790));
  it('분:초.센티초', () => expect(parseTimeToken('1:08.79')).toBe(68790));
  it('두 자리 분', () => expect(parseTimeToken('16:30.00')).toBe(990000));
  it('별표 제거', () => expect(parseTimeToken('31.79*')).toBe(31790));
  it('시간 아님', () => {
    expect(parseTimeToken('FR')).toBeNull();
    expect(parseTimeToken('50')).toBeNull();
    expect(parseTimeToken('AAAA')).toBeNull();
  });
});

describe('extractTimes — 실측 PDF 추출 텍스트의 공백/별표 소실 대응', () => {
  it('정상 공백+별표 구분', () => {
    expect(extractTimes('39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *')).toEqual([
      39790, 35990, 32090, 30890, 29590, 28290,
    ]);
  });
  it('완전히 붙어 나온 값도 정확히 분리(실측 사례)', () => {
    // 실제 Mac에서 다운로드한 공식 PDF의 100 BK SCY 11-12 남자 줄
    expect(extractTimes('59.491:02.791:05.991:09.29 *1:15.691:22.19')).toEqual([
      59490, 62790, 65990, 69290, 75690, 82190,
    ]);
  });
  it('완전히 붙어 나온 값(초 단위만, 실측 사례) — 50 FL SCY 11-12 남자', () => {
    expect(extractTimes('26.69 *28.1929.6931.1934.1937.09')).toEqual([
      26690, 28190, 29690, 31190, 34190, 37090,
    ]);
  });
});

describe('levelsFromBlock', () => {
  it('내림차순 = B 먼저(여자 컬럼)', () => {
    const lv = levelsFromBlock([33990, 31690, 29290, 28090, 26990, 25790])!;
    expect(lv.B).toBe(33990);
    expect(lv.AAAA).toBe(25790);
  });
  it('오름차순 = AAAA 먼저(남자 컬럼)', () => {
    const lv = levelsFromBlock([27490, 28690, 29890, 31090, 34590, 38190])!;
    expect(lv.AAAA).toBe(27490);
    expect(lv.B).toBe(38190);
  });
  it('비단조 → null', () => {
    expect(levelsFromBlock([31790, 33000, 27290, 26090, 24990, 23890])).toBeNull();
  });
});

/**
 * Mac에서 다운로드한 실제 공식 PDF(pdf-parse 추출) 텍스트 그대로 —
 * 지어낸 픽스처가 아니라 사용자가 실행 결과로 붙여준 원문의 발췌.
 */
const REAL_PDF_TEXT = `
USA Swimming 2024-2028 Motivational Standards
10/10/2025 1:02:42 AM
BBBAAAAAAAAAAAAAAAAAAAABBB
10 & under GirlsEvent10 & under Boys
39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *50 FR SCY
27.49 *28.69 *29.89 *31.09 *34.59 *38.19 *
3:14.99 *2:55.49 *2:35.99 *2:29.49 *2:22.99 *2:16.49 *200 MED-R
SCY
2:15.39 *2:21.79 *2:28.29 *2:34.69 *2:53.99 *3:13.39 *
11-12 GirlsEvent11-12 Boys
33.99 *31.69 *29.29 *28.09 *26.99 *25.79 *50 FR SCY
24.59 *25.79 *26.99 *28.09 *30.49 *32.79 *
1:14.69 *1:09.39 *1:03.99 *1:01.39 *58.69 *55.99 *100 FR SCY
53.59 *56.19 *58.69 *1:01.29 *1:06.39 *1:11.49 *
1:26.59 *1:19.79 *1:12.99 *1:09.59 *1:06.19 *1:02.69 *100 BK SCY
59.491:02.791:05.991:09.29 *1:15.691:22.19
36.89 *34.29 *31.59 *30.29 *28.99 *27.69 *50 FL SCY
26.69 *28.1929.6931.1934.1937.09
`;

describe('parsePdfText — 실측 텍스트', () => {
  const res = parsePdfText(REAL_PDF_TEXT);

  it('오류 없음(경고는 허용 — 릴레이 스킵 등)', () => {
    expect(res.errors).toEqual([]);
  });
  it('개인 종목만 파싱: 10&under 50FR + 11-12 50FR/100FR/100BK/50FL = 5 × 성별2 × 레벨6', () => {
    expect(res.records).toHaveLength(5 * 2 * 6);
  });
  it('릴레이(200 MED-R)는 스킵됨', () => {
    expect(res.records.some((r) => r.event.includes('MED'))).toBe(false);
  });
  it('앵커 검증 통과(11-12 여자 50FR/100FR B·AAAA)', () => {
    expect(checkAnchors(res.records)).toEqual([]);
  });
  it('붙어 나온 남자 줄(100 BK SCY 11-12)도 정확히 파싱', () => {
    const aaaa = res.records.find((r) => r.gender === 'M' && r.event === '100BK' && r.ageGroup === '11-12' && r.level === 'AAAA');
    const b = res.records.find((r) => r.gender === 'M' && r.event === '100BK' && r.ageGroup === '11-12' && r.level === 'B');
    expect(aaaa?.timeMs).toBe(59490);
    expect(b?.timeMs).toBe(82190);
  });
  it('완전히 붙어 나온 남자 줄(50 FL SCY 11-12)도 정확히 파싱', () => {
    const aaaa = res.records.find((r) => r.gender === 'M' && r.event === '50FL' && r.ageGroup === '11-12' && r.level === 'AAAA');
    expect(aaaa?.timeMs).toBe(26690);
  });
  it('줄바꿈된 코스(200 MED-R\\nSCY)도 병합되어 릴레이로 인식(레코드는 안 남지만 오류도 없음)', () => {
    // 병합 실패 시 "SCY" 단독 줄이 남자 줄로 오인되어 짝이 깨지고 다음 이벤트까지 밀림 —
    // 그런 흔적(경고)이 없어야 병합이 제대로 된 것.
    expect(res.warnings.some((w) => w.includes('남자 시간 6개'))).toBe(false);
  });
  it('연령 그룹이 올바르게 태깅됨(10U vs 11-12)', () => {
    const under10 = res.records.filter((r) => r.ageGroup === '10U');
    const g11 = res.records.filter((r) => r.ageGroup === '11-12');
    expect(under10.length).toBeGreaterThan(0);
    expect(g11.length).toBeGreaterThan(0);
  });
});

describe('parsePdfText — 방어 케이스', () => {
  it('연령 컨텍스트 없는 데이터는 경고와 함께 스킵', () => {
    const r = parsePdfText('39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *50 FR SCY\n27.49 *28.69 *29.89 *31.09 *34.59 *38.19 *');
    expect(r.records).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('중복 종목은 오류', () => {
    const block = '11-12 GirlsEvent11-12 Boys\n39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *50 FR SCY\n27.49 *28.69 *29.89 *31.09 *34.59 *38.19 *\n';
    const r = parsePdfText(block + block);
    expect(r.errors.some((e) => e.includes('중복'))).toBe(true);
  });
  it('여자 줄만 있고 남자 줄이 없으면(문서 끝) 경고', () => {
    const r = parsePdfText('11-12 GirlsEvent11-12 Boys\n39.79 *35.99 *32.09 *30.89 *29.59 *28.29 *50 FR SCY');
    expect(r.records).toHaveLength(0);
    expect(r.warnings.some((w) => w.includes('남자 줄'))).toBe(true);
  });
});

describe('generate', () => {
  const { records } = parsePdfText(REAL_PDF_TEXT);

  it('toTable 중첩 구조', () => {
    const t = toTable(records);
    expect(t.SCY!.F!['11-12']!['50FR']!.B).toBe(33990);
    expect(t.SCY!.M!['11-12']!['50FR']!.AAAA).toBe(24590);
  });
  it('seedJson은 실수치, placeholder 없음', () => {
    const j = JSON.parse(seedJson(records, 'test'));
    expect(j.records.every((r: { timeMs: number }) => r.timeMs > 0)).toBe(true);
    expect(j.season).toBe('2024-2028');
  });
  it('mobileDataTs는 유효한 TS 모듈 형태', () => {
    const ts = mobileDataTs(records, 'test');
    expect(ts).toContain('export const MOTIVATIONAL');
    expect(ts).toContain('"50FR"');
    expect(ts).toContain('자동 생성 파일');
  });
});
