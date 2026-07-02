# 공통 테스트 규약

러너: **vitest** (전 워크스페이스 동일). 각 워크스페이스 `npm test`로 실행,
루트 `npm test --workspaces --if-present`가 CI 기본.

| 레이어 | 방식 |
| --- | --- |
| packages/* | 순수 단위 테스트. timer-core는 `docs/03-timer-engine.md` §3.8 TE-1~13을 테스트 이름으로 유지 |
| apps/mobile | 로직은 hooks/유틸로 분리해 단위 테스트. 화면은 최소한의 react-native-testing-library. e2e(Maestro)는 릴리스 전 수동 트리거 |
| services/* | 핸들러 단위 테스트(이벤트 페이로드 → 응답). DynamoDB는 로컬 모킹(aws-sdk-client-mock). 통합 테스트는 dev 스테이지에 대해 태그된 스위트만 |
| infra | `cdk synth` 스냅샷 + assertions(리소스 정책·로그 설정 존재) |

규칙
1. 티켓 완료 = 수용기준이 테스트로 존재하고 통과. 테스트 없는 `done` 금지.
2. 타이밍 로직은 **가짜 클락 주입**(now를 인자로) — sleep 기반 테스트 금지.
3. 스냅샷 테스트는 결정적 데이터만(랜덤/시각 고정).
4. 커버리지 수치보다 불변식(§3.5)·경계 케이스 우선.
