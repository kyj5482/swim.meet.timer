# 티켓 보드

작업은 위에서 아래로 **순차** 처리한다. 상태: `todo` / `in-progress` / `done` / `blocked`.
티켓 상세(범위·수용기준)는 각 phase 파일에 있다. 완료 시 이 표와 상세 파일 둘 다 갱신.

## Phase 0 — 기반
| ID | 제목 | 상태 |
| --- | --- | --- |
| T-001 | 모노레포 스캐폴드 + timer-core 순수 TS 포팅 + 테스트 | done |
| T-002 | 공통 계약 문서(common/) + 영역별 CLAUDE.md | done |

## Phase 1 — 무료 네이티브 앱 (`tickets/phase-1.md`)
| ID | 제목 | 상태 |
| --- | --- | --- |
| T-101 | Expo RN 앱 스캐폴드 + 디자인 토큰 적용 | done |
| T-102 | 타이머 화면(설정→측정→배정) — timer-core 연결 | done |
| T-103 | 로컬 DB(expo-sqlite): 선수·기록·세션 영속 | done |
| T-104 | 기록지/추세 화면 + CSV 내보내기 | done |
| T-105 | 볼륨 키 LAP(Android 네이티브 모듈) | done |
| T-108 | iOS/공통 외부 리모컨 입력(BT 키보드·미디어 키 → LAP) | todo |
| T-106 | 앱 폴리시: wake lock, 햅틱, 크래시 복구 스냅샷 | done |
| T-109 | i18n(en/ko) — PWA 문자열 전체 이식 + 설정 화면(언어·햅틱·볼륨키) | done |
| T-110 | UI 디자인 폴리시(PWA 수준) + Records SVG 라인/비교 차트 | done |
| T-111 | 화면을 원본 PWA와 픽셀 일치 + 데모 시드 + 세션 증감 표시 | done |
| T-107 | EAS Build + 스토어 배포 파이프라인(GitHub Actions) | done (수동 1회 설정 필요) |

## Phase 2 — 계정·동기화·타겟 (`tickets/phase-2.md`)
| ID | 제목 | 상태 |
| --- | --- | --- |
| T-201 | infra 부트스트랩: CDK 앱, dev/prod 스테이지, 로깅 베이스라인 | done(스캐폴드·synth) |
| T-202 | auth 서비스: Cognito + 역할(선수/코치/부모) + JWT 검증 공용층 | 부분(Cognito+JWT authorizer+클레임 파싱; /auth API·초대는 T-206) |
| T-203 | records 서비스: 기록 동기화 API + DynamoDB 설계 | done(핸들러·테스트·앱 동기화 클라이언트 연결 완료) |
| T-204 | standards 서비스: 표준기록·클럽조건 데이터 임포트 + 조회 API | done(임포터·조회 API·테스트; 공식 전체 PDF 파싱 확장 잔여) |
| T-205 | 앱: 로그인/타겟 선택/달성 % 표시 | 부분(온디바이스 타겟%는 T-112 완료; 로그인은 T-202 후) |
| T-206 | 공유: 코치·부모 초대(선수 데이터 열람 권한) | todo |
| T-112 | 온디바이스 타겟·진행률(달성%/궤적/표준 사다리) — 제품 핵심 | done |
| T-114 | 동시 다중 레인 탭(멀티터치 LAP) + 동기화 ms 정수화(float 400 수정) | done |
| T-115 | USA Swimming 표준 전체 임포터(tools/standards-import) + 코스(SCY/SCM/LCM) 차원 | done(실데이터 생성은 Mac에서 임포터 1회 실행) |
| T-116 | UI 재구성: 탭 = 타이머·전체 종목·세부 종목, 표준 레벨 축 차트(myswimio 방식) | done |
| T-117 | 전체 종목: 쇼트/롱 코스 섹션 + PB·최근 수영 날짜 + 설정 목표 진행률 | done |
| T-118 | UX 피드백 라운드: 색상 재설계·영어 단일화·볼륨LAP 제거·저장 Undo/OK·차트 확대·챔피언십 사다리·USA ID | done |

## Phase 3 — AI 코치 구독 (`tickets/phase-3.md`)
| ID | 제목 | 상태 |
| --- | --- | --- |
| T-301 | 구독: IAP(RevenueCat) + 서버 entitlement 검증 | todo |
| T-302 | ai-coach 서비스: 궤적 분석(on-track, 향상 가속도) + Bedrock 요약 | todo |
| T-303 | 앱: AI 코치 화면(진행률, 가속도, 다음 연습 포커스) | todo |
| T-304 | 포트폴리오: 표준 대비 백분위 히스토리 + 공유 카드 | todo |

## Phase 4 — 마켓플레이스·운영 (`tickets/phase-4.md`)
| ID | 제목 | 상태 |
| --- | --- | --- |
| T-401 | 정체 감지 → 코치에게 데이터+영상 전달 플로우 | todo |
| T-402 | 코치 마켓플레이스: 프로필·세션 판매·Stripe Connect 정산 | todo |
| T-403 | 관측성 완성: correlation-id 대시보드, 알람, 비용 가드레일 | todo |
| T-404 | 부하 테스트 + 스케일아웃 검증 | todo |
