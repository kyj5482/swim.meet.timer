import { fmtTotal } from '@splitlane/timer-core';

import type { TrainingRecord } from '../../db/mapping';

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 선수 기록 CSV (docs/04 §4.4 내보내기). 세그먼트는 열로 평면화.
 * 시간은 사람이 읽는 1/100초 표기 + 원본 ms 병기(스프레드시트 계산용).
 */
export function recordsToCsv(swimmerName: string, records: TrainingRecord[]): string {
  const maxSegs = Math.max(1, ...records.map((r) => r.splits.length));
  const header = [
    'swimmer', 'date', 'stroke', 'distance', 'course', 'status', 'total', 'totalMs',
    ...Array.from({ length: maxSegs }, (_, i) => `split${i + 1}`),
  ];
  const lines = [header.join(',')];
  for (const r of [...records].sort((a, b) => a.date - b.date)) {
    lines.push([
      esc(swimmerName),
      new Date(r.date).toISOString().slice(0, 10),
      r.target.stroke, r.target.distance, r.target.course, r.status,
      fmtTotal(r.totalMs), r.totalMs,
      ...Array.from({ length: maxSegs }, (_, i) => {
        const s = r.splits[i];
        return s ? (s.splitMs / 1000).toFixed(2) : '';
      }),
    ].join(','));
  }
  return lines.join('\n');
}

/** 스트로크 짧은 이름(라벨용): Free/Back/Breast/Fly/IM. */
const STROKE_SHORT: Record<string, string> = {
  free: 'Free', back: 'Back', breast: 'Breast', fly: 'Fly', im: 'IM',
};

/** 코스 전체 이름: 25y→'25 Yard', 25m→'25 Meter', 50m→'50 Meter'. */
export const COURSE_FULL: Record<string, string> = {
  '25y': '25 Yard', '25m': '25 Meter', '50m': '50 Meter',
};
export function courseFull(course: string): string {
  return COURSE_FULL[course] ?? course;
}

/** 종목 라벨: "100 Free · 25 Yard" (코스 단위 전체 표기). */
export function eventLabel(t: TrainingRecord['target']): string {
  return `${t.distance} ${STROKE_SHORT[t.stroke] ?? t.stroke} · ${courseFull(t.course)}`;
}

/** 종목 그룹 키(같은 종목·거리·코스 = 같은 추세). */
export function eventKeyOf(t: TrainingRecord['target']): string {
  return `${t.distance}|${t.stroke}|${t.course}`;
}

/** 세션 날짜(로케일). */
export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString();
}
/** 압축 날짜 — 올해면 월/일만, 아니면 연도 포함(전체 종목 행처럼 좁은 곳용). */
export function fmtDateShort(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'numeric', day: 'numeric' }
    : { year: '2-digit', month: 'numeric', day: 'numeric' });
}
/** 세션 시각 HH:MM(로케일). 타이머 기록은 날짜만이 아니라 시각까지 남는다. */
export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
/** 날짜+시각 한 줄. */
export function fmtDateTime(ms: number): string {
  return `${fmtDate(ms)} ${fmtTime(ms)}`;
}
