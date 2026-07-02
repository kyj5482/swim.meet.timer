# 표준기록·클럽 조건 데이터 (standards 서비스의 데이터 소스)

타겟 = "표준기록 레벨" 또는 "클럽 그룹 승급 조건" 또는 "커스텀 시간".
이 폴더의 JSON이 임포터(T-204)의 입력이다.

## 체계 (2026-07 리서치 결과)

### 1. USA Swimming Motivational Time Standards 2024–2028
- 레벨 사다리: **B → BB → A → AA → AAA → AAAA** (낮을수록 좋은 시간).
- 에이지 그룹: 10&U, 11-12, 13-14, 15-16, 17-18 (+ single-age 변형본 존재).
- 코스: SCY / LCM, 성별 F/M, 2024-09-01 발효. 2025-10 업데이트로 15-16·17-18에
  50 fly/back/breast 추가됨.
- 산식 배경: 기준 시드타임(과거 16위 기록) × 레벨·연령 계수.
- **공식 소스(임포트 대상)**:
  - Age group PDF: https://websitedevsa.blob.core.windows.net/sitefinity/docs/default-source/timesdocuments/time-standards/2025/2028-motivational-standards-age-group.pdf
  - Single age PDF: https://websitedevsa.blob.core.windows.net/sitefinity/docs/default-source/timesdocuments/time-standards/2025/2028-motivational-standards-single-age.pdf
  - 대조 검증용: https://swimstandards.com/national/age-group-motivational-times

### 2. 챔피언십 컷 (상위 타겟)
- **Futures Championships**, **Speedo Sectionals**(존/LSC별 상이) — 시즌마다
  USA Swimming/존 사이트에서 발표. 시즌 파일로 임포트(`authority` 필드로 구분).

### 3. 클럽 그룹 조건 (예: NOVA of Virginia Aquatics, 팀코드 vsnva)
- 15개 연습 그룹. 연령대 안에서 Bronze → Silver → Gold 사다리.
  - Age Group Development Bronze(AGDB): 9-11세.
  - Age Group Development Silver(AGDS): 대부분 **B~BB 레벨** 선수.
  - Age Group Development Gold(AGDG): 10&U 최상위 그룹.
  - AGD 배치 최소조건 예: **100 Free·100 IM B 타임** + 주 2~3회 연습.
  - "그룹 배치는 바닥(floor)이지 천장이 아니다" — 승급 조건은 최소 기준.
- 소스: https://www.gomotionapp.com/team/vsnva/page/swim-team/practice-groups
- 다른 클럽도 같은 스키마로 추가한다(클럽별 JSON 1개).

## 스키마

```ts
interface TimeStandard {
  authority: 'usa-swimming'|'futures'|'sectionals-<zone>'|string;
  season: string;            // '2024-2028' | '2026'
  course: 'SCY'|'LCM'|'SCM';
  gender: 'F'|'M';
  ageGroup: '10U'|'11-12'|'13-14'|'15-16'|'17-18'|`${number}`;
  event: string;             // '100FR', '50FL', '200IM'
  level: 'B'|'BB'|'A'|'AA'|'AAA'|'AAAA'|'CUT';
  timeMs: number;
}
interface ClubGroupCriteria {
  clubId: string;            // 'nova-va'
  groupId: string;           // 'AGD-SILVER'
  name: string; ageRange: [number, number];
  requirements: Array<
    | { type: 'standardLevel'; event: string; level: TimeStandard['level'] }
    | { type: 'time'; event: string; course: string; timeMs: number }
    | { type: 'attendance'; perWeekMin: number; perWeekMax?: number }>;
  nextGroups: string[];      // 승급 경로
}
```

## 파일
- `seed/club-groups.nova-va.json` — 리서치 기반 시드(추정치는 `"estimated": true`).
- `seed/usa-swimming-motivational.sample.json` — **스키마 예시용 샘플**. 실제 수치는
  T-204에서 공식 PDF를 파싱해 채운다. 샘플 값을 실데이터로 쓰지 말 것.

## 진행률 산식 (standards·ai-coach 공통)
- 달성 % = `100 × targetMs / currentBestMs` (100% 이상 = 달성). myswimio와 동일 방식.
- 사다리 위치 = 현재 베스트가 통과한 최고 레벨 + 다음 레벨까지 남은 초.
