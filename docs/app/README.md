# SplitLane — iOS PWA (installable web app)

This folder is a self-contained **Progressive Web App**. On an iPhone you install
it straight from Safari with **Add to Home Screen** — no App Store, no Mac, no
Xcode, no Apple Developer account. It then opens full-screen like a native app
and works **offline** (a service worker caches everything).

```
docs/app/
├─ index.html            # the whole app (CSS inlined) — built from the preview
├─ manifest.webmanifest  # name, icons, standalone display
├─ sw.js                 # offline cache (service worker)
└─ icons/                # 180 / 192 / 512 / maskable-512 PNG app icons
```

## Build

`index.html` and the icons are generated — edit the source, then regenerate:

```bash
node tools/gen-icons.mjs   # regenerate app icons
node tools/build-app.mjs   # rebuild docs/app/index.html from docs/design-preview/app.html
```

Source of truth: `docs/design-preview/app.html` + `docs/design-preview/tokens.css`.

## Publish (GitHub Pages)

**Option A — GitHub Actions (recommended, clean URL).**
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The included workflow `.github/workflows/pages.yml` deploys `docs/app` on push
   (or run it from the **Actions** tab → *Deploy SplitLane to GitHub Pages* → *Run workflow*).
3. Site URL: **https://kyj5482.github.io/swim.meet.timer/**

**Option B — Deploy from a branch (no workflow).**
1. Repo **Settings → Pages → Source: Deploy from a branch**.
2. Branch: your branch, Folder: **/docs**. Save.
3. App URL: **https://kyj5482.github.io/swim.meet.timer/app/**

## Install on your iPhone

1. Open the published URL above in **Safari** (must be Safari, not Chrome).
2. Tap the **Share** button (the square with an ↑ arrow).
3. Scroll down and tap **Add to Home Screen** → **Add**.
4. Launch **SplitLane** from your Home Screen — it opens full-screen and works
   offline. Switch language to Korean any time via the **⚙** Settings sheet.

> HTTPS is required for install/offline. GitHub Pages serves HTTPS automatically.
> A native App Store build is also possible later by wrapping this PWA with
> [Capacitor](https://capacitorjs.com/) (that path needs a Mac + Xcode + an
> Apple Developer account).
