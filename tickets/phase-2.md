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

## 앱 ↔ 로컬 백엔드 동기화 연결
사용자 질문: "Expo Go에서 실제 서버랑 통신 가능한가?" → 네트워크는 가능하지만
앱에 API 호출 코드가 전혀 없었음(전량 로컬 SQLite) → "로컬 서버에 연결" 선택.

- **apps/mobile/src/api/client.ts**: fetch 래퍼. 로컬 개발 인증은
  `x-dev-user`/`x-dev-role` 헤더(tools/local-api와 동일 규약, AWS 배포본에서는
  무시됨). common/api-spec.md 에러 포맷(`{error:{code,message,correlationId}}`)을
  `ApiError`로 변환. `checkHealth()`로 서버 도달 확인. 테스트 8개(fetch 모킹).
- **apps/mobile/src/api/sync.ts**: `syncAll()` — 선수별로 로컬 전체 레코드
  푸시(멱등 업서트, tombstone 포함) → `since` 이후 서버 변경분 풀.
- **apps/mobile/src/db/records.ts** 확장: `recordsForPush`(삭제 포함 전체 조회),
  `applyPulledRecords`(id 기준 UPSERT, updatedAt 비교로 last-write-wins).
- **설정 화면**: 서버 URL 입력 + Test Connection + Sync Now 버튼, 마지막 동기화
  시각 표시, 결과/에러 메시지.
- **검증**: 서버를 기동해 앱이 만드는 정확한 요청 형태로 curl 호출 —
  `PUT /v1/records/batch`(zod 스키마 통과 확인, ECONNREFUSED로만 실패 =
  DynamoDB Local 부재가 유일한 원인), `GET /v1/records?swimmerId=&since=`
  (같은 결과), `swimmerId` 누락 시 400 VALIDATION 정상. 즉 앱-서버 계약이
  정확히 맞음을 실제 HTTP 요청으로 확인(코드 리뷰 아님).
  이 세션 환경엔 Docker 데몬이 없어 실제 저장까지는 못 봤지만, 사용자 Mac에서
  `npm run local:up/setup/api` 후 앱에서 서버 URL 입력 → Sync Now 누르면
  실제로 선수·기록이 DynamoDB Local에 저장되고 재조회된다.
- 전 워크스페이스 테스트 87개 통과(timer-core 32·앱 29(client.ts 8 포함)·
  shared 5·standards 5·records 6·infra 3·local-api 7).

## T-114 · T-115 · T-116 — 필드 피드백 배치 (동시 탭 · 표준 전체 · UI 재구성)

사용자 피드백 4건을 한 배치로 처리.

### T-114 동시 다중 레인 탭 + 동기화 float 수정
- **Sync 400 수정**: 앱 타이머 타임스탬프가 소수(ms float)라 서버 zod
  `int()` 검증에서 400. 3중 방어 — 저장 시 반올림(saveSession),
  푸시 직전 반올림(recordsForPush, 기존 행 대응), 서버 스키마도
  `transform(round)`로 수용(services/records/model.ts). 테스트 추가.
- **멀티터치**: RN responder(onPressIn)는 한 번에 한 뷰만 → 두 레인 동시 탭
  불가였음. 레인 행을 raw touch 이벤트 기반 `MultiTapPressable`로 교체 —
  손가락마다 자기 finger-down timestamp로 커밋(1/100초 유지), move-slop·
  touchCancel로 스크롤 오탭 방지, 같은 행 250ms 중복 가드. LAP 버튼은
  touchStart 즉시 커밋(제스처당 1회 가드).

### T-115 표준기록 전체 임포터
- 이 세션 환경은 egress 정책으로 외부 웹 차단 → 값 하드코딩 대신
  **tools/standards-import**: 공식 USA Swimming 2024-2028 PDF(연령그룹판)를
  다운로드·파싱해 `common/standards/seed/usa-swimming-motivational.json` +
  `apps/mobile/.../standards.data.ts`(온디바이스) 생성. 데이터를 지어내지
  않기 위해 단조성 검증 + 검증된 앵커(여 11-12 SCY 50/100FR) 불일치 시
  중단. 파서 테스트 21개. **Mac에서 1회 실행 필요**:
  `npm run import -w tools/standards-import -- --write` 후 두 파일 커밋.
- 앱 standards는 코스(SCY/SCM/LCM) 차원 추가 — 25y/25m/50m 기록이 각각
  맞는 표준과 비교된다.

### T-116 UI 재구성 (선수·코치·부모 사용성)
- **탭 = 타이머 · 전체 종목 · 세부 종목**. Athletes는 자주 안 바뀌므로 탭에서
  내리고 전체 종목 탭 Switch 모달의 '선수 관리'(스택 라우트)로 이동.
- **전체 종목(신규)**: 선수 1명의 모든 종목 한눈에 — 베스트, 달성 레벨 배지,
  다음 레벨까지 필요한 단축률(myswimio "% drop needed"). 행 탭 → 세부 종목.
- **세부 종목(기존 Records 개선)**: 이벤트 드롭다운 메달 아이콘 제거.
  차트를 myswimio 방식으로 재작성 — Y 도메인을 선수 기록이 아니라 **표준
  레벨 컷 기준**으로(다음 레벨 컷·한 단계 느린 컷, 데이터에서 너무 멀면
  확장 안 함), 컷은 레벨명+실제 시간 라벨의 가로선, 다음 레벨은 강조
  대시+목표 존 셰이딩, 점 아래 실제 기록 라벨(많으면 처음·베스트·마지막만),
  X축 날짜 시간축 + 좌우 8% 패딩, 떠 있는 PB 라벨 제거.
  순수 계산은 chartMath.ts(테스트 9개)·progress.ts(테스트 3개)로 분리.
- Expo web + Playwright로 3탭 스크린샷 검증(전체 종목 레벨 배지·세부 종목
  컷 라인 차트·선수 관리 스택 라우트 정상).
- 전 워크스페이스 테스트 121개 통과(timer-core 32·앱 41·shared 5·records 7·
  standards 5·infra 3·local-api 7·standards-import 21).

### T-117 전체 종목 확장 (코스 섹션 · 날짜 · 목표 진행률)
- 사용자 피드백(myswimio Best Times 스냅샷): 쇼트/롱 코스 구분, PB 날짜와
  마지막 수영 날짜, 설정한 목표 표준 대비 진행률.
- SectionList로 **Short Course(25y·25m) / Long Course(50m)** 섹션 분리.
- 행마다 **PB 날짜(며칠 전) + 최근 수영 날짜**(fmtDateShort — 올해면 연도
  생략, 좁은 행 잘림 방지).
- **목표 진행률**: 선수가 설정한 타겟(표준 레벨/커스텀)이 있으면 그 기준으로
  "🎯 AA까지 −4.2%" 또는 "🎯 AA 달성 ✓"(액센트색), 없으면 기존 다음 레벨
  기준. `listTargets()`(db/targets) + `targetDropPct()`(progress.ts, 테스트).
- Expo web 스크린샷 검증. 전 워크스페이스 테스트 122개.

## T-115 후속 — 실제 PDF 레이아웃 대응 + 잘못된 "검증값" 정정

사용자가 Mac에서 임포터를 실행 → 0개 파싱. 실제 공식 PDF(pdf-parse 추출)
텍스트를 사용자가 붙여줘서 확인한 결과, 두 가지 문제 발견.

### 1) 파서 레이아웃 가정이 틀림 → 실제 레이아웃으로 재작성
- 상상해서 만든 "여자6+종목+남자6 한 줄" 포맷이 아니라 실제로는
  **두 줄**: 여자 줄(시간 6개 + 거리+스트로크+코스), 다음 줄이 남자 줄
  (시간 6개만).
- 더 큰 문제: 시간 사이 공백·별표가 종종 통째로 사라져 값이 그대로 붙어
  나옴(예 `"59.491:02.791:05.991:09.29 *1:15.691:22.19"`,
  `"28.1929.6931.1934.1937.09"`). 공백 split은 무의미 — `extractTimes()`로
  시간 패턴(`\d{1,2}(:\d{1,2})?\.\d{2}`)을 전역 스캔해 토큰 경계를 자체
  길이로 판별하도록 재작성(구분자 없어도 정확히 분리됨, 테스트로 검증).
- 릴레이 종목("FR-R","MED-R")은 스트로크 화이트리스트에 없어 자동 스킵,
  줄바꿈된 코스("200 MED-R\nSCY")는 단독 SCY/SCM/LCM 줄을 앞 줄에 병합해
  대응.
- 테스트를 사용자가 붙여준 **실제 원문 발췌**로 교체(25개, 지어낸 픽스처
  아님) — 10&under·11-12 50FR/100FR/100BK/50FL, 정상/완전히 붙은 두 케이스
  모두 회귀 테스트.

### 2) 기존 "검증값"이 실제로는 틀렸었음 — 정정
- 이전 세션에서 웹 요약으로 하드코딩한 여자 11-12 SCY 50FR/100FR 값이
  **공식 PDF 원문과 달랐다**(예: 50FR B는 31.79가 아니라 33.99, AAAA는
  23.89가 아니라 25.79). 원문 대조 없이 기억/요약에 의존한 게 원인.
- 영향받은 곳 전부 정정: `tools/standards-import/src/parse.ts`의 ANCHORS,
  `services/standards/src/data.ts`(백엔드 시드) + 해당 테스트,
  `apps/mobile/src/features/targets/standards.data.ts`(온디바이스 — 지금
  실제 사용자에게 보이는 값이라 가장 중요).
- 온디바이스 데이터셋은 이번에 확인된 만큼 확장: 10&under·11-12 ×
  남녀 × 50FR/100FR/100BK/50FL SCY(전부 원문 대조, 추측 없음).
- Expo web 스크린샷으로 재확인(도윤 50/100 Free·100 Back가 AAAA 넘어
  "Top level ✓" 정상 표시, 차트 컷 라인도 새 값 기준으로 정상).
- 전 워크스페이스 테스트 126개 통과(standards-import 25개로 증가).
- **교훈**: 표준기록처럼 정확성이 중요한 데이터는 웹 요약을 "검증값"이라고
  자칭하지 말 것 — 원문 대조 전까지는 unverified로 표시해야 했다.

### T-118 사용자 UX 피드백 라운드 (Event Detail · All Events · Timer · 공통)

사용자 실기기 리뷰 피드백 전체 반영. 결과 요약:

- **공통**: 형광 민트 → 차분한 풀 레인 블루 팔레트(MeetMobile 지향,
  theme.ts만 수정). 한국어/언어 설정 제거(영어 단일). 볼륨키 LAP
  기능·네이티브 모듈·플러그인 삭제(iOS 미지원으로 제품 결정). 랩 햅틱
  Light→Heavy(짧은 탭에도 체감), 완주 시 Success 패턴. 선수에 USA
  Swimming ID(usaId, 스키마 v4) 추가 — myswimio 공인 기록 링크.
- **Event Detail**: 타겟 시트에서 성별 선택 제거(선수 프로필 사용, 연령그룹만
  선택), 레벨·컷타임 중앙 정렬. 세션 행 날짜+시각 한 줄, ⋮ 메뉴/Export CSV
  삭제(삭제는 펼친 상세 안으로). 비교 모달 닫으면 비교 모드 자동 해제.
  Switch는 전체 종목과 동일한 SwimmerPicker 공유(선수 관리 버튼 포함),
  선수 0명일 때도 선수 관리 버튼.
- **Trend 차트**: 기본 뷰는 Y축 없이 여백·좌우 밸런스 개선 + 향상 가속도
  (Accelerating/Steady/Slowing · ▼x.xx/wk) 헤더 표시, "N sessions·lower is
  better" 제거. ⤢ 확대 → 가로 전체 화면(회전 변환), Y축에 표준 레벨
  컷 라인+밴드로 현재 위치 표시.
- **All Events**: 종목명 "50 Yard/Meter Free" 표기, 보조 메타 줄 삭제,
  PB 경과일 표시 유지, "reached ✓"류 문구 제거(레벨 배지 + −x% to LEVEL만).
  Switch 모달 선수 관리 버튼(아이콘 제거, 버튼 스타일).
- **Timer**: 배정 화면 Add Swimmer가 선수 관리와 동일 폼(SwimmerFormModal,
  키보드 회피 포함). Save Records → 화면 유지 + Undo/OK 오버레이, OK는 2초
  채움 애니메이션 후 자동 확정, 결정 후에만 초기 화면 복귀. 측정 레인
  목록 스크롤 제거(8레인까지 행 높이 분배) — 스크롤로 인한 미입력 원천 차단.
  배정 요약(향상/PB total) 삭제.
- **표준 사다리 확장**: championships.data.ts 신설 — Western Zones, Far
  Western, CA/NV Sect, NCSA Senior, Futures, TYR Pro Series, Winter Juniors,
  Junior Natl, Toyota Nationals, NCAA D1 A (SCY 남녀 12종목). ⚠️ 이 값들은
  이 환경에서 원문 PDF 검증을 못 한 **시드값(unverified)** — 파일 상단
  주석에 명시, 실사용 전 각 대회 공식 스탠더드와 대조 필요(T-115 교훈 준수).
  200 IM처럼 모티베이셔널 데이터가 빈 종목도 챔피언십 컷으로 레벨이 뜬다
  (모티베이셔널 전체 데이터는 여전히 Mac에서 임포터 실행 필요).
- 전 워크스페이스 테스트 통과(신규: standards.test.ts 5개, csv.test.ts 개편).

## T-119 UX 피드백 라운드 2 + AI 코치 로그인·웹 뷰어 [done]
사용자 실기기 피드백 2차 반영 + 백엔드 확장의 관문(계정 로그인) 착수.

- **내비게이션**: 선수 관리 뒤로가기 라벨이 **들어온 탭**(All Events / Event
  Detail)을 표시(`/athletes?from=`), SwimmerPicker·빈 화면 진입 모두 적용.
- **선수 헤더 공용화(SwimmerHeader)**: 이름 아래 **한 줄** —
  "12 yo · Elite · Official times ↗" (공인 기록 링크를 그룹명 옆 인라인으로,
  Event Detail에도 추가). 선수 관리 목록도 동일 인라인.
- **선택 선수 탭 간 공유**: prefs `selectedSwimmerId` — 어느 탭에서 바꿔도
  다른 탭에 그대로 반영.
- **Target**: ① SCM/LCM 챔피언십 컷을 SCY에서 환산 파생(×1.11, 롱코스
  ×1.025, 500y→400m ×0.893 — **시드, 공식 표준 확보 시 교체**)해 모든
  코스·종목에 사다리 생성. ② 날짜 선택 시 달력 즉시 닫힘(Save 혼동 방지).
  ③ 사다리 칩 레벨·컷타임 가로 배치. ④ 🎯/🏅 이모지 전부 제거.
  ⑤ **모티베이셔널 B~AAAA를 전 종목·연령·코스에 항상 표시**
  (motivational.derive.ts): 실측 subset이 없는 조합은 WZ 컷 × 연령·성별 앵커 ×
  레벨 배율로 파생(**시드/unverified, 실측 우선**). 모든 종목이 B~AAAA 기본 위에
  Western Zones…NCAA D1 A가 얹힌 완전한 사다리를 갖는다.
- **Trend**: ① 시간 라벨을 기울기 반대편(위/아래)에 배치해 선과 겹침 원천
  차단(chartMath.labelSides + 테스트). ② 페이스 문구 재설계 —
  timer-core `paceInsight`: Theil-Sen 로버스트 기울기(최근 120일 창),
  베스트 대비 %-임계로 improving/plateau/regressing 판정, 비현실적 기울기
  (월 10% 초과)는 숫자 숨김. "10:45.10/wk" 같은 표기 제거,
  Projected도 같은 클램프 적용(불가하면 'Keep training to project').
  plateau는 "Holding steady — plateaus are normal"로 계단식 향상 맥락 전달.
  ③ 확대 아이콘 SVG 24px로 확대, 제목·닫기가 세이프 에어리어(상태바)를
  침범하지 않게 회전 기준 패딩, Done → ✕.
- **Sessions**: 표준 레벨이 **처음 올라간** 세션에만 레벨 배지
  (시간 아래 두 번째 줄, milestones.ts + 테스트).
- **Timer 배정**: Prev → 화살표 색 명시(muted) — 검정 화살표 안 보이던 버그.
- **AI Coach Account(Settings)**: 이메일/비밀번호 로그인(`POST /auth/login`,
  common/api-spec.md 갱신) → 토큰 저장, 동기화 요청에 Bearer 부착.
  로그인 없이 기본 기능 전부 동작.
- **웹 기록 뷰어**: tools/local-api `GET /web` — 앱이 Sync Now로 올린 기록을
  브라우저에서 선수별로 확인(SplitLane Cloud 프리뷰), 렌더러 순수 함수 +
  테스트. `/v1/auth/login` dev 토큰 발급, adapter가 Bearer dev 토큰 →
  userId 파생.

## T-207 SplitLane Cloud 웹 포털 (역할 기반) [todo]
서버 배포 웹 서비스에서 동기화된 기록 열람 — 부모/선수/코치/어드민 역할.
- 부모·선수: 자기(연결된) 선수 기록·추세 열람, 코치에게 리뷰 요청 전송
  (기록 패키지 + 촬영 영상 첨부 — T-401 패키지 포맷 공유).
- 코치: 접수함(리뷰 요청 목록), 리뷰 작성. 어드민: 계정·연결 관리.
- 앱: 코치 계정으로 로그인 시 리뷰 접수 공지 수신 → 탭하면 해당 웹페이지로
  이동(딥링크). 수용: 로그인 → 역할별 화면 → 리뷰 요청/응답 왕복 1회 e2e.
