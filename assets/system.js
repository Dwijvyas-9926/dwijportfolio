/* "How a system comes together." — the AVION stack as a live block diagram.
   Blocks are the real parts (depth camera, companion computer, autopilot,
   ESCs, payload servo, telemetry, ground station); links carry small packets
   that travel the real buses (USB 3, MAVLink over UART, PWM, 915 MHz).
   The section is pinned; scrolling steps through three chapters and lights
   the parts each one is about. Static (everything lit) for reduced motion,
   narrow screens, or when the section is not pinned. */
(function () {
  'use strict';
  const sec = document.getElementById('sys');
  if (!sec) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = sec.querySelector('[data-diagram]');
  const notes = [...sec.querySelectorAll('[data-note]')];
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1200, H = 560;

  // ── parts ──  id, x, y, w, h, title, sub, chapters it belongs to
  const parts = [
    ['cam',  60, 70, 220, 84, 'RealSense D455', 'depth + RGB, 30 fps', [0]],
    ['th',   60, 190, 220, 84, 'Thermal camera', 'search & rescue', [0]],
    ['gps',  60, 310, 220, 84, 'GPS / IMU', 'position, attitude', [1]],
    ['bat',  60, 430, 220, 84, '4S LiPo', '14.8 V · power rail', [1]],
    ['pi',  400, 130, 250, 110, 'Raspberry Pi 4', 'OpenCV · DroneKit · Python', [0, 2]],
    ['px',  400, 330, 250, 110, 'Pixhawk 2.4.8', 'ArduPilot · attitude loop', [1, 2]],
    ['esc', 870, 290, 250, 84, '4 × ESC + motors', 'PWM, 400 Hz', [1]],
    ['srv', 870, 410, 250, 84, 'Payload servo', 'medikit release hook', [1, 2]],
    ['gcs', 870, 90, 250, 110, 'Ground station', 'Flask · Socket.IO · 3D twin', [2]],
  ];
  // ── links ──  from, to, label, path (orthogonal), chapters, packet speed, label anchor [x, y, anchor]
  const links = [
    ['cam', 'pi', 'USB 3', 'M280,112 H340 V185 H400', [0], 1.0, [310, 104, 'middle']],
    ['th', 'pi', 'MIPI', 'M280,232 H340 V185 H400', [0], 0.8, [310, 224, 'middle']],
    ['gps', 'px', 'I²C, UART', 'M280,352 H340 V385 H400', [1], 0.7, [310, 344, 'middle']],
    ['bat', 'px', '5 V BEC', 'M280,472 H340 V385 H400', [1], 0.4, [310, 464, 'middle']],
    ['pi', 'px', 'MAVLink over UART', 'M525,240 V330', [2, 0], 1.1, [536, 290, 'start']],
    ['px', 'esc', 'PWM × 4', 'M650,385 H760 V332 H870', [1], 1.4, [815, 324, 'middle']],
    ['px', 'srv', 'PWM', 'M650,385 H760 V452 H870', [1, 2], 0.6, [815, 444, 'middle']],
    ['px', 'gcs', '915 MHz telemetry', 'M650,360 H720 V145 H870', [2], 0.9, [732, 260, 'start']],
    ['pi', 'gcs', 'Wi-Fi video', 'M650,185 H760 V145 H870', [2], 1.2, [705, 177, 'middle']],
  ];

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Block diagram of the AVION drone: cameras and sensors feed a Raspberry Pi and a Pixhawk autopilot, which drive the motors, payload servo and a ground station.');
  const el = (n, a, parent = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };

  // faint ruler grid behind the diagram
  const defs = el('defs', {});
  const pat = el('pattern', { id: 'sysgrid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M40 0H0V40', fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.07' }, pat);
  el('rect', { width: W, height: H, fill: 'url(#sysgrid)', class: 'sys__grid' });

  const linkEls = links.map(([a, b, label, d, ch, speed, at]) => {
    const g = el('g', { class: 'sys__link', 'data-ch': ch.join(' ') });
    const path = el('path', { d, fill: 'none' }, g);
    const len = path.getTotalLength();
    const t = el('text', { x: at[0], y: at[1], class: 'sys__lbl', 'text-anchor': at[2] }, g); t.textContent = label;
    const dots = [0, 0.5].map(() => el('circle', { r: 4.5, class: 'sys__pkt' }, g));
    return { path, len, dots, speed, ch, g, offs: [0, 0.5] };
  });
  const partEls = parts.map(([id, x, y, w, h, title, sub, ch]) => {
    const g = el('g', { class: 'sys__part', 'data-ch': ch.join(' '), transform: `translate(${x} ${y})` });
    el('rect', { width: w, height: h, rx: 10 }, g);
    const t1 = el('text', { x: 18, y: 34, class: 'sys__t' }, g); t1.textContent = title;
    const t2 = el('text', { x: 18, y: 58, class: 'sys__s' }, g); t2.textContent = sub;
    el('circle', { cx: w - 18, cy: 18, r: 3.5, class: 'sys__led' }, g);
    return { g, ch };
  });
  host.appendChild(svg);

  // ── chapters ──
  let active = -1;
  function setChapter(i) {
    if (i === active) return; active = i;
    partEls.forEach(p => p.g.classList.toggle('is-on', i < 0 || p.ch.includes(i)));
    linkEls.forEach(l => l.g.classList.toggle('is-on', i < 0 || l.ch.includes(i)));
    notes.forEach((n, k) => n.classList.toggle('is-on', i < 0 || k === i));
    sec.dataset.chapter = i < 0 ? 'all' : String(i);
  }

  // ── packets ──
  let running = false, visible = false, last = 0;
  function frame(now) {
    const dt = Math.min(50, now - (last || now)) / 1000; last = now;
    for (const l of linkEls) {
      const on = active < 0 || l.ch.includes(active);
      for (let k = 0; k < 2; k++) {
        l.offs[k] = (l.offs[k] + dt * 0.22 * l.speed * (on ? 1 : 0.3)) % 1;
        const p = l.path.getPointAtLength(l.offs[k] * l.len);
        l.dots[k].setAttribute('cx', p.x); l.dots[k].setAttribute('cy', p.y);
      }
    }
  }
  const loop = now => { if (!running) return; frame(now); requestAnimationFrame(loop); };
  const update = () => {
    const on = visible && !document.hidden && !reduced;
    if (on && !running) { running = true; last = 0; requestAnimationFrame(loop); } else if (!on) running = false;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }, { rootMargin: '200px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', update);

  // ── scroll steps ──
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
  onScroll(); frame(performance.now());
  sec.classList.add('sys--ready');
})();
