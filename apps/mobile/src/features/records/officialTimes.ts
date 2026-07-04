/**
 * 공인 기록(SWIMS meet results) 열람 링크 — myswimio Best Times 페이지.
 * 앱이 직접 잰 훈련 기록과 별개로, 등록 선수의 공식 대회 기록을 볼 수 있다.
 */
export function officialTimesUrl(usaId: string): string {
  return `https://www.myswimio.com/besttimes.php?swimmerid=${encodeURIComponent(usaId.trim())}`;
}

/**
 * SplitLane Cloud 웹 서비스 베이스 URL — 계정 생성·코치 대시보드로 이동.
 * 개발 중 apiBaseUrl(예: http://host:4000/v1)이 설정돼 있으면 그 호스트의 /web,
 * 아니면 프로덕션 웹 서비스. path를 붙여 특정 화면으로 이동한다.
 */
const PROD_WEB = 'https://app.splitlane.swim';
export function webBaseUrl(apiBaseUrl: string): string {
  const api = apiBaseUrl.trim();
  if (api) {
    const root = api.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    return `${root}/web`;
  }
  return PROD_WEB;
}

