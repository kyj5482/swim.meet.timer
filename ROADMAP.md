# ROADMAP — SplitLane

비즈니스 모델: **타이머+기록(무료)** → **AI 코치 진행률/가속도 분석(구독)** →
**실코치 매칭 마켓플레이스(수수료)**. myswimio 와의 차별점: 대회 결과 조회가 아니라
**연습 데이터 기반의 과정 추적**(타겟 대비 %, 향상 가속도, 포트폴리오).

## Phase 0 — 기반 (이번 세션)
- 모노레포 + 티켓 시스템 + 공통 계약 문서
- `packages/timer-core`: 1/100초 엔진을 순수 TS로 포팅, 테스트로 불변식 고정

## Phase 1 — 무료 네이티브 앱 (iOS/Android 스토어 배포)
- Expo RN 앱: 타이머(단일 LAP + 레인 직접 탭), 선수/기록지, 오프라인 SQLite
- **볼륨 키 LAP**: Android 완전 지원. iOS는 정책상 볼륨 키 가로채기 불가 →
  블루투스 리모컨/키보드 입력 지원으로 대체 (docs/08 참조)
- EAS Build → TestFlight / Play 내부 테스트 → 스토어

## Phase 2 — 계정·동기화·타겟 (백엔드 시작)
- Cognito 로그인(선수/코치/부모 역할), 기록 클라우드 동기화
- 표준기록 DB: USA Swimming Motivational(B~AAAA), Futures, Sectionals, 클럽 그룹
  조건(NOVA 등) 임포트
- 타겟 선택 → 현재 기록 대비 **달성 %** 표시(무료 범위는 % 1개까지)
- 코치·부모 공유(선수 데이터 열람 초대)

## Phase 3 — AI 코치 (구독)
- IAP 구독 + 서버 entitlement 검증
- 연습 세션마다: 타겟 궤적 대비 on-track 여부, **향상 가속도**(개선 기울기의 변화),
  구간 페이스 일관성, 다음 연습 포커스 제안 (Bedrock/Claude)
- 포트폴리오: 에이지 그룹 표준 대비 백분위 히스토리 — 시간이 지나도 "과정"이 남음
- 정체 감지 → 데이터+영상 패키지를 코치에게 전달하는 플로우

## Phase 4 — 코치 마켓플레이스 & 운영
- 코치 가입·프로필·리뷰, 원격 코칭 세션 판매, Stripe Connect 정산
- 관측성 완성(API→DB correlation-id 대시보드, 알람), 부하 테스트, 비용 가드레일

상세 작업 항목과 순서는 `tickets/README.md`.
