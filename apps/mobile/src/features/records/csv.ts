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

/** 종목 라벨: "100 free · 25y" */
export function eventLabel(t: TrainingRecord['target']): string {
  return `${t.distance} ${t.stroke} · ${t.course}`;
}

/** 종목 그룹 키(같은 종목·거리·코스 = 같은 추세). */
export function eventKeyOf(t: TrainingRecord['target']): string {
  return `${t.distance}|${t.stroke}|${t.course}`;
}
