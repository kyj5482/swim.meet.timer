# @splitlane/timer-core

플랫폼 무관 순수 TS 타이머 엔진. `docs/03-timer-engine.md`의 구현체이며,
앱(apps/mobile)과 백엔드 분석(services/ai-coach)이 동일 로직을 공유한다.

- `TimerEngine` — 라운드 단조매칭(단일 LAP), 레인 직접 탭, Undo, DNF, 스냅샷
  복구, 불변식 검증. **시간을 내부에서 읽지 않는다** — 호출자가 OS 이벤트의
  모노토닉 타임스탬프(ms)를 주입한다.
- `recommend / markLowConfidence / swapSwimmers / improvement` — 측정 후 선수
  배정·저신뢰·PB 판정.
- `fmtClock / fmtSplit / fmtTotal / parseTime` — 1/100초 표시·파싱.

```bash
npm test -w packages/timer-core   # §3.8 TE 시나리오 = 테스트 이름
```

규칙: 이 패키지는 React/RN/AWS 어떤 것에도 의존하지 않는다(zero deps).
엔진 동작을 바꾸면 docs/03과 테스트를 같은 커밋에서 갱신한다.
