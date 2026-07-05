import { randomUUID } from 'node:crypto';
import express from 'express';

import { endpoint, PORT, tables } from './env.js';
import { sendLambdaResult, toApiGatewayEvent } from './adapter.js';
import type { Account, CoachProfile, ReviewRequest, Role } from './portal.js';

/**
 * 로컬 개발 API 서버 + SplitLane Cloud 웹 포털(프리뷰).
 * services/records·standards의 **동일한 Lambda 핸들러**를 Express로 감싸고,
 * ai-coach 가이드 엔진과 crypto(PII 암호화)를 붙여 역할 기반 웹 화면을 제공한다.
 * 인증은 Cognito 대신 dev 토큰/세션 쿠키로 대체(로컬 전용, 프로덕션 미배포).
 *
 * 실행 전: `npm run setup -w @splitlane/local-api` (테이블 생성 + 표준 시드).
 * PII 암호화 키: DATA_ENCRYPTION_KEY(base64 32B) 미설정 시 로컬용 임시키 자동 생성.
 */

process.env.DYNAMODB_ENDPOINT = endpoint;
process.env.RECORDS_TABLE = tables.records;
process.env.STANDARDS_TABLE = tables.standards;
process.env.LOG_LEVEL ??= 'DEBUG';

const [
  { handler: recordsHandler },
  { handler: standardsHandler },
  shared,
  aiCoach,
  standardsData,
  portal,
  web,
] = await Promise.all([
  import('@splitlane/svc-records'),
  import('@splitlane/svc-standards'),
  import('@splitlane/svc-shared'),
  import('@splitlane/svc-ai-coach'),
  import('@splitlane/svc-standards'),
  import('./portal.js'),
  import('./web.js'),
]);

const { makeLogger, generateKeyBase64, encryptField, decryptField } = shared;
process.env.DATA_ENCRYPTION_KEY ??= generateKeyBase64(); // 로컬 임시키(재시작 시 갱신)
const gwLog = makeLogger('local-gateway');

// ── 인메모리 도메인 스토어(로컬 프리뷰) — AWS 배포 시 DynamoDB로 교체 ──────────
type StoredAccount = Account & { password: string };
const store = {
  accounts: new Map<string, StoredAccount>(),
  profiles: new Map<string, CoachProfile>(),
  reviews: [] as ReviewRequest[],
  academics: new Map<string, string>(), // email → 암호화된 JSON
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 관측성: correlation-id 전파 + 요청 로깅(Gateway→Lambda 연속 추적) ─────────
app.use((req, res, next) => {
  const cid = (req.header('x-correlation-id') as string) || `web-${Date.now()}-${randomUUID().slice(0, 8)}`;
  req.headers['x-correlation-id'] = cid;   // Lambda 이벤트로 전파 → 핸들러도 같은 cid로 로깅
  res.setHeader('x-correlation-id', cid);
  const start = Date.now();
  gwLog.info('request received', { correlationId: cid, method: req.method, path: req.path });
  res.on('finish', () => {
    gwLog.info('request completed', {
      correlationId: cid, method: req.method, path: req.path,
      status: res.statusCode, durationMs: Date.now() - start,
    });
  });
  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, tables }));

async function invoke(h: typeof recordsHandler, req: express.Request, res: express.Response) {
  const event = toApiGatewayEvent(req);
  const result = await h(event, {} as never, () => {});
  sendLambdaResult(res, result!);
}

app.get('/v1/standards', (req, res) => void invoke(standardsHandler, req, res));
app.get('/v1/standards/clubs/:clubId/groups', (req, res) => void invoke(standardsHandler, req, res));
app.put('/v1/records/batch', (req, res) => void invoke(recordsHandler, req, res));
app.get('/v1/records', (req, res) => void invoke(recordsHandler, req, res));
// 이스터 에그 게임 리더보드 (api-spec §game) — records 핸들러가 rawPath로 라우팅
app.put('/v1/game/scores', (req, res) => void invoke(recordsHandler, req, res));
app.get('/v1/game/leaderboard', (req, res) => void invoke(recordsHandler, req, res));

// ── 인증(로컬 대체) — 앱 Sign in이 호출. 성공/실패가 위 로깅 미들웨어에 남는다 ──
app.post('/v1/auth/login', (req, res) => {
  const cid = req.header('x-correlation-id');
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'email and password required' } });
    return;
  }
  const acct = store.accounts.get(email);
  const role = acct?.role ?? 'coach';
  gwLog.info('auth login', { correlationId: cid, userId: email, role, known: !!acct });
  res.json({ token: `dev.${Buffer.from(email).toString('base64url')}`, displayName: acct?.displayName ?? email.split('@')[0]!, role });
});

// ══ 웹 포털 ═══════════════════════════════════════════════════════════════════
function currentUser(req: express.Request): Account | null {
  const cookie = req.header('cookie') ?? '';
  const m = cookie.match(/sl_session=([^;]+)/);
  if (!m) return null;
  const email = decodeURIComponent(m[1]!);
  return store.accounts.get(email) ?? null;
}
function setSession(res: express.Response, email: string) {
  res.setHeader('Set-Cookie', `sl_session=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax`);
}

app.get('/web', (req, res) => res.type('html').send(portal.homePage(currentUser(req))));

app.get('/web/login', (_req, res) => res.type('html').send(portal.loginPage('login')));
app.get('/web/signup', (_req, res) => res.type('html').send(portal.loginPage('signup')));

app.post('/web/signup', (req, res) => {
  const { email, password, role } = req.body as { email?: string; password?: string; role?: Role };
  if (!email || !password) { res.status(400).type('html').send(portal.loginPage('signup', 'Email and password required')); return; }
  if (store.accounts.has(email)) { res.status(409).type('html').send(portal.loginPage('signup', 'Account already exists')); return; }
  store.accounts.set(email, { email, password, role: role ?? 'parent', displayName: email.split('@')[0]! });
  gwLog.info('account created', { correlationId: req.header('x-correlation-id'), userId: email, role });
  setSession(res, email);
  res.redirect('/web');
});

app.post('/web/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const acct = email ? store.accounts.get(email) : null;
  if (!acct || acct.password !== password) { res.status(401).type('html').send(portal.loginPage('login', 'Invalid email or password')); return; }
  setSession(res, acct.email);
  res.redirect('/web');
});

app.get('/web/logout', (_req, res) => { res.setHeader('Set-Cookie', 'sl_session=; Path=/; Max-Age=0'); res.redirect('/web'); });

app.get('/web/records', (_req, res) => {
  void (async () => {
    try {
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      const items: Record<string, unknown>[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const p = await shared.docClient().send(new ScanCommand({ TableName: tables.records, ExclusiveStartKey: lastKey }));
        items.push(...(p.Items ?? []));
        lastKey = p.LastEvaluatedKey;
      } while (lastKey);
      res.type('html').send(web.renderRecordsPage(items as never));
    } catch (e) {
      res.status(500).type('text').send(`records viewer error: ${e instanceof Error ? e.message : e}`);
    }
  })();
});

// 수영 코치 AI 가이드
app.get('/web/swim-coach', (req, res) => {
  const age = req.query.age ? Number(req.query.age) : null;
  if (age == null || Number.isNaN(age)) { res.type('html').send(portal.swimCoachPage(null, null)); return; }
  const cuts = portal.cutsFrom(standardsData.buildStandardRows().map((r) => ({ event: r.event, level: r.level, timeMs: r.timeMs })));
  const bests = req.query.fr50 ? [{ event: '50FR', course: 'SCY', totalMs: parseClock(String(req.query.fr50)) }] : [];
  const g = aiCoach.swimGuidance(bests, age, cuts);
  res.type('html').send(portal.swimCoachPage(age, g));
});

// 진학 코치 AI 가이드 — 학업 PII는 암호화 저장 후 사용
app.get('/web/college-coach', (_req, res) => res.type('html').send(portal.collegeCoachPage(null)));
app.post('/web/college-coach', (req, res) => {
  const b = req.body as Record<string, string>;
  const academics = {
    mathPct: Number(b.mathPct) || 0, elaPct: Number(b.elaPct) || 0,
    apCourses: (b.ap ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
  const user = currentUser(req);
  if (user) store.academics.set(user.email, encryptField(JSON.stringify(academics))); // 민감정보 암호화 저장
  const schools = Array.isArray(b.schools) ? b.schools : b.schools ? [b.schools] : [];
  const g = aiCoach.collegeGuidance('developing', academics, [], schools as string[], Number(b.age) || 15);
  res.type('html').send(portal.collegeCoachPage(g));
});

// 코치 프로필
app.get('/web/coach/profile', (req, res) => {
  const u = currentUser(req);
  res.type('html').send(portal.coachProfilePage(u ? store.profiles.get(u.email) ?? null : null));
});
app.post('/web/coach/profile', (req, res) => {
  const u = currentUser(req);
  if (!u) { res.redirect('/web/login'); return; }
  const b = req.body as Record<string, string>;
  store.profiles.set(u.email, {
    email: u.email, kind: (b.kind as 'swim' | 'college') ?? 'swim', bio: b.bio ?? '',
    specialties: (b.specialties ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    ageMin: Number(b.ageMin) || 6, ageMax: Number(b.ageMax) || 19,
    levelMin: b.levelMin ?? 'B', levelMax: b.levelMax ?? 'AAAA', rate: b.rate,
  });
  res.redirect('/web');
});

// 실제 코치 리뷰 요청 → 매칭 → 코치 수락/거절
app.get('/web/review/new', (_req, res) => res.type('html').send(portal.reviewNewPage()));
app.post('/web/review/new', (req, res) => {
  const u = currentUser(req);
  const b = req.body as Record<string, string>;
  const age = Number(b.age) || 12;
  const matched = portal.matchCoach([...store.profiles.values()], 'swim', age);
  const rr: ReviewRequest = {
    id: randomUUID().slice(0, 8), fromEmail: u?.email ?? 'guest', toCoachEmail: matched?.email ?? null,
    swimmerName: b.swimmerName ?? 'Swimmer', age, note: b.note ?? '',
    videoUrls: (b.videos ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean),
    status: 'pending', createdAt: Date.now(),
  };
  store.reviews.push(rr);
  gwLog.info('review requested', { correlationId: req.header('x-correlation-id'), reviewId: rr.id, matched: matched?.email ?? null });
  res.type('html').send(portal.page('Review sent', `<h1>Review sent</h1>
    <p class="muted">${matched ? `Matched to a coach and delivered.` : 'Queued — no matching coach yet, we\'ll assign one.'}</p>
    <p><a href="/web">Back home</a></p>`));
});

app.get('/web/coach/inbox', (req, res) => {
  const u = currentUser(req);
  const reqs = store.reviews.filter((r) => !u || r.toCoachEmail === u.email || r.toCoachEmail === null);
  res.type('html').send(portal.coachInboxPage(reqs));
});
app.post('/web/review/:id/respond', (req, res) => {
  const rr = store.reviews.find((r) => r.id === req.params.id);
  if (rr) rr.status = (req.body as { action?: string }).action === 'accept' ? 'accepted' : 'declined';
  gwLog.info('review responded', { correlationId: req.header('x-correlation-id'), reviewId: req.params.id, status: rr?.status });
  res.redirect('/web/coach/inbox');
});

/** 'mm:ss.hh' | 'ss.hh' → ms (웹 폼 입력용). */
function parseClock(s: string): number {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return 0;
  return Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000);
}

app.listen(PORT, () => {
  console.log(`splitlane local-api listening on http://localhost:${PORT}`);
  console.log(`  Web portal:     http://localhost:${PORT}/web`);
  console.log(`  Records viewer: http://localhost:${PORT}/web/records`);
  console.log(`  DynamoDB Local: ${endpoint}`);
  console.log('  Every request is logged with a correlation-id (propagated into the Lambda handlers).');
});
