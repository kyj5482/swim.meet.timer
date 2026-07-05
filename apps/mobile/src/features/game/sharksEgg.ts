/**
 * 이스터 에그 트리거 (docs/09-sharks-game.md §1)
 * 배정 화면 기록의 1/100초 두 자리가 같은 숫자(00,11,…,99)면 활성화.
 */

/** ms 기록의 1/100초 두 자리가 더블 숫자인지. 음수/비유한 값은 false. */
export function isDoubleCentis(ms: number): boolean {
  if (!Number.isFinite(ms) || ms < 0) return false;
  const cs = Math.floor(ms / 10) % 100;
  return cs % 11 === 0;
}

/** 슬롯 최종 기록들 중 하나라도 더블 숫자면 이스터 에그 활성화. 0(미기록)은 제외. */
export function sharksEggActive(lastCumMsList: number[]): boolean {
  return lastCumMsList.some((ms) => ms > 0 && isDoubleCentis(ms));
}
