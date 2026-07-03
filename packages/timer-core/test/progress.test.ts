import { describe, expect, it } from 'vitest';
import {
  achievement, acceleration, improvementSlopePerDay, ladderPosition,
  projectTargetDate, trajectory, type LadderStep, type TrendPoint,
} from '../src/progress';

const DAY = 86_400_000;

describe('achievement — 달성률(낮을수록 좋음)', () => {
  it('best가 target보다 느리면 100% 미만', () => {
    const a = achievement(60_000, 55_000); // 60초, 타겟 55초
    expect(a.percent).toBeCloseTo(91.7, 1);
    expect(a.remainingMs).toBe(5_000);
    expect(a.reached).toBe(false);
  });
  it('best가 target에 도달/초과하면 달성', () => {
    expect(achievement(55_000, 55_000).reached).toBe(true);
    const a = achievement(54_000, 55_000);
    expect(a.reached).toBe(true);
    expect(a.percent).toBeGreaterThan(100);
    expect(a.remainingMs).toBeLessThan(0);
  });
});

describe('ladderPosition — 표준 사다리 위치', () => {
  const steps: LadderStep[] = [
    { level: 'B', timeMs: 70_000 },
    { level: 'BB', timeMs: 65_000 },
    { level: 'A', timeMs: 60_000 },
    { level: 'AA', timeMs: 56_000 },
    { level: 'AAA', timeMs: 53_000 },
  ];
  it('중간 레벨 달성 + 다음 목표', () => {
    const p = ladderPosition(58_000, steps); // A는 통과(<=60k), AA(56k) 미달
    expect(p.reached?.level).toBe('A');
    expect(p.next?.level).toBe('AA');
    expect(p.toNextMs).toBe(2_000);
  });
  it('아직 최저 레벨도 못 미침', () => {
    const p = ladderPosition(75_000, steps);
    expect(p.reached).toBeNull();
    expect(p.next?.level).toBe('B');
  });
  it('최고 레벨 달성', () => {
    const p = ladderPosition(52_000, steps);
    expect(p.reached?.level).toBe('AAA');
    expect(p.next).toBeNull();
    expect(p.toNextMs).toBeNull();
  });
});

describe('improvementSlopePerDay — 개선 기울기', () => {
  it('꾸준히 빨라지면 음수 기울기', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_000 },
      { date: 20 * DAY, totalMs: 58_000 },
    ];
    const s = improvementSlopePerDay(pts);
    expect(s).toBeCloseTo(-100, 0); // 하루 100ms씩 빨라짐
  });
  it('점 1개면 null', () => {
    expect(improvementSlopePerDay([{ date: 0, totalMs: 1 }])).toBeNull();
  });
});

describe('acceleration — 향상 가속도', () => {
  it('후반에 더 가팔라지면 improving', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_800 },
      { date: 20 * DAY, totalMs: 59_600 },
      { date: 30 * DAY, totalMs: 59_000 },
      { date: 40 * DAY, totalMs: 58_200 },
    ];
    expect(acceleration(pts)).toBe('improving');
  });
  it('후반에 둔화되면 slowing', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_000 },
      { date: 20 * DAY, totalMs: 58_000 },
      { date: 30 * DAY, totalMs: 57_800 },
      { date: 40 * DAY, totalMs: 57_700 },
    ];
    expect(acceleration(pts)).toBe('slowing');
  });
});

describe('projectTargetDate & trajectory', () => {
  it('개선 중이면 도달일 예측', () => {
    const d = projectTargetDate(60_000, 58_000, -100, 100 * DAY); // 100ms/day
    expect(d).toBe(120 * DAY); // 2000ms / 100ms per day = 20일 뒤
  });
  it('개선 없으면(기울기 0 이상) 예측 불가', () => {
    expect(projectTargetDate(60_000, 58_000, 0, 0)).toBeNull();
    expect(projectTargetDate(60_000, 58_000, 50, 0)).toBeNull();
  });
  it('trajectory: 타겟일 내 도달이면 on-track', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_000 },
      { date: 20 * DAY, totalMs: 58_000 },
    ];
    const tj = trajectory(58_000, 56_000, pts, 60 * DAY, 20 * DAY);
    expect(tj.onTrack).toBe(true);
    expect(tj.slopePerWeekMs).toBeLessThan(0);
    expect(tj.projectedDate).not.toBeNull();
  });
  it('trajectory: 정체면 off-track', () => {
    const flat: TrendPoint[] = [
      { date: 0, totalMs: 58_000 },
      { date: 10 * DAY, totalMs: 58_010 },
      { date: 20 * DAY, totalMs: 58_000 },
    ];
    const tj = trajectory(58_000, 56_000, flat, 60 * DAY, 20 * DAY);
    expect(tj.onTrack).toBe(false);
    expect(tj.projectedDate).toBeNull();
  });
});
