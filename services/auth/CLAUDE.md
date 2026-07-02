# services/auth — 인증·계정·역할·공유

읽을 문서: 이 파일 + `common/api-spec.md` §auth + `common/data-model.md`(Users,
Relation) + `services/README.md`. 담당 티켓: T-202, T-206.

- Cognito User Pool(email, 이후 소셜). 커스텀 속성 `role`.
- 미성년 선수: 부모 계정이 SwimmerProfile을 소유(선수 본인 로그인은 선택).
- 초대 코드: 6자리, 24h TTL(DynamoDB TTL), 수락 시 Relation 생성.
- 소유권 검사 헬퍼를 `services/_shared/auth.ts`로 export — records/standards/
  ai-coach가 사용(코드 복사 금지).
- 로그에 이메일·이름 금지(userId만).
