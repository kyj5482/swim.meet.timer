# SplitLane — 수영선수 타이머 + AI 코치 플랫폼

1/100초 정밀 수영 훈련 타이머(무료) 위에, 목표 표준기록(USA Swimming Motivational
Times · Futures · Sectionals · 클럽 그룹 조건) 대비 진행률과 향상 가속도를 추적하는
**AI 코치(구독제)** 를 얹는 제품. 선수·코치·부모가 데이터를 공유하고, 정체 시 실제
코치 매칭(마켓플레이스)으로 확장한다.

## 작업 방식 (반드시 지킬 것)

1. **티켓 단위로 작업한다.** `tickets/README.md`가 상태 보드다.
   - 시작 전: 티켓 상태를 `in-progress`로 변경.
   - 완료 후: `done`으로 변경 + 티켓 파일에 결과 요약 1~3줄 추가 + **커밋·푸시**.
   - 토큰이 부족하면 진행 중 내용을 티켓 파일에 메모하고 커밋한다. 다음 세션은
     `tickets/README.md`에서 첫 `in-progress`/`todo` 티켓부터 이어서 한다.
2. **컨텍스트 최소화.** 각 영역(apps/mobile, services/*, infra, packages/*)은 자기
   폴더의 `CLAUDE.md`만 읽고 독립적으로 작업한다. 영역 간 계약은 `common/`의 md가
   유일한 소스다. 다른 영역의 코드를 직접 읽지 말 것.
3. **공통 규약은 `common/`에만 존재한다.** 디자인 → `common/design-system.md`,
   API 계약 → `common/api-spec.md`, 테스트 방식 → `common/testing.md`,
   아키텍처/로깅 → `common/architecture.md`, 표준기록 데이터 → `common/standards/`.
   규약을 바꾸면 common부터 고치고 관련 티켓을 만든다.
4. 커밋 메시지는 `T-0XX: <요약>` 형식.

## 모노레포 지도

| 경로 | 내용 | 컨텍스트 문서 |
| --- | --- | --- |
| `packages/timer-core/` | 순수 TS 타이머 엔진(플랫폼 무관, 완전 테스트) | `packages/timer-core/README.md` |
| `apps/mobile/` | React Native(Expo) iOS/Android 앱 | `apps/mobile/CLAUDE.md` |
| `services/auth/` | 인증·계정·역할(Cognito) | `services/auth/CLAUDE.md` |
| `services/records/` | 기록 동기화·조회 API | `services/records/CLAUDE.md` |
| `services/standards/` | 표준기록·클럽 조건·타겟/진행률 | `services/standards/CLAUDE.md` |
| `services/ai-coach/` | AI 코치 분석(구독 전용) | `services/ai-coach/CLAUDE.md` |
| `infra/` | AWS CDK, CI/CD, 관측성 | `infra/CLAUDE.md` |
| `common/` | 모든 영역이 참조하는 계약 문서 | — |
| `docs/` | 제품 문서(v1 PWA 명세 포함, 참고용) | `docs/README.md` |
| `tickets/` | 작업 티켓 + 상태 보드 | `tickets/README.md` |

## 기술 스택 (결정 사항 — docs/08-native-app-review.md 참조)

- 모바일: **React Native + Expo(custom dev client) + TypeScript**, expo-sqlite,
  EAS Build. 타이머 로직은 전부 `packages/timer-core` 재사용.
- 백엔드: **AWS 서버리스** — API Gateway(HTTP API) + Lambda(Node 22/TS) +
  DynamoDB(on-demand) + Cognito. 사용량 0일 때 비용 ≈ 0, 자동 스케일아웃.
- IaC/CI: AWS CDK(TS) + GitHub Actions. 로깅: Lambda Powertools(구조화 JSON,
  correlation-id 전파, X-Ray 트레이싱).
- AI: Amazon Bedrock(Claude). 결제: 스토어 IAP(RevenueCat) + Stripe Connect(코치 정산).

## 자주 쓰는 명령

```bash
npm install                 # 워크스페이스 전체
npm test -w packages/timer-core
```
