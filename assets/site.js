/* ─────────────────────────────────────────────────────────────
   Dwij Vyas — shared site script
   Loads content (same precedence the /admin editor expects),
   renders the shared header and contact block, and provides
   helpers each page uses: Site.ready(fn), Site.esc, Site.cards …
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const page = document.body.dataset.page || 'home';

  // ── content: 1. unpublished /admin draft, 2. cloud row, 3. content.json ──
  const DRAFT_KEY = 'dwij.portfolio.content.v1';
  const valid = c => c && typeof c === 'object' && c.profile && Array.isArray(c.projects);
  async function loadContent() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) { const c = JSON.parse(raw); if (valid(c)) return { c, draft: true }; }
    } catch (e) {}
    const cloud = window.PORTFOLIO_CLOUD || {};
    if (cloud.url && cloud.key) {
      try {
        const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 3500);
        const base = String(cloud.url).replace(/\/+$/, '');
        const r = await fetch(`${base}/rest/v1/${cloud.table || 'portfolio_content'}?id=eq.${cloud.row || 1}&select=content`,
          { headers: { apikey: cloud.key, Authorization: `Bearer ${cloud.key}` }, signal: ac.signal, cache: 'no-store' });
        clearTimeout(to);
        if (r.ok) { const j = await r.json(); if (j && j[0] && valid(j[0].content)) return { c: j[0].content }; }
      } catch (e) {}
    }
    const r = await fetch('./content.json', { cache: 'no-store' });
    return { c: await r.json() };
  }

  // ── helpers ──────────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rich = s => esc(s).replace(/&lt;(\/?)strong&gt;/g, '<$1strong>');
  const bind = (k, html, root = document) => { const el = $(`[data-bind="${k}"]`, root); if (el) el.innerHTML = html; return el; };
  const splitKind = s => String(s || '').split(/\s*[·|•]\s*|\s+:\s+/).map(x => x.trim()).filter(Boolean);
  const linkLabel = href => !href ? '' : /github\.com/i.test(href) ? 'Source on GitHub' : /drive\.google\.com/i.test(href) ? 'Project files' : 'Open live project';
  const ext = href => /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
  const safeHref = h => /^(https?:|mailto:|tel:|\.?\/|#)/i.test(String(h || '')) ? String(h) : '#';
  const projectUrl = id => `./project.html?p=${encodeURIComponent(id)}`;
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  // disciplines used for the Work filters, matched from each project's "kind"
  const DISCIPLINES = [
    ['Robotics', /robot|uav|drone|pixhawk|autonom/i],
    ['Embedded', /embedded|firmware|esp32|arduino|pcb/i],
    ['Digital logic', /digital|cpu|logic|fpga|verilog/i],
    ['Software & AI', /\bai\b|software|vision|decision|data|machine/i],
  ];
  const disciplinesOf = p => DISCIPLINES.filter(([, re]) => re.test(`${p.kind} ${p.sub}`)).map(([n]) => n);

  let C = null;
  const resultFor = x => {
    const t = String(x.title || '').toLowerCase();
    const m = (C.milestones || []).find(m => m.emphasis && t &&
      ((m.note || '').toLowerCase().includes(t) || (m.title || '').toLowerCase().includes(t) || (x.link && m.link === x.link)));
    return m ? `${m.emphasis}, ${m.title}` : '';
  };
  const milestoneFor = x => {
    const t = String(x.title || '').toLowerCase();
    return (C.milestones || []).find(m => t &&
      ((m.note || '').toLowerCase().includes(t) || (m.title || '').toLowerCase().includes(t) || (x.link && m.link === x.link)));
  };
  const yearFor = x => { const m = milestoneFor(x); return m && m.when ? String(m.when).trim() : ''; };
  const projects = () => (C.projects || []).filter(x => x && x.title && x.id);

  // project card, used on Home and Work
  function card(x, { wide = false, n = 0 } = {}) {
    const im = (x.images || [])[0];
    const cat = splitKind(x.kind)[0] || '';
    const res = resultFor(x);
    const ds = disciplinesOf(x).join('|');
    return `
    <a class="pcard${wide ? ' pcard--wide' : ''} fade" href="${projectUrl(x.id)}" data-d="${esc(ds)}">
      <div class="pcard__img">${n ? `<span class="pcard__n">${String(n).padStart(2, '0')}</span>` : ''}${im ? `<img src="${esc(im.src)}" alt="${esc(im.caption || x.title)}" loading="lazy" decoding="async">` : ''}
        <span class="pcard__go">${ARROW}</span></div>
      <div class="pcard__body">
        ${wide ? `<span class="pcard__cat">${esc(cat)}</span>` : ''}
        <h3 class="pcard__t">${esc(x.title)}</h3>
        ${!wide && cat ? `<span class="pcard__cat">${esc(cat)}</span>` : ''}
        <p class="pcard__s">${esc(x.sub)}</p>
        ${wide && x.desc ? `<p class="pcard__d">${esc(x.desc)}</p>` : ''}
        ${res ? `<p class="pcard__res">${esc(res)}</p>` : ''}
      </div>
    </a>`;
  }

  // editorial index row (home + work list view)
  function row(x, n) {
    const im = (x.images || [])[0];
    const cat = splitKind(x.kind).slice(0, 2).join(' · ');
    const res = resultFor(x), yr = yearFor(x);
    return `
    <li class="row fade" data-d="${esc(disciplinesOf(x).join('|'))}">
      <a class="row__a" href="${projectUrl(x.id)}" data-cursor="View" data-peek="${im ? esc(im.src) : ''}">
        <span class="row__n mono">${String(n).padStart(2, '0')}</span>
        <span class="row__t"><span class="row__title">${esc(x.title)}</span><span class="row__s">${esc(x.sub)}</span></span>
        <span class="row__m mono">${esc(cat)}</span>
        <span class="row__y mono">${esc(yr || '')}</span>
        <span class="row__r">${res ? `<span class="mono">${esc(res)}</span>` : ''}<i>${ARROW}</i></span>
        ${im ? `<span class="row__thumb"><img src="${esc(im.src)}" alt="" loading="lazy" decoding="async"></span>` : ''}
      </a>
    </li>`;
  }
  // the feature: one project, full width, image with a clip reveal
  function feature(x) {
    const im = (x.images || [])[0];
    const res = resultFor(x), yr = yearFor(x);
    return `
    <a class="feat" href="${projectUrl(x.id)}" data-cursor="View">
      <span class="feat__img rv"><span class="line"><span>${im ? `<img src="${esc(im.src)}" alt="${esc(im.caption || x.title)}" loading="lazy" decoding="async">` : ''}</span></span></span>
      <span class="feat__body">
        <span class="feat__meta mono"><span>01</span><span>${esc(splitKind(x.kind).slice(0, 2).join(' · '))}</span><span>${esc(yr || '')}</span></span>
        <span class="feat__t">${esc(x.title)}</span>
        <span class="feat__s">${esc(x.sub)}</span>
        ${x.desc ? `<span class="feat__d">${esc(x.desc)}</span>` : ''}
        ${res ? `<span class="feat__r mono">${esc(res)}</span>` : ''}
      </span>
    </a>`;
  }

  // ── shared chrome: header + contact block ───────────────────────────
  function header() {
    const here = { work: 'work', project: 'work', about: 'about' }[page] || '';
    return `
    <header class="hdr" id="hdr">
      <div class="pillnav">
        <a class="pillnav__me" href="./" aria-label="Dwij Vyas, home">
          <img src="./assets/avatar.webp" alt="" width="34" height="34"><span data-bind="mark">Dwij Vyas</span>
        </a>
        <nav class="nav" id="nav" aria-label="Main">
          <a href="./"${page === 'home' ? ' aria-current="page"' : ''}>Home</a>
          <a href="./work.html"${here === 'work' ? ' aria-current="page"' : ''}>Work</a>
          <a href="./about.html"${here === 'about' ? ' aria-current="page"' : ''}>About</a>
          <a href="#contact">Contact</a>
        </nav>
        <span class="status" data-bind="status">Open to internships</span>
        <a class="btn btn--primary btn--sm" href="./resume.html"${page === 'resume' ? ' aria-current="page"' : ''}>Résumé</a>
        <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="nav">Menu</button>
      </div>
    </header>`;
  }
  function contactBlock() {
    return `
    <section class="contact" id="contact" aria-labelledby="contact-h">
      <video class="vbg contact__v" data-src="./assets/video/assembly.mp4" poster="./assets/video/assembly.jpg" muted loop playsinline preload="none" aria-hidden="true"></video>
      <div class="wrap">
        <h2 class="contact__h rv" id="contact-h"><span class="line"><span>Let’s build</span></span><span class="line"><span>something real.</span></span></h2>
        <p class="contact__intro" data-bind="contactIntro"></p>
        <div class="contact__cta">
          <a class="btn btn--accent" data-bind="mailBtn" href="mailto:dwijgvyas@gmail.com">Email me</a>
          <button class="btn btn--ghost" type="button" data-copy aria-live="polite">Copy address</button>
          <a class="btn btn--ghost" href="./resume.html">See my résumé</a>
        </div>
        <div class="clinks" data-bind="clinks"></div>
        <footer class="foot">
          <span data-bind="copyright">© Dwij Vyas</span>
          <span><span data-bind="place"></span> · <span data-clock></span></span>
          <nav aria-label="Footer"><a href="./">Home</a><a href="./work.html">Work</a><a href="./about.html">About</a><a href="./resume.html">Résumé</a></nav>
          <span class="foot__tools"><button type="button" data-sound aria-pressed="true">Sound on</button><button type="button" data-keys aria-controls="keys">Keys ?</button><span class="mono">v3 — Nov 2026</span></span>
        </footer>
      </div>
      <p class="wordmark" aria-hidden="true" data-bind="wordmark">Dwij Vyas<span>.</span></p>
    </section>
    <div class="keys" id="keys" role="dialog" aria-label="Keyboard shortcuts" hidden>
      <p class="keys__h">Keyboard</p>
      <dl><div><dt><kbd>H</kbd></dt><dd>Home</dd></div><div><dt><kbd>W</kbd></dt><dd>Work</dd></div><div><dt><kbd>A</kbd></dt><dd>About</dd></div><div><dt><kbd>C</kbd></dt><dd>Contact</dd></div><div><dt><kbd>R</kbd></dt><dd>Résumé</dd></div><div><dt><kbd>?</kbd></dt><dd>This list</dd></div></dl>
    </div>`;
  }
  function lightbox() {
    return `
    <div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
      <button class="lb__x" data-lb="close">Close</button>
      <button class="lb__nav lb__prev" data-lb="prev" aria-label="Previous image"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <img id="lbImg" alt="">
      <p id="lbCap"></p>
      <button class="lb__nav lb__next" data-lb="next" aria-label="Next image"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>`;
  }
  const INTRO_KEY = 'dwij.intro.v1';
  let showIntro = false;
  try { showIntro = !reduced && !sessionStorage.getItem(INTRO_KEY) && page === 'home'; } catch (e) {}
  const intro = showIntro ? `<div class="pre" id="pre" aria-hidden="true"><p class="pre__n mono"><span id="preN">00</span><span>/100</span></p><p class="pre__w mono">Dwij Vyas — portfolio</p></div>` : '';
  document.body.insertAdjacentHTML('afterbegin', intro + '<a class="skip" href="#main">Skip to content</a>' + header() + '<div class="grain" aria-hidden="true"></div><div class="prog" aria-hidden="true"><i id="prog"></i></div>' + (fine && !reduced ? '<div class="cur" id="cur" aria-hidden="true"><i></i><span id="curL"></span></div>' : ''));
  const main = $('#main');
  main.insertAdjacentHTML('afterend', contactBlock() + lightbox());

  function renderChrome() {
    const p = C.profile || {};
    const name = String(p.name || '').trim();
    bind('mark', esc(name));
    if (p.availability) bind('status', /internship/i.test(p.availability) ? 'Open to internships' : 'Open to work');
    bind('contactIntro', esc(p.availability ? `${p.availability}. Email is the quickest way to reach me.` : 'Email is the quickest way to reach me.'));
    bind('copyright', `© ${new Date().getFullYear()} ${esc(name)}`);
    bind('place', esc(p.location || ''));
    bind('wordmark', `${esc(name)}<span>.</span>`);
    const K = { email: 'Email', linkedin: 'LinkedIn', phone: 'Phone', github: 'GitHub' };
    const mail = (C.contact || []).find(c => /^mailto:/i.test(c.href || ''));
    const mb = $('[data-bind="mailBtn"]'); if (mail && mb) mb.href = safeHref(mail.href);
    bind('clinks', (C.contact || []).map(c => `
      <a class="clink" href="${esc(safeHref(c.href))}"${ext(c.href)}>
        <small>${esc(K[c.id] || K[c.icon] || c.id || '')}</small>
        <span>${esc(/^https?:/i.test(c.href) && /linkedin|github/i.test(c.href) ? c.href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') : c.label)}</span>
      </a>`).join(''));
  }

  // ── behaviour ────────────────────────────────────────────────────────
  // smooth scroll
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    let el = null; try { el = document.querySelector(a.getAttribute('href')); } catch (err) {}
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -24 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });

  // the preloader counts to 100 while the hero assets arrive, then lifts
  const introWait = [];
  let introDone = !showIntro;
  function afterIntro(fn) { introDone ? fn() : introWait.push(fn); }
  if (showIntro) {
    document.body.classList.add('is-pre');
    const n = $('#preN'), pre = $('#pre'), t0 = performance.now(), D = 1100;
    const tick = now => {
      const x = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - x, 3);
      n.textContent = String(Math.round(e * 100)).padStart(2, '0');
      if (x < 1) requestAnimationFrame(tick);
      else {
        try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (err) {}
        pre.classList.add('is-done'); document.body.classList.remove('is-pre'); sfx('land');
        introDone = true; introWait.forEach(f => f()); introWait.length = 0;
        setTimeout(() => pre.remove(), 1200);
      }
    };
    requestAnimationFrame(tick);
  }

  // reading progress hairline
  const prog = $('#prog');
  const onProg = () => { const h = document.documentElement; const m = h.scrollHeight - innerHeight; prog.style.transform = `scaleX(${m > 0 ? (scrollY / m).toFixed(4) : 0})`; };
  addEventListener('scroll', onProg, { passive: true }); addEventListener('resize', onProg);

  // cursor: a dot that grows into a label over links that ask for one
  const cur = $('#cur');
  if (cur) {
    const lab = $('#curL'); let cx = 0, cy = 0, tx = 0, ty = 0, shown = false;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!shown) { shown = true; cx = tx; cy = ty; cur.classList.add('is-on'); } }, { passive: true });
    document.addEventListener('pointerover', e => { const a = e.target.closest('[data-cursor]'); if (a) { lab.textContent = a.dataset.cursor; cur.classList.add('is-label'); } });
    document.addEventListener('pointerout', e => { if (e.target.closest('[data-cursor]') && !(e.relatedTarget && e.relatedTarget.closest('[data-cursor]'))) cur.classList.remove('is-label'); });
    document.addEventListener('mouseleave', () => cur.classList.remove('is-on'));
    document.addEventListener('mouseenter', () => cur.classList.add('is-on'));
    const run = () => { cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22; cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`; requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }

  // hover preview that follows the pointer over the index rows
  function peek(root = document) {
    if (!fine || reduced) return;
    $$('.rows', root).forEach(list => {
      if (list.dataset.peek) return; list.dataset.peek = '1';
      const pk = document.createElement('div'); pk.className = 'peek'; pk.innerHTML = '<img alt="">';
      list.appendChild(pk);
      const img = pk.firstChild; let px = 0, py = 0, tx = 0, ty = 0, on = false;
      list.addEventListener('pointerover', e => { const a = e.target.closest('[data-peek]'); if (a && a.dataset.peek) { if (img.src !== a.dataset.peek) img.src = a.dataset.peek; on = true; pk.classList.add('is-on'); } });
      list.addEventListener('pointerleave', () => { on = false; pk.classList.remove('is-on'); });
      list.addEventListener('pointermove', e => { const r = list.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; }, { passive: true });
      const run = () => { if (on) { px += (tx - px) * 0.12; py += (ty - py) * 0.12; pk.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) rotate(${((tx - px) * 0.04).toFixed(2)}deg)`; } requestAnimationFrame(run); };
      requestAnimationFrame(run);
    });
  }

  // the project image you click carries over into the case page's cover (cross-document view transition)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="project.html"]'); if (!a || reduced) return;
    $$('[style*="view-transition-name"]').forEach(el => el.style.viewTransitionName = '');
    const img = a.querySelector('img') || (a.dataset.peek && $('.peek.is-on img'));
    if (img) img.style.viewTransitionName = 'cover';
  });
  addEventListener('pagereveal', e => { if (e.viewTransition) document.documentElement.classList.add('vt'); });

  // ── sound: a quiet synthesized click set, off with one switch ──
  const SFX_KEY = 'dwij.sound';
  let sfxOn = true; try { sfxOn = localStorage.getItem(SFX_KEY) !== 'off'; } catch (e) {}
  let sctx = null, gestured = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { gestured = true; }, { once: true, passive: true }));
  function sfx(kind) {
    if (!sfxOn || reduced || !gestured) return;
    try {
      sctx = sctx || new (window.AudioContext || window.webkitAudioContext)();
      if (sctx.state === 'suspended') sctx.resume();
      const t = sctx.currentTime, o = sctx.createOscillator(), g = sctx.createGain();
      const f = { tick: [1800, 0.018], click: [900, 0.035], land: [520, 0.12] }[kind] || [900, 0.03];
      o.type = kind === 'land' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(f[0], t);
      o.frequency.exponentialRampToValueAtTime(f[0] * 0.6, t + f[1]);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + f[1]);
      o.connect(g); g.connect(sctx.destination); o.start(t); o.stop(t + f[1] + 0.02);
    } catch (e) {}
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-sound]')) { sfxOn = !sfxOn; try { localStorage.setItem(SFX_KEY, sfxOn ? 'on' : 'off'); } catch (err) {} $$('[data-sound]').forEach(b => { b.setAttribute('aria-pressed', String(sfxOn)); b.textContent = sfxOn ? 'Sound on' : 'Sound off'; }); if (sfxOn) sfx('click'); return; }
    if (e.target.closest('.seg button, .filters button, .views button')) sfx('tick');
    else if (e.target.closest('a.btn, .nav a, .row__a, .feat, .pcard, .next__a')) sfx('click');
  });

  // ── keyboard shortcuts: H W A C, ? for the list ──
  const KEYS = { h: './', w: './work.html', a: './about.html', c: '#contact', r: './resume.html' };
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === '?') { const h = $('#keys'); if (h) { h.hidden = !h.hidden; } return; }
    if (k === 'escape') { const h = $('#keys'); if (h && !h.hidden) h.hidden = true; return; }
    if (!KEYS[k] || $('#lb').classList.contains('is-open')) return;
    if (KEYS[k].startsWith('#')) { const el = $(KEYS[k]); if (el) lenis ? lenis.scrollTo(el, { offset: -24 }) : el.scrollIntoView({ behavior: 'smooth' }); }
    else location.href = KEYS[k];
  });

  // copy the email address
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const mail = (C && C.contact || []).find(c => /^mailto:/i.test(c.href || ''));
    const addr = mail ? mail.href.replace(/^mailto:/i, '') : 'dwijgvyas@gmail.com';
    try { await navigator.clipboard.writeText(addr); b.textContent = 'Copied'; } catch (err) { b.textContent = addr; }
    setTimeout(() => { b.textContent = 'Copy address'; }, 1800);
  });

  document.addEventListener('click', e => { if (e.target.closest('[data-keys]')) { const h = $('#keys'); h.hidden = !h.hidden; } else if (e.target.closest('#keys')) { $('#keys').hidden = true; } });
  // sound switch reflects the stored choice
  $$('[data-sound]').forEach(b => { b.setAttribute('aria-pressed', String(sfxOn)); b.textContent = sfxOn ? 'Sound on' : 'Sound off'; });

  // header hides on the way down, returns on the way up
  const hdr = $('#hdr'); let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (y > lastY + 4 && y > 240 && !document.body.classList.contains('is-locked')) hdr.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 240) hdr.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });

  // mobile menu
  const nav = $('#nav'), mbtn = $('#menuBtn');
  const setMenu = o => { nav.classList.toggle('is-open', o); mbtn.setAttribute('aria-expanded', o); mbtn.textContent = o ? 'Close' : 'Menu'; };
  mbtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

  // reveals, once each
  const once = new IntersectionObserver(ents => ents.forEach(en => {
    if (!en.isIntersecting) return;
    once.unobserve(en.target);
    en.target.classList.add('in');
    if (en.target.dataset.count) countUp(en.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  const observe = (root = document) => $$('.rv, .fade, [data-count]', root).forEach(el => once.observe(el));
  function countUp(el) {
    const to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0;
    if (reduced || !isFinite(to)) return;
    const t0 = performance.now();
    const step = now => {
      const x = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - x, 4);
      el.textContent = (to * e).toFixed(dec);
      if (x < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // magnetic primary buttons
  function magnetic(root = document) {
    if (!fine || reduced) return;
    $$('[data-magnetic]', root).forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  // background videos: load when near, play only while visible; poster only for reduced motion or data saver
  function videos() {
    const save = navigator.connection && navigator.connection.saveData;
    $$('video[data-src]').forEach(v => {
      if (reduced || save) return;
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting) {
          if (!v.src) { v.src = v.dataset.src; v.load(); }
          const pl = v.play(); if (pl && pl.catch) pl.catch(() => {});
        } else if (v.src) v.pause();
      }, { rootMargin: '200px 0px' }).observe(v);
    });
  }

  // live local time
  function clocks() {
    const els = $$('[data-clock]');
    const tick = () => { try { const v = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: true }).format(new Date()) + ' IST'; els.forEach(c => c.textContent = v); } catch (e) {} };
    tick(); setInterval(tick, 20000);
  }

  // lightbox
  const lb = $('#lb'); let lbList = [], lbI = 0, lbReturn = null;
  function lbShow(i) {
    lbI = (i + lbList.length) % lbList.length;
    const im = lbList[lbI];
    $('#lbImg').src = /^(https?:|\.?\/|data:image\/)/i.test(im.src || '') ? im.src : ''; $('#lbImg').alt = im.caption || '';
    $('#lbCap').textContent = im.caption ? `${im.caption} (${lbI + 1} of ${lbList.length})` : `${lbI + 1} of ${lbList.length}`;
    $$('.lb__nav', lb).forEach(b => b.hidden = lbList.length < 2);
  }
  function lbOpen(list, i) {
    if (!list || !list.length) return;
    lbList = list; lbReturn = document.activeElement;
    lb.hidden = false; lb.classList.add('is-open'); document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    lbShow(i); $('.lb__x', lb).focus();
  }
  function lbClose() {
    lb.classList.remove('is-open'); lb.hidden = true; document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  }
  lb.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]');
    if (b) { const a = b.dataset.lb; a === 'close' ? lbClose() : lbShow(lbI + (a === 'next' ? 1 : -1)); }
    else if (e.target === lb) lbClose();
  });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowRight') lbShow(lbI + 1);
    else if (e.key === 'ArrowLeft') lbShow(lbI - 1);
    else if (e.key === 'Tab') {
      const f = $$('button:not([hidden])', lb); const i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // ── boot ─────────────────────────────────────────────────────────────
  const waiting = [];
  let loaded = false;
  window.Site = {
    ready(fn) { loaded ? fn(C) : waiting.push(fn); },
    $, $$, esc, rich, bind, splitKind, linkLabel, ext, projectUrl, card, row, feature, projects, resultFor, disciplinesOf, DISCIPLINES, sfx,
    observe, magnetic, lbOpen, reduced, fine, ARROW, yearFor, afterIntro, peek, safeHref,
  };
  loadContent().then(({ c, draft }) => {
    C = c; loaded = true;
    renderChrome();
    waiting.forEach(fn => { try { fn(C); } catch (e) { console.error(e); } });
    observe(); magnetic(); clocks(); videos(); peek(); onProg();
    // on touch screens a tap brings a film frame into colour; a second tap follows the link
    if (!fine) document.addEventListener('click', e => { const f = e.target.closest('.strip__f'); if (f && !f.classList.contains('is-color')) { e.preventDefault(); $$('.strip__f.is-color').forEach(x => x.classList.remove('is-color')); f.classList.add('is-color'); } });
    if (draft) {
      const d = document.createElement('p'); d.className = 'draft';
      d.textContent = 'Showing your unpublished draft from the editor';
      document.body.appendChild(d);
    }
  }).catch(err => {
    console.error(err);
    main.insertAdjacentHTML('afterbegin', '<p class="wrap" style="padding:160px 0 40px">Content could not be loaded. Refresh the page to try again.</p>');
  });
})();
