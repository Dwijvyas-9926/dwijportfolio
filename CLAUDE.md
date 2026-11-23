# CLAUDE.md — dwijportfolio

Live portfolio of Dwij Vyas. Static HTML, no build step, deployed on Vercel from `main`.
Every push to `main` goes live in about a minute. Any other branch gets a preview URL.

## Files
- `index.html` (home), `work.html`, `about.html`, `project.html?p=<id>` (case study), `resume.html`, `404.html`.
  Each page is plain HTML with a short page script; all read `content.json` at load through `assets/site.js`.
- `assets/site.js` — shared: content loading (admin draft → cloud row → `content.json`), header + contact block, project rows/cards, preloader, cursor, sound, shortcuts, lightbox, helpers (`Site.esc`, `Site.safeHref`, `Site.row`, `Site.card`, `Site.feature`…).
- `assets/site.css` — the whole design system. Palette: off-white `#F3F2EF`, ink `#111214`, one accent `#F05627`. Type: Barlow Condensed (display), Barlow (text), Archivo (name/wordmark), Liberation Mono (data labels only).
- `assets/blob.js` — hero liquid-crystal shader. `assets/scope.js` — the modulator (oscilloscope + Listen). `assets/drone.js` + `assets/system.js` — the annotated AERONEX airframe section (`assets/aeronex.glb`, three.js in `vendor/three`).
- `assets/img/<project>-<n>.webp` — project images (max 1280 px wide). `assets/video/*.mp4` — background clips (Mixkit free licence).
- `admin.html` — browser-only content editor at `/admin`. Publishes by committing `content.json` to this repo via the GitHub API.
- `content.json` — **single source of truth for all content.** Keys: `profile`, `contact`, `education`, `milestones`, `projects`, `domains`. Project images are `{ src, caption }` where `src` is a path under `assets/img/` (the editor may add new ones as data URIs; both work). A project may carry `chapters: [{ title, text, image }]` (image = 1-based index into its `images`) for a chaptered case study.
- `vercel.json` — clean URLs, security headers, `no-cache` on `content.json`, `noindex` on `/admin.html`. Keep these.
- `Dwij_Vyas_Resume.pdf`, `og-image.jpg`, `favicon.ico` + `assets/favicon-*.png`, `robots.txt`, `sitemap.xml`.

## How to make changes
- **Content** (projects, text, education, milestones, links, chapters): edit `content.json` only. Never hard-code content into the pages.
  - Edit it with a script (Python `json` load → modify → dump with `ensure_ascii=False`, 2-space indent). Match the existing schema exactly.
  - New images: resize to max 1280 px wide, save as WebP under `assets/img/`, reference by path.
- **Résumé PDF**: replace `Dwij_Vyas_Resume.pdf`, keep the filename. The online résumé at `/resume` builds itself from `content.json`.
- **Design / behaviour**: edit `assets/site.css`, `assets/site.js` or the page. Every value that reaches markup goes through `Site.esc`; every href from content through `Site.safeHref`.

## Rules
- Change only what was asked.
- Content-only changes may go straight to `main`. Any change to pages, `assets/`, or `vercel.json` goes on a branch so Vercel builds a preview; merge only after Dwij approves.
- Before pushing: `python3 -m json.tool content.json > /dev/null` must pass; serve locally (`python3 -m http.server`) and open every page; the console must be clean.
- Never touch the admin passphrase gate, the `PORTFOLIO_GITHUB` / `PORTFOLIO_CLOUD` config blocks, or the publish logic unless explicitly asked.
- Never commit tokens, keys, or passwords.
- `admin.html` also commits `content.json`: pull before editing so you don't overwrite changes published from the admin panel.

## Design direction
An engineering annual: editorial, precise, one accent. Motion is directed and few-property (position, opacity, clip masks), with reduced-motion still frames everywhere. No eyebrow labels on every section, no middle-dot meta strings in UI copy, numbering only where content is a sequence. Mono is for data (years, indices, readouts), not for decoration. No neon, no generic hero + three cards + footer, nothing that reads as AI-generated or childish.
