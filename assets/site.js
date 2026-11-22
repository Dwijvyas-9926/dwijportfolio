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
  function card(x, { wide = false } = {}) {
    const im = (x.images || [])[0];
    const cat = splitKind(x.kind)[0] || '';
    const res = resultFor(x);
    const ds = disciplinesOf(x).join('|');
    return `
    <a class="pcard${wide ? ' pcard--wide' : ''} fade" href="${projectUrl(x.id)}" data-d="${esc(ds)}">
      <div class="pcard__img">${im ? `<img src="${im.src}" alt="${esc(im.caption || x.title)}" loading="lazy" decoding="async">` : ''}
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
        <a class="btn btn--primary btn--sm" data-resume href="./Dwij_Vyas_Resume.pdf" download>Résumé</a>
        <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="nav">Menu</button>
      </div>
    </header>`;
  }
  function contactBlock() {
    return `
    <section class="contact" id="contact" aria-labelledby="contact-h">
      <div class="wrap">
        <h2 class="contact__h rv" id="contact-h"><span class="line"><span>Let’s build</span></span><span class="line"><span>something real.</span></span></h2>
        <p class="contact__intro" data-bind="contactIntro"></p>
        <div class="contact__cta">
          <a class="btn btn--accent" data-bind="mailBtn" href="mailto:dwijgvyas@gmail.com">Email me</a>
          <a class="btn btn--ghost" data-resume href="./Dwij_Vyas_Resume.pdf" download>Download résumé</a>
        </div>
        <div class="clinks" data-bind="clinks"></div>
        <footer class="foot">
          <span data-bind="copyright">© Dwij Vyas</span>
          <span><span data-bind="place"></span> · <span data-clock></span></span>
          <nav aria-label="Footer"><a href="./">Home</a><a href="./work.html">Work</a><a href="./about.html">About</a></nav>
        </footer>
      </div>
      <p class="wordmark" aria-hidden="true" data-bind="wordmark">Dwij Vyas<span>.</span></p>
    </section>`;
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
  document.body.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main">Skip to content</a>' + header());
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
    const mb = $('[data-bind="mailBtn"]'); if (mail && mb) mb.href = mail.href;
    bind('clinks', (C.contact || []).map(c => `
      <a class="clink" href="${esc(c.href)}"${ext(c.href)}>
        <small>${esc(K[c.id] || K[c.icon] || c.id || '')}</small>
        <span>${esc(/^https?:/i.test(c.href) && /linkedin|github/i.test(c.href) ? c.href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') : c.label)}</span>
      </a>`).join(''));
    try { if (typeof uf === 'function') uf(C); } catch (e) { /* the static PDF link stays */ }
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
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -24 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });

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
    $('#lbImg').src = im.src; $('#lbImg').alt = im.caption || '';
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
    $, $$, esc, rich, bind, splitKind, linkLabel, ext, projectUrl, card, projects, resultFor, disciplinesOf, DISCIPLINES,
    observe, magnetic, lbOpen, reduced, fine, ARROW, yearFor,
  };
  loadContent().then(({ c, draft }) => {
    C = c; loaded = true;
    renderChrome();
    waiting.forEach(fn => { try { fn(C); } catch (e) { console.error(e); } });
    observe(); magnetic(); clocks(); videos();
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
