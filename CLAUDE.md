# CLAUDE.md — dwijportfolio

Live portfolio of Dwij Vyas. Static HTML, no build step, deployed on Vercel from `main`.
Every push to `main` goes live in about a minute.

## Files
- `index.html` — the portfolio (~780 KB, bundled/minified JS + CSS inline). Reads `content.json` at load.
- `admin.html` — browser-only content editor at `/admin`. Publishes by committing `content.json` to this repo via the GitHub API (commits titled "Update portfolio content — <timestamp>").
- `content.json` — **single source of truth for all content.** Top-level keys: `profile`, `contact`, `education`, `milestones`, `projects`, `domains`. Images are embedded as data URIs, so the file is ~2 MB.
- `vercel.json` — clean URLs, security headers, `no-cache` on `content.json`, `noindex` on `/admin.html`. Keep these.
- `Dwij_Vyas_Resume.pdf`, `og-image.jpg`, `robots.txt`, `sitemap.xml`.

## How to make changes
- **Content** (projects, text, education, milestones, links): edit `content.json` only. Never hard-code content into `index.html`.
  - Edit it with a script (Python `json` load → modify → dump with `ensure_ascii=False`, 2-space indent to match), not by hand — the embedded images make it huge.
  - Match the existing schema exactly: copy the shape of an existing entry before adding a new one.
  - New images: resize to max 1280 px wide, JPEG/WebP, embed as a data URI like the existing ones.
- **Résumé**: replace `Dwij_Vyas_Resume.pdf`, keep the filename.
- **Design / behaviour**: edit `index.html` or `admin.html`. The JS is minified — make small, targeted edits; don't reformat or re-bundle the file.

## Rules
- Change only what was asked. Nothing else gets touched, reworded, or "improved".
- Content-only changes may go straight to `main`. Any change to `index.html`, `admin.html` or `vercel.json` goes on a branch so Vercel builds a preview; merge only after Dwij approves.
- Before pushing: `python3 -m json.tool content.json > /dev/null` must pass, and open the page locally (`python3 -m http.server`) to confirm it loads.
- Never touch the admin passphrase gate, the `PORTFOLIO_GITHUB` / `PORTFOLIO_CLOUD` config blocks, or the publish logic unless explicitly asked.
- Never commit tokens, keys, or passwords. The GitHub token lives only in the editor's sessionStorage.
- Remember `admin.html` also commits `content.json`: pull before editing so you don't overwrite changes published from the admin panel.

## Design direction
Professional and subtle, editorial. No neon/glow, no generic hero + three cards + footer layouts, nothing that reads as AI-generated or childish. Preserve the existing look unless asked to change it.
