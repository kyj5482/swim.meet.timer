/** 시간 표시 — 항상 1/100초 (TE-10). 저장은 ms, 표시만 여기서. */

/** ms → 센티초(반올림). 모든 표시는 이 값에서 파생해 자릿수 불일치를 막는다. */
function toCs(ms: number): number {
  return Math.round(Math.max(0, ms) / 10);
}

/** "MM:SS.hh" — 러닝 시계용. */
export function fmtClock(ms: number): string {
  const cs = toCs(ms);
  const mm = Math.floor(cs / 6000);
  const ss = Math.floor(cs / 100) % 60;
  const hh = cs % 100;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(hh).padStart(2, '0')}`;
}

/** ":SS.hh" — 구간 스플릿용. */
export function fmtSplit(ms: number): string {
  const cs = toCs(ms);
  return `:${String(Math.floor(cs / 100)).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

/** 총기록: 60초 미만 "SS.hh", 이상 "MM:SS.hh". */
export function fmtTotal(ms: number): string {
  const cs = toCs(ms);
  if (cs < 6000) return `${Math.floor(cs / 100)}.${String(cs % 100).padStart(2, '0')}`;
  return fmtClock(ms);
}

/** "1:02.34" | "58.21" 형식 문자열 → ms (표준기록 임포트·타겟 입력용). */
export function parseTime(text: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const min = m[1] ? parseInt(m[1], 10) : 0;
  const sec = parseInt(m[2]!, 10);
  const frac = m[3] ? m[3].padEnd(2, '0') : '00';
  if (sec >= 60 && m[1]) return null;
  return (min * 60 + sec) * 1000 + parseInt(frac, 10) * 10;
}
