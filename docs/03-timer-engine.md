# 03. 타이머 엔진 명세 (Timer Engine Spec) — 핵심

이 문서는 제품의 심장인 **"단일 Lap 버튼 → 익명 슬롯 자동 배정 → 측정 후 선수 배정"** 로직을 개발 가능한 수준으로 정의한다.

> **v2 핵심 전환**: 측정 중에는 선수 이름이 없다. 탭은 **익명 슬롯**에 배정되고, 선수는 측정이 끝난 뒤 기록을 보고 배정한다. 따라서 배정의 페이스 근거는 *선수 이력* 이 아니라 **슬롯이 측정 중 쌓은 자기 스플릿**이다.

---

## 3.1 핵심 개념과 용어

- **Session(Heat)**: 동시에 출발해 함께 측정되는 한 묶음.
- **Slot(슬롯)**: 세션 안의 익명 자리 1..N. 출발 시점엔 누구인지 모른다. **1라운드 도착 순서로 정의**(첫 length를 먼저 끝낸 탭 = 1번 슬롯).
- **Target**: 슬롯의 측정 목표 = `{ stroke, distance, course(25m|25y|50m) }`.
  - `segmentCount = distance / unit(course)` (정수). 예) 100y, 구간 25y → `segmentCount = 4`.
- **Tap(Lap)**: 코치가 단일 버튼을 1회 누른 사건. 타임스탬프 1개 생성.
- **Split**: 한 슬롯의 한 세그먼트 기록. `{ segmentIndex, cumulativeMs, splitMs }`. 모두 ms로 저장, 표시는 1/100초.
- **Slot pace**: 한 슬롯이 *이번 세션에서* 관측한 스플릿 평균 → 다음 도착 예측의 근거(선수 이력 아님).
- **Swimmer 배정**: 측정 종료 후, 각 슬롯 → 로스터의 선수에 매핑. 추천은 §3.6.

### 시간 기준 (NFR-1)
- 모든 타임스탬프는 **모노토닉 클락**(`performance.now()` / `CLOCK_MONOTONIC`)로 캡처. 시스템 시각/타임존 변경에 영향받지 않는다.
- `elapsed(tap) = tap.monotonic - session.t0`.
- UI 렌더링(60fps)과 입력 캡처(이벤트 즉시)는 **분리**한다. 탭 핸들러는 즉시 타임스탬프만 큐에 넣고, 배정/렌더는 다음 프레임에 처리해도 정확도 손실 없음.

---

## 3.2 측정 상태 기계 (State Machine)

```
            ┌─────────┐  configure (인원 +/- · 세트)
            │  IDLE   │◄───────────────────────────┐
            └────┬────┘                            │
                 │ START (t0 캡처)                  │ RESET / 저장완료
                 ▼                                  │
            ┌─────────┐  LAP* (익명슬롯 자동배정·재할당) │
   PAUSE ◄──┤ RUNNING ├──► (슬롯 완주마다 표시)        │
   RESUME ─►└────┬────┘                            │
                 │ 모든 슬롯 완주(마지막 Stop)         │
                 ▼                                  │
            ┌─────────┐  추천·향상체크·맞바꾸기          │
            │ ASSIGN  ├────────────────────────────►│
            │(선수배정)│  CONFIRM → 영속 저장           │
            └─────────┘
```

- `RUNNING` 중 **인원 수**를 바꾸면(FR-S6) → 확인 후 `IDLE`로 **RESET**. (선수 배정은 측정 후라 리셋과 무관.)
- `RUNNING` 중 크래시 → 스냅샷에서 `RUNNING` 복구(NFR-7).

---

## 3.3 자동 배정 알고리즘 (Tap → Slot, 익명)

> 목표: 코치가 "벽 찍는 순서대로" 단일 버튼만 누르면, 앱이 각 탭을 올바른 **익명 슬롯**에 배정한다. 선수 이름은 측정 후 붙인다.

### 입력
- `activeSlots`: 아직 완주하지 않은 슬롯 집합.
- 각 슬롯 `s`의 상태: `splits[]`, `nextSegmentIndex[s]`, `lastCumMs[s]`(없으면 0).
- 새 탭의 `elapsed`.

### 배정 규칙 (2단계)
**1라운드(슬롯 정의 단계)** — 아직 첫 스플릿이 없는 슬롯이 있으면:
1. 첫 스플릿이 없는 슬롯 중 **가장 낮은 번호**에 배정.
2. → 결과적으로 첫 length를 끝낸 순서가 슬롯 1,2,3…을 정의한다. (물리적 레인 위치는 무의미; 선수는 나중에 매핑.)

**2라운드 이후(페이스 추적 단계)** — 모든 슬롯이 최소 1스플릿을 가지면:
1. 각 슬롯의 **자기 관측 페이스** `slotPace[s] = mean(s.splits.splitMs)` (또는 최근값 EWMA).
2. 예상 도착 `expectedArrival[s] = lastCumMs[s] + slotPace[s]`.
3. `score[s] = |elapsed - expectedArrival[s]|`가 **최소**인 슬롯 `s*`에 배정.
4. 동점/근접(`τ` 이내) tie-break: (a) 이번 세그먼트 탭 못 받은 슬롯 → (b) `nextSegmentIndex` 작은 슬롯 → (c) 슬롯 번호.
5. 배정 후 `s*`: 스플릿 push, `nextSegmentIndex++`, `lastCumMs=elapsed`.
6. `nextSegmentIndex == segmentCount` → `s*` **완주(Stop)**, `activeSlots`에서 제외.

> **선수 이력을 안 쓰는 이유**: 측정 중엔 누가 어느 슬롯인지 모른다. 그래서 각 슬롯이 *스스로 쌓은* 스플릿으로 다음을 예측한다. 이력 기반 추천은 측정 *후* 배정에서만 쓴다(§3.6).
>
> 핵심: 알고리즘이 완벽할 필요는 없다. **틀려도 1탭 수정**(§3.4)으로 100%가 된다. 자기-페이스 추적은 "탭 순서가 애매할 때의 추측"을 좋게 만들 뿐이다.

### 의사코드
```ts
function onLap(elapsed: number, session: Session): Assignment {
  const cands = session.slots.filter(s => !s.finished);
  if (cands.length === 0) return noop();

  // 1라운드: 첫 스플릿 없는 슬롯을 도착 순서대로 정의
  const virgin = cands.filter(s => s.splits.length === 0);
  let target: Slot;
  if (virgin.length) {
    target = virgin[0]; // 가장 낮은 번호
  } else {
    let best = cands[0], bestScore = Infinity;
    for (const s of cands) {
      const pace = mean(s.splits.map(x => x.splitMs));
      const score = Math.abs(elapsed - (s.lastCumMs + pace));
      if (score < bestScore) { bestScore = score; best = s; }
    }
    target = best;
  }
  const split = elapsed - target.lastCumMs;
  target.splits.push({ segmentIndex: target.nextSegmentIndex, cumulativeMs: elapsed, splitMs: split });
  target.lastCumMs = elapsed;
  target.nextSegmentIndex++;
  if (target.nextSegmentIndex === target.segmentCount) target.finished = true;
  return { slot: target, split, finishedAll: cands.every(s => s.finished) };
}
```

### 경계 상황
| 상황 | 처리 |
| --- | --- |
| 두 선수 거의 동시 터치 | 코치가 빠르게 2탭. 서로 다른 두 슬롯에 배정. 순서 틀리면 §3.4 재할당, 또는 측정 후 §3.6 맞바꾸기. |
| 실수로 한 번 더 누름(중복) | **Undo**(FR-T10)로 직전 탭 제거. |
| 한 구간 깜빡하고 못 누름 | 다음 탭이 엉뚱하게 배정 → 누락 보정(FR-T11): 빠진 세그먼트 수동 삽입 후 재정렬. |
| 한 슬롯 도중 포기 | DNF(FR-T12): 후보 제외, 부분 기록 보존. |
| 모든 슬롯 완주 직전 마지막 탭 | 그 탭이 마지막 슬롯의 Stop → **배정(ASSIGN)** 화면으로 전환. |

---

## 3.4 즉석 재할당 (Manual Correction, 측정 중)

자동 배정이 틀렸을 때, **시계를 멈추지 않고** 바로잡는다.

- **모델**: "마지막에 배정된 split을 다른 슬롯으로 옮긴다." 두 슬롯 모두 스플릿·누적·`nextSegmentIndex`를 재계산.
- **UX**: 방금 하이라이트된 배정 직후, 하단 **슬롯 칩(1/2/3)** 을 1탭.
- **범위**: 최근 1~몇 개 탭 한정. 종료 후에는 배정 화면 스플릿 표에서 자유 편집.
- **불변식 검증**(§3.5)을 매 수정마다 통과해야 함.

---

## 3.5 데이터 불변식 (Invariants)

엔진은 항상 다음을 만족해야 한다(테스트로 강제):

1. 각 슬롯의 splits는 `segmentIndex` 0..k 로 **연속·유일**.
2. `splitMs[i] = cumulativeMs[i] - cumulativeMs[i-1]` (i=0이면 cumulative와 동일), 모두 ≥ 0.
3. 완주 슬롯의 `splits.length == segmentCount`.
4. 모든 탭은 정확히 한 슬롯에 배정(또는 명시적 폐기). 탭 총수 = 배정 합 + 폐기 합.
5. `cumulativeMs`는 슬롯 내에서 **단조 증가**.
6. 세션 최종 저장 시 모든 슬롯이 `finished` 또는 `DNF`.

### 3.5a 모호성(저신뢰) 판정 — 측정 후 안전장치
시간만으로 두 선수를 구분할 수 없는 경우를 명시적으로 표시한다.

- 어떤 슬롯의 총기록이 **다른 슬롯과 `CLOSE`(기본 0.40초) 이내**이면 두 슬롯 모두 `lowConfidence = true`.
- 저신뢰 슬롯은 배정 화면에서 경고("N번과 0.10초 차 — 선수 확인") + **원탭 맞바꾸기**를 제공(§3.6, FR-A4).
- 저신뢰 슬롯의 PB/향상 배지는 **차분히(muted)** 표시해, 확정 전 과신을 막는다.

---

## 3.6 측정 후 선수 배정 & 향상 체크 (Post-race, FR-A*)

측정이 끝나면 각 익명 슬롯을 로스터의 선수에 매핑한다.

### (1) 추천 — 기록 ↔ 이력 매칭
- 각 선수의 `typical`(같은 종목·거리·코스 최근 K세션 평균)을 기준으로, 슬롯 총기록과의 차이를 비용으로 둔다.
- **전역 최소비용 매칭**(중복 없이): 모든 `(슬롯, 선수)` 쌍을 비용 오름차순으로 그리디 배정(소규모 N은 최적 매칭으로 대체 가능).
  - 단순 "시간순 정렬 후 최근접"은 *국소 최적*에 빠져 오배정을 낳으므로 지양(이터레이션 1에서 실제 관측됨).
- 결과는 드롭다운에 **미리 채워두고**, 코치가 자유롭게 변경.

### (2) 실력 향상 체크 (코치의 핵심 효용)
배정된 선수에 대해 즉시 표시:
- **이전 → 오늘** (예: `이전 53.40 → 52.30`) + 증감 `▼/▲ 0.xx`.
- 오늘 기록 < 개인 베스트면 **🏅 PB** 배지.
- 상단 **요약 헤드라인**: `향상 N명 · PB N명 · 총 N명`.

### (3) 모호성 처리
- §3.5a로 저신뢰 슬롯엔 경고 + **맞바꾸기**(가장 가까운 슬롯과 swimmerId 교환, 1탭).
- 드롭다운 변경/맞바꾸기 시 향상치·PB·요약을 **즉시 재계산**.

> 변경 이력: 초기안은 *출발 전* 레인-선수 추천 + 선수 변경 시 타이머 리셋이었다. v2는 *측정 후* 배정으로 옮겨, 측정 집중도와 안전성을 높였다([02 §2.8]).

---

## 3.7 저장 (Persistence, FR-A6/R1)

- 배정 화면에서 각 슬롯의 스플릿 표를 보여주고 수정 가능.
- **CONFIRM** 시: 슬롯마다 1개의 `TrainingRecord` 생성(스키마 [04]) → 해당 선수 기록지에 append.
- 저장은 **트랜잭션**: 전부 저장 또는 전부 롤백.
- 자동 스냅샷(NFR-7): `RUNNING` 동안 N초마다 + 모든 탭 직후 로컬 직렬화. 복구 시 마지막 스냅샷 로드.

---

## 3.8 테스트 시나리오 (수용 기준)

| # | 시나리오 | 기대 |
| --- | --- | --- |
| TE-1 | 3명 100y/25y, 정확한 순서로 12탭 | 각 슬롯 4스플릿, 총합·누적 일치, 마지막 탭에 ASSIGN 전환 |
| TE-2 | TE-1에서 5번째 탭 오배정 → 슬롯 재할당 | 두 슬롯 스플릿 재계산, 불변식 통과 |
| TE-3 | 중복 탭 1회 → Undo | 탭 수 원복, 영향 슬롯 정상 |
| TE-4 | 한 슬롯 DNF | 나머지 정상 완주·저장, DNF 부분 기록 |
| TE-5 | 측정 중 인원 수 변경 | 확인 다이얼로그 → IDLE 리셋 |
| TE-6 | 2탭/초 연타 20회 | 입력 유실 0, 정확도 < 50ms |
| TE-7 | 측정 중 강제종료 후 재실행 | RUNNING 스냅샷 복구 |
| TE-8 | 배정: 두 슬롯 0.10초 차 | 두 카드 저신뢰 경고 + 맞바꾸기, PB muted |
| TE-9 | 배정: 선수 변경/맞바꾸기 | 향상치·PB·요약 즉시 재계산 |
| TE-10 | 시간 표시 | 전 구간 `mm:ss.SS`(1/100초) |
