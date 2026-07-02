import type { Course, Stroke } from '@splitlane/timer-core';

export interface TimerConfig {
  course: Course;
  stroke: Stroke;
  distance: number;
  /** 스플릿 1개 거리(풀 길이의 배수). distance와 같으면 1회 기록. */
  splitInterval: number;
  slotCount: number;
}

export const COURSES: Course[] = ['25m', '25y', '50m'];
export const STROKES: Stroke[] = ['free', 'back', 'breast', 'fly', 'im'];

export function poolLength(course: Course): number {
  return course === '50m' ? 50 : 25;
}

export function courseUnit(course: Course): 'm' | 'y' {
  return course === '25y' ? 'y' : 'm';
}

/** 코스에서 선택 가능한 거리 목록. */
export function distanceOptions(course: Course): number[] {
  const len = poolLength(course);
  const base = [1, 2, 4, 8, 16].map((n) => n * len);
  return courseUnit(course) === 'y' ? [...base, 500] : base;
}

/** 거리에서 선택 가능한 스플릿 간격(풀 길이의 배수 + 전체 1회). */
export function splitOptions(course: Course, distance: number): number[] {
  const len = poolLength(course);
  const opts: number[] = [];
  for (let iv = len; iv <= distance; iv += len) {
    if (distance % iv === 0) opts.push(iv);
  }
  if (!opts.includes(distance)) opts.push(distance);
  return opts;
}

/** 세그먼트 수. 유효하지 않으면 null (풀에서 잴 수 없는 조합). */
export function segmentCount(cfg: Pick<TimerConfig, 'course' | 'distance' | 'splitInterval'>): number | null {
  const len = poolLength(cfg.course);
  if (cfg.distance % len !== 0) return null;
  if (cfg.splitInterval % len !== 0 && cfg.splitInterval !== cfg.distance) return null;
  if (cfg.distance % cfg.splitInterval !== 0) return null;
  return cfg.distance / cfg.splitInterval;
}

export const DEFAULT_CONFIG: TimerConfig = {
  course: '25y',
  stroke: 'free',
  distance: 100,
  splitInterval: 25,
  slotCount: 3,
};

/**
 * 터치 이벤트 타임스탬프(nativeEvent.timestamp)와 performance.now()는 플랫폼에
 * 따라 원점이 다를 수 있다. START 시점에 두 값을 함께 캡처해 고정 오프셋을 구하고,
 * 표시용 시계만 performance 시각을 이벤트 시각 베이스로 변환한다.
 * 엔진에 들어가는 탭 시각은 전부 이벤트 타임스탬프라 오프셋과 무관하게 정확하다.
 */
export function clockBase(pressTimestampMs: number, perfNowMs: number) {
  const offset = perfNowMs - pressTimestampMs;
  return {
    t0: pressTimestampMs,
    /** rAF 프레임의 performance 시각 → 이벤트 타임스탬프 베이스 */
    toEventBase: (perfMs: number) => perfMs - offset,
  };
}
