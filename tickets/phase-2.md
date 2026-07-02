# Phase 2 — 계정·동기화·타겟

목표: 로그인/역할, 기록 클라우드 동기화, 표준기록 DB와 타겟 진행률.
계약: `common/api-spec.md`, `common/architecture.md`, `common/standards/README.md`.

## T-201 infra 부트스트랩
- `infra/`에 CDK(TS) 앱: dev/prod 스테이지, HTTP API Gateway 1개(도메인
  `api.<domain>`), 서비스별 Lambda 라우팅 `/auth/* /records/* /standards/* /coach/*`.
- 로깅 베이스라인: Lambda Powertools(Logger/Tracer/Metrics), 구조화 JSON,
  `x-correlation-id` 헤더 수용·생성·전파, X-Ray 활성화, CloudWatch 대시보드 뼈대.
- CI: GitHub Actions OIDC로 AWS 배포(dev 자동, prod 수동 승인).
- 수용: `GET /health`가 dev에 배포되고 로그에 correlation-id가 남는다.

## T-202 auth 서비스
- Cognito User Pool: email+소셜(후순위), 커스텀 속성 `role`(swimmer|coach|parent).
- 미성년 선수 계정은 부모 계정에 종속(COPPA 고려 — 13세 미만은 부모가 생성).
- 공용 JWT authorizer(API GW) + `services/_shared/auth.ts`(클레임 파싱).
- API: `POST /auth/profile`, `GET /auth/me`. DynamoDB `Users` 테이블.
- 수용: 가입→로그인→`GET /auth/me` 역할 반환, 무단 접근 401.

## T-203 records 서비스
- DynamoDB 단일 테이블(`common/data-model.md` §백엔드): 기록 업로드는 멱등
  (클라이언트 UUID), last-write-wins, 삭제는 tombstone.
- API: `PUT /records/batch`, `GET /records?since=` (델타 동기화),
  `GET /swimmers/{id}/records?event=`.
- 앱: 로그인 시 백그라운드 양방향 동기화(오프라인 우선 유지).
- 수용: 두 기기 간 동기화 시나리오 통합 테스트.

## T-204 standards 서비스
- `common/standards/`의 스키마로 DynamoDB `Standards` 적재. 임포터 스크립트:
  USA Swimming 2024-2028 Motivational(B~AAAA, SCY/LCM, 에이지그룹) 공식 PDF/CSV,
  Futures/Sectionals 시즌 파일, 클럽 그룹 조건(NOVA 시드 포함).
- API: `GET /standards?authority=&season=&course=&age=&gender=&event=`,
  `GET /standards/clubs/{club}/groups`.
- 수용: 임포트 검증 테스트(총 개수·샘플 값 대조), API 조회.

## T-205 앱: 타겟 선택 + 달성 %
- 선수 프로필에 소속 클럽·타겟 설정(예: "NOVA AG Silver 진입", "Futures 100 Free").
- 달성 % = `target_time / current_best`(myswimio 방식) + 표준 레벨 사다리에서
  현재 위치. 무료: 타겟 1개 %만. 구독: 궤적/가속도(Phase 3).
- 수용: 타겟 선택 → 기록 저장 때마다 % 갱신.

## T-206 공유(코치·부모)
- 초대 코드/링크 → 열람 권한(REL 테이블: viewer↔swimmer). 부모=쓰기, 코치=읽기+메모.
- 수용: 부모 계정이 선수 기록을 보고, 권한 해제 가능.
