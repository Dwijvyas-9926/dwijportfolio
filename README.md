# Deploying so admin edits go live globally

This folder is a normal static site (`index.html`, `admin.html`, `content.json`)
plus small serverless functions that persist your edits to storage. It's
set up to deploy to **either Netlify or Vercel** — pick one, you don't need
both. Netlify instructions are first; scroll to the bottom for Vercel.

You log into `admin.html`, hit **Save**, and every visitor's browser gets
the change — no manual redeploy needed.

How it works: `index.html` fetches content from `/api/get-content`, which
reads from a small key/value store (Netlify Blobs or Vercel Blob,
depending which you deploy to). `admin.html`'s Save button writes through
`/api/save-content`, which checks a passphrase hash before writing
anything. `content.json` stays in the repo as a fallback/first-boot copy.

## 1. Push this folder to GitHub

Create a repo and push everything in this folder (including `netlify/`,
`netlify.toml`, `package.json`, `content.json`) to it.

## 2. Create the Netlify site (named dwijvyasportfolio)

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Import an existing project** → pick your GitHub repo.
2. Build settings: leave build command empty (or `true`), publish directory
   `.` — `netlify.toml` already sets this. Deploy once (any name is fine
   for now).
3. Once the site exists: **Site configuration → General → Site details →
   Change site name** → enter `dwijvyasportfolio` → Save.
   - If that exact name is already taken by someone else on Netlify, it'll
     ask you to pick a variant (e.g. `dwijvyasportfolio-1`) — the URL below
     just adjusts to match whatever it accepts.
4. Your site is now live at **`https://dwijvyasportfolio.netlify.app`**
   (admin at `https://dwijvyasportfolio.netlify.app/admin.html`).
5. Netlify will detect `netlify/functions/*.js` automatically and deploy
   them as Functions. Netlify Blobs works out of the box on Netlify's own
   infra — no extra database sign-up needed.

   *(Optional later: if you buy a custom domain like `dwijvyas.com`, you can
   point it at this same site under Domain management — the `.netlify.app`
   one keeps working either way.)*

## 3. Set your publish key (ADMIN_HASH)

This is the real lock — it's checked on the server, not just in the
browser.

1. Open `admin.html` locally (or on the deployed site) and log in with the
   existing default email/passphrase baked into the file.
2. Go to the **Settings** tab → **Publish** card. It shows a **Publish key**
   — copy it.
   - Current default key (matches the passphrase already in the file):
     `6e60981bdfaae029c742d5609943ae7bb91b144f87d37ea72e5510ac6192cac5`
3. In Netlify: **Site configuration → Environment variables → Add a
   variable**. Name: `ADMIN_HASH`. Value: paste the key. Save, then
   **trigger a redeploy** (env vars only apply to new deploys).
4. **Strongly recommended:** immediately change your passphrase in
   `admin.html` → Settings → Passphrase → Update. Copy the *new* Publish
   key shown afterward, and update the `ADMIN_HASH` variable in Netlify to
   match, then redeploy again. This retires the default that shipped in the
   file.

## 4. Use it

- Open `https://dwijvyasportfolio.netlify.app/admin.html`, log in, edit,
  hit **Save & preview**. The status bar will show "Saved — live for
  everyone" once the publish call succeeds.
- Open `https://dwijvyasportfolio.netlify.app/` on any device — it fetches
  the live content on every load (`cache: no-store`), so changes show up
  immediately, everywhere.
- **Export content.json** still works as a manual backup/download.

## Notes

- `admin.html` has `<meta name="robots" content="noindex,nofollow">`
  already, so search engines won't index it — but it is still reachable by
  URL. This scheme (a client-known hash, checked server-side) is fine for a
  personal portfolio, not bank-grade auth. Don't reuse this passphrase
  anywhere sensitive.
- If you ever see "Saved locally. Publish key rejected", the `ADMIN_HASH`
  env var doesn't match your current passphrase — redo step 3.
- If `get-content` briefly 404s (e.g. right after first deploy, before you
  ever click Save), `index.html` automatically falls back to the bundled
  `content.json`, so the site never breaks.

---

## Deploying to Vercel instead

This repo also includes `api/get-content.js` and `api/save-content.js` —
the Vercel equivalent of the two Netlify functions, using **Vercel Blob**
(Vercel's built-in storage) instead of Netlify Blobs. Both `index.html` and
`admin.html` call the platform-agnostic paths `/api/get-content` and
`/api/save-content`, which Netlify redirects to its functions
(`netlify.toml`) and which Vercel serves natively from the `api/` folder —
so the same repo deploys cleanly to either one; you don't need both.

1. Push this folder to GitHub (same as step 1 above).
2. [vercel.com](https://vercel.com) → **Add New… → Project** → import the
   repo. Framework preset: "Other". No build command needed — deploy.
3. Rename it: **Project Settings → General → Project Name** →
   `dwijvyasportfolio`. Your site is then at
   `https://dwijvyasportfolio.vercel.app`.
4. Create the storage: **Project Settings → Storage → Create Database →
   Blob**. Connect it to this project — Vercel automatically adds a
   `BLOB_READ_WRITE_TOKEN` environment variable for you, which
   `api/save-content.js` and `api/get-content.js` use automatically. No
   manual token copying needed.
5. Set the publish key: same as step 3 above, but in **Project Settings →
   Environment Variables**, add `ADMIN_HASH` with the value from
   admin.html's Settings → Publish card. Redeploy (Deployments tab →
   ⋯ → Redeploy) so it takes effect.
6. Change your passphrase in admin.html (same as step 6 above) and update
   `ADMIN_HASH` to match, then redeploy again.

Everything else — logging in, editing, hitting Save, the live URL updating
instantly on every device — works exactly the same as on Netlify.
