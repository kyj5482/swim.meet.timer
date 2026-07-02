# services/records — 기록 동기화·조회

읽을 문서: 이 파일 + `common/api-spec.md` §records + `common/data-model.md`
(TrainingRecord, Records 테이블 키) + `services/README.md`. 담당 티켓: T-203.

- 업서트는 멱등(recordId=UUIDv7 PK), 충돌은 `updatedAt` last-write-wins.
- 삭제는 tombstone(`deleted: true`) — 델타 동기화(`?since=`)에 포함.
- 저장 성공 시 EventBridge `record.saved` 발행 { swimmerId, event, totalMs,
  date, correlationId } — ai-coach·standards가 구독.
- 쿼리 패턴은 GSI1(이벤트별 날짜순)만 사용. 스캔 금지.
- 권한: 요청자 userId가 해당 swimmerId에 Relation을 가져야 함(_shared/auth).
