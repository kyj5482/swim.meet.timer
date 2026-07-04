import {
  collegeGuidance, swimGuidance,
  type Academics, type CollegeGuidance, type LevelCut, type SwimGuidance,
} from '@splitlane/svc-ai-coach';

/**
 * SplitLane Cloud 웹 포털(로컬 프리뷰) — 순수 렌더 함수 + 인메모리 도메인 스토어.
 * 역할: swimmer/parent/coach/college-coach/admin. 서버 라우트(server.ts)가 이
 * 렌더러를 호출한다. AWS 배포 시 이 화면은 그대로 두고 스토어만 DynamoDB로
 * 교체하면 되도록(기능 업그레이드가 기존과 충돌하지 않도록) 렌더/스토어를 분리.
 */

export type Role = 'swimmer' | 'parent' | 'coach' | 'college-coach' | 'admin';

export interface Account { email: string; role: Role; displayName: string; }

export interface CoachProfile {
  email: string;
  kind: 'swim' | 'college';
  bio: string;
  specialties: string[];      // 예: ['sprint free', 'IM']
  ageMin: number; ageMax: number;
  levelMin: string; levelMax: string;   // 매칭용 레벨 범위
  rate?: string;
}

export type ReviewStatus = 'pending' | 'accepted' | 'declined';
export interface ReviewRequest {
  id: string;
  fromEmail: string;
  toCoachEmail: string | null;   // null이면 매칭 대기
  swimmerName: string;
  age: number;
  note: string;
  videoUrls: string[];
  status: ReviewStatus;
  createdAt: number;
}

/** 학업 PII는 암호화된 채로만 보관 — 스토어에는 암호문 문자열을 넣는다. */
export interface AcademicRecordEnc { email: string; encJson: string; }

const PAGE_CSS = `
  body{font-family:-apple-system,system-ui,sans-serif;background:#0A1929;color:#E7F0F7;margin:0;padding:24px;line-height:1.5}
  a{color:#3D8FC9}h1{font-size:22px}h2{font-size:15px;color:#8FA8BC;margin-top:26px}
  .card{background:#0E2438;border:1px solid #1E3A52;border-radius:12px;padding:16px;margin:12px 0;max-width:720px}
  .tag{display:inline-block;background:#13324c;border:1px solid #1E3A52;border-radius:999px;padding:2px 10px;font-size:12px;margin:2px}
  .reach{color:#F5A05B}.match{color:#5BE58C}.safety{color:#3D8FC9}
  label{display:block;font-size:13px;color:#8FA8BC;margin-top:10px}
  input,select,textarea{width:100%;max-width:420px;padding:8px;border-radius:8px;border:1px solid #1E3A52;background:#0A1929;color:#E7F0F7;font-size:14px}
  button{margin-top:12px;padding:10px 16px;border-radius:10px;border:0;background:#3D8FC9;color:#001; font-weight:700;cursor:pointer}
  table{border-collapse:collapse;width:100%;max-width:640px}th,td{text-align:left;padding:6px 12px 6px 0;border-bottom:1px solid #1E3A52;font-size:14px}
  .muted{color:#8FA8BC;font-size:13px}.soon{opacity:.6}
  ul{margin:6px 0}li{margin:3px 0}
`;

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>${PAGE_CSS}</style></head><body>
<p class="muted"><a href="/web">← SplitLane Cloud</a></p>
${body}</body></html>`;
}

export function loginPage(mode: 'login' | 'signup', error?: string): string {
  const isSignup = mode === 'signup';
  return page(isSignup ? 'Create account' : 'Sign in', `
    <h1>${isSignup ? 'Create your account' : 'Sign in'}</h1>
    ${error ? `<p class="reach">${esc(error)}</p>` : ''}
    <form class="card" method="post" action="/web/${mode}">
      <label>Email</label><input name="email" type="email" required>
      <label>Password</label><input name="password" type="password" required>
      ${isSignup ? `<label>I am a…</label><select name="role">
        <option value="parent">Parent</option><option value="swimmer">Swimmer</option>
        <option value="coach">Swim coach</option><option value="college-coach">College coach</option>
      </select>` : ''}
      <br><button type="submit">${isSignup ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="muted">${isSignup ? '<a href="/web/login">Have an account? Sign in</a>'
      : '<a href="/web/signup">New here? Create an account</a>'}</p>
  `);
}

export function homePage(acct: Account | null): string {
  if (!acct) {
    return page('SplitLane Cloud', `
      <h1>SplitLane Cloud</h1>
      <p class="muted">Sync from the app, then sign in to unlock AI coaching, real-coach reviews, and college guidance.</p>
      <p><a href="/web/login">Sign in</a> · <a href="/web/signup">Create an account</a></p>
      <h2>What's inside</h2>
      <div class="card"><b>🏊 Swim coach (AI)</b><br><span class="muted">Level assessment + age-appropriate training & video guidance.</span></div>
      <div class="card"><b>🎓 College coach (AI)</b><br><span class="muted">School-fit and prep roadmap from records + academics.</span></div>
      <div class="card"><b>🧑‍🏫 Real coach reviews</b><br><span class="muted">Send stroke videos + times; a matched coach responds.</span></div>
    `);
  }
  const coachLink = acct.role === 'coach' || acct.role === 'college-coach'
    ? `<div class="card"><b>Coach tools</b><br><a href="/web/coach/profile">Edit profile</a> · <a href="/web/coach/inbox">Review inbox</a></div>` : '';
  return page('SplitLane Cloud', `
    <h1>Welcome, ${esc(acct.displayName)}</h1>
    <p class="muted">Role: ${esc(acct.role)} · <a href="/web/logout">Sign out</a></p>
    <div class="card"><b>🏊 Swim coach (AI)</b><br><a href="/web/swim-coach">Open guidance</a></div>
    <div class="card"><b>🎓 College coach (AI)</b><br><a href="/web/college-coach">Open guidance</a></div>
    <div class="card"><b>🧑‍🏫 Request a real-coach review</b><br><a href="/web/review/new">Send records + video</a></div>
    ${coachLink}
    <div class="card soon"><b>📹 1:1 live video coaching</b> <span class="tag">Soon</span><br>
      <span class="muted">Native English 1:1 sessions with a coach over mobile video call.</span></div>
  `);
}

/** 수영 코치 AI 가이드 페이지 — 나이 입력 폼 + 결과 렌더. */
export function swimCoachPage(age: number | null, g: SwimGuidance | null): string {
  const form = `<form class="card" method="get" action="/web/swim-coach">
    <label>Swimmer age</label><input name="age" type="number" min="6" max="19" value="${age ?? ''}" required>
    <label>Best 50 Free (SCY, e.g. 28.90) — optional</label><input name="fr50" placeholder="mm:ss.hh or ss.hh">
    <br><button>Get guidance</button></form>`;
  if (!g) return page('Swim coach (AI)', `<h1>Swim coach (AI)</h1>${form}`);
  return page('Swim coach (AI)', `
    <h1>Swim coach (AI)</h1>${form}
    <div class="card">
      <b>${esc(g.tier.toUpperCase())}</b><p>${esc(g.levelSummary)}</p>
      <h2>Focus this season</h2><ul>${g.focusAreas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <h2>Weekly plan</h2><table>${g.weeklyPlan.map((d) => `<tr><td><b>${esc(d.day)}</b></td><td>${esc(d.focus)}</td></tr>`).join('')}</table>
      <h2>Watch & learn</h2><ul>${g.videos.map((v) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a></li>`).join('')}</ul>
      <p class="muted">${esc(g.safetyNote)}</p>
    </div>`);
}

/** 진학 코치 AI 가이드 페이지 — 학업 입력(민감정보) + 결과. */
export function collegeCoachPage(g: CollegeGuidance | null): string {
  const form = `<form class="card" method="post" action="/web/college-coach">
    <label>Math percentile (0-100)</label><input name="mathPct" type="number" min="0" max="100" required>
    <label>ELA (English) percentile (0-100)</label><input name="elaPct" type="number" min="0" max="100" required>
    <label>AP courses (comma separated, high school)</label><input name="ap" placeholder="AP Calc, AP Bio">
    <label>Swimmer age</label><input name="age" type="number" min="10" max="19" required>
    <label>Target schools</label>
    <select name="schools" multiple size="5">
      <option value="uchicago">University of Chicago</option><option value="stanford">Stanford</option>
      <option value="michigan">Michigan</option><option value="emory">Emory</option><option value="uva">Virginia</option>
    </select>
    <p class="muted">Academic scores are private and stored encrypted at rest.</p>
    <button>Get school-fit guidance</button></form>`;
  if (!g) return page('College coach (AI)', `<h1>College coach (AI)</h1>${form}`);
  const rows = g.fits.map((f) => `<div class="card">
    <b class="${f.fit}">${esc(f.school.name)} — ${f.fit.toUpperCase()}</b>
    <p>${esc(f.rationale)}</p>
    <span class="muted">Prep:</span><ul>${f.prep.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');
  const road = g.roadmap.map((r) => `<div class="card"><b>${esc(r.stage)}</b><ul>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
  return page('College coach (AI)', `
    <h1>College coach (AI)</h1>${form}
    <h2>Academic profile: ${g.academicPct} percentile</h2>${rows}
    <h2>Roadmap</h2>${road}
    <p class="muted">${esc(g.note)}</p>`);
}

export function coachProfilePage(p: CoachProfile | null): string {
  return page('Coach profile', `
    <h1>Coach profile</h1>
    <p class="muted">Fill this so we can match you to swimmers at the right level and age.</p>
    <form class="card" method="post" action="/web/coach/profile">
      <label>Coaching kind</label><select name="kind"><option value="swim">Swim</option><option value="college">College</option></select>
      <label>Short bio</label><textarea name="bio" rows="3">${esc(p?.bio ?? '')}</textarea>
      <label>Specialties (comma separated)</label><input name="specialties" value="${esc(p?.specialties.join(', ') ?? '')}">
      <label>Age range you coach</label>
      <input name="ageMin" type="number" placeholder="min" value="${p?.ageMin ?? ''}" style="max-width:120px">
      <input name="ageMax" type="number" placeholder="max" value="${p?.ageMax ?? ''}" style="max-width:120px">
      <label>Level range (e.g. B … AAAA)</label>
      <input name="levelMin" placeholder="min level" value="${esc(p?.levelMin ?? '')}" style="max-width:120px">
      <input name="levelMax" placeholder="max level" value="${esc(p?.levelMax ?? '')}" style="max-width:120px">
      <label>Rate (optional)</label><input name="rate" value="${esc(p?.rate ?? '')}">
      <button>Save profile</button>
    </form>
    <div class="card soon"><b>📹 Live 1:1 video coaching</b> <span class="tag">Soon</span><br>
      <span class="muted">You'll be able to run paid live sessions over mobile video call.</span></div>`);
}

export function coachInboxPage(reqs: ReviewRequest[]): string {
  if (reqs.length === 0) return page('Review inbox', '<h1>Review inbox</h1><p class="muted">No requests yet.</p>');
  const rows = reqs.map((r) => `<div class="card">
    <b>${esc(r.swimmerName)}</b> · age ${r.age} · <span class="tag">${esc(r.status)}</span>
    <p>${esc(r.note)}</p>
    ${r.videoUrls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">video ↗</a> `).join('')}
    ${r.status === 'pending' ? `<form method="post" action="/web/review/${esc(r.id)}/respond" style="margin-top:8px">
      <button name="action" value="accept">Accept</button>
      <button name="action" value="decline" style="background:#E5484D">Decline</button></form>` : ''}
  </div>`).join('');
  return page('Review inbox', `<h1>Review inbox</h1>${rows}`);
}

export function reviewNewPage(): string {
  return page('Request a review', `
    <h1>Request a real-coach review</h1>
    <p class="muted">Send your stroke videos and recent times. We match you to a coach by level and age.</p>
    <form class="card" method="post" action="/web/review/new">
      <label>Swimmer name</label><input name="swimmerName" required>
      <label>Age</label><input name="age" type="number" min="6" max="19" required>
      <label>Video links (one per line — YouTube/Drive)</label><textarea name="videos" rows="3" placeholder="https://…"></textarea>
      <label>What would you like feedback on?</label><textarea name="note" rows="3"></textarea>
      <button>Send to a matched coach</button>
    </form>`);
}

/** 표준 컷(백엔드 verified subset)에서 종목별 LevelCut 맵 구성 — 가이드 입력용. */
export function cutsFrom(rows: { event: string; level: string; timeMs: number }[]): Record<string, LevelCut[]> {
  const out: Record<string, LevelCut[]> = {};
  for (const r of rows) (out[r.event] ??= []).push({ level: r.level, timeMs: r.timeMs });
  return out;
}

/** 코치 매칭 — 나이·레벨 범위가 맞는 첫 코치(간단 규칙, 추후 랭킹 확장). */
export function matchCoach(profiles: CoachProfile[], kind: 'swim' | 'college', age: number): CoachProfile | null {
  return profiles.find((p) => p.kind === kind && age >= p.ageMin && age <= p.ageMax) ?? null;
}

// 편의 재노출(server.ts에서 엔진 직접 호출용)
export { swimGuidance, collegeGuidance };
export type { Academics, SwimGuidance, CollegeGuidance };
