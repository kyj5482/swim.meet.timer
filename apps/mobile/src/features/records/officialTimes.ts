/**
 * 공인 기록(SWIMS meet results) 열람 링크 — myswimio Best Times 페이지.
 * 앱이 직접 잰 훈련 기록과 별개로, 등록 선수의 공식 대회 기록을 볼 수 있다.
 */
export function officialTimesUrl(usaId: string): string {
  return `https://www.myswimio.com/besttimes.php?swimmerid=${encodeURIComponent(usaId.trim())}`;
}
