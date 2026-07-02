# services/ai-coach — 궤적 분석 (구독 전용)

읽을 문서: 이 파일 + `common/api-spec.md` §ai-coach + `common/standards/README.md`
(산식) + `services/README.md`. 담당 티켓: T-301~T-304, T-401.

- **수치는 코드가, 문장은 LLM이.** 회귀 기울기(초/주), 가속도(기울기 변화),
  on-track(필요 기울기 대비), 도달 예상일, 스플릿 일관성은 전부 순수 함수
  (`analysis/`)로 계산·테스트. Bedrock(Claude)에는 계산 결과만 넘겨 요약 문장
  생성 — LLM에게 시간 계산을 시키지 않는다(환각 방지).
- 모든 엔드포인트는 entitlement 미들웨어(Entitlements 테이블) 통과 필수.
  실패 시 403 `SUBSCRIPTION_REQUIRED`.
- 입력 데이터는 `record.saved` 이벤트로 적재한 자체 시계열 캐시.
- 정체 감지(T-401): 최근 6주 기울기 ≥ -0.05초/주(개선 없음)이면 plateau 이벤트.
- Bedrock 호출은 로그에 프롬프트 전문 대신 해시+토큰수만 기록.
