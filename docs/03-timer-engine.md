# 03. 타이머 엔진 명세 (Timer Engine Spec) — 핵심

이 문서는 제품의 심장인 **"단일 Lap 버튼 → 다중 선수 자동 배정"** 로직을 개발 가능한 수준으로 정의한다.

---

## 3.1 핵심 개념과 용어

- **Session(Heat)**: 동시에 출발해 함께 측정되는 한 묶음.
- **Position(레인)**: 세션 안의 자리 1..N. 화면의 행 순서. 각 레인은 한 선수에 매핑.
- **Target**: 레인의 측정 목표 = `{ stroke, distance, course(25m|25y|50m) }`.
  - `segmentCount = distance / course` (정수). 예) 100y, 구간 25y → `segmentCount = 4`.
- **Tap(Lap)**: 코치가 단일 버튼을 1회 누른 사건. 타임스탬프 1개 생성.
- **Split**: 한 레인의 한 세그먼트 기록. `{ segmentIndex, cumulativeMs, splitMs }`.
- **Pace model**: 한 선수의 세그먼트별 예상 소요시간. 기존 기록 또는 기본값에서 도출. → 자동 배정의 근거.

### 시간 기준 (NFR-1)
- 모든 타임스탬프는 **모노토닉 클락**(`performance.now()` / `CLOCK_MONOTONIC`)로 캡처. 시스템 시각/타임존 변경에 영향받지 않는다.
- `elapsed(tap) = tap.monotonic - session.t0`.
- UI 렌더링(60fps)과 입력 캡처(이벤트 즉시)는 **분리**한다. 탭 핸들러는 즉시 타임스탬프만 큐에 넣고, 배정/렌더는 다음 프레임에 처리해도 정확도 손실 없음.

---

## 3.2 측정 상태 기계 (State Machine)

```
            ┌─────────┐  configure / pick swimmers
            │  IDLE   │◄───────────────────────────┐
            └────┬────┘                            │
                 │ START (t0 캡처)                  │ RESET / 저장완료
                 ▼                                  │
            ┌─────────┐  LAP* (자동배정·재할당)        │
   PAUSE ◄──┤ RUNNING ├──► (레인 완주마다 표시)       │
   RESUME ─►└────┬────┘                            │
                 │ 모든 레인 완주(마지막 Stop)         │
                 ▼                                  │
            ┌─────────┐  검토/수정                    │
            │REVIEW   ├────────────────────────────►│
            │(저장확인)│  CONFIRM → 영속 저장           │
            └─────────┘
```

- `RUNNING` 중 레인의 swimmer를 바꾸면(FR-S6) → 확인 후 `IDLE`로 **RESET**.
- `RUNNING` 중 크래시 → 스냅샷에서 `RUNNING` 복구(NFR-7).

---

## 3.3 자동 배정 알고리즘 (Tap → Position)

> 목표: 코치가 "다음에 벽 찍는 선수" 순서대로 누르기만 하면, 앱이 각 탭을 올바른 레인에 배정한다.

### 입력
- `activeLanes`: 아직 완주하지 않은 레인 집합.
- 각 레인 `p`의 상태: `nextSegmentIndex[p]`, `lastCumMs[p]`(마지막 스플릿의 누적시간, 없으면 0).
- 각 레인 `p`의 pace model: `expectedSplitMs(p, segIdx)`.
- 새 탭의 `elapsed`.

### 예상 도착 시각
```
expectedArrival[p] = lastCumMs[p] + expectedSplitMs(p, nextSegmentIndex[p])
```

### 배정 규칙 (기본: 최근접 예상)
1. 후보 = `activeLanes`.
2. 각 후보의 `score[p] = |elapsed - expectedArrival[p]|`.
3. `score`가 **최소**인 레인 `p*`에 배정.
4. 동점/근접(임계 `τ` 이내 복수) 시 **tie-break**:
   - (a) 아직 이번 세그먼트 탭을 못 받은 레인 우선,
   - (b) `nextSegmentIndex`가 작은(뒤처진) 레인 우선,
   - (c) 그래도 같으면 레인 번호 순.
5. 배정 후 `p*` 갱신: 스플릿 기록, `nextSegmentIndex[p*]++`, `lastCumMs[p*]=elapsed`.
6. `nextSegmentIndex[p*] == segmentCount[p*]` 이면 `p*` **완주(Stop)** → `activeLanes`에서 제거.

### Pace model (`expectedSplitMs`)
우선순위로 fallback:
1. **개인 이력**: 같은 종목·코스의 최근 K세션 해당 세그먼트 평균(이상치 제거). 가장 정확.
2. **개인 전체 평균 페이스** × 세그먼트 가중(첫 구간은 스타트로 빠름, 마지막은 느려짐 등 곡선 가중치).
3. **세션 평균/기본값**: 이력 없으면 같은 세션 다른 레인 또는 디폴트 페이스(연령·종목 테이블).
4. 측정이 진행되며 **현재 세션 관측치로 온라인 업데이트**(EWMA): 1번째 구간을 보면 그 선수의 당일 컨디션을 반영해 이후 예상 보정.

> 핵심: 알고리즘이 완벽할 필요는 없다. **틀려도 1탭 수정**(§3.4)으로 100%가 되며, pace model은 "탭 순서가 애매할 때의 추측"을 좋게 만들 뿐이다.

### 의사코드
```ts
function onLap(elapsed: number, session: Session): Assignment {
  const cands = session.lanes.filter(l => !l.finished);
  if (cands.length === 0) return noop();

  let best = cands[0], bestScore = Infinity;
  for (const l of cands) {
    const exp = l.lastCumMs + pace(l, l.nextSegmentIndex);
    const s = Math.abs(elapsed - exp);
    if (s < bestScore - EPS || (Math.abs(s - bestScore) <= TAU && tieBreak(l, best))) {
      best = l; bestScore = s;
    }
  }
  const split = elapsed - best.lastCumMs;
  best.splits.push({ segmentIndex: best.nextSegmentIndex, cumulativeMs: elapsed, splitMs: split });
  best.lastCumMs = elapsed;
  best.nextSegmentIndex++;
  if (best.nextSegmentIndex === best.segmentCount) best.finished = true;
  updatePaceOnline(best); // EWMA
  return { lane: best, split, finishedAllLanes: cands.every(l => l.finished) };
}
```

### 경계 상황
| 상황 | 처리 |
| --- | --- |
| 두 선수 거의 동시 터치 | 코치가 빠르게 2탭. 알고리즘이 서로 다른 두 레인에 배정. 순서 틀리면 §3.4 재할당. |
| 실수로 한 번 더 누름(중복) | **Undo**(FR-T9)로 직전 탭 제거. |
| 한 구간 깜빡하고 못 누름 | 다음 탭이 엉뚱하게 배정 → 누락 보정(FR-T10): 빠진 세그먼트 수동 삽입 후 이후 자동 재정렬. |
| 한 레인 도중 포기 | DNF(FR-T11): 후보 제외, 지금까지 부분 기록 보존. |
| 모든 레인 완주 직전 마지막 탭 | 그 탭이 마지막 선수의 Stop → `REVIEW`로 전환. |

---

## 3.4 즉석 재할당 (Manual Correction)

자동 배정이 틀렸을 때, **시계를 멈추지 않고** 바로잡는다.

- **모델**: "마지막에 배정된 split을 다른 레인으로 옮긴다." 두 레인 모두 스플릿·누적·`nextSegmentIndex`를 재계산.
- **UX**: 방금 하이라이트된 배정 카드에서, 옮길 대상 레인 칩을 1탭. 또는 split을 끌어 다른 행에 드롭.
- **범위**: 최근 1~몇 개 탭 한정(되돌리기 쉬움). 종료(REVIEW) 후에는 전체 스플릿 표에서 자유 편집.
- **불변식 검증**(§3.5)을 매 수정마다 통과해야 함.

---

## 3.5 데이터 불변식 (Invariants)

엔진은 항상 다음을 만족해야 한다(테스트로 강제):

1. 각 레인의 splits는 `segmentIndex` 0..k 로 **연속·유일**.
2. `splitMs[i] = cumulativeMs[i] - cumulativeMs[i-1]` (i=0이면 cumulative와 동일), 모두 ≥ 0.
3. 완주 레인의 `splits.length == segmentCount`.
4. 모든 탭은 정확히 한 레인에 배정(또는 명시적 폐기). 탭 총수 = 배정 합 + 폐기 합.
5. `cumulativeMs`는 레인 내에서 **단조 증가**.
6. 세션 최종 저장 시 모든 레인이 `finished` 또는 `DNF`.

---

## 3.6 레인-선수 추천 (Pre-race Recommendation, FR-S4)

세션 설정 시 각 레인에 들어갈 선수를 추천한다.

- **신호(가중 합산)**:
  - 최근 같은 세트로 **함께 측정된 조합**(co-occurrence) — 가장 강한 신호.
  - 최근 활동(마지막 측정일이 가까운 선수).
  - 동일 종목/거리 훈련 빈도.
  - 직전 세션의 레인 배치(연속 세트 가정).
- **출력**: 레인별 추천 선수 + 대안 후보 리스트.
- **상호작용**: 추천을 그대로 쓰거나, 레인의 선수를 바꾸면(FR-S6) — 측정 시작 전이면 단순 교체, **측정 시작 후면 확인 → 타이머 리셋**.

> 리셋 이유: 출발 구성(누가 어느 레인)이 바뀌면 이미 들어간 탭들의 의미가 사라지므로, 데이터 무결성을 위해 초기화한다.

---

## 3.7 저장 (Persistence, FR-R1/R2)

- `REVIEW`에서 각 레인의 스플릿 표를 보여주고 수정 가능.
- **CONFIRM** 시: 레인마다 1개의 `TrainingRecord` 생성(스키마 [04]) → 해당 선수의 기록지에 append.
- 저장은 **트랜잭션**: 전부 저장 또는 전부 롤백.
- 자동 스냅샷(NFR-7): `RUNNING` 동안 N초마다 + 모든 탭 직후 로컬에 직렬화. 복구 시 마지막 스냅샷 로드.

---

## 3.8 테스트 시나리오 (수용 기준)

| # | 시나리오 | 기대 |
| --- | --- | --- |
| TE-1 | 3명 100y/25y, 정확한 순서로 12탭 | 각 레인 4스플릿, 총합·누적 일치, 마지막 탭에 REVIEW |
| TE-2 | TE-1에서 5번째 탭 오배정 → 재할당 | 두 레인 스플릿 재계산, 불변식 통과 |
| TE-3 | 중복 탭 1회 → Undo | 탭 수 원복, 영향 레인 정상 |
| TE-4 | 한 레인 DNF | 나머지 정상 완주·저장, DNF 부분 기록 |
| TE-5 | 측정 중 레인2 선수 교체 | 확인 다이얼로그 → IDLE 리셋 |
| TE-6 | 2탭/초 연타 20회 | 입력 유실 0, 정확도 < 50ms |
| TE-7 | 측정 중 강제종료 후 재실행 | RUNNING 스냅샷 복구 |
| TE-8 | 이력 없는 신규 선수 | 기본 페이스로 배정, 측정 후 이력 생성 |
