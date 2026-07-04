import { describe, expect, it } from 'vitest';

import { collegeGuidance } from '../src/college-guidance.js';

describe('collegeGuidance — 학교 적합도 + 나이별 준비', () => {
  it('학업 백분위가 높으면 일부 학교가 match/safety로 판정', () => {
    const g = collegeGuidance(
      'recruit-d3', { mathPct: 95, elaPct: 93, apCourses: ['AP Calc', 'AP Bio', 'AP Eng'] },
      [{ name: 'Robotics', role: 'Captain', years: 3 }], ['michigan', 'emory'], 16,
    );
    expect(g.academicPct).toBe(94);
    const fits = new Set(g.fits.map((f) => f.fit));
    expect([...fits].some((f) => f === 'match' || f === 'safety')).toBe(true);
  });

  it('낮은 백분위 + 최상위 학교는 reach로 판정하고 강화 제안', () => {
    const g = collegeGuidance('developing', { mathPct: 70, elaPct: 68 }, [], ['uchicago'], 15);
    const uc = g.fits.find((f) => f.school.id === 'uchicago')!;
    expect(uc.fit).toBe('reach');
    expect(uc.prep.join(' ')).toMatch(/AP|activity|essays|rigor/i);
  });

  it('나이에 따라 로드맵 단계가 달라진다', () => {
    expect(collegeGuidance('club', { mathPct: 80, elaPct: 80 }, [], [], 11).roadmap[0]!.stage).toMatch(/Middle/);
    expect(collegeGuidance('club', { mathPct: 80, elaPct: 80 }, [], [], 17).roadmap[0]!.stage).toMatch(/Upper/);
  });

  it('타겟 미지정이면 전체 시드 학교로 안내', () => {
    const g = collegeGuidance('club', { mathPct: 85, elaPct: 85 }, [], [], 16);
    expect(g.fits.length).toBeGreaterThanOrEqual(5);
  });

  it('공식 데이터 아님을 note로 고지', () => {
    const g = collegeGuidance('club', { mathPct: 85, elaPct: 85 }, [], ['uva'], 16);
    expect(g.note).toMatch(/not official|seed/i);
  });
});
