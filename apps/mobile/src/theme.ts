import { Platform } from 'react-native';

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
  /** accent 배경 위의 잉크 */
  accentInk: '#04221d',
  stop: '#FF5A4D',
  warn: '#FFC24B',
  warnInk: '#3a2a05',
  ok: '#5BE584',
  okInk: '#06270f',
  lane: ['#FF4D6D', '#FFB020', '#19E3C6', '#5B8DEF', '#B36BFF', '#41D7A7', '#FF7A45', '#E8E04F'],
} as const;

export const radius = { card: 16, btn: 20, pill: 999 } as const;

/** 숫자·시간 표기는 반드시 mono + tabular-nums (자릿수 흔들림 금지). */
export const font = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const;

/** 측정 화면 최소 터치 타깃(pt). 메인(START/LAP) 버튼은 PWA와 동일 104pt. */
export const touch = { min: 56, lapButton: 104 } as const;

export function laneColor(i: number): string {
  return color.lane[i % color.lane.length]!;
}

/** 이름 이니셜(아바타용) — 한글은 첫 글자, 영문은 두 글자. */
export function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return /[a-zA-Z]/.test(t[0]!) ? t.slice(0, 2).toUpperCase() : t[0]!;
}
