import type { TrainingRecord } from '../../db/mapping';

/** 종목·날짜 라벨 유틸. (CSV 내보내기는 제품 결정으로 제거 — SplitLane Cloud에서 재도입 예정.) */

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

/** 종목 이름(미트 표기): "50 Yard Free" / "50 Meter Free" — 코스 단위 포함. */
export function eventName(t: TrainingRecord['target']): string {
  const unit = t.course === '25y' ? 'Yard' : 'Meter';
  return `${t.distance} ${unit} ${STROKE_SHORT[t.stroke] ?? t.stroke}`;
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
