import { describe, expect, it } from 'vitest';

import { CHAMP_LEVELS, CHAMPS } from './championships.data';
import { championshipSteps, levelLabel, standardLadderForGroup } from './standards';

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

  it('모티베이셔널 데이터가 없는 종목도 챔피언십 컷만으로 사다리가 생긴다 (200 IM)', () => {
    // 200 IM은 모티베이셔널 subset에 아직 없지만 레벨이 비는 일은 없어야 한다.
    const ladder = standardLadderForGroup('SCY', 'M', '11-12', 'im', 200);
    expect(ladder).not.toBeNull();
    expect(ladder!.length).toBeGreaterThanOrEqual(CHAMP_LEVELS.length);
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

  it('없는 조합(LCM 등)은 빈 배열/null로 UI에서 숨겨진다', () => {
    expect(championshipSteps('LCM', 'M', 'free', 50)).toEqual([]);
  });
});
