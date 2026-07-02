# Phase 1 — 무료 네이티브 앱

목표: 현재 PWA(docs/app/index.html)의 모든 기능을 **네이티브 품질**로 iOS/Android에
배포. 무료. 오프라인 우선. 참고: `docs/08-native-app-review.md`, `common/design-system.md`.

## T-101 Expo RN 앱 스캐폴드 + 디자인 토큰
- `apps/mobile/`에 Expo(TypeScript, custom dev client) 생성. expo-router 사용.
- `common/design-system.md`의 토큰을 `apps/mobile/src/theme.ts`로 구현(다크 기본).
- 탭 3개 골격: Timer / Records / Athletes.
- 수용: `npx expo start`로 구동, 탭 전환, 토큰 기반 스타일 적용.
- **결과(done)**: Expo SDK 57 스캐폴드, `src/theme.ts` 토큰, 탭 3개(Timer/Records/
  Athletes), `@splitlane/timer-core` 워크스페이스 연결(Metro 번들 확인,
  `expo export` 성공). 탭 아이콘·폰트(JetBrains Mono/Pretendard)는 T-102에서.

## T-102 타이머 화면 — timer-core 연결
- 설정(코스·종목·거리·스플릿·인원) → 측정(대형 시계, 레인 행 직접 탭 + 단일 LAP
  버튼 + 예측 표시 + Undo) → 배정(추천·향상·PB·맞바꾸기) 3단계. PWA와 동일 UX.
- 탭 타임스탬프는 `e.nativeEvent.timestamp`(터치 발생 시각) 사용 — JS 렌더 지연과
  분리(1/100초 정확도 핵심). `onPressIn`에서 캡처.
- 수용: timer-core 테스트 시나리오 TE-1~TE-12를 화면에서 재현 가능.
- **결과(done)**: `src/features/timer/`에 Setup/Running/Assign + Clock(rAF 분리)
  구현. 탭 시각은 `onPressIn`+`nativeEvent.timestamp`, 표시 시계는 `clockBase`
  오프셋 보정(테스트 포함). 선수/기록 저장은 인메모리 스텁(`roster.ts`) —
  T-103에서 sqlite로 교체. 햅틱·keep-awake는 T-106.

## T-103 로컬 DB (expo-sqlite)
- `common/data-model.md`의 Swimmer/TrainingRecord/SessionLog/AppPrefs 저장.
- 저장 트랜잭션(all-or-nothing), schemaVersion 마이그레이션 틀.
- 수용: 앱 재시작 후 데이터 유지, 세션 저장/삭제/Undo 동작.
- **결과(done)**: `src/db/` — user_version 마이그레이션, swimmers/records/prefs
  리포지토리, 세션 저장 트랜잭션 + 저장취소(tombstone), 시간순 id(newId),
  종목 통계 집계(computeStats, 테스트). Athletes 탭 CRUD(아카이브 삭제),
  마지막 타이머 설정 prefs 복원. 인메모리 스텁(roster.ts) 제거.
  metro.config.js에 wasm(웹 sqlite) 추가. 실기기 재시작 검증은 T-107 빌드에서.

## T-104 기록지/추세 + CSV 내보내기
- 선수별 종목 필터, 베스트/추세 차트, 세션 스플릿 비교(2개 이상 선택).
- expo-sharing으로 CSV 내보내기.
- **결과(done)**: Records 탭 — 선수·종목 필터 필, 도트 트렌드 차트(단일 시리즈,
  베스트·최신만 직접 라벨, 낮을수록 좋음), 세션 목록(Best 배지·tombstone 삭제),
  2개 이상 선택 → 구간 비교 모달, CSV(스플릿 평면화·이스케이프 테스트) 공유.
  차트 실기기 육안 확인은 T-107 빌드에서.

## T-105 볼륨 키 LAP (Android)
- Android: expo-modules 네이티브 모듈로 `onKeyDown`(KEYCODE_VOLUME_DOWN/UP)
  가로채기. `KeyEvent.getEventTime()`(모노토닉)을 그대로 엔진에 전달 — 최고 정밀.
  측정 화면에서만 활성화, 볼륨 UI 억제.
- 수용: 화면을 보지 않고 볼륨 키만으로 3명×4구간 측정 완료(Android 실기기).
- **결과(done)**: `modules/volume-lap/`(Kotlin, repeatCount 필터, eventTime 전달)
  + `plugins/withVolumeLap`(MainActivity 훅 주입, 멱등 — 변환 함수 테스트 3개)
  + RunningView에서 측정 중에만 setEnabled. prebuild로 훅 주입 종단 확인.
  Kotlin 컴파일·실기기 수용 테스트는 T-107 EAS 빌드에서.

## T-108 iOS/공통 외부 리모컨 입력
- iOS: 볼륨 키 가로채기는 심사 거절 사유(가이드라인 2.5.9) → 하드웨어 키보드/BT
  리모컨의 키 이벤트(스페이스/미디어키)를 LAP으로 매핑(UIKeyCommand 또는
  expo 모듈 ios 구현). 설정 화면(T-106)에서 켜고 끔.
- 수용: iPhone + BT 셔터 리모컨으로 eyes-free 측정.

## T-106 앱 폴리시
- expo-keep-awake(타이머 탭 전체), expo-haptics(랩마다),
  RUNNING 중 스냅샷 → 크래시 복구(NFR-7).
- **결과(done)**: 타이머 탭 포커스 동안 keep-awake(START 대기 포함 — PWA 동작
  계승), 랩·볼륨키마다 가벼운 햅틱, 매 탭/Undo 직후 스냅샷 저장 → 재실행 시
  Resume/Discard 제안. 탭 클락(uptime)은 재시작 후에도 이어져 기록 정확도 유지,
  표시 시계만 벽시계 앵커로 추정(restoredClockBase, 테스트 포함).

## T-109 i18n(en/ko) + 설정 화면
- PWA(docs/app/index.html S 객체)의 en/ko 문자열 전체 이식, 언어 토글.
- 설정 화면: 언어, 코스 기본값, 볼륨키 LAP 켬/끔(Android), 사운드/햅틱.

## T-107 EAS Build + 배포 파이프라인
- eas.json(dev/preview/production), GitHub Actions: PR마다 lint+test,
  main 태그 시 EAS build → TestFlight/Play 내부 트랙 제출.
- 수용: 태그 푸시만으로 양 스토어 내부 테스트 배포.
- **결과(done — 파이프라인 코드)**: `apps/mobile/eas.json` 3개 프로필,
  `.github/workflows/mobile-build.yml`(v* 태그 → production 빌드+제출,
  수동 실행 → preview APK). **사용자 수동 1회 설정 필요**:
  1) expo.dev 계정 → `npx eas init` (projectId가 app.json에 기록됨)
  2) expo.dev Access Token 발급 → GitHub 저장소 시크릿 `EXPO_TOKEN` 등록
  3) `npx eas credentials`로 iOS(App Store Connect API Key)·Android(서비스 계정
     JSON) 제출 자격증명 연결 — 이후 태그 푸시만으로 빌드·제출
  4) 첫 dev client 빌드: `npx eas build --profile development --platform android`
     → 설치 후 볼륨키 LAP·SQLite 재시작 유지·햅틱·복구 실기기 수용 테스트
     (T-102/103/105/106의 실기기 검증 항목이 여기서 수행됨)
