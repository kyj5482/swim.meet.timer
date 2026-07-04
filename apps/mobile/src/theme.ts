import { Platform } from 'react-native';

/**
 * common/design-system.md 토큰의 유일한 구현.
 * 화면 코드에서 색·라운드 값을 직접 쓰지 말고 반드시 여기서 import 한다.
 *
 * 팔레트: "수영장 물빛" 계열의 차분한 프로페셔널 톤(MeetMobile 지향) —
 * 형광 민트 대신 풀 레인 블루를 액션 컬러로 쓰고, 배경은 딥 네이비.
 * 눈이 아프지 않도록 채도·명도를 낮췄다.
 */
export const color = {
  bg: '#0A1929',
  surface: '#11263A',
  surface2: '#18334B',
  line: '#25455F',
  text: '#EAF3FA',
  textMuted: '#8FA9BD',
  /** 액션(START/SAVE/선택) — 풀 레인 블루. */
  accent: '#3D8FC9',
  accentPress: '#31759F',
  /** accent 배경 위의 잉크 */
  accentInk: '#FFFFFF',
  stop: '#D95F52',
  warn: '#D9A84E',
  warnInk: '#33270B',
  ok: '#4FB286',
  okInk: '#07281A',
  lane: ['#D96379', '#D9A84E', '#3D8FC9', '#6A8FD8', '#9B7ED9', '#4FB286', '#D9825A', '#C9BE5A'],
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

/**
 * 표준기록 레벨 배지/셀 색 — B(입문)→AAAA(모티베이셔널 최상위)→챔피언십
 * 미트 컷(Western Zones … NCAA D1 A) 진행 램프(어두운 배경 위).
 */
const STD_LEVEL: Record<string, string> = {
  B: '#6A8FD8', BB: '#4FA3C9', A: '#3D8FC9', AA: '#4FB286', AAA: '#D9A84E', AAAA: '#D9825A',
  // 챔피언십 미트(모티베이셔널 위 단계) — 금·보라 계열로 위상 구분
  WZ: '#B58ADB', FW: '#A275D9', SECT: '#8F5FD1', NCSA: '#7C4DC4',
  FUT: '#C9A227', TYR: '#C9922E', WJR: '#D4AF37', JNAT: '#E0B939',
  NAT: '#EFCB4F', D1A: '#F5D76E',
};
export function stdLevelColor(level: string): string {
  return STD_LEVEL[level] ?? color.textMuted;
}

/** 이름 이니셜(아바타용) — 한글은 첫 글자, 영문은 두 글자. */
export function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return /[a-zA-Z]/.test(t[0]!) ? t.slice(0, 2).toUpperCase() : t[0]!;
}
