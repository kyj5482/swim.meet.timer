# services/ — 백엔드 마이크로서비스

서비스별로 독립 폴더·독립 CLAUDE.md·독립 배포. 서로의 코드를 import 하지 않는다.
공통 유틸은 `services/_shared/`(auth 클레임 파싱, 로거 초기화, 에러 포맷)만 허용.

공통 규약(전 서비스 필수): `common/architecture.md`(로깅·correlation-id),
`common/api-spec.md`(응답 포맷), `common/data-model.md`(키 설계), `common/testing.md`.

핸들러 템플릿: API GW HTTP API 이벤트 → zod 검증 → 비즈니스 로직(순수 함수) →
응답. Powertools Logger/Tracer/Metrics 데코레이션 필수.
