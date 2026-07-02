# infra — AWS CDK · CI/CD · 관측성

읽을 문서: 이 파일 + `common/architecture.md`(전체 다이어그램·로깅 표준) +
`common/testing.md` §infra. 담당 티켓: T-201, T-403, T-404.

- CDK(TS) 단일 앱, 스테이지 dev/prod. 스택 분리: `NetworkApiStack`(API GW·도메인·
  authorizer), 서비스별 `ServiceStack`(Lambda+테이블+이벤트 규칙), `ObservabilityStack`
  (대시보드·알람·Budgets).
- 서비스 Lambda는 각 `services/<name>/`의 esbuild 번들을 배포(NodejsFunction).
  infra는 서비스 비즈니스 로직을 모른다 — 핸들러 경로와 라우트만 계약.
- 필수 기본값: 모든 Lambda에 Powertools env(SERVICE_NAME, LOG_LEVEL), X-Ray on,
  로그 보존(dev 7d/prod 30d), DLQ, 태그 project/stage.
- GitHub Actions: OIDC role, PR=synth+test, main=dev 배포, v태그=prod(환경 승인).
- 어떤 리소스도 콘솔 수동 생성 금지 — 전부 코드.
