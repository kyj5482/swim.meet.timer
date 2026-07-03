import type { LadderStep } from '@splitlane/timer-core';

/**
 * 표준기록 데이터(온디바이스 subset). 값은 실제 USA Swimming 2024-2028 SCY
 * Motivational에서 확인한 것만 verified. 전체 공식 임포트는 백엔드 T-204.
 * 출처: swimstandards.com / USA Swimming 공식 PDF (2024-2028).
 *
 * 구조가 핵심 — 여기에 (성별×연령대×종목) 키를 추가하면 그대로 확장된다.
 */
export type Gender = 'F' | 'M';
export type Level = 'B' | 'BB' | 'A' | 'AA' | 'AAA' | 'AAAA';
export const LEVELS: Level[] = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

/** 종목 키: `${distance}${strokeCode}` 예 '50FR','100BK'. */
const STROKE_CODE: Record<string, string> = { free: 'FR', back: 'BK', breast: 'BR', fly: 'FL', im: 'IM' };
export function eventCode(stroke: string, distance: number): string {
  return `${distance}${STROKE_CODE[stroke] ?? stroke.toUpperCase()}`;
}

export const AGE_GROUPS = ['10U', '11-12', '13-14', '15-16', '17-18'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** 만 나이 → USA Swimming 연령 그룹. */
export function ageGroup(age: number | null): AgeGroup | null {
  if (age == null) return null;
  if (age <= 10) return '10U';
  if (age <= 12) return '11-12';
  if (age <= 14) return '13-14';
  if (age <= 16) return '15-16';
  return '17-18';
}

type LevelTimes = Record<Level, number>; // ms
const sec = (s: number) => Math.round(s * 1000);

/**
 * MOTIVATIONAL[gender][ageGroup][eventCode] = 레벨별 컷타임(ms).
 * 현재 verified: 여자 11-12 SCY 50 Free / 100 Free (2024-2028).
 */
const MOTIVATIONAL: Record<string, Record<string, Record<string, LevelTimes>>> = {
  F: {
    '11-12': {
      '50FR': { B: sec(31.79), BB: sec(29.49), A: sec(27.29), AA: sec(26.09), AAA: sec(24.99), AAAA: sec(23.89) },
      '100FR': { B: sec(68.79), BB: sec(63.79), A: sec(58.89), AA: sec(56.49), AAA: sec(53.99), AAAA: sec(51.59) },
    },
  },
};

/** 연령그룹 문자열로 직접 조회(타겟 시트에서 사용자가 그룹을 고를 때). */
export function standardLadderForGroup(gender: Gender, ag: AgeGroup, stroke: string, distance: number): LadderStep[] | null {
  const times = MOTIVATIONAL[gender]?.[ag]?.[eventCode(stroke, distance)];
  if (!times) return null;
  return LEVELS.map((level) => ({ level, timeMs: times[level] }));
}

/** 이 조합에 표준 사다리가 있으면 LadderStep[](빠른→느린 정렬은 엔진이 처리), 없으면 null. */
export function standardLadder(gender: Gender, age: number | null, stroke: string, distance: number): LadderStep[] | null {
  const ag = ageGroup(age);
  if (!ag) return null;
  return standardLadderForGroup(gender, ag, stroke, distance);
}

/** 특정 레벨의 컷타임(ms) 또는 null. */
export function levelTime(gender: Gender, age: number | null, stroke: string, distance: number, level: Level): number | null {
  const ag = ageGroup(age);
  const t = ag ? MOTIVATIONAL[gender]?.[ag]?.[eventCode(stroke, distance)]?.[level] : undefined;
  return t ?? null;
}

/**
 * 클럽 그룹 승급 조건(리서치 시드 — common/standards/seed/club-groups.nova-va.json).
 * 조건이 표준 레벨을 참조하므로, 위 MOTIVATIONAL로 실제 시간까지 해석된다.
 */
export interface ClubGroup {
  clubId: string;
  clubName: string;
  groupId: string;
  name: string;
  /** 대표 승급 조건(요약). 실제 판정은 requirement별 개별. */
  requirements: { event: string; distance: number; stroke: string; level: Level }[];
  note?: string;
}

export const CLUB_GROUPS: ClubGroup[] = [
  {
    clubId: 'nova-va', clubName: 'NOVA of Virginia Aquatics', groupId: 'AGD-SILVER',
    name: 'Age Group Dev · Silver',
    requirements: [
      { event: '100FR', distance: 100, stroke: 'free', level: 'B' },
      { event: '100IM', distance: 100, stroke: 'im', level: 'B' },
    ],
    note: 'AGD Silver 진입: 100 Free·100 IM B 타임 (+주 2~3회)',
  },
  {
    clubId: 'nova-va', clubName: 'NOVA of Virginia Aquatics', groupId: 'AGD-GOLD',
    name: 'Age Group Dev · Gold',
    requirements: [
      { event: '100FR', distance: 100, stroke: 'free', level: 'BB' },
      { event: '100IM', distance: 100, stroke: 'im', level: 'BB' },
    ],
    note: '10&U 최상위 그룹 (추정 — 클럽 공지로 검증 필요)',
  },
];
