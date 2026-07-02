# 공통 API 계약

베이스: `https://api.<domain>/v1`. 인증: `Authorization: Bearer <Cognito JWT>`.
공통 헤더: `x-correlation-id`(선택, 없으면 서버 생성 후 응답에 반환).

## 공통 규약
- JSON, camelCase. 시간 기록값은 **ms 정수**(표시만 1/100초). 날짜는 epoch ms.
- 에러: `{ "error": { "code": "NOT_FOUND", "message": "...", "correlationId": "..." } }`
  + 표준 HTTP 상태. 코드: `UNAUTHORIZED CONFLICT VALIDATION NOT_FOUND SUBSCRIPTION_REQUIRED`.
- 멱등성: 쓰기 API는 클라이언트 생성 UUID를 PK로 사용(재시도 안전).
- 페이지네이션: `?cursor=&limit=`(기본 50) → `{ items, nextCursor? }`.
- 버저닝: 경로 `/v1`. 하위호환 깨는 변경은 새 버전.

## auth (`/auth`)
- `GET /auth/me` → `{ userId, role, displayName, swimmers[] }` (부모/코치는 연결된 선수 목록)
- `PUT /auth/profile` → 프로필 갱신
- `POST /auth/invites` (부모/코치가 선수 열람 초대 생성) → `{ code }`
- `POST /auth/invites/{code}/accept`

## records (`/records`)
- `PUT /records/batch` body `{ records: TrainingRecord[] }` → 멱등 업서트
- `GET /records?swimmerId=&since=&cursor=` → 델타 동기화(tombstone 포함)
- `DELETE /records/{id}` → tombstone
- TrainingRecord 스키마는 `common/data-model.md` (클라이언트 로컬 스키마와 동일)

## standards (`/standards`)
- `GET /standards?authority=usa-swimming&season=2024-2028&course=SCY&gender=F&age=11-12&event=100FR`
  → `[{ level: 'B'|'BB'|'A'|'AA'|'AAA'|'AAAA'|'FUTURES'|'SECTIONAL', timeMs }]`
- `GET /standards/clubs` / `GET /standards/clubs/{clubId}/groups` → 그룹 승급 조건
- `PUT /targets/{swimmerId}` body `{ type: 'standard'|'clubGroup'|'customTime', ... , targetDate? }`
- `GET /targets/{swimmerId}/progress?event=` → `{ percent, currentBestMs, targetMs, ladder[] }`
  - `percent = round(100 * targetMs / currentBestMs, 1)` (수영은 낮을수록 좋음 — myswimio 동일 방식)

## ai-coach (`/coach`) — 구독 전용 (403 SUBSCRIPTION_REQUIRED)
- `GET /coach/analysis/{swimmerId}?event=` →
  `{ slopeSecPerWeek, accel: 'improving'|'steady'|'slowing', onTrack: boolean,
     projectedTargetDate, requiredSlope, consistency, summary }`
- `POST /coach/session-review` body `{ sessionId }` → 1줄 리뷰 + 다음 포커스
- `GET /coach/report/weekly/{swimmerId}`

## market (`/market`) — Phase 4
- `GET /market/coaches`, `POST /market/packages`(정체 데이터+영상 전달),
  `POST /market/orders`(Stripe Connect)

서비스가 API를 추가/변경하면 **이 문서를 같은 커밋에서 갱신**한다.
