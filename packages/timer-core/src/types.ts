export type Course = '25m' | '25y' | '50m';
export type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'im';
export type SlotStatus = 'in_progress' | 'finished' | 'dnf';

export interface Target {
  stroke: Stroke;
  distance: number;
  course: Course;
  /** 스플릿 1개의 거리(풀 길이의 배수). distance와 같으면 1회 기록. */
  splitInterval: number;
}

export interface Split {
  segmentIndex: number;
  /** 출발(t0)로부터 누적 ms */
  cumulativeMs: number;
  /** 직전 세그먼트 대비 ms */
  splitMs: number;
}

export interface SlotState {
  /** 0-based. 표시 시 +1. 1라운드 도착 순서로 정의되는 익명 슬롯. */
  idx: number;
  splits: Split[];
  lastCumMs: number;
  nextSegmentIndex: number;
  status: SlotStatus;
  swimmerId: string | null;
  lowConfidence?: boolean;
}

export interface TapEvent {
  elapsedMs: number;
  slotIdx: number;
}

export interface CommitResult {
  slotIdx: number;
  segmentIndex: number;
  splitMs: number;
  cumulativeMs: number;
  slotFinished: boolean;
  /** 모든 슬롯이 finished/dnf → ASSIGN 단계로 전환 */
  allDone: boolean;
}

export interface EngineSnapshot {
  slotCount: number;
  segmentCount: number;
  t0: number | null;
  slots: SlotState[];
  taps: TapEvent[];
}
