# services/standards — 표준기록·클럽조건·타겟·진행률

읽을 문서: 이 파일 + `common/standards/README.md`(스키마·소스·산식) +
`common/api-spec.md` §standards + `services/README.md`. 담당 티켓: T-204, T-205.

- Standards 테이블은 불변 데이터 — 임포터 스크립트(`importer/`)로만 쓴다.
  임포트 검증: 이벤트×레벨×성별×연령 조합 수 대조 + 알려진 샘플 값 스팟체크.
- 진행률: `percent = 100 * targetMs / currentBestMs`. currentBest는 records
  API가 아니라 `record.saved` 이벤트로 유지하는 자체 캐시(서비스 간 동기 호출
  금지 원칙).
- 클럽 조건은 requirements 배열 평가기로 판정(모두 충족 = 승급 가능).
