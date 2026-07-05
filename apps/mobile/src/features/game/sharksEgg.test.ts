import { describe, expect, it } from 'vitest';

import { isDoubleCentis, sharksEggActive } from './sharksEgg';

describe('isDoubleCentis', () => {
  it('1/100초 두 자리가 같은 숫자면 true (00,11,…,99)', () => {
    expect(isDoubleCentis(61_000)).toBe(true); // 1:01.00
    expect(isDoubleCentis(61_110)).toBe(true); // .11
    expect(isDoubleCentis(5_220)).toBe(true); // .22
    expect(isDoubleCentis(5_330)).toBe(true); // .33
    expect(isDoubleCentis(9_990)).toBe(true); // .99
  });

  it('다른 숫자면 false', () => {
    expect(isDoubleCentis(61_120)).toBe(false); // .12
    expect(isDoubleCentis(5_010)).toBe(false); // .01
    expect(isDoubleCentis(5_100)).toBe(false); // .10
    expect(isDoubleCentis(12_345)).toBe(false); // .34
  });

  it('ms 하위 자리(1/1000초)는 무시한다', () => {
    expect(isDoubleCentis(5_223)).toBe(true); // .22|3
    expect(isDoubleCentis(5_129)).toBe(false); // .12|9
  });

  it('경계·이상값', () => {
    expect(isDoubleCentis(0)).toBe(true); // .00 — 리스트 판정에서 0은 제외됨
    expect(isDoubleCentis(-100)).toBe(false);
    expect(isDoubleCentis(NaN)).toBe(false);
    expect(isDoubleCentis(Infinity)).toBe(false);
  });
});

describe('sharksEggActive', () => {
  it('하나라도 더블 숫자면 활성화', () => {
    expect(sharksEggActive([61_120, 5_220])).toBe(true);
    expect(sharksEggActive([61_120, 33_450])).toBe(false);
  });
  it('0(미기록)은 무시', () => {
    expect(sharksEggActive([0])).toBe(false);
    expect(sharksEggActive([])).toBe(false);
  });
});
