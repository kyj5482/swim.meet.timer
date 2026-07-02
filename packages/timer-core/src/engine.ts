import type { CommitResult, EngineSnapshot, SlotState, TapEvent } from './types';

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * 라운드 단조매칭 타이머 엔진 (docs/03-timer-engine.md §3.2~3.5).
 *
 * 시간은 절대 내부에서 읽지 않는다 — 모든 입력이 모노토닉 타임스탬프를 주입한다
 * (앱은 터치/키 이벤트가 가진 OS 캡처 시각을 넘긴다). 이 덕분에 완전 결정적으로
 * 테스트되고, JS 처리 지연이 기록 정확도에 영향을 주지 않는다.
 */
export class TimerEngine {
  readonly slotCount: number;
  readonly segmentCount: number;
  private t0: number | null = null;
  private slots: SlotState[] = [];
  private taps: TapEvent[] = [];

  constructor(slotCount: number, segmentCount: number) {
    if (!Number.isInteger(slotCount) || slotCount < 1) throw new Error('slotCount >= 1');
    if (!Number.isInteger(segmentCount) || segmentCount < 1) throw new Error('segmentCount >= 1');
    this.slotCount = slotCount;
    this.segmentCount = segmentCount;
  }

  /** START. t0 = 모노토닉 캡처 시각(ms). */
  start(t0: number): void {
    this.t0 = t0;
    this.taps = [];
    this.slots = Array.from({ length: this.slotCount }, (_, idx) => ({
      idx,
      splits: [],
      lastCumMs: 0,
      nextSegmentIndex: 0,
      status: 'in_progress' as const,
      swimmerId: null,
    }));
  }

  get running(): boolean {
    return this.t0 !== null && !this.allDone;
  }

  get allDone(): boolean {
    return this.slots.length > 0 && this.slots.every((s) => s.status !== 'in_progress');
  }

  get state(): readonly SlotState[] {
    return this.slots;
  }

  get tapEvents(): readonly TapEvent[] {
    return this.taps;
  }

  elapsed(now: number): number {
    return this.t0 === null ? 0 : now - this.t0;
  }

  private active(): SlotState[] {
    return this.slots.filter((s) => s.status === 'in_progress');
  }

  /**
   * 현재 라운드 = 진행 중 슬롯의 최소 nextSegmentIndex.
   * 라운드에서 아직 탭을 안 받은 슬롯 = nextSegmentIndex === round (파생 —
   * 별도 tapped 집합이 필요 없어 undo 후에도 상태가 항상 일관된다).
   */
  private due(): SlotState[] {
    const active = this.active();
    if (active.length === 0) return [];
    const round = Math.min(...active.map((s) => s.nextSegmentIndex));
    return active.filter((s) => s.nextSegmentIndex === round);
  }

  /** 슬롯이 이번 세션에서 관측한 스플릿의 EWMA(최근 가중, α=0.6). */
  private ewmaPace(s: SlotState, alpha = 0.6): number {
    const first = s.splits[0];
    if (!first) return 0;
    let p = first.splitMs;
    for (let i = 1; i < s.splits.length; i++) p = alpha * s.splits[i]!.splitMs + (1 - alpha) * p;
    return p;
  }

  /** LAP 버튼이 가리키는 예측 슬롯 (§3.3 라운드 단조매칭). */
  peekNext(): SlotState | null {
    const due = this.due();
    if (due.length === 0) return null;
    const round = due[0]!.nextSegmentIndex;
    if (round === 0) {
      // 1라운드: 도착 순서가 슬롯 번호를 정의 → 가장 앞 번호부터
      return due.slice().sort((a, b) => a.idx - b.idx)[0]!;
    }
    return due
      .map((s) => ({ s, exp: s.lastCumMs + this.ewmaPace(s) }))
      .sort((a, b) => a.exp - b.exp)[0]!.s;
  }

  /** 단일 LAP 버튼: 예측 슬롯에 기록. */
  lap(now: number): CommitResult | null {
    return this.commit(this.peekNext(), now);
  }

  /** 레인 행 직접 탭(WYSIWYG): 이번 라운드의 그 슬롯에 기록. */
  tapLane(idx: number, now: number): CommitResult | null {
    const slot = this.due().find((s) => s.idx === idx);
    return this.commit(slot ?? null, now);
  }

  private commit(slot: SlotState | null | undefined, now: number): CommitResult | null {
    if (!slot || this.t0 === null) return null;
    const elapsedMs = now - this.t0;
    if (elapsedMs < slot.lastCumMs) return null; // 시간 역행 입력 거부 (불변식 5)
    const splitMs = elapsedMs - slot.lastCumMs;
    slot.splits.push({ segmentIndex: slot.nextSegmentIndex, cumulativeMs: elapsedMs, splitMs });
    slot.lastCumMs = elapsedMs;
    slot.nextSegmentIndex++;
    if (slot.nextSegmentIndex === this.segmentCount) slot.status = 'finished';
    this.taps.push({ elapsedMs, slotIdx: slot.idx });
    return {
      slotIdx: slot.idx,
      segmentIndex: slot.nextSegmentIndex - 1,
      splitMs,
      cumulativeMs: elapsedMs,
      slotFinished: slot.status === 'finished',
      allDone: this.allDone,
    };
  }

  /** 직전 탭 제거 (FR-T10). */
  undo(): boolean {
    const tap = this.taps.pop();
    if (!tap) return false;
    const s = this.slots[tap.slotIdx]!;
    s.splits.pop();
    s.nextSegmentIndex--;
    if (s.status === 'finished') s.status = 'in_progress';
    s.lastCumMs = s.splits.length ? s.splits[s.splits.length - 1]!.cumulativeMs : 0;
    return true;
  }

  /** 도중 포기 (FR-T12). 부분 기록 보존. */
  markDnf(idx: number): void {
    const s = this.slots[idx];
    if (s && s.status === 'in_progress') s.status = 'dnf';
  }

  /** 크래시 복구용 스냅샷 (NFR-7). JSON 직렬화 가능(RN Hermes 호환). */
  snapshot(): EngineSnapshot {
    return deepCopy({
      slotCount: this.slotCount,
      segmentCount: this.segmentCount,
      t0: this.t0,
      slots: this.slots,
      taps: this.taps,
    });
  }

  static restore(snap: EngineSnapshot): TimerEngine {
    const e = new TimerEngine(snap.slotCount, snap.segmentCount);
    e.t0 = snap.t0;
    e.slots = deepCopy(snap.slots);
    e.taps = deepCopy(snap.taps);
    return e;
  }

  /** 데이터 불변식 검증 (§3.5). 위반 목록 반환(빈 배열 = 정상). */
  validate(): string[] {
    const errs: string[] = [];
    let assigned = 0;
    for (const s of this.slots) {
      assigned += s.splits.length;
      s.splits.forEach((sp, i) => {
        if (sp.segmentIndex !== i) errs.push(`slot ${s.idx}: segmentIndex not contiguous at ${i}`);
        const prevCum = i === 0 ? 0 : s.splits[i - 1]!.cumulativeMs;
        if (sp.splitMs !== sp.cumulativeMs - prevCum) errs.push(`slot ${s.idx}: split/cum mismatch at ${i}`);
        if (sp.splitMs < 0) errs.push(`slot ${s.idx}: negative split at ${i}`);
        if (i > 0 && sp.cumulativeMs <= prevCum) errs.push(`slot ${s.idx}: cumulative not increasing at ${i}`);
      });
      if (s.status === 'finished' && s.splits.length !== this.segmentCount)
        errs.push(`slot ${s.idx}: finished with ${s.splits.length}/${this.segmentCount} splits`);
    }
    if (assigned !== this.taps.length) errs.push(`taps ${this.taps.length} != assigned splits ${assigned}`);
    return errs;
  }
}
