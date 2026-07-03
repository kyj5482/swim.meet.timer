import { describe, expect, it } from 'vitest';

import { toTable, seedJson, mobileDataTs } from '../src/generate.js';
import {
  checkAnchors, levelsFromBlock, parseDataLine, parsePdfText, parseTimeToken,
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

describe('levelsFromBlock', () => {
  it('내림차순 = B 먼저', () => {
    const lv = levelsFromBlock([31790, 29490, 27290, 26090, 24990, 23890])!;
    expect(lv.B).toBe(31790);
    expect(lv.AAAA).toBe(23890);
  });
  it('오름차순 = AAAA 먼저(남자 컬럼)', () => {
    const lv = levelsFromBlock([21990, 22990, 24190, 25690, 27990, 30990])!;
    expect(lv.AAAA).toBe(21990);
    expect(lv.B).toBe(30990);
  });
  it('비단조 → null', () => {
    expect(levelsFromBlock([31790, 33000, 27290, 26090, 24990, 23890])).toBeNull();
  });
});

describe('parseDataLine', () => {
  it('여6 + 종목 + 남6', () => {
    const d = parseDataLine('31.79 29.49 27.29 26.09 24.99 23.89 50 FR 21.99 22.99 24.19 25.69 27.99 30.99')!;
    expect(d.event).toBe('50FR');
    expect(d.girls.B).toBe(31790);
    expect(d.girls.AAAA).toBe(23890);
    expect(d.boys.AAAA).toBe(21990);
    expect(d.boys.B).toBe(30990);
  });
  it('별표 붙은 PDF 원문도 파싱', () => {
    const d = parseDataLine('1:08.79 * 1:03.79 58.89 56.49 53.99 51.59 100 FR 47.99 50.19 52.99 56.09 1:01.09 1:07.09')!;
    expect(d.event).toBe('100FR');
    expect(d.girls.B).toBe(68790);
    expect(d.girls.AAAA).toBe(51590);
  });
  it('헤더/일반 텍스트 줄은 null', () => {
    expect(parseDataLine('B BB A AA AAA AAAA Event AAAA AAA AA A BB B')).toBeNull();
    expect(parseDataLine('USA Swimming 2024-2028 Motivational Standards')).toBeNull();
    expect(parseDataLine('')).toBeNull();
  });
});

const FIXTURE = `
USA Swimming 2024-2028 Motivational Standards
11-12 Age Group
Short Course Yards
GIRLS                                BOYS
B BB A AA AAA AAAA    Event    AAAA AAA AA A BB B
31.79 29.49 27.29 26.09 24.99 23.89 50 FR 21.99 22.99 24.19 25.69 27.99 30.99
1:08.79 1:03.79 58.89 56.49 53.99 51.59 100 FR 47.99 50.19 52.99 56.09 1:01.09 1:07.09
Long Course Meters
36.69 33.99 31.39 30.09 28.79 27.49 50 FR 25.99 27.19 28.59 30.29 32.99 36.29
`;

describe('parsePdfText', () => {
  const res = parsePdfText(FIXTURE);

  it('오류·경고 없음', () => {
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
  it('코스·연령 컨텍스트 추적: SCY 2종목 + LCM 1종목 × 성별2 × 레벨6', () => {
    expect(res.records).toHaveLength((2 + 1) * 2 * 6);
  });
  it('앵커 검증 통과', () => {
    expect(checkAnchors(res.records)).toEqual([]);
  });
  it('남자 값이 올바른 레벨로 매핑', () => {
    const m = res.records.find((r) => r.gender === 'M' && r.course === 'SCY' && r.event === '50FR' && r.level === 'AAAA');
    expect(m?.timeMs).toBe(21990);
  });
  it('LCM 코스 분리 저장', () => {
    const l = res.records.find((r) => r.gender === 'F' && r.course === 'LCM' && r.event === '50FR' && r.level === 'B');
    expect(l?.timeMs).toBe(36690);
  });

  it('컨텍스트 없는 데이터 줄은 경고와 함께 스킵', () => {
    const r2 = parsePdfText('31.79 29.49 27.29 26.09 24.99 23.89 50 FR 21.99 22.99 24.19 25.69 27.99 30.99');
    expect(r2.records).toHaveLength(0);
    expect(r2.warnings).toHaveLength(1);
  });
  it('중복 종목은 오류', () => {
    const dup = parsePdfText(`11-12\nSCY\n${'31.79 29.49 27.29 26.09 24.99 23.89 50 FR 21.99 22.99 24.19 25.69 27.99 30.99\n'.repeat(2)}`);
    expect(dup.errors.length).toBeGreaterThan(0);
  });
});

describe('generate', () => {
  const { records } = parsePdfText(FIXTURE);

  it('toTable 중첩 구조', () => {
    const t = toTable(records);
    expect(t.SCY!.F!['11-12']!['50FR']!.B).toBe(31790);
    expect(t.LCM!.M!['11-12']!['50FR']!.AAAA).toBe(25990);
  });
  it('seedJson은 placeholder 없이 실수치', () => {
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
