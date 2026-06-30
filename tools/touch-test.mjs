// End-to-end multi-touch test for the timer's lane tapping — the core value of
// the app. Drives a real Chromium with genuine simultaneous touch input (via
// the CDP Input.dispatchTouchEvent API, with multiple touch points in one
// touchStart) and asserts the recorded timer state for each scenario:
//
//   1. two-finger SIMULTANEOUS taps on two lanes, every round
//   2. rapid SEQUENTIAL taps on different lanes within a round
//   3. fast DOUBLE-tap on the SAME lane must not double-count
//   4. STRESS: 20x simultaneous taps with no delay — no over-count, no crash
//   5. 4 swimmers, two pairs tapped simultaneously
//
// Why this matters: every tap rebuilds the #lanes DOM, so a naive per-lane
// onclick drops a second finger that lands mid-rebuild. The app uses a
// delegated pointerdown that keys off state + data-idx, which survives the
// rebuild. This test is the regression guard for that behaviour.
//
// Run:  node tools/touch-test.mjs
// Needs Playwright + Chromium. In environments without them it prints SKIP and
// exits 0 so it never blocks. PLAYWRIGHT_BROWSERS_PATH is honoured automatically.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..', 'docs', 'app');

// ---- resolve Playwright from local or global node_modules ----
function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const candidates = [];
  try { candidates.push(req.resolve('playwright')); } catch {}
  try { candidates.push(join(execSync('npm root -g').toString().trim(), 'playwright')); } catch {}
  for (const c of candidates) {
    try { return req(c); } catch {}
  }
  return null;
}
const pw = loadPlaywright();
if (!pw) { console.log('SKIP: Playwright not installed — `npm i -g playwright` to run this test.'); process.exit(0); }
const { chromium } = pw;

// ---- tiny static file server for docs/app ----
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer(async (rq, rs) => {
  try {
    let p = normalize(decodeURIComponent(rq.url.split('?')[0]));
    if (p === '/' || p === '\\') p = '/index.html';
    const file = join(APP_DIR, p);
    if (!file.startsWith(APP_DIR)) { rs.writeHead(403); return rs.end(); }
    const body = await readFile(file);
    const ext = p.slice(p.lastIndexOf('.'));
    rs.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    rs.end(body);
  } catch { rs.writeHead(404); rs.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/index.html`;

let PASS = 0, FAIL = 0; const fails = [];
function check(name, cond, detail = '') {
  if (cond) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; fails.push(name); console.log(`  ❌ ${name}  ${detail}`); }
}

const launchOpts = { args: ['--no-proxy-server'] };
if (process.env.PW_EXECUTABLE) launchOpts.executablePath = process.env.PW_EXECUTABLE;
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
page.on('pageerror', e => { FAIL++; fails.push('pageerror'); console.log('  ❌ pageerror:', e.message); });
await page.goto(URL, { waitUntil: 'networkidle' });

const readState = () => page.evaluate(() => ({
  view: timerView, seg: segCount,
  slots: state ? state.map(s => ({ nextSeg: s.nextSeg, splits: s.splits.length, finished: s.finished })) : null,
}));
async function laneCenters() {
  const out = [];
  for (const l of await page.$$('#lanes .lane')) { const b = await l.boundingBox(); if (b) out.push({ x: b.x + b.width/2, y: b.y + b.height/2 }); }
  return out;
}
async function multiTap(points) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points.map((p,i) => ({ x: p.x, y: p.y, id: i })) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const singleTap = p => multiTap([p]);
const wait = ms => page.waitForTimeout(ms);
async function gotoSetup() {
  const v = await page.evaluate(() => timerView);
  if (v === 'running') await page.click('#reset'); else if (v === 'assign') await page.click('#again');
  await wait(50);
}
async function setupSwimmers(n) {
  const count = () => page.$eval('#count', e => +e.textContent);
  while (await count() > n) await page.click('#minus');
  while (await count() < n) await page.click('#plus');
  await page.click('#start'); await wait(50);
}

console.log('\n=== SCENARIO 1: simultaneous two-finger taps each round ===');
await setupSwimmers(2);
{
  let st = await readState();
  check('starts running with 2 lanes', st.view === 'running' && st.slots.length === 2, JSON.stringify(st));
  check('segCount = 4', st.seg === 4);
  for (let round = 0; round < 4; round++) {
    const c = await laneCenters(); await multiTap([c[0], c[1]]); await wait(40);
    st = await readState();
    if (round < 3) check(`round ${round}: both lanes advanced together`,
      st.slots[0].nextSeg === round+1 && st.slots[1].nextSeg === round+1 &&
      st.slots[0].splits === round+1 && st.slots[1].splits === round+1, JSON.stringify(st.slots));
  }
  st = await readState();
  check('after 4 rounds both finished', st.slots && st.slots.every(s => s.finished && s.splits === 4), JSON.stringify(st.slots));
  check('moved to ASSIGN screen on finish', st.view === 'assign', 'view=' + st.view);
}

console.log('\n=== SCENARIO 2: rapid SEQUENTIAL taps (different lanes, same round) ===');
await gotoSetup(); await setupSwimmers(2);
{
  for (let round = 0; round < 4; round++) {
    const c = await laneCenters(); await singleTap(c[0]); await singleTap(c[1]); await wait(40);
    const st = await readState();
    if (round < 3) check(`round ${round}: sequential taps both recorded`,
      st.slots[0].nextSeg === round+1 && st.slots[1].nextSeg === round+1, JSON.stringify(st.slots));
  }
  const st = await readState();
  check('sequential: reached assign', st.view === 'assign', 'view=' + st.view);
}

console.log('\n=== SCENARIO 3: fast DOUBLE-tap on the SAME lane must not double-count ===');
await gotoSetup(); await setupSwimmers(2);
{
  const c = await laneCenters(); await singleTap(c[0]); await singleTap(c[0]); await wait(40);
  let st = await readState();
  check('lane0 advanced exactly once', st.slots[0].nextSeg === 1 && st.slots[0].splits === 1, JSON.stringify(st.slots));
  check('lane1 untouched (still round 0)', st.slots[1].nextSeg === 0 && st.slots[1].splits === 0, JSON.stringify(st.slots));
  const c2 = await laneCenters(); await singleTap(c2[1]); await wait(40);
  st = await readState();
  check('after lane1 catches up, both at round 1', st.slots[0].nextSeg === 1 && st.slots[1].nextSeg === 1, JSON.stringify(st.slots));
}

console.log('\n=== SCENARIO 4: STRESS — 20x simultaneous two-finger taps, no delay ===');
await gotoSetup(); await setupSwimmers(2);
{
  const c = await laneCenters();
  for (let i = 0; i < 20; i++) {
    const cur = await laneCenters();
    await multiTap(cur.length < 2 ? [c[0], c[1]] : [cur[0], cur[1]]);
  }
  await wait(60);
  const st = await readState();
  check('stress: each lane recorded exactly segCount splits (no over-count)',
    st.slots.every(s => s.splits === 4 && s.nextSeg === 4 && s.finished), JSON.stringify(st.slots));
  check('stress: ended on assign screen, no crash', st.view === 'assign', 'view=' + st.view);
}

console.log('\n=== SCENARIO 5: 4 swimmers, two pairs tapped simultaneously ===');
await gotoSetup(); await setupSwimmers(4);
{
  let st = await readState();
  check('4 lanes running', st.slots.length === 4, JSON.stringify(st.slots));
  for (let round = 0; round < 4; round++) {
    const c = await laneCenters(); await multiTap([c[0], c[1]]); await wait(15);
    const c2 = await laneCenters(); await multiTap([c2[2], c2[3]]); await wait(30);
    st = await readState();
    if (round < 3) check(`4-lane round ${round}: all four advanced`,
      st.slots.every(s => s.nextSeg === round+1), JSON.stringify(st.slots.map(s => s.nextSeg)));
  }
  st = await readState();
  check('4-lane: all finished with 4 splits', st.slots ? st.slots.every(s => s.splits === 4 && s.finished) : false, JSON.stringify(st.slots));
}

console.log(`\n──────── RESULT: ${PASS} passed, ${FAIL} failed ────────`);
if (FAIL) console.log('FAILURES:', fails.join(' | '));
await browser.close();
server.close();
process.exit(FAIL ? 1 : 0);
