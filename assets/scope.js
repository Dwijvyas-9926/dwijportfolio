/* Oscilloscope for any <canvas data-scope>.
   It is a working modulator, not decoration:
   CH2 (silver-blue) is the message — a tone, or a bit stream for PSK.
   CH1 (orange) is the modulated carrier for the selected scheme:
     AM  s(t) = [1 + μ·m(t)]·cos(ωc·t)
     FM  s(t) = cos(ωc·t + β·sin(ωm·t))
     PSK s(t) = cos(ωc·t + π·b(t))
   Options (data attributes, live): data-mod="am|fm|psk", data-fc (carrier,
   divisions of cycles across the screen), data-depth (μ or β, 0..1),
   data-follow="pointer" lets the cursor tune carrier (x) and depth (y),
   data-labels="off", data-top (label offset). Animates only while visible. */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BITS = [1, 0, 1, 1, 0, 0, 1, 0];

  function scope(cv) {
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, running = false, visible = false, still = false;
    let last = 0, slow = 0, frames = 0;
    const t0 = performance.now();
    const follow = cv.dataset.follow === 'pointer';
    const ptr = { fc: null, depth: null };

    if (follow) {
      const host = cv.parentElement;
      host.addEventListener('pointermove', e => {
        const r = host.getBoundingClientRect();
        ptr.fc = 6 + 20 * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        ptr.depth = 0.15 + 0.8 * (1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      }, { passive: true });
      host.addEventListener('pointerleave', () => { ptr.fc = ptr.depth = null; });
    }

    function resize() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(performance.now());
    }

    function trace(fn, color, width) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 1.5) { const y = fn(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.16)'); ctx.lineWidth = width * 5; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }

    let fcNow = +cv.dataset.fc || 12, depthNow = +cv.dataset.depth || 0.6;
    function draw(now) {
      const t = reduced ? 2.5 : (now - t0) / 1000;
      const mod = cv.dataset.mod || 'am';
      const fcT = ptr.fc ?? (+cv.dataset.fc || 12), dT = ptr.depth ?? (+cv.dataset.depth || 0.6);
      fcNow += (fcT - fcNow) * 0.12; depthNow += (dT - depthNow) * 0.12;
      ctx.clearRect(0, 0, W, H);
      const dx = W / 10, dy = H / 8, cy = H / 2;

      // graticule
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.beginPath();
      for (let i = 1; i < 10; i++) { const x = Math.round(i * dx) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let j = 1; j < 8; j++) { const y = Math.round(j * dy) + .5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath();
      const mx = Math.round(W / 2) + .5, my = Math.round(cy) + .5;
      ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.moveTo(mx, 0); ctx.lineTo(mx, H);
      for (let x = 0; x <= W; x += dx / 5) { ctx.moveTo(x, my - 3); ctx.lineTo(x, my + 3); }
      for (let y = 0; y <= H; y += dy / 5) { ctx.moveTo(mx - 3, y); ctx.lineTo(mx + 3, y); }
      ctx.stroke();

      // signals. u is screen position 0..1; the message is ~1.6 cycles across the screen
      const fm = 1.6, wc = 2 * Math.PI * fcNow, wm = 2 * Math.PI * fm, drift = t * 0.35;
      const bit = u => BITS[Math.floor(((u + drift / 4) * 8) % 8 + 8) % 8];
      const msg = u => mod === 'psk' ? (bit(u) ? 1 : -1) : Math.sin(wm * u + drift * 2 * Math.PI / 4);
      const out = u => {
        const ph = wc * u - t * 6;
        if (mod === 'fm') return Math.cos(ph + depthNow * 6 * Math.sin(wm * u + drift * 2 * Math.PI / 4));
        if (mod === 'psk') return Math.cos(ph + (bit(u) ? 0 : Math.PI));
        return (1 + depthNow * msg(u)) / (1 + depthNow) * Math.cos(ph);
      };
      const A1 = dy * 1.45, A2 = dy * 0.75;
      trace(x => cy - dy * 1.4 - A1 * out(x / W), 'rgba(240,86,39,0.95)', 1.6);
      trace(x => cy + dy * 2.2 - A2 * msg(x / W), 'rgba(157,180,218,0.9)', 1.4);

      if (cv.dataset.labels !== 'off') {
        const top = +cv.dataset.top || 22;
        const name = { am: 'AM', fm: 'FM', psk: 'PSK' }[mod];
        ctx.font = '500 12px Barlow, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(240,86,39,0.95)';
        ctx.fillText(`CH1  ${name} output`, 14, top);
        ctx.fillStyle = 'rgba(157,180,218,0.95)';
        ctx.fillText(mod === 'psk' ? 'CH2  Data 10110010' : 'CH2  Message', 14, H - 14);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'right';
        ctx.fillText(`fc ${fcNow.toFixed(1)} kHz   ${mod === 'am' ? 'μ ' + depthNow.toFixed(2) : mod === 'fm' ? 'β ' + (depthNow * 6).toFixed(1) : '8 kbit/s'}`, W - 14, top);
        ctx.textAlign = 'left';
      }
      cv.dispatchEvent(new CustomEvent('scope:measure', { detail: { mod, fc: fcNow, depth: depthNow, fm } }));
    }

    // if this device cannot keep up, hold a still frame instead of stuttering
    const watch = now => {
      const dt = last ? now - last : 16; last = now;
      if (document.hidden || dt > 250 || now - t0 < 2000) return;
      frames++; if (dt > 34) slow++;
      if (frames >= 60) { if (slow > 40) { still = true; running = false; } frames = slow = 0; }
    };
    const loop = now => { if (!running) return; draw(now); watch(now); requestAnimationFrame(loop); };
    const update = () => {
      const on = visible && !document.hidden && !reduced && !still;
      if (on && !running) last = 0;
      if (on && !running) { running = true; requestAnimationFrame(loop); } else if (!on) running = false;
    };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(cv);
    document.addEventListener('visibilitychange', update);
    new ResizeObserver(resize).observe(cv);
    cv.redraw = () => { if (!running) draw(performance.now()); };
    resize();
  }

  // controls for the signal lab
  function lab(root) {
    const cv = root.querySelector('canvas[data-scope]');
    const out = k => root.querySelector(`[data-out="${k}"]`);

    // listen: the same equations, rendered to a two-second loop you can hear.
    // The carrier is scaled into the audible range (6–26 "kHz" on screen → 300–900 Hz).
    const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
    let actx = null, src = null, gain = null, playing = false;
    const btn = root.querySelector('[data-listen]');
    function render() {
      const sr = actx.sampleRate, N = sr * 2, buf = actx.createBuffer(1, N, sr), d = buf.getChannelData(0);
      const mod = cv.dataset.mod || 'am', fc = 300 + (((+cv.dataset.fc || 12) - 6) / 20) * 600, mu = +cv.dataset.depth || 0.6;
      const fm = 55, bitRate = 10;
      for (let i = 0; i < N; i++) {
        const t = i / sr, bit = BITS[Math.floor(t * bitRate) % 8];
        const m = Math.sin(2 * Math.PI * fm * t);
        let v;
        if (mod === 'fm') v = Math.cos(2 * Math.PI * fc * t + mu * 6 * Math.sin(2 * Math.PI * fm * t));
        else if (mod === 'psk') v = Math.cos(2 * Math.PI * fc * t + (bit ? 0 : Math.PI));
        else v = (1 + mu * m) / (1 + mu) * Math.cos(2 * Math.PI * fc * t);
        // short fades at the loop seam
        const e = Math.min(1, i / 400, (N - i) / 400);
        d[i] = v * e;
      }
      return buf;
    }
    function play() {
      if (src) { try { src.stop(); } catch (e) {} src.disconnect(); }
      src = actx.createBufferSource(); src.buffer = render(); src.loop = true;
      src.connect(gain); src.start();
    }
    function setListen(on) {
      playing = on;
      if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Mute' : 'Listen'; }
      if (on) {
        if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); gain = actx.createGain(); gain.gain.value = 0.12; gain.connect(actx.destination); }
        if (actx.state === 'suspended') actx.resume();
        play();
      } else if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; }
    }
    if (btn) btn.addEventListener('click', () => setListen(!playing));
    let rerender = 0;
    const refresh = () => { if (!playing) return; clearTimeout(rerender); rerender = setTimeout(play, 160); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setListen(false); });
    root.querySelectorAll('[data-mod]').forEach(b => b.addEventListener('click', () => {
      cv.dataset.mod = b.dataset.mod;
      root.querySelectorAll('[data-mod]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const depth = root.querySelector('[data-ctl="depth"]');
      if (depth) depth.closest('label').hidden = b.dataset.mod === 'psk';
      cv.redraw && cv.redraw(); refresh();
    }));
    root.querySelectorAll('input[data-ctl]').forEach(inp => {
      const set = () => { cv.dataset[inp.dataset.ctl] = inp.value; cv.redraw && cv.redraw(); refresh(); };
      inp.addEventListener('input', set); set();
    });
    cv.addEventListener('scope:measure', e => {
      const { mod, fc, depth, fm } = e.detail;
      const bw = mod === 'am' ? 2 * fm : mod === 'fm' ? 2 * (depth * 6 + 1) * fm : 2 * 8;
      const set = (k, v) => { const o = out(k); if (o && o.textContent !== v) o.textContent = v; };
      set('fc', `${fc.toFixed(1)} kHz`);
      set('idx', mod === 'am' ? `μ = ${depth.toFixed(2)}` : mod === 'fm' ? `β = ${(depth * 6).toFixed(1)}` : 'BPSK, 8 kbit/s');
      set('bw', `${bw.toFixed(1)} kHz`);
    });
  }

  const start = () => {
    document.querySelectorAll('canvas[data-scope]').forEach(scope);
    document.querySelectorAll('[data-lab]').forEach(lab);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
