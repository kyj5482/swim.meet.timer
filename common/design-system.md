# 공통 디자인 시스템 (모든 화면·서비스가 이 문서를 따른다)

수영장 사이드(poolside) 환경 기준: 젖은 손, 강한 햇빛/실내 대비, 한 손 조작,
시선은 물에. → **다크 기본, 초대형 터치 타깃, 고대비, 모노스페이스 숫자**.

## 토큰 (RN `theme.ts`와 웹이 공유하는 단일 소스)

```ts
export const color = {
  bg: '#081623', surface: '#0F2333', surface2: '#16344A', line: '#23465F',
  text: '#EAF4FB', textMuted: '#8EA9BE',
  accent: '#19E3C6', accentPress: '#0FBFA6',
  stop: '#FF5A4D', warn: '#FFC24B', ok: '#5BE584',
  lane: ['#FF4D6D','#FFB020','#19E3C6','#5B8DEF','#B36BFF','#41D7A7','#FF7A45','#E8E04F'],
};
export const radius = { card: 16, btn: 20, pill: 999 };
export const font = {
  mono: 'JetBrainsMono',   // 숫자·시간 — tabular-nums 필수
  sans: 'Pretendard',      // 본문 (fallback: system)
};
```

## 규칙

1. **시간 표기**: 항상 1/100초. 60초 미만 `SS.hh`, 이상 `MM:SS.hh`. 스플릿 `:SS.hh`.
   숫자는 mono + tabular-nums(자릿수 흔들림 금지).
2. **터치 타깃**: 측정 화면 최소 56pt, 레인 행은 풀폭. LAP 버튼은 화면 하단 고정
   대형(높이 ≥ 88pt). `touch-action: manipulation` 상당(300ms 지연 금지).
3. **레인 색**: `lane[i % 8]` 고정 매핑 — 측정·배정·기록지에서 동일 색 유지.
4. **피드백**: 랩마다 햅틱(가벼움) + 레인 행 펄스. 향상 `ok`/퇴보 `stop` 색,
   PB는 🏅 배지, 저신뢰(0.40초 이내)는 muted 처리 + 경고 바.
5. **다크 기본**, 라이트는 후순위. 애니메이션은 reduced-motion 존중.
6. 새 화면은 이 문서의 토큰 외 색·라운드 값을 만들지 않는다. 필요하면 이 문서에
   먼저 추가하고 사용.

원본 참고: `docs/06-design-guide.md`, `docs/design-preview/tokens.css`.
