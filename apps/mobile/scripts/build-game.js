#!/usr/bin/env node
/**
 * game.html → gameHtml.ts 인라인 생성기.
 * WebView는 파일 자산 대신 source={{ html }}을 쓰므로(iOS/Android 동일 동작),
 * 소스 HTML을 문자열 모듈로 굽는다. 생성물은 커밋한다.
 *
 *   npm run build:game -w apps/mobile
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/features/game/game.html');
const out = path.join(__dirname, '../src/features/game/gameHtml.ts');

const html = fs.readFileSync(src, 'utf8');
const body = [
  '/* eslint-disable */',
  '// 자동 생성 파일 — 직접 수정 금지. 소스: game.html, 생성: scripts/build-game.js',
  `export const GAME_HTML = ${JSON.stringify(html)};`,
  '',
].join('\n');

fs.writeFileSync(out, body);
console.log(`gameHtml.ts written (${(body.length / 1024).toFixed(1)} KB)`);
