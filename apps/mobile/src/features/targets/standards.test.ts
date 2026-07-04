import { describe, expect, it } from 'vitest';

import { CHAMP_LEVELS, CHAMPS } from './championships.data';
import { MOTIVATIONAL } from './standards.data';
import { championshipSteps, levelLabel, standardLadderForGroup } from './standards';

const MOTIV = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

describe('챔피언십 사다리', () => {
  it('모티베이셔널 위에 챔피언십 컷이 이어 붙는다 (11-12 M 50 Free SCY)', () => {
    const ladder = standardLadderForGroup('SCY', 'M', '11-12', 'free', 50);
    expect(ladder).not.toBeNull();
    const levels = ladder!.map((s) => s.level);
    expect(levels).toContain('B');
    expect(levels).toContain('AAAA');
    expect(levels).toContain('FUT');
    expect(levels).toContain('D1A');
  });

  it('모든 종목이 B~AAAA 기본 + 챔피언십을 함께 갖는다 (200 IM, 100 Breast 등)', () => {
    for (const [stroke, dist] of [['im', 200], ['breast', 100], ['back', 200], ['fly', 100]] as const) {
      const ladder = standardLadderForGroup('SCY', 'M', '13-14', stroke, dist);
      expect(ladder, `${dist}${stroke}`).not.toBeNull();
      const levels = ladder!.map((s) => s.level);
      for (const lv of MOTIV) expect(levels, `${dist}${stroke} ${lv}`).toContain(lv);
      expect(levels).toContain('WZ'); // Far Western 등 챔피언십도 함께
      expect(levels).toContain('D1A');
    }
  });

  it('사다리 전체가 느린→빠른으로 단조(모티베이셔널 B가 가장 느리고 D1A가 가장 빠름)', () => {
    const ladder = standardLadderForGroup('SCY', 'F', '15-16', 'free', 100)!;
    const sorted = [...ladder].sort((a, b) => b.timeMs - a.timeMs);
    expect(sorted[0]!.level).toBe('B');                        // 가장 느림
    expect(sorted[sorted.length - 1]!.level).toBe('D1A');       // 가장 빠름
    // AAAA(모티베이셔널 최상)가 WZ(챔피언십 최하)보다 느려 겹치지 않는다
    const aaaa = ladder.find((s) => s.level === 'AAAA')!;
    const wz = ladder.find((s) => s.level === 'WZ')!;
    expect(aaaa.timeMs).toBeGreaterThan(wz.timeMs);
  });

  it('실측 subset이 있으면 파생값 대신 실측을 쓴다 (11-12 M 50FR SCY)', () => {
    const real = MOTIVATIONAL.SCY!.M!['11-12']!['50FR']!;
    const ladder = standardLadderForGroup('SCY', 'M', '11-12', 'free', 50)!;
    for (const lv of MOTIV) {
      expect(ladder.find((s) => s.level === lv)!.timeMs, lv).toBe(real[lv]);
    }
  });

  it('챔피언십 컷은 레벨 순서대로 단조 감소(빨라진다)', () => {
    for (const [course, byGender] of Object.entries(CHAMPS)) {
      for (const [gender, byEvent] of Object.entries(byGender)) {
        for (const [event, cuts] of Object.entries(byEvent)) {
          const seq = CHAMP_LEVELS.map((l) => cuts[l]).filter((v): v is number => v != null);
          for (let i = 1; i < seq.length; i++) {
            expect(seq[i]!, `${course} ${gender} ${event} step ${i}`).toBeLessThan(seq[i - 1]!);
          }
        }
      }
    }
  });

  it('레벨 표시 이름 — 모티베이셔널은 코드, 챔피언십은 대회명', () => {
    expect(levelLabel('AAAA')).toBe('AAAA');
    expect(levelLabel('WZ')).toBe('Western Zones');
    expect(levelLabel('D1A')).toBe('NCAA D1 A');
  });

  it('SCM/LCM은 SCY에서 파생돼 모든 코스가 사다리를 갖는다', () => {
    const scy = championshipSteps('SCY', 'M', 'free', 50);
    const scm = championshipSteps('SCM', 'M', 'free', 50);
    const lcm = championshipSteps('LCM', 'M', 'free', 50);
    expect(scm.length).toBe(scy.length);
    expect(lcm.length).toBe(scy.length);
    // 미터 환산은 야드보다 느리고, 롱코스는 쇼트미터보다 더 느리다
    expect(scm[0]!.timeMs).toBeGreaterThan(scy[0]!.timeMs);
    expect(lcm[0]!.timeMs).toBeGreaterThan(scm[0]!.timeMs);
  });

  it('500y는 미터 코스에서 400FR로 치환된다 (800FR도 1000y에서 파생)', () => {
    expect(championshipSteps('LCM', 'M', 'free', 400).length).toBeGreaterThan(0);
    expect(championshipSteps('LCM', 'F', 'free', 800).length).toBeGreaterThan(0);
    expect(championshipSteps('SCM', 'M', 'free', 500)).toEqual([]); // 미터 풀에 500 없음
  });

  it('진짜 없는 조합(25FR 등)은 빈 배열로 UI에서 숨겨진다', () => {
    expect(championshipSteps('SCY', 'M', 'free', 25)).toEqual([]);
  });
});
