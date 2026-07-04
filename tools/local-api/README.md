# @splitlane/local-api — 백엔드 + SplitLane Cloud 웹 포털 로컬 실행 (AWS 불필요)

`services/records`, `services/standards`의 **실제 Lambda 핸들러 코드**를 그대로
불러와 로컬 Express 서버로 감싸고, `services/ai-coach` 가이드 엔진과 PII 암호화를
붙여 **역할 기반 웹 포털**(SplitLane Cloud 프리뷰)까지 함께 띄운다. 로직은
전혀 재구현하지 않으므로 여기서 확인한 동작은 AWS 배포본과 동일하다.

## 웹 서비스 실행 방법 (요약)

```bash
npm install                              # 최초 1회 (워크스페이스 전체)
cd tools/local-api && docker compose up -d   # DynamoDB Local (기록 동기화용, 선택)
npm run setup -w @splitlane/local-api    # 테이블 생성 + 표준 시드 (Docker 있을 때)
npm run dev -w @splitlane/local-api      # 서버 + 웹 포털 기동
```

- **웹 포털**: <http://localhost:4000/web> — 가입/로그인 → 수영 코치 AI ·
  진학 코치 AI · 실제 코치 리뷰 요청 · 코치 프로필/인박스.
- **기록 뷰어**: <http://localhost:4000/web/records> — 앱이 Sync Now로 올린 기록.
- **관측성**: 모든 요청이 `correlation-id`와 함께 구조화 JSON 로그로 남고, 그
  ID가 Lambda 핸들러까지 이어져 API 호출부터 DB 쿼리까지 한 줄로 추적된다.
  앱에서 Sign in 하면 `auth login` 로그가 뜬다.
- DynamoDB Local(Docker) 없이도 웹 포털·AI 가이드·인증은 동작한다(기록 뷰어만
  Dynamo 필요).

PII 암호화 키(`DATA_ENCRYPTION_KEY`, base64 32B)는 미설정 시 로컬 임시키를 자동
생성한다. 프로덕션은 KMS 데이터 키를 주입한다(리포·코드에 키 없음).

## 사전 준비 (최초 1회)

Mac에 [Docker Desktop](https://www.docker.com/products/docker-desktop/)이
설치·실행 중이어야 한다.

## 실행

```bash
# 1. DynamoDB Local 기동 (백그라운드)
cd tools/local-api
docker compose up -d

# 2. 테이블 생성 + 표준기록 시드 (최초 1회, 또는 데이터 리셋 시)
npm run setup -w @splitlane/local-api

# 3. API 서버 실행
npm run dev -w @splitlane/local-api
```

서버가 뜨면: `splitlane local-api listening on http://localhost:4000`

## 확인

```bash
curl http://localhost:4000/health

curl "http://localhost:4000/v1/standards?gender=F&age=11-12&course=SCY"

curl -X PUT http://localhost:4000/v1/records/batch \
  -H "content-type: application/json" \
  -H "x-dev-user: me" -H "x-dev-role: coach" \
  -d '{"records":[{"id":"r1","swimmerId":"s1","sessionId":"ss1","date":1735689600000,"stroke":"free","distance":100,"course":"25y","splitInterval":25,"totalMs":62340,"status":"finished","slot":1,"splits":[{"segmentIndex":0,"cumulativeMs":62340,"splitMs":62340}],"updatedAt":1735689600000}]}'

curl "http://localhost:4000/v1/records?swimmerId=s1&since=0"
```

## 인증 (로컬 전용)

실제 Cognito 대신 헤더로 로그인 사용자를 흉내 낸다:

- `x-dev-user: <임의 문자열>` — 기본값 `local-dev-user`
- `x-dev-role: swimmer|coach|parent` — 기본값 `coach`

이 방식은 `tools/local-api`에만 존재하고 AWS에는 배포되지 않는다. 서비스
핸들러(`services/*/src/handler.ts`)는 이 사실을 전혀 모른다 —
`requestContext.authorizer.jwt.claims` 모양만 맞춰 주므로 실제 API Gateway와
동일한 이벤트를 받는다.

## 중지 / 리셋

```bash
docker compose down          # 컨테이너만 중지(데이터는 볼륨에 남음)
docker compose down -v       # 데이터까지 완전 삭제 후 처음부터
```

## 앱을 로컬 백엔드에 연결하려면

`apps/mobile` Settings → AI Coach Account → (개발 빌드) Backend Sync 에서 API
베이스 URL을 `http://localhost:4000/v1`로 설정한다(iOS 시뮬레이터는 localhost,
실기기는 Mac의 LAN IP). 그 위 AI Coach Account에서 Sign in 하면 백엔드
`/v1/auth/login`이 호출되고 서버 로그에 `auth login`이 남는다.

---

## 웹 서비스 (개발 완료 항목)

역할: **swimmer · parent · coach · college-coach · admin.** 렌더러는 순수 함수
(`src/portal.ts`, 테스트됨), 도메인 스토어만 로컬은 인메모리 → AWS는 DynamoDB로
교체(화면·계약은 그대로라 기능 업그레이드가 기존과 충돌하지 않는다).

### 수영 코치 (AI) — `/web/swim-coach`
- 기록으로 **수준 판정**(표준 레벨 → tier) 후 **나이에 맞는** 체력·수영 훈련
  포커스와 **주간 플랜**, **유튜브/영상 위주 학습 링크**를 제시. 어린 선수는
  재미·기술, 상급은 근력·젖산 내성 등 LTAD 통념 반영. 안전 고지 포함.
  엔진: `services/ai-coach/src/swim-guidance.ts`(순수·테스트, Bedrock으로 문장
  다듬기 교체 가능 — 수치는 코드가, 문장은 LLM이).
- **실제 코치 리뷰**(`/web/review/new`): 전 영법 영상 + 기록을 제출 → 코치
  프로필(나이·레벨 범위) 기준 **매칭** → 코치가 앱/인박스에서 **수락/거절**.
- **코치 프로필**(`/web/coach/profile`): 로그인 후 기본 항목(전문·나이·레벨·요금)
  작성. 매칭에 사용.

### 진학 코치 (AI) — `/web/college-coach`
- 기록(운동 프로필) + **학업 점수(수학·ELA 백분위)** + AP + 활동으로 **학교
  적합도**(reach/match/safety)와 **나이별 준비 로드맵**을 개인화 제시. 목표
  학교(예: UChicago)가 선호하는 요소를 근거로 부족분을 안내.
  엔진: `services/ai-coach/src/college-guidance.ts`(순수·테스트).
- **민감정보 암호화**: 학업 점수/평가 PDF 텍스트는 `services/_shared/src/crypto.ts`
  (AES-256-GCM 봉투 암호화)로 **저장 시 암호화**. 평문을 DB·로그에 남기지 않는다.
  학교 평가 PDF 업로드→수학·ELA 파싱은 T-306(고교부터 AP 점수 추가).

### Soon (티켓화 — 웹에 "Soon" 배지로 노출)
- 📹 **1:1 라이브 영상 코칭**(모바일 영상통화, 원어민 1:1 확장) — T-407.

## AWS 배포 계획 (비용 최적화 · 보안 · 업그레이드 안전)

- **서버리스 유지**(common/architecture.md): API Gateway(HTTP API) + Lambda +
  DynamoDB on-demand. 사용량 0일 때 비용 ≈ $0, 자동 스케일아웃. 웹 포털은
  Lambda(SSR) 또는 정적 호스팅(S3+CloudFront)로 — 컨테이너/EC2 고정비 없음.
- **보안(고객 데이터 수준)**: PII(학업·성적·개인식별)는 필드 단위 암호화 후 저장
  (KMS 데이터 키). 전송 TLS, Cognito 인증, 역할·소유권 검사. 로그엔 PII 금지
  (userId·correlationId만). S3 영상은 SSE-KMS + presigned·짧은 만료.
- **업그레이드 안전**: 서비스별 독립 배포(경계 = `services/<name>`), 계약은
  `common/`이 단일 소스. API `/v1` 버저닝 — 깨는 변경은 `/v2` 신설로 기존 무중단.
  웹 렌더러/스토어 분리로 저장소 교체가 화면에 영향 없음.
- **관측성**: correlation-id가 API GW 액세스 로그 → Lambda 구조화 로그 →
  DynamoDB 호출(X-Ray)까지 한 ID로 연결(이 로컬 서버가 같은 패턴을 시연).
- **비용 가드**: 태그(`project=splitlane, stage=`), AWS Budgets 월 알람, 로그
  보존 30일(dev 7일), Lambda 256MB/10s 기본.
