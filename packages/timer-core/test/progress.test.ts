import { describe, expect, it } from 'vitest';
import {
  achievement, acceleration, improvementSlopePerDay, ladderPosition, paceInsight,
  projectTargetDate, robustSlopePerDay, trajectory, type LadderStep, type TrendPoint,
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

describe('robustSlopePerDay — Theil-Sen(이상치 저항)', () => {
  it('꾸준한 개선의 기울기를 OLS와 동일하게 잡는다', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_000 },
      { date: 20 * DAY, totalMs: 58_000 },
    ];
    expect(robustSlopePerDay(pts)).toBeCloseTo(-100, 0);
  });
  it('컨디션 난조 이상치 하나에 흔들리지 않는다', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 10 * DAY, totalMs: 59_000 },
      { date: 20 * DAY, totalMs: 64_000 }, // 아픈 날 — OLS라면 기울기가 양수로 뒤집힌다
      { date: 30 * DAY, totalMs: 57_000 },
      { date: 40 * DAY, totalMs: 56_000 },
    ];
    const s = robustSlopePerDay(pts)!;
    expect(s).toBeCloseTo(-100, 0); // 이상치를 무시하고 기저 추세(-100ms/일)를 유지
  });
  it('점 1개면 null', () => {
    expect(robustSlopePerDay([{ date: 0, totalMs: 1 }])).toBeNull();
  });
});

describe('paceInsight — 부모·선수용 페이스 요약', () => {
  it('유의미한 월간 단축이면 improving + 수치 표시 가능', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 60_000 },
      { date: 15 * DAY, totalMs: 59_600 },
      { date: 30 * DAY, totalMs: 59_100 },
      { date: 45 * DAY, totalMs: 58_800 },
    ];
    const p = paceInsight(pts);
    expect(p.state).toBe('improving');
    expect(p.perMonthMs).toBeLessThan(0);
    expect(p.plausible).toBe(true);
  });
  it('노이즈 범위의 등락은 plateau(계단식 정체는 정상)', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 58_000 },
      { date: 15 * DAY, totalMs: 58_040 },
      { date: 30 * DAY, totalMs: 57_990 },
      { date: 45 * DAY, totalMs: 58_020 },
    ];
    expect(paceInsight(pts).state).toBe('plateau');
  });
  it('PB 대비 지속적으로 밀리면 regressing', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 56_000 },
      { date: 20 * DAY, totalMs: 56_900 },
      { date: 40 * DAY, totalMs: 57_600 },
      { date: 60 * DAY, totalMs: 58_400 },
    ];
    expect(paceInsight(pts).state).toBe('regressing');
  });
  it('점이 몰려 만들어진 초대형 기울기는 plausible=false(숫자 숨김)', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 40_000 },
      { date: 1 * DAY, totalMs: 30_000 }, // 하루 10초 = 월 300초 — 비현실
      { date: 2 * DAY, totalMs: 20_000 },
    ];
    const p = paceInsight(pts);
    expect(p.plausible).toBe(false);
  });
  it('최근 120일 창 밖의 옛 기록은 판정에서 제외', () => {
    const pts: TrendPoint[] = [
      { date: 0, totalMs: 70_000 },        // 1년 전 — 무시돼야 함
      { date: 300 * DAY, totalMs: 58_000 },
      { date: 320 * DAY, totalMs: 58_020 },
      { date: 340 * DAY, totalMs: 57_990 },
    ];
    // 옛 점까지 넣으면 improving처럼 보이지만, 최근 창만 보면 plateau가 맞다
    expect(paceInsight(pts).state).toBe('plateau');
  });
  it('점 2개 미만은 판정 불가 → plateau/null', () => {
    const p = paceInsight([{ date: 0, totalMs: 60_000 }]);
    expect(p.state).toBe('plateau');
    expect(p.perMonthMs).toBeNull();
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
