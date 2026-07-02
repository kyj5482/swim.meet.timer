/**
 * common/design-system.md 토큰의 유일한 구현.
 * 화면 코드에서 색·라운드 값을 직접 쓰지 말고 반드시 여기서 import 한다.
 */
export const color = {
  bg: '#081623',
  surface: '#0F2333',
  surface2: '#16344A',
  line: '#23465F',
  text: '#EAF4FB',
  textMuted: '#8EA9BE',
  accent: '#19E3C6',
  accentPress: '#0FBFA6',
  stop: '#FF5A4D',
  warn: '#FFC24B',
  ok: '#5BE584',
  lane: ['#FF4D6D', '#FFB020', '#19E3C6', '#5B8DEF', '#B36BFF', '#41D7A7', '#FF7A45', '#E8E04F'],
} as const;

export const radius = { card: 16, btn: 20, pill: 999 } as const;

/** 측정 화면 최소 터치 타깃(pt). LAP 버튼 높이는 88 이상. */
export const touch = { min: 56, lapButton: 88 } as const;

export function laneColor(i: number): string {
  return color.lane[i % color.lane.length]!;
}
