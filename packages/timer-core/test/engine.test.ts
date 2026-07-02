import { describe, expect, it } from 'vitest';
import { TimerEngine } from '../src/engine.js';

/** 3명 × 100/25(4구간) 세션. 페이스: A(30s) < B(32s) < C(34s) */
function session3x4() {
  const e = new TimerEngine(3, 4);
  e.start(0);
  return e;
}

describe('TE-1: 3명 100/25, 정순 12탭', () => {
  it('각 슬롯 4스플릿, 누적·총합 일치, 마지막 탭에 allDone', () => {
    const e = session3x4();
    const paces = [30_000, 32_000, 34_000];
    let last: ReturnType<TimerEngine['lap']> = null;
    for (let seg = 1; seg <= 4; seg++)
      for (const p of paces) last = e.lap(p * seg);
    expect(last?.allDone).toBe(true);
    e.state.forEach((s, i) => {
      expect(s.splits.length).toBe(4);
      expect(s.status).toBe('finished');
      expect(s.lastCumMs).toBe(paces[i]! * 4);
      s.splits.forEach((sp) => expect(sp.splitMs).toBe(paces[i]));
    });
    expect(e.validate()).toEqual([]);
  });
});

describe('TE-3: 중복 탭 → Undo', () => {
  it('탭 수 원복, 영향 슬롯 정상, 불변식 통과', () => {
    const e = session3x4();
    e.lap(30_000);
    e.lap(32_000);
    e.lap(32_100); // 실수 중복 탭 (3번 주자가 아직인데 눌림)
    expect(e.tapEvents.length).toBe(3);
    expect(e.undo()).toBe(true);
    expect(e.tapEvents.length).toBe(2);
    expect(e.state[2]!.splits.length).toBe(0);
    e.lap(34_000); // 실제 3번 도착
    expect(e.state[2]!.splits[0]!.cumulativeMs).toBe(34_000);
    expect(e.validate()).toEqual([]);
  });

  it('완주 직후 Undo하면 슬롯이 in_progress로 돌아온다', () => {
    const e = new TimerEngine(1, 2);
    e.start(0);
    e.lap(10_000);
    e.lap(20_000);
    expect(e.allDone).toBe(true);
    e.undo();
    expect(e.state[0]!.status).toBe('in_progress');
    expect(e.state[0]!.lastCumMs).toBe(10_000);
    expect(e.allDone).toBe(false);
  });
});

describe('TE-4: DNF', () => {
  it('나머지 정상 완주, DNF 부분 기록 보존', () => {
    const e = new TimerEngine(2, 4);
    e.start(0);
    e.lap(30_000); // slot0 seg1
    e.lap(33_000); // slot1 seg1
    e.markDnf(1);
    for (const t of [60_000, 90_000, 120_000]) e.lap(t); // slot0만 남음
    expect(e.state[0]!.status).toBe('finished');
    expect(e.state[1]!.status).toBe('dnf');
    expect(e.state[1]!.splits.length).toBe(1);
    expect(e.allDone).toBe(true);
    expect(e.validate()).toEqual([]);
  });
});

describe('TE-6: 연타 입력 유실 없음', () => {
  it('2탭/초 20회 — 전부 배정, 타임스탬프 그대로 보존', () => {
    const e = new TimerEngine(2, 10);
    e.start(0);
    for (let i = 0; i < 20; i++) e.lap(500 * (i + 1));
    expect(e.tapEvents.length).toBe(20);
    const total = e.state.reduce((a, s) => a + s.splits.length, 0);
    expect(total).toBe(20);
    expect(e.validate()).toEqual([]);
  });
});

describe('TE-7: 스냅샷 복구', () => {
  it('RUNNING 중 스냅샷 → 복구 후 이어서 측정', () => {
    const e = session3x4();
    e.lap(30_000);
    e.lap(32_000);
    const snap = e.snapshot();
    const r = TimerEngine.restore(snap);
    expect(r.state[0]!.lastCumMs).toBe(30_000);
    r.lap(34_000); // 3번 도착
    expect(r.state[2]!.splits.length).toBe(1);
    expect(r.validate()).toEqual([]);
  });
});

describe('TE-11: 순서 일관 시나리오 — 단조매칭 100%', () => {
  it('페이스 격차가 벌어져도 LAP만으로 정확 추적', () => {
    const e = new TimerEngine(3, 4);
    e.start(0);
    // 도착 시각 매트릭스: 세 슬롯의 페이스가 서로 다르게 변함(라운드 순서는 유지)
    const arrivals: [number, number][] = [];
    const pace = [[28, 29, 30, 31], [32, 32, 32, 32], [34, 35, 36, 37]];
    pace.forEach((ps, slot) => {
      let cum = 0;
      ps.forEach((p) => { cum += p * 1000; arrivals.push([cum, slot]); });
    });
    arrivals.sort((a, b) => a[0] - b[0]);
    for (const [t, expectSlot] of arrivals) {
      const r = e.lap(t);
      expect(r?.slotIdx).toBe(expectSlot);
    }
    expect(e.validate()).toEqual([]);
  });
});

describe('TE-12: 복귀 역전(2-4-3-5) — 레인 직접 탭은 100%', () => {
  it('tapLane은 역전 순서에서도 코치가 본 대로 기록한다', () => {
    const e = new TimerEngine(4, 2);
    e.start(0);
    // 1라운드 도착: 슬롯 0,1,2,3 (= 레인 2,3,4,5)
    [30, 31, 32, 33].forEach((s, i) => e.tapLane(i, s * 1000));
    // 2라운드 복귀 역전: 0,2,1,3 (= 2-4-3-5)
    const order = [0, 2, 1, 3];
    const times = [59, 60, 61, 63];
    order.forEach((idx, i) => {
      const r = e.tapLane(idx, times[i]! * 1000);
      expect(r?.slotIdx).toBe(idx);
    });
    expect(e.allDone).toBe(true);
    expect(e.state[2]!.lastCumMs).toBe(60_000); // 역전한 4레인
    expect(e.validate()).toEqual([]);
  });

  it('같은 라운드에 같은 레인 두 번 탭은 무시된다', () => {
    const e = new TimerEngine(2, 4);
    e.start(0);
    expect(e.tapLane(0, 30_000)?.slotIdx).toBe(0);
    expect(e.tapLane(0, 30_500)).toBeNull(); // 라운드 내 중복
    expect(e.tapLane(1, 33_000)?.slotIdx).toBe(1);
    expect(e.tapLane(0, 58_000)?.slotIdx).toBe(0); // 다음 라운드는 허용
  });
});

describe('경계·불변식', () => {
  it('모든 슬롯 완주 후 추가 lap은 무시', () => {
    const e = new TimerEngine(1, 1);
    e.start(0);
    e.lap(10_000);
    expect(e.lap(11_000)).toBeNull();
    expect(e.tapEvents.length).toBe(1);
  });

  it('시간 역행 입력은 거부한다', () => {
    const e = new TimerEngine(1, 4);
    e.start(1_000_000);
    e.lap(1_030_000);
    expect(e.lap(1_020_000)).toBeNull(); // 이전 누적보다 이른 시각
    expect(e.validate()).toEqual([]);
  });

  it('undo 후 예측(peekNext)이 일관된다 — 라운드 상태는 파생', () => {
    const e = session3x4();
    e.lap(30_000);
    e.lap(32_000);
    e.undo();
    expect(e.peekNext()!.idx).toBe(1); // 아직 1라운드: 다음 도착 = 슬롯1
    e.lap(32_000);
    e.lap(34_000);
    // 2라운드: 페이스 EWMA가 가장 빠른 슬롯0 예측
    expect(e.peekNext()!.idx).toBe(0);
    expect(e.validate()).toEqual([]);
  });
});
