/**
 * 로컬 웹 기록 뷰어(GET /web) — 앱이 동기화한 기록을 브라우저에서 확인하는
 * SplitLane Cloud 웹 서비스의 로컬 프리뷰. 렌더링은 순수 함수로 분리해 테스트한다.
 *
 * 데이터 조회는 DynamoDB Scan을 쓴다 — services/records의 "스캔 금지" 규칙은
 * 프로덕션 쿼리 패턴 얘기고, 이건 로컬 개발 도구(DynamoDB Local 전용)다.
 */

export interface WebRecord {
  swimmerId: string;
  id: string;
  date: number;
  stroke: string;
  distance: number;
  course: string;
  totalMs: number;
  status: string;
  deleted?: boolean;
}

const STROKE_SHORT: Record<string, string> = {
  free: 'Free', back: 'Back', breast: 'Breast', fly: 'Fly', im: 'IM',
};

export function fmtTotal(ms: number): string {
  const h = Math.floor((ms % 1000) / 10);
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000);
  const hh = String(h).padStart(2, '0');
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}.${hh}` : `${s}.${hh}`;
}

export function eventName(r: Pick<WebRecord, 'stroke' | 'distance' | 'course'>): string {
  const unit = r.course === '25y' ? 'Yard' : 'Meter';
  return `${r.distance} ${unit} ${STROKE_SHORT[r.stroke] ?? r.stroke}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 선수(swimmerId)별로 묶어 최신 기록부터 보여주는 단일 HTML 페이지. */
export function renderRecordsPage(records: WebRecord[]): string {
  const live = records.filter((r) => !r.deleted);
  const bySwimmer = new Map<string, WebRecord[]>();
  for (const r of live) {
    const list = bySwimmer.get(r.swimmerId) ?? [];
    list.push(r);
    bySwimmer.set(r.swimmerId, list);
  }

  const sections = [...bySwimmer.entries()].map(([sid, recs]) => {
    const rows = [...recs]
      .sort((a, b) => b.date - a.date)
      .map((r) => `<tr>
        <td>${new Date(r.date).toISOString().slice(0, 16).replace('T', ' ')}</td>
        <td>${esc(eventName(r))}</td>
        <td class="t">${r.status === 'dnf' ? 'DNF' : fmtTotal(r.totalMs)}</td>
      </tr>`)
      .join('\n');
    return `<section>
      <h2>Swimmer <code>${esc(sid)}</code> · ${recs.length} record${recs.length === 1 ? '' : 's'}</h2>
      <table><thead><tr><th>Date (UTC)</th><th>Event</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SplitLane — Records</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0A1929; color: #E7F0F7; margin: 0; padding: 24px; }
  h1 { font-size: 20px; } h2 { font-size: 14px; color: #8FA8BC; margin-top: 28px; }
  code { color: #3D8FC9; }
  table { border-collapse: collapse; width: 100%; max-width: 640px; }
  th, td { text-align: left; padding: 6px 12px 6px 0; border-bottom: 1px solid #1E3A52; font-size: 14px; }
  th { color: #8FA8BC; font-size: 12px; }
  td.t { font-variant-numeric: tabular-nums; font-weight: 600; }
  .empty { color: #8FA8BC; }
</style></head><body>
<h1>SplitLane — Synced Records</h1>
${sections || '<p class="empty">No records synced yet. In the app: Settings → Backend Sync → Sync Now.</p>'}
</body></html>`;
}
