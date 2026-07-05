# Phase G — 이스터 에그 웹 게임: Sharks in the Water!

기획 원본: `docs/09-sharks-game.md`. 모든 티켓은 그 문서의 규칙을 따른다.
상태는 `tickets/README.md` 보드와 함께 갱신.

## 결과 요약 (2026-07-05, 전 티켓 done)
- 게임: `apps/mobile/src/features/game/game.html`(소스) → `npm run build:game`으로
  `gameHtml.ts` 재생성. playwright 봇으로 free25/breast50/fly100+보스/back100+보스/
  im200 **완주 검증**(상어 대피·보스·스프린트·결과·리더보드 주입 포함), 콘솔 에러 0.
- 공정성 수정: 상어 경보 중 생물 산개+스폰 정지, 경보 중 전진 정지(짧은 거리도
  이벤트 완결), 보스/스프린트 전환은 상어 이벤트 종료 후.
- 검증: mobile 71 · records 18 · local-api 23 · timer-core 41 테스트 그린,
  전 워크스페이스 tsc 클린. 잔여: 실기기(Expo Go) 터치 QA, AWS 배포 후 실서버 e2e.

## T-122 — 기획 문서 + 티켓 + API 계약
- 범위: `docs/09-sharks-game.md`(씬·조작·장애물·상어·보스·배지·테마·캐릭터),
  이 파일, README 보드, `common/api-spec.md` §game 추가.
- 수용: 문서만으로 다음 세션이 T-123~T-127을 이어서 구현 가능.

## T-123 — 게임 본체 (단일 HTML5 캔버스)
- 범위: `apps/mobile/src/features/game/game.html` + `scripts/build-game.js`
  → `gameHtml.ts` 생성(커밋). 의존성 0, canvas 2D.
- 씬: title → character select(10명) → intro brief → race(테마 구간·장애물·
  상어 대피·보물 수집) → boss(골키퍼 회피, 시간 보너스) → sprint(연타 추격전)
  → finish/gameover → results.
- 조작: 스와이프 4방향(영법 모션), 1초 홀드 대피/입수(버블 물보라), 연타 스프린트.
- `window.GAME_CONFIG`(stroke/distance/courseUnit) 반영: Lap 수=distance/25,
  IM은 접→배→평→자 자동 전환, HUD에 Lap·시간(1/100)·코인·진행바.
- 수용: 데스크톱 브라우저에서 키보드(화살표/스페이스)로도 완주 가능(개발 편의),
  터치 제스처 동작, 게임오버·완주·보스 보너스 정상.

## T-124 — 이스터 에그 + 웹뷰 연동 (mobile)
- 범위: `react-native-webview`(SDK54 호환 13.15.x) 추가,
  `src/features/game/sharksEgg.ts`(+vitest) — `cs % 11 === 0` 감지,
  AssignView "+ Add Swimmer" 아래 조건부 버튼, `/game` 라우트(WebView 풀스크린,
  GAME_CONFIG 주입, result postMessage 수신), i18n 문자열(en/ko).
- 수용: 배정 화면 기록 중 1/100 더블 숫자가 있을 때만 버튼 노출, 게임 실행·복귀.

## T-125 — 게임 리더보드 API (services/records)
- 범위: `PUT /game/scores` body `{ scoreId, stroke, distance, courseUnit,
  timeMs, character }` 멱등 업서트(사용자당 이벤트별 베스트 유지),
  `GET /game/leaderboard?stroke=&distance=&courseUnit=&scoreId=` →
  `{ items(top10: rank/name/timeMs/badge), me?: { rank, total, percentile,
  badge } }`. 배지 사다리 AAAA1/AAA5/AA15/A30/BB50/B(문서 §3). vitest.
- 수용: 핸들러 라우팅 + 배지 산정 단위 테스트 그린. api-spec과 일치.

## T-126 — 결과 제출 + 배지 UI (mobile)
- 범위: 게임 result 수신 → 로그인(토큰) 시 `/game/scores` 제출 후 leaderboard
  조회 → 웹뷰로 재주입(`postResult`), 게임 결과 화면에 등수·배지·Top10 표시.
  비로그인은 로컬 결과만.
- 수용: 서버 미설정/실패 시에도 게임 결과 화면 정상(그레이스풀).

## T-127 — 퀄리티 라운드 + 검증
- 범위: docs/09 §7 체크리스트 반복 점검(파티클·전환·난이도·텔레그래프),
  playwright로 game.html 스모크(로드·씬 전환·완주 시뮬), 워크스페이스
  typecheck/test 그린, 보드 done 처리.
