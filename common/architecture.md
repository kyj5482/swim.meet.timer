# 공통 아키텍처 (AWS)

원칙: **최소 비용으로 시작, 자동 스케일아웃, 사용량 없으면 ≈ $0.**
→ 전면 서버리스. 컨테이너/EC2 금지(운영 부담·고정비). 리전: us-east-1.

```
Mobile App ── HTTPS ──► API Gateway (HTTP API, 단일 도메인 api.*)
                          │  JWT Authorizer(Cognito) · 액세스 로그(correlation-id)
     /auth/*  /records/*  /standards/*  /coach/*  /market/*
        │         │            │            │         │
     Lambda    Lambda       Lambda       Lambda    Lambda      (서비스별 독립 배포)
        └────┬────┴────────────┴──────┬─────┴─────────┘
             ▼                        ▼
        DynamoDB(on-demand)      Bedrock(Claude) · S3(영상) · SES(알림)
```

- **마이크로서비스 경계 = `services/<name>`**: 자체 Lambda·자체 테이블 액세스 패턴·
  자체 CLAUDE.md·자체 배포. 서비스 간 직접 호출 금지 — 필요하면 EventBridge 이벤트
  (`record.saved`, `entitlement.changed`, `plateau.detected`)로 비동기 연동.
- **DB**: DynamoDB 단일 테이블 per 서비스(on-demand). RDB 금지(고정비).
  스키마는 `common/data-model.md`.
- **인증**: Cognito User Pool. 앱→API는 JWT. 서비스 내부에서 역할(swimmer/coach/
  parent)과 리소스 소유권 검사(`_shared/auth`).
- **구독 게이트**: coach/* 는 entitlement 미들웨어 필수.

## 로깅·관측성 (모든 서비스 공통, 예외 없음)

- **Lambda Powertools for TypeScript** 필수: Logger(구조화 JSON), Tracer(X-Ray),
  Metrics(EMF).
- **correlation-id**: 클라이언트가 `x-correlation-id` 전송(없으면 API GW requestId
  사용). 모든 로그 라인·X-Ray 어노테이션·EventBridge 이벤트에 포함 → API 호출부터
  DB 쿼리까지 한 ID로 추적.
- 로그 필드 표준: `{ level, timestamp, service, correlationId, userId?, msg, ...data }`.
  PII(이름·이메일)는 로그 금지.
- CloudWatch Logs Insights 대시보드 + 알람(5xx율, p99, DLQ)은 infra가 소유.

## CI/CD

- GitHub Actions. PR: lint + 단위테스트(전 워크스페이스). main 머지: dev 자동 배포
  (CDK). `v*` 태그: prod 배포(수동 승인 environment) + EAS 앱 빌드.
- AWS 자격증명은 OIDC(장기 키 금지). 시크릿은 SSM Parameter Store.

## 비용 가드

- 모든 스택에 태그 `project=splitlane, stage=`. AWS Budgets 월 알람.
- Lambda 기본 256MB/10s, DynamoDB on-demand, CloudWatch 로그 보존 30일(dev 7일).
