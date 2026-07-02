import { describe, expect, it } from 'vitest';
import { improvement, markLowConfidence, nearestSibling, recommend, swapSwimmers } from '../src/assign';
import type { SlotState } from '../src/types';

function slot(idx: number, totalMs: number): SlotState {
  return {
    idx, splits: [], lastCumMs: totalMs, nextSegmentIndex: 4,
    status: 'finished', swimmerId: null,
  };
}

describe('추천 매칭 (§3.6)', () => {
  it('전역 최소비용: 국소최적 함정에서도 올바르게 배정', () => {
    // 슬롯 52.0/53.0 vs typical 민준52.9/서연53.1 —
    // 시간순 최근접(그리디 per-slot)이면 52.0→민준(0.9)이지만
    // 전역 최소는 53.0↔민준(0.1) 페어가 먼저다.
    const s = [slot(0, 52_000), slot(1, 53_000)];
    recommend(s, [
      { swimmerId: 'minjun', typicalMs: 52_900, bestMs: null, lastMs: null },
      { swimmerId: 'seoyeon', typicalMs: 53_100, bestMs: null, lastMs: null },
    ]);
    expect(s[0]!.swimmerId).toBe('seoyeon'); // 남는 최소비용 조합
    expect(s[1]!.swimmerId).toBe('minjun');
  });
});

describe('TE-8: 저신뢰 (0.40초 이내)', () => {
  it('가까운 두 슬롯 모두 lowConfidence + 형제·격차 제공', () => {
    const s = [slot(0, 52_000), slot(1, 52_100), slot(2, 60_000)];
    markLowConfidence(s);
    expect(s[0]!.lowConfidence).toBe(true);
    expect(s[1]!.lowConfidence).toBe(true);
    expect(s[2]!.lowConfidence).toBe(false);
    const near = nearestSibling(s, s[0]!)!;
    expect(near.sibling.idx).toBe(1);
    expect(near.gapMs).toBe(100);
  });
});

describe('TE-9: 맞바꾸기·향상 재계산', () => {
  it('swap 후 improvement가 새 매핑 기준으로 계산된다', () => {
    const a = slot(0, 52_000);
    const b = slot(1, 55_000);
    a.swimmerId = 'fast';
    b.swimmerId = 'slow';
    swapSwimmers(a, b);
    expect(a.swimmerId).toBe('slow');
    const imp = improvement(a.lastCumMs, { bestMs: 54_000, lastMs: 55_500 });
    expect(imp.kind).toBe('improved');
    expect(imp.deltaMs).toBe(-3_500);
    expect(imp.isPB).toBe(true);
  });

  it('첫 기록 / 퇴보 / PB 경계', () => {
    expect(improvement(50_000, { bestMs: null, lastMs: null }).kind).toBe('first');
    const reg = improvement(56_000, { bestMs: 54_000, lastMs: 55_000 });
    expect(reg.kind).toBe('regressed');
    expect(reg.isPB).toBe(false);
    // 베스트와 동일 기록은 PB 아님
    expect(improvement(54_000, { bestMs: 54_000, lastMs: 55_000 }).isPB).toBe(false);
  });
});
