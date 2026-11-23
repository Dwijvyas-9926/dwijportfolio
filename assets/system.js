/* "How a system comes together." — the AVION stack on the aircraft itself.
   The section is pinned; scrolling steps through three chapters. For each
   one the aircraft (assets/drone.js) turns to the pose that shows the
   parts involved, and callouts are drawn from those parts to tags set
   around the aircraft. Static on narrow screens and for reduced motion. */
(function () {
  'use strict';
  const sec = document.getElementById('sys');
  if (!sec) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const notes = [...sec.querySelectorAll('[data-note]')];
  const scene = sec.querySelector('.sys__scene'), canvas = sec.querySelector('#droneCanvas'), leads = sec.querySelector('.sys__leads');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, parent) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };

  // what each chapter points at, and what the tag says
  const TAGS = {
    cam: ['RealSense D455', 'depth + RGB, 30 fps'],
    th:  ['Thermal camera', 'search and rescue'],
    pi:  ['Raspberry Pi 4', 'OpenCV · DroneKit · Python'],
    px:  ['Pixhawk 2.4.8', 'ArduPilot attitude loop'],
    gps: ['GPS / IMU', 'position and attitude'],
    esc: ['4 × ESC + motors', 'PWM, 400 Hz'],
    srv: ['Payload hook', 'servo release'],
    bat: ['4S LiPo', '14.8 V power rail'],
  };
  const CHAPTERS = [['cam', 'th', 'pi'], ['px', 'gps', 'esc', 'bat'], ['pi', 'px', 'srv']];

  let active = -1;
  function setChapter(i) {
    if (i === active) return; active = i;
    notes.forEach((n, k) => n.classList.toggle('is-on', i < 0 || k === i));
    sec.dataset.chapter = i < 0 ? 'all' : String(i);
    if (window.SysDrone) window.SysDrone.setChapter(i);
  }

  // callouts: a leader from the part out to a ring around the aircraft, tag beside it
  const made = {};
  function draw() {
    const dr = window.SysDrone; if (!dr || !leads) return;
    const keys = active >= 0 ? CHAPTERS[active] : [];
    const r = canvas.getBoundingClientRect(), W = r.width, H = r.height;
    leads.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const k in made) if (!keys.includes(k)) made[k].g.classList.remove('is-on');
    const cx = W / 2, cy = H * 0.5, R = Math.min(W, H) * 0.44;
    // place tags on the ring, then push apart any two closer than 34px
    const pts = keys.map(k => { const p = dr.project(k); if (!p) return null; const a = Math.atan2(p.y - cy, p.x - cx); return { k, p, a }; }).filter(Boolean).sort((a, b) => a.a - b.a);
    const slots = pts.map(o => ({ ...o, y: Math.min(H - 34, Math.max(28, cy + Math.sin(o.a) * R)), x: cx + Math.cos(o.a) * R }));
    const left = slots.filter(s => s.x < cx).sort((a, b) => a.y - b.y), right = slots.filter(s => s.x >= cx).sort((a, b) => a.y - b.y);
    for (const col of [left, right]) {
      for (let i = 1; i < col.length; i++) if (col[i].y - col[i - 1].y < 40) col[i].y = col[i - 1].y + 40;
      for (let i = col.length - 1; i >= 0; i--) { const lim = H - 34 - (col.length - 1 - i) * 40; if (col[i].y > lim) col[i].y = lim; }
    }
    slots.forEach(s => {
      let L = made[s.k];
      if (!L) {
        const g = el('g', { class: 'sys__lead' }, leads);
        L = made[s.k] = { g, path: el('path', { fill: 'none' }, g), ring: el('circle', { r: 9, class: 'sys__ring' }, g), dot: el('circle', { r: 3.5 }, g), t1: el('text', { class: 'sys__lt' }, g), t2: el('text', { class: 'sys__ls' }, g) };
      }
      const side = s.x < cx ? -1 : 1, tx = Math.min(W - 12, Math.max(12, s.x)), ty = s.y;
      L.path.setAttribute('d', `M${s.p.x.toFixed(1)},${s.p.y.toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)} h${(side * 14).toFixed(1)}`);
      L.dot.setAttribute('cx', s.p.x); L.dot.setAttribute('cy', s.p.y); L.ring.setAttribute('cx', s.p.x); L.ring.setAttribute('cy', s.p.y);
      const ax = tx + side * 20, anchor = side > 0 ? 'start' : 'end';
      L.t1.setAttribute('x', ax); L.t1.setAttribute('y', ty - 2); L.t1.setAttribute('text-anchor', anchor); L.t1.textContent = TAGS[s.k][0];
      L.t2.setAttribute('x', ax); L.t2.setAttribute('y', ty + 13); L.t2.setAttribute('text-anchor', anchor); L.t2.textContent = TAGS[s.k][1];
      L.g.classList.add('is-on');
    });
  }
  sec.addEventListener('drone:ready', () => { if (window.SysDrone) window.SysDrone.setChapter(active); });

  let running = false, visible = false;
  const loop = () => { if (!running) return; draw(); requestAnimationFrame(loop); };
  const update = () => { const on = visible && !document.hidden && !reduced; if (on && !running) { running = true; requestAnimationFrame(loop); } else if (!on) running = false; };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }, { rootMargin: '200px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', update);

  const pinned = () => getComputedStyle(sec.querySelector('.sys__stage')).position === 'sticky';
  const WIN = [[0.0, 0.36], [0.36, 0.68], [0.68, 1.01]];
  function onScroll() {
    if (reduced || !pinned()) { setChapter(-1); return; }
    const r = sec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    setChapter(WIN.findIndex(([a, b]) => p >= a && p < b));
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  sec.classList.add('sys--ready');
})();
