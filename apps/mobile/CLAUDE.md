@AGENTS.md

# apps/mobile — React Native(Expo) 앱

이 폴더에서 작업할 때는 이 문서와 `common/`(design-system, api-spec, data-model,
testing)만 읽는다. 서비스 코드(services/*)는 열지 않는다 — API 계약은
`common/api-spec.md`가 전부다.

## 스택
- Expo SDK 57 + TypeScript + expo-router. 볼륨키 네이티브 모듈(T-105)부터는
  custom dev client 필요(Expo Go 불가).
- 상태: zustand(도입 시). DB: expo-sqlite. 타이머 로직: **`@splitlane/timer-core`
  만 사용** (이 앱에서 배정/스플릿 계산을 재구현하는 것 금지).

## 구조
```
src/
  app/            # expo-router 라우트. 탭 3개(timer=index, events=전체 종목, records=세부 종목)
                  # + 스택: athletes(선수 관리), settings
  theme.ts        # common/design-system.md 토큰의 유일한 구현
  db/             # (T-103) sqlite 스키마·마이그레이션·리포지토리
  sync/           # (Phase 2) records API 동기화
  native/         # (T-105) 볼륨키 키이벤트 모듈 (android/)
  i18n/           # (T-106) en/ko — 기존 PWA 문자열(docs/app/index.html의 S 객체) 이식
```

## 철칙
1. 탭·키 입력의 타임스탬프는 **이벤트가 가진 시각**(nativeEvent.timestamp /
   KeyEvent.getEventTime)을 엔진에 주입한다. 핸들러에서 now()를 새로 읽지 않는다.
2. 측정 화면에서는 리렌더 최소화 — 시계는 별도 컴포넌트에서 rAF로만 갱신.
3. 색·라운드·폰트는 src/theme.ts 밖에서 하드코딩 금지.
4. 모든 신규 로직은 hooks/유틸로 분리해 vitest 단위 테스트(`common/testing.md`).
5. UX 원본은 PWA(docs/app/index.html)와 docs/05-ux-flows.md — 화면 흐름을 임의
   변경하지 않는다.
