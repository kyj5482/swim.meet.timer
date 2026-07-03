import type { Course, Split, Stroke } from '@splitlane/timer-core';

/**
 * 데모 시드 데이터 — 원본 PWA(docs/app/index.html의 DEFAULT_ROSTER + genHist)와
 * 동일한 선수·히스토리를 재현한다. 첫 실행 시 앱이 비어 보이지 않고, Records
 * 추세 차트·배정 추천이 즉시 의미를 갖는다. 사용자가 만든 데이터와 구분되도록
 * seed=1 플래그를 달아 두고, 언제든 설정에서 비울 수 있게 한다(T-110).
 */

/** context의 currentDate 기준. age → birthYear 계산에 사용. */
const BASE_YEAR = 2026;

export interface SeedSwimmer {
  id: string;
  name: string;
  group: string;
  age: number;
  gender: 'F' | 'M';
}

// 데모는 전원 여자로 두어 11-12 여자 표준기록(50/100 Free)이 곧바로 매칭되게 한다.
export const SEED_SWIMMERS: SeedSwimmer[] = [
  { id: 'seed-seoyeon', name: '서연', group: '엘리트반', age: 13, gender: 'F' },
  { id: 'seed-minjun', name: '민준', group: '엘리트반', age: 12, gender: 'F' },
  { id: 'seed-jiwoo', name: '지우', group: '엘리트반', age: 13, gender: 'F' },
  { id: 'seed-hajun', name: '하준', group: '일반반', age: 11, gender: 'F' },
  { id: 'seed-doyun', name: '도윤', group: '일반반', age: 12, gender: 'F' },
];

interface EventTemplate {
  stroke: Stroke;
  distance: number;
  splitInterval: number;
  /** 최고 기록(초, 가장 최근 세션) */
  base: number;
  /** 세션마다 느려지는 폭(과거로 갈수록 base+step*k) */
  step: number;
}

const EVENTS: EventTemplate[] = [
  { stroke: 'free', distance: 100, splitInterval: 25, base: 52.4, step: 0.42 },
  { stroke: 'free', distance: 50, splitInterval: 25, base: 25.1, step: 0.22 },
  { stroke: 'back', distance: 100, splitInterval: 25, base: 61.3, step: 0.5 },
  { stroke: 'breast', distance: 100, splitInterval: 25, base: 68.2, step: 0.55 },
  { stroke: 'fly', distance: 100, splitInterval: 25, base: 59.9, step: 0.48 },
  { stroke: 'free', distance: 200, splitInterval: 50, base: 118.5, step: 0.9 },
];

/** 6개 세션 날짜(2026년, 과거→현재). PWA의 05-10 … 06-17과 동일. */
const SESSION_DATES = ['05-10', '05-20', '05-28', '06-05', '06-12', '06-17'];

function dateMs(md: string): number {
  const [m, d] = md.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(BASE_YEAR, m! - 1, d!, 12, 0, 0);
}

/** 선수마다 ±~6% 편차 — 추천/랭킹이 의미 있도록. PWA hashF와 동일 개념. */
function swimmerFactor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 1 + (((h % 9) - 4) * 0.014);
}

/** 총 시간을 n개 구간으로 분배(뒤로 갈수록 살짝 느려지는 자연스러운 페이스). */
function distribute(totalSec: number, n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => 1 + i * 0.012 - (i === 0 ? 0.03 : 0));
  const sw = w.reduce((a, b) => a + b, 0);
  const arr = w.map((x) => +(totalSec * x / sw).toFixed(2));
  arr[n - 1] = +(totalSec - arr.slice(0, n - 1).reduce((a, b) => a + b, 0)).toFixed(2);
  return arr;
}

export interface SeedRecord {
  id: string;
  swimmerId: string;
  sessionId: string;
  date: number;
  stroke: Stroke;
  distance: number;
  course: Course;
  splitInterval: number;
  totalMs: number;
  splits: Split[];
}

/**
 * 시드 선수 전원의 데모 훈련 기록을 생성한다(결정적 — 테스트 가능).
 * 각 종목 6세션, 최근일수록 빠름(우상향 개선 궤적).
 */
export function buildSeedRecords(): SeedRecord[] {
  const out: SeedRecord[] = [];
  for (const sw of SEED_SWIMMERS) {
    const f = swimmerFactor(sw.id);
    for (const ev of EVENTS) {
      const best = +(ev.base * f).toFixed(2);
      const segN = ev.distance / ev.splitInterval;
      SESSION_DATES.forEach((md, i) => {
        const totalSec = +(best + (SESSION_DATES.length - 1 - i) * ev.step).toFixed(2);
        const splitSecs = distribute(totalSec, segN);
        let cum = 0;
        const splits: Split[] = splitSecs.map((s, seg) => {
          const splitMs = Math.round(s * 1000);
          cum += splitMs;
          return { segmentIndex: seg, cumulativeMs: cum, splitMs };
        });
        const key = `${sw.id}-${ev.stroke}${ev.distance}-${md}`;
        out.push({
          id: `seed-rec-${key}`,
          swimmerId: sw.id,
          sessionId: `seed-sess-${key}`,
          date: dateMs(md),
          stroke: ev.stroke,
          distance: ev.distance,
          course: '25y',
          splitInterval: ev.splitInterval,
          totalMs: splits[splits.length - 1]!.cumulativeMs,
          splits,
        });
      });
    }
  }
  return out;
}

export function birthYearFromAge(age: number): number {
  return BASE_YEAR - age;
}
