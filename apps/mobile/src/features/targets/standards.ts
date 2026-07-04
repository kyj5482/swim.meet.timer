import type { LadderStep } from '@splitlane/timer-core';

import { CHAMP_LABEL, CHAMP_LEVELS, CHAMPS, type ChampLevel } from './championships.data';
import { MOTIVATIONAL } from './standards.data';

/**
 * 표준기록 조회. 데이터는 standards.data.ts(임포터 생성물,
 * tools/standards-import) + championships.data.ts(챔피언십 미트 컷) —
 * 코스×성별×(연령그룹)×종목 → 레벨별 컷타임(ms).
 * 값이 없는 조합은 null을 돌려주고 UI는 해당 선택지를 숨긴다.
 */
export type Gender = 'F' | 'M';
export type Level = 'B' | 'BB' | 'A' | 'AA' | 'AAA' | 'AAAA' | ChampLevel;
export const LEVELS: Level[] = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

/** 레벨 표시 이름 — 모티베이셔널은 코드 그대로, 챔피언십은 대회명. */
export function levelLabel(level: string): string {
  return (CHAMP_LABEL as Record<string, string>)[level] ?? level;
}

/** 표준기록 코스 표기. 앱 설정 코스('25y'|'25m'|'50m') → SCY/SCM/LCM. */
export type StdCourse = 'SCY' | 'SCM' | 'LCM';
export function stdCourse(appCourse: string): StdCourse {
  if (appCourse === '25m') return 'SCM';
  if (appCourse === '50m') return 'LCM';
  return 'SCY';
}

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

function times(course: StdCourse, gender: Gender, ag: AgeGroup, stroke: string, distance: number) {
  return MOTIVATIONAL[course]?.[gender]?.[ag]?.[eventCode(stroke, distance)] ?? null;
}

/** 챔피언십 미트 컷(연령 무관 사다리 상단) — 없으면 빈 배열. */
export function championshipSteps(
  course: StdCourse, gender: Gender, stroke: string, distance: number,
): LadderStep[] {
  const t = CHAMPS[course]?.[gender]?.[eventCode(stroke, distance)];
  if (!t) return [];
  const steps: LadderStep[] = [];
  for (const level of CHAMP_LEVELS) {
    const ms = t[level];
    if (ms != null) steps.push({ level, timeMs: ms });
  }
  return steps;
}

/**
 * 연령그룹 문자열로 직접 조회(타겟 시트에서 사용자가 그룹을 고를 때).
 * 모티베이셔널(B~AAAA) 위에 챔피언십 컷(Western Zones…NCAA D1 A)을 이어 붙여
 * 선수가 다음 단계 목표를 끊김 없이 볼 수 있게 한다.
 */
export function standardLadderForGroup(
  course: StdCourse, gender: Gender, ag: AgeGroup, stroke: string, distance: number,
): LadderStep[] | null {
  const t = times(course, gender, ag, stroke, distance);
  const steps: LadderStep[] = [];
  if (t) {
    for (const level of LEVELS) {
      const ms = t[level];
      if (ms != null) steps.push({ level, timeMs: ms });
    }
  }
  // 챔피언십 컷을 함께 반환 — 시간 정렬은 소비자(ladderPosition/차트)가 하므로
  // 연령그룹에 따라 모티베이셔널 레벨 사이에 자연스럽게 끼어든다.
  steps.push(...championshipSteps(course, gender, stroke, distance));
  return steps.length > 0 ? steps : null;
}

/** 이 조합에 표준 사다리가 있으면 LadderStep[](빠른→느린 정렬은 엔진이 처리), 없으면 null. */
export function standardLadder(
  course: StdCourse, gender: Gender, age: number | null, stroke: string, distance: number,
): LadderStep[] | null {
  const ag = ageGroup(age);
  if (!ag) return null;
  return standardLadderForGroup(course, gender, ag, stroke, distance);
}

/** 특정 레벨의 컷타임(ms) 또는 null. */
export function levelTime(
  course: StdCourse, gender: Gender, age: number | null, stroke: string, distance: number, level: Level,
): number | null {
  const ag = ageGroup(age);
  const t = ag ? times(course, gender, ag, stroke, distance)?.[level] : undefined;
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
