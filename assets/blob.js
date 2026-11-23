/* Liquid-crystal form behind the hero portrait.
   One organic body (metaballs under a slow domain warp) rendered in a WebGL
   fragment shader as a sheet of thin glass: it refracts a faint ruler grid
   and the page tone behind it, carries a thin-film iridescence (the soft
   silver / blue / violet / peach interference you see on a soap film or an
   LCD seen off-axis), a fresnel rim and two small speculars. It breathes on
   its own; the cursor is a tethered attractor and each pointer move sends a
   ripple across the surface. Paused off-screen; a still frame for reduced
   motion; drops to 1x and finally to a still frame if the device struggles. */
(function () {
  'use strict';
  const canvas = document.getElementById('blob');
  const hero = document.getElementById('top');
  if (!canvas || !hero) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 6;

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `#extension GL_OES_standard_derivatives : enable
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform vec2 uRes, uRip;
  uniform float uTime, uIntro, uWarp, uFreq, uR, uRipT;
  uniform vec3 uB[${N}];

  // value noise + 3-octave fbm for the organic warp
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){ return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 7.1) + 0.125 * noise(p * 4.07 - 3.3); }

  float field(vec2 p, out vec2 g){
    float f = 0.0; g = vec2(0.0);
    for (int i = 0; i < ${N}; i++){
      vec2 d = p - uB[i].xy; float r2 = uB[i].z * uB[i].z; float d2 = max(dot(d, d), 1.0);
      f += r2 / d2; g += -2.0 * r2 * d / (d2 * d2);
    }
    return f;
  }
  vec2 warp(vec2 p){
    float k = uFreq, t = uTime * 0.18;
    vec2 q = p * k;
    vec2 w = vec2(fbm(q + vec2(t, -t * 0.7)), fbm(q + vec2(-t * 0.6, t * 0.9) + 5.2)) - 0.5;
    // pointer ripple: a ring that expands from the last pointer position and fades
    float age = uTime - uRipT;
    float dr = length(p - uRip);
    float ring = sin(dr * 0.09 - age * 7.0) * exp(-age * 1.6) * exp(-dr / (uR * 1.6));
    return p + uWarp * w * 2.2 + ring * uR * 0.06 * normalize(p - uRip + 0.001);
  }
  // what the glass sees through itself: the page tone and a faint ruler grid
  vec3 behind(vec2 q){
    vec3 base = vec3(0.953, 0.949, 0.937);
    vec2 cell = abs(fract(q / 48.0) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.04, min(cell.x, cell.y));
    vec3 c = mix(base, vec3(0.84, 0.84, 0.83), line * 0.35);
    float b1 = 0.5 + 0.5 * sin(q.x * 0.006 + q.y * 0.004 + uTime * 0.2);
    c = mix(c, vec3(0.88, 0.91, 0.97), smoothstep(0.55, 1.0, b1) * 0.5);
    return c;
  }
  vec3 env(vec3 r){
    vec3 sky = mix(vec3(0.86, 0.90, 0.97), vec3(1.0), smoothstep(0.0, 0.9, r.y));
    vec3 flo = mix(vec3(0.55, 0.60, 0.72), vec3(0.30, 0.34, 0.46), smoothstep(0.0, -0.9, r.y));
    vec3 c = mix(flo, sky, smoothstep(-0.1, 0.1, r.y));
    return c + vec3(0.7, 0.8, 1.0) * 0.25 * exp(-pow(r.y * 8.0, 2.0));
  }
  // thin-film interference, the way a soap bubble shows it: bands of violet,
  // blue and teal that drift with film thickness and the angle you see it at
  vec3 film(float x){
    vec3 c = vec3(0.50, 0.56, 0.74) + vec3(0.42, 0.36, 0.26) * cos(6.2831 * (x + vec3(0.72, 0.50, 0.33)));
    return clamp(c, 0.0, 1.0);
  }

  void main(){
    vec2 p0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 p = warp(p0), g;
    float f = field(p, g);
    float w = fwidth(f);
    float a = smoothstep(1.0 - w * 1.5, 1.0 + w * 1.5, f);

    // soft contact shadow below the body
    vec2 gs; float fs = field(warp(p0 - vec2(0.0, uR * 0.2)), gs);
    float shadow = smoothstep(0.3, 1.0, fs) * (1.0 - a) * 0.16;

    float s = 0.6 / max(f, 0.65);
    vec3 n = normalize(vec3(-g.x * s * 120.0, g.y * s * 120.0, 1.0));
    float thick = clamp((f - 1.0) * 0.55, 0.0, 1.0);

    // internal flow: a slow current that drifts through the body
    float flow = fbm(p0 * uFreq * 1.7 + vec2(uTime * 0.07, -uTime * 0.05));

    // refraction with a slight chromatic split
    vec2 off = n.xy * uR * (0.75 + 0.6 * thick);
    vec3 refr = vec3(behind(p0 - off * 1.00).r, behind(p0 - off * 1.07).g, behind(p0 - off * 1.15).b);
    refr *= mix(vec3(0.70, 0.78, 0.94), vec3(0.90, 0.94, 1.0), thick);   // silver-blue glass, deeper at the thin edge

    vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
    float fres = 0.06 + 0.94 * pow(1.0 - clamp(n.z, 0.0, 1.0), 3.2);
    vec3 col = mix(refr, env(r), fres * 0.85);

    // iridescent sheen, strongest where the surface tilts and where the film is thin
    float phase = thick * 1.5 + (1.0 - n.z) * 1.6 + flow * 1.2 + uTime * 0.04;
    vec3 iri = film(phase);
    float sheen = (0.34 + 0.5 * pow(1.0 - n.z, 1.2)) * (0.65 + 0.35 * flow);
    col = mix(col, col * 0.3 + iri * 0.85, clamp(sheen, 0.0, 0.74));

    vec3 L1 = normalize(vec3(-0.55, 0.6, 0.6)), L2 = normalize(vec3(0.6, -0.25, 0.5));
    col += vec3(1.0) * pow(max(dot(reflect(-L1, n), vec3(0,0,1)), 0.0), 90.0) * 0.9;
    col += vec3(0.85, 0.92, 1.0) * pow(max(dot(reflect(-L2, n), vec3(0,0,1)), 0.0), 36.0) * 0.35;
    float rim = smoothstep(1.0 + w * 9.0, 1.0, f) * a;
    col = mix(col, vec3(1.0), rim * 0.55);

    // the body is glass: more transparent through its thick middle, denser at the edge
    float body = a * mix(0.8, 0.98, pow(1.0 - n.z, 0.6));
    vec3 shc = vec3(0.22, 0.26, 0.36);
    float alpha = (body + shadow) * uIntro;
    gl_FragColor = vec4((col * body + shc * shadow) * uIntro, alpha);
  }`;

  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  if (!gl.getExtension('OES_standard_derivatives')) return;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let running = false, visible = true, degraded = false, still = false, dead = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; dead = true; canvas.style.opacity = '0'; });
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('[blob] unavailable', e); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uIntro = U('uIntro'), uB = U('uB'), uWarp = U('uWarp'), uFreq = U('uFreq'), uR = U('uR'), uRip = U('uRip'), uRipT = U('uRipT');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let W = 1, H = 1, dpr = 1, home = { x: 0, y: 0 }, R = 100;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, lowPower || degraded ? 1 : 1.5);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    const narrow = r.width < 800;
    home = { x: W * 0.5, y: H * (narrow ? 0.44 : 0.43) };
    R = Math.min(W, H) * (narrow ? 0.25 : 0.21);
    if (!running) draw(performance.now());
  }

  // the cursor is an attractor on a short tether; each move sends a ripple
  const m = { x: 0, y: 0, in: false };
  const pull = { x: 0, y: 0, vx: 0, vy: 0 };
  const rip = { x: -9999, y: -9999, t: -100 };
  let lastRip = 0;
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    m.x = (e.clientX - r.left) * dpr; m.y = (e.clientY - r.top) * dpr; m.in = true;
    const now = performance.now();
    if (now - lastRip > 420) { lastRip = now; rip.x = m.x; rip.y = m.y; rip.t = (now - t0) / 1000; }
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { m.in = false; });

  const t0 = performance.now();
  const B = new Float32Array(N * 3);
  function draw(now) {
    const t = reduced ? 6 : (now - t0) / 1000;
    const intro = reduced ? 1 : Math.min(1, (now - t0) / 1600);
    const ease = 1 - Math.pow(1 - intro, 3);

    let tx = 0, ty = 0;
    if (m.in && !reduced) {
      const dx = m.x - home.x, dy = m.y - home.y, d = Math.hypot(dx, dy) || 1;
      const reach = R * 1.2 * (1 - Math.exp(-d / (R * 1.4)));
      tx = dx / d * reach; ty = dy / d * reach;
    }
    pull.vx = (pull.vx + (tx - pull.x) * 0.05) * 0.84;
    pull.vy = (pull.vy + (ty - pull.y) * 0.05) * 0.84;
    pull.x += pull.vx; pull.y += pull.vy;

    const breathe = 1 + 0.035 * Math.sin(t * 0.9);
    const cx = home.x + pull.x * 0.25, cy = home.y + pull.y * 0.25, s = R * (0.55 + 0.45 * ease) * breathe;
    const orb = (i, ax, ay, w, ph, r) => {
      B[i * 3] = cx + Math.cos(t * w + ph) * ax * R;
      B[i * 3 + 1] = cy + Math.sin(t * w * 1.13 + ph) * ay * R;
      B[i * 3 + 2] = s * r;
    };
    orb(0, 0.18, 0.12, 0.29, 0.0, 0.98);
    orb(1, 0.70, 0.34, 0.33, 1.7, 0.70);
    orb(2, 0.46, 0.64, 0.24, 3.9, 0.64);
    orb(3, 0.34, 0.72, 0.31, 5.1, 0.58);
    orb(4, 0.78, 0.20, 0.21, 2.6, 0.52);
    B[15] = home.x + pull.x; B[16] = home.y + pull.y; B[17] = s * (0.7 + 0.08 * Math.min(1, Math.hypot(pull.x, pull.y) / R));

    gl.uniform2f(uRes, W, H); gl.uniform1f(uTime, t); gl.uniform1f(uIntro, ease);
    gl.uniform1f(uWarp, R * 0.16); gl.uniform1f(uFreq, 1.0 / (R * 0.9)); gl.uniform1f(uR, R);
    gl.uniform2f(uRip, rip.x, rip.y); gl.uniform1f(uRipT, rip.t);
    gl.uniform3fv(uB, B);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // adaptive quality: slow frames drop to 1x; still slow, settle on a still frame
  let last = 0, slow = 0, frames = 0, total = 0, bad = 0;
  function watch(now) {
    const dt = last ? now - last : 16; last = now;
    if (document.hidden || dt > 250 || now - t0 < 2000) return;
    frames++; total += dt; if (dt > 28) slow++;
    if (frames >= 45) {
      const avg = total / frames;
      bad = slow > 30 ? bad + 1 : 0;
      if (avg > 80 || (bad >= 2 && degraded)) { still = true; running = false; draw(performance.now()); }
      else if (bad >= 2) { degraded = true; bad = 0; resize(); }
      frames = slow = 0; total = 0;
    }
  }
  const loop = now => { if (!running) return; draw(now); watch(now); requestAnimationFrame(loop); };
  const update = () => {
    const on = visible && !document.hidden && !reduced && !still && !dead;
    if (on && !running) last = 0;
    if (on && !running) { running = true; requestAnimationFrame(loop); } else if (!on) running = false;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  new ResizeObserver(resize).observe(canvas);
  resize();
  update();
  if (reduced) draw(performance.now());
  canvas.classList.add('is-ready');
})();
