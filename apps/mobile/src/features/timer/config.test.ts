import { describe, expect, it } from 'vitest';
import { clockBase, distanceOptions, segmentCount, splitOptions } from './config';

describe('세그먼트 계산', () => {
  it('100/25 = 4구간, 100/100 = 1회', () => {
    expect(segmentCount({ course: '25y', distance: 100, splitInterval: 25 })).toBe(4);
    expect(segmentCount({ course: '25y', distance: 100, splitInterval: 100 })).toBe(1);
  });
  it('풀에서 잴 수 없는 조합은 null', () => {
    expect(segmentCount({ course: '50m', distance: 75, splitInterval: 25 })).toBeNull();
    expect(segmentCount({ course: '25m', distance: 100, splitInterval: 40 })).toBeNull();
  });
  it('스플릿 옵션은 거리의 약수인 풀 배수만', () => {
    expect(splitOptions('25y', 100)).toEqual([25, 50, 100]);
    expect(splitOptions('50m', 200)).toEqual([50, 100, 200]);
  });
  it('야드 코스에는 500 제공', () => {
    expect(distanceOptions('25y')).toContain(500);
    expect(distanceOptions('25m')).not.toContain(500);
  });
});

describe('clockBase: 이벤트 타임스탬프 ↔ performance.now 베이스 보정', () => {
  it('오프셋이 달라도 표시 경과시간이 정확하다', () => {
    // 터치 클락 원점이 performance보다 1000ms 뒤인 플랫폼 가정
    const base = clockBase(5_000, 6_000);
    expect(base.t0).toBe(5_000);
    // 2.5초 뒤 프레임: perf=8_500 → 이벤트 베이스 7_500 → 경과 2_500
    expect(base.toEventBase(8_500) - base.t0).toBe(2_500);
  });
});
