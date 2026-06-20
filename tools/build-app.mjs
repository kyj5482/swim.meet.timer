// Build the deployable PWA (docs/app/index.html) from the preview source
// (docs/design-preview/app.html). Inlines tokens.css so the app is a single
// self-contained file, injects the iOS/PWA <head> tags, and registers the
// service worker. Re-run whenever the preview or tokens change:
//
//   node tools/build-app.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('docs/design-preview/app.html', root), 'utf8');
const css = readFileSync(new URL('docs/design-preview/tokens.css', root), 'utf8');

const head = `<title>SplitLane</title>
<meta name="description" content="Time multiple swimmers with one LAP button, then assign records.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#081623">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="SplitLane">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<style>
${css.trim()}
</style>`;

let out = src
  // viewport-fit=cover so the app fills the screen under the notch / home bar
  .replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">'
  )
  // swap the title + external stylesheet for inlined CSS + PWA head
  .replace(
    /<title>SplitLane<\/title>\s*<link rel="stylesheet" href="tokens.css">/,
    head
  )
  // register the service worker just before </body>
  .replace(
    '</body>',
    `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
</script>
</body>`
  );

if (out === src) {
  console.error('build-app: no substitutions applied — check the source markers.');
  process.exit(1);
}

writeFileSync(new URL('docs/app/index.html', root), out);
console.log('wrote docs/app/index.html (' + out.length + ' bytes)');
