# Swim Meet Timer (가칭: **SplitLane**)

수영 코치와 부모가 **여러 아이의 훈련 기록을 하나의 타이머로 동시에** 측정·관리하는 앱.

> 핵심 아이디어: 선수마다 Lap 버튼을 따로 두지 않고, **일반 스톱워치처럼 단 하나의 Lap 버튼**만 누른다.
> 측정 중엔 **익명 슬롯(1번·2번·…)** 에 자동 배정하고, **측정이 끝난 뒤** 기록을 보고 각 슬롯에 선수를 배정한다.
> 배정 즉시 **이전 대비 향상·PB(실력 체크)** 를 보여주고, 저장하면 각 선수 기록지에 **자동 누적**된다. 시간은 **1/100초**.

---

## 문서 구성

| 문서 | 내용 |
| --- | --- |
| [01-product-vision.md](./01-product-vision.md) | 문제 정의, 타깃 사용자, 가치 제안, 성공 지표 |
| [02-requirements.md](./02-requirements.md) | 기능/비기능 요구사항 (개발 요구사항 수준, FR/NFR ID 부여) |
| [03-timer-engine.md](./03-timer-engine.md) | **핵심**: 단일 Lap 버튼 → 다중 선수 기록 분배 알고리즘 명세 |
| [04-data-model.md](./04-data-model.md) | 엔티티/스키마, 저장·동기화 모델 |
| [05-ux-flows.md](./05-ux-flows.md) | 화면 구성, 주요 플로우, 상태 다이어그램 |
| [06-design-guide.md](./06-design-guide.md) | 디자인 시스템, 컬러/타이포/컴포넌트 가이드 |
| [07-field-research.md](./07-field-research.md) | 코치·부모의 스톱워치 고충 리서치 → 설계 반영 |

## 디자인 프리뷰 (HTML)

`docs/design-preview/` 의 HTML 파일을 브라우저로 열어 확인할 수 있습니다.

| 파일 | 설명 |
| --- | --- |
| [design-preview/index.html](./design-preview/index.html) | 프리뷰 허브 (디자인 토큰 + 화면 링크) |
| [design-preview/timer.html](./design-preview/timer.html) | **동작하는 타이머 데모** — 단일 버튼으로 3명 기록을 실제로 측정해볼 수 있음 |
| [design-preview/records.html](./design-preview/records.html) | 선수 기록지 화면 목업 |

## 배정 알고리즘 벤치마크

레인 순서 변화(갈때 2-3-4-5 / 올때 2-4-3-5)·출발 다이브를 반영해 배정 전략 정확도를 측정합니다.

```bash
node bench/lap-assignment-bench.mjs   # 결과: bench/RESULTS.md
```

요약: 그리디(구) **25%** → **라운드 단조매칭 ~72%** 채택, 레인 이력 모드(선택) **~76%**(복귀 역전 97%).

```bash
# 예: macOS
open docs/design-preview/timer.html
# Linux
xdg-open docs/design-preview/timer.html
```

## 한눈에 보는 MVP 범위

- ✅ 코스/구간 선택 (25m · 25y · 50m), 종목·거리 선택, **인원 +/-**
- ✅ 익명 슬롯(1~N) 동시 출발, **단일 Lap 버튼** 측정 (1/100초)
- ✅ 실시간 전체 경과 시간 + 슬롯별 구간/누적 즉시 표시 + 랩 진행도
- ✅ 자동 배정 + 즉석 수정(잘못 배정된 Lap 재할당)
- ✅ **측정 후** 기록 기반 선수 추천 → 배정 → **이전 대비 향상·PB 즉시 표시**
- ✅ 비슷한 기록은 "확인 필요" + **원탭 맞바꾸기** 안전장치
- ✅ 저장 시 각 선수 기록지에 자동 누적
- ✅ 선수별 기록지(스플릿, 베스트, 추세)
- ✅ 오프라인 우선(poolside), 화면 항상 켜짐(wake lock)
