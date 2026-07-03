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

## T-112 온디바이스 타겟·진행률 (제품 핵심 차별점 — myswimio 대비)
- 백엔드 없이 앱에서 먼저 "타겟을 정하면 현재 %인지, 잘 가고 있는지"를 보여준다.
  Phase 2 백엔드(로그인·동기화·공식 표준 임포트)는 이후 이 위에 얹는다.
- **결과(done)**:
  - `packages/timer-core/progress.ts`(순수·테스트 13개): achievement(달성%),
    ladderPosition(표준 사다리 위치), improvementSlopePerDay(회귀 기울기),
    acceleration(향상 가속도), projectTargetDate/trajectory(도달 예상일·on-track).
    수치는 코드가 계산(LLM 아님 — 향후 AI 코치의 결정적 기반).
  - `features/targets/standards.ts`: USA Swimming 2024-2028 SCY Motivational
    **검증값**(여자 11-12: 50 Free/100 Free, 실제 값) + 구조상 확장 가능.
    NOVA 클럽 그룹(Silver/Gold) 조건이 표준 레벨→실제 시간으로 해석됨.
    전체 공식 임포트는 T-204(백엔드).
  - `features/targets/TargetCard.tsx`: 달성률 게이지, 궤적 칩(순항/예상일/주간
    개선/가속), 표준 사다리(B→AAAA, 현재 위치 강조). 설정 시트: 표준 레벨 /
    직접 입력 + 목표 날짜(없음/3개월/6개월).
  - DB v3: swimmers.gender 추가 + targets 테이블(선수×종목). Athletes 편집에
    성별 토글. 시드 선수 전원 여자로 지정해 11-12 표준이 즉시 매칭.
  - 검증: Records에서 도윤 50 Free에 AA(26.09) 타겟 → 110.1% 달성·▼0.20/주·
    Accelerating·사다리 전부 통과 표시(스크린샷 확인). 테스트 timer-core 32개·
    앱 21개·typecheck·android 번들 통과.

## 백엔드 스캐폴드 (T-201/T-203/T-204 — Phase 2 착수)
- **infra/ (CDK, T-201)**: `bin/app.ts` + DataStack(DynamoDB 3테이블 on-demand:
  Users/Records/Standards + Records byEvent GSI; Cognito User Pool + `custom:role`
  선수/코치/부모, 클라이언트) + ApiStack(HTTP API GW v2, Cognito JWT authorizer,
  표준 라우트는 공개·records는 인증, NodejsFunction, X-Ray Active, Powertools env,
  로그 보존 dev7/prod30, project/stage 태그). dev/prod 스테이지. `cdk synth`
  assertion 테스트 3개 통과.
- **services/_shared**: Powertools 구조화 로거(correlation-id 부착),
  http 응답 규약(ok/fail/에러코드), Cognito 클레임 파싱(auth), DynamoDB
  DocumentClient. 테스트 5개.
- **services/standards (T-204)**: `data.ts`(검증된 여자 11-12 SCY 50/100 Free +
  NOVA 클럽 그룹, 확장 구조) → `importer.ts`(DynamoDB 배치 적재 = "미리 읽어와서
  업데이트" 잡, 멱등, EventBridge/CLI 실행) → `handler.ts`(GET /v1/standards,
  /v1/standards/clubs/{clubId}/groups). 테스트 5개. 공식 전체 PDF 파서 연결 시
  같은 잡이 전 종목/연령/성별 적재.
- **services/records (T-203)**: `handler.ts`(PUT /v1/records/batch 멱등 업서트
  last-write-wins, GET /v1/records?swimmerId=&since= 델타·tombstone), zod 검증,
  선수 파티션+updatedAt#id 정렬 키. 테스트 6개(인증 401 포함).
- 전 워크스페이스 테스트: timer-core 32 · 앱 21 · shared 5 · standards 5 ·
  records 6 · infra 3 = 72개 통과. 배포는 사용자 AWS 계정+OIDC 연결 후
  `cdk deploy`(T-201 문서 절차).
- 잔여: 앱↔records 동기화 클라이언트, /auth API·초대(T-206), ai-coach(Phase 3),
  공식 표준 전량 임포트, 관측성 대시보드/알람(T-403).

## Mac 로컬 백엔드 실행 (AWS 계정 불필요)
사용자 요청: "Mac에서 백엔드를 실행할 수 있는 방법은?" → 완전 로컬 방식 선택.
- **tools/local-api**: `services/records`·`services/standards`의 **실제 Lambda
  핸들러**를 그대로 불러와 Express로 감싼 로컬 서버. 로직 이중 구현 없음 —
  여기서 통과하면 AWS 배포본도 동일하게 동작.
  - `adapter.ts`: Express req ↔ API Gateway v2 이벤트/응답 변환(순수 함수,
    테스트 7개). 인증은 `x-dev-user`/`x-dev-role` 헤더로 Cognito JWT claims를
    흉내(로컬 전용, AWS 미배포).
  - `setup.ts`: DynamoDB Local에 테이블 생성(멱등) + 표준기록 임포터 실행.
  - `server.ts`: 동적 import로 env(DYNAMODB_ENDPOINT/RECORDS_TABLE/
    STANDARDS_TABLE) 확정 후 핸들러 로드 — 정적 import 호이스팅 문제 회피.
  - `docker-compose.yml`: DynamoDB Local.
- **services/_shared/table-schema.ts** 신설: 테이블 pk/sk/GSI 정의를 CDK
  (`infra/lib/data-stack.ts`)와 로컬 세팅이 공유 — 로컬/AWS 스키마 불일치 방지.
- **검증**: 이 세션 환경엔 Docker 데몬이 없어(사용자 Mac에서는 있음) 실제
  DynamoDB Local 연동은 못 돌렸지만, 서버를 기동해 `/health`(200) 확인 +
  `/v1/standards` 호출이 핸들러까지 정확히 도달해 `ECONNREFUSED
  127.0.0.1:8000`(DynamoDB Local 부재)로 실패하는 것을 확인 — Express→어댑터→
  동적 import→Lambda 핸들러→구조화 로거→DynamoDB 클라이언트 배선이 전부 정상.
  어댑터 로직은 단위 테스트 7개로 커버.
- 사용법: `tools/local-api/README.md`. 루트 스크립트 `npm run local:up/setup/api/down`.
- 전 워크스페이스 테스트 79개 통과(timer-core 32·앱 21·shared 5·standards 5·
  records 6·infra 3·local-api 7).
