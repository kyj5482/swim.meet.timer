# 04. 데이터 모델 (Data Model)

오프라인 우선(NFR-3). 로컬 영속(예: IndexedDB / SQLite). 동기화는 후순위.

---

## 4.1 엔티티 관계 (개요)

```
Swimmer 1───* TrainingRecord *───1 SessionLog
   │                                  │
   └────────────── Roster             └── slots[] (익명 슬롯별 측정 결과)

SetPreset (재사용 세트 설정)
```

- **Swimmer**: 선수 1명.
- **SessionLog**: 한 번의 측정(heat) 전체 로그.
- **TrainingRecord**: 한 선수의 한 세션 결과(기록지에 쌓이는 단위).
- **SetPreset**: 자주 쓰는 세트 설정.

---

## 4.2 스키마 (TypeScript 형태)

```ts
type Course = '25m' | '25y' | '50m';
type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'im';

interface Swimmer {
  id: string;
  name: string;
  group?: string;          // 반/팀
  birthYear?: number;      // 연령 그룹 기본 페이스 산정용
  note?: string;
  createdAt: number;
  archived?: boolean;
}

interface Target {
  stroke: Stroke;
  distance: number;        // 예: 100 (단위는 course의 단위계와 일치)
  course: Course;
  // segmentCount = distance / unitOf(course)  (예: 100 / 25 = 4)
}

interface Split {
  segmentIndex: number;    // 0-based
  cumulativeMs: number;    // 출발(t0)로부터 누적 (저장 ms, 표시 1/100초)
  splitMs: number;         // 직전 세그먼트 대비
  edited?: boolean;        // 수동 보정 여부
}

// 측정 종료 후 선수별로 저장되는 단위 (기록지의 row)
interface TrainingRecord {
  id: string;
  swimmerId: string;       // ASSIGN 단계에서 슬롯 → 선수 매핑으로 확정
  sessionId: string;
  date: number;            // 측정 시각(벽시계, 표시는 모노토닉 아님)
  target: Target;
  splits: Split[];
  totalMs: number;         // 완주 시 마지막 cumulative, DNF면 마지막 기록
  status: 'finished' | 'dnf';
  slot: number;            // 그 세션에서의 슬롯 번호(1-based)
  conditionNote?: string;
}

// 측정 1회 전체 로그(감사/복구/재현용)
interface SessionLog {
  id: string;
  createdAt: number;
  t0Monotonic: number;
  course: Course;          // 세션 공통 기본값
  defaultTarget: Target;
  slots: SlotResult[];
  rawTaps: TapEvent[];     // 원시 탭(감사/디버깅, 재배정 재현)
  savedRecordIds: string[];
}

interface SlotResult {
  slot: number;            // 1..N, 도착 순서로 정의된 익명 자리
  swimmerId: string | null;// 측정 중 null, ASSIGN 단계에서 채워짐
  target: Target;          // 슬롯별 오버라이드 가능
  splits: Split[];
  status: 'finished' | 'dnf' | 'in_progress';
  lowConfidence?: boolean; // 다른 슬롯과 기록이 가까워 배정 확인 필요(§3.5a)
}

interface TapEvent {
  monotonic: number;       // 캡처 시각
  assignedSlot: number | null;   // 배정 결과(폐기 시 null)
  reassignedFrom?: number; // 재할당 이력
  discarded?: boolean;     // Undo로 폐기
}

interface SetPreset {
  id: string;
  name: string;            // "100 free · 25y · 3명"
  defaultTarget: Target;
  slotCount: number;
}
```

---

## 4.3 파생/집계 (기록지·통계)

저장 데이터에서 계산(별도 저장 불필요, P1은 캐시):

- **베스트 타임**: `swimmerId × stroke × distance × course` 별 `min(totalMs, status=finished)`.
- **추세**: 동일 키의 `TrainingRecord`를 날짜순 → 라인 차트.
- **구간 일관성**: 한 세션 내 splitMs의 표준편차(페이스 분배 코칭).
- **pace model 입력**([03 §3.3]): 최근 K개 record의 세그먼트별 평균(이상치 제거).

---

## 4.4 영속/복구 정책

| 항목 | 정책 |
| --- | --- |
| 저장소 | 로컬 우선(IndexedDB/SQLite). |
| 진행 중 스냅샷 | `RUNNING` 중 N초 + 매 탭 직후 직렬화(NFR-7). 종료/저장 시 폐기. |
| 트랜잭션 | 세션 저장은 all-or-nothing. |
| 마이그레이션 | 스키마 버전 필드(`schemaVersion`) 보유. |
| 동기화(P2) | last-write-wins + 디바이스별 id, 충돌은 record 단위. |
| 내보내기 | CSV(선수/세션 평면화), 공유 이미지(기록 카드). |

---

## 4.5 프라이버시 (NFR-10)

- 아동 식별정보 최소화. 기본은 로컬 전용.
- 클라우드/공유는 명시적 동의 시에만. 내보내기 데이터에 생년 등 민감정보 포함 여부 선택.
