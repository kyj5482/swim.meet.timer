# Swim Meet Timer (가칭: **SplitLane**)

수영 코치와 부모가 **여러 아이의 훈련 기록을 하나의 타이머로 동시에** 측정·관리하는 앱.

> 핵심 아이디어: 선수마다 Lap 버튼을 따로 두지 않고, **일반 스톱워치처럼 단 하나의 Lap 버튼**만 누른다.
> 앱이 각 탭(tap)을 "지금 벽을 찍을 차례인 선수"에게 자동으로 배정하고, 마지막 Stop이 끝나면 모든 선수의 기록이 **자동으로 기록지에 저장**된다.

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

## 디자인 프리뷰 (HTML)

`docs/design-preview/` 의 HTML 파일을 브라우저로 열어 확인할 수 있습니다.

| 파일 | 설명 |
| --- | --- |
| [design-preview/index.html](./design-preview/index.html) | 프리뷰 허브 (디자인 토큰 + 화면 링크) |
| [design-preview/timer.html](./design-preview/timer.html) | **동작하는 타이머 데모** — 단일 버튼으로 3명 기록을 실제로 측정해볼 수 있음 |
| [design-preview/records.html](./design-preview/records.html) | 선수 기록지 화면 목업 |

```bash
# 예: macOS
open docs/design-preview/timer.html
# Linux
xdg-open docs/design-preview/timer.html
```

## 한눈에 보는 MVP 범위

- ✅ 코스/구간 선택 (25m · 25y · 50m), 종목·거리 선택
- ✅ 다중 선수(레인 1~N) 동시 출발, **단일 Lap 버튼** 측정
- ✅ 실시간 전체 경과 시간 + 선수별 구간/누적 기록 즉시 표시
- ✅ 자동 배정 + 즉석 수정(잘못 배정된 Lap 재할당)
- ✅ 마지막 Stop 시 전 선수 기록 자동 저장
- ✅ 기존 기록 기반 레인-선수 추천 / 선수 변경 시 타이머 리셋
- ✅ 선수별 기록지(스플릿, 베스트, 추세)
- ✅ 오프라인 우선(poolside), 화면 항상 켜짐(wake lock)
