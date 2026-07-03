# @splitlane/local-api — Mac에서 백엔드 로컬 실행 (AWS 계정 불필요)

`services/records`, `services/standards`의 **실제 Lambda 핸들러 코드**를 그대로
불러와 로컬 Express 서버로 감싼다. DynamoDB Local(Docker)에 붙는다. 로직은
전혀 재구현하지 않으므로 여기서 확인한 동작은 AWS 배포본과 동일하다.

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

`apps/mobile`에서 API 베이스 URL을 `http://localhost:4000/v1`로 설정한다
(iOS 시뮬레이터는 localhost 그대로, 실기기는 Mac의 LAN IP로 교체).
현재 앱은 아직 이 API를 호출하지 않는다(로컬 SQLite만 사용) — 동기화 클라이언트
연결은 `tickets/phase-2.md` T-203 잔여 항목.
