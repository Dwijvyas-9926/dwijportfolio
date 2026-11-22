/* Liquid-glass blob behind the hero portrait.
   One intact metaball body rendered in a WebGL fragment shader. The cursor
   acts as an attractor tethered close to the body, so the blob bulges and
   stretches toward it but never splits. Glass look: refraction of soft
   silver-blue light bands, chromatic fringe, fresnel reflection, sharp
   specular highlights, a bright rim and a soft contact shadow.
   Paused off-screen; a still frame for reduced motion. */
(function () {
  'use strict';
  const canvas = document.getElementById('blob');
  const hero = document.getElementById('top');
  if (!canvas || !hero) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 5;

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `#extension GL_OES_standard_derivatives : enable
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform vec2 uRes;
  uniform float uTime, uIntro, uWarp, uFreq, uR;
  uniform vec3 uB[${N}];

  float field(vec2 p, out vec2 g){
    float f = 0.0; g = vec2(0.0);
    for (int i = 0; i < ${N}; i++){
      vec2 d = p - uB[i].xy; float r2 = uB[i].z * uB[i].z; float d2 = max(dot(d, d), 1.0);
      f += r2 / d2; g += -2.0 * r2 * d / (d2 * d2);
    }
    return f;
  }
  vec2 warp(vec2 p){
    float k = uFreq, t = uTime;
    return p + uWarp * vec2(
      sin(p.y * k + t * 0.5) + 0.5 * sin(p.x * k * 1.7 - t * 0.38),
      cos(p.x * k * 1.1 + t * 0.44) + 0.5 * cos(p.y * k * 1.9 + t * 0.31));
  }
  // what the glass sees through itself: the page tone with soft drifting light bands
  vec3 behind(vec2 q){
    vec3 base = vec3(0.953, 0.949, 0.937);
    float b1 = 0.5 + 0.5 * sin(q.x * 0.010 + q.y * 0.006 + uTime * 0.25);
    float b2 = 0.5 + 0.5 * sin(q.y * 0.014 - q.x * 0.004 - uTime * 0.18 + 1.7);
    vec3 cool = vec3(0.62, 0.74, 0.94), deep = vec3(0.22, 0.33, 0.58), white = vec3(1.0);
    vec3 c = mix(base, cool, smoothstep(0.3, 0.95, b1) * 0.9);
    c = mix(c, deep, smoothstep(0.6, 1.0, b2) * 0.75);
    c = mix(c, white, smoothstep(0.9, 1.0, b1 * b2) * 0.8);
    return c;
  }
  vec3 env(vec3 r){
    vec3 sky = mix(vec3(0.84,0.89,0.97), vec3(1.0), smoothstep(0.0, 0.9, r.y));
    vec3 flo = mix(vec3(0.46,0.55,0.72), vec3(0.24,0.31,0.48), smoothstep(0.0, -0.9, r.y));
    vec3 c = mix(flo, sky, smoothstep(-0.1, 0.1, r.y));
    return c + vec3(0.6,0.75,1.0) * 0.3 * exp(-pow(r.y * 8.0, 2.0));
  }

  void main(){
    vec2 p0 = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 p = warp(p0), g;
    float f = field(p, g);
    float w = fwidth(f);
    float a = smoothstep(1.0 - w * 1.5, 1.0 + w * 1.5, f);

    // soft contact shadow below the body
    vec2 gs; float fs = field(warp(p0 - vec2(0.0, uR * 0.22)), gs);
    float shadow = smoothstep(0.25, 1.0, fs) * (1.0 - a) * 0.22;

    float s = 0.6 / max(f, 0.65);
    vec3 n = normalize(vec3(-g.x * s * 115.0, g.y * s * 115.0, 1.0));
    float thick = clamp((f - 1.0) * 0.6, 0.0, 1.0);

    // refraction with a slight chromatic split
    vec2 off = n.xy * uR * (0.8 + 0.5 * thick);
    vec3 refr = vec3(behind(p0 - off * 1.00).r, behind(p0 - off * 1.06).g, behind(p0 - off * 1.13).b);
    refr *= mix(vec3(0.66, 0.75, 0.92), vec3(0.9, 0.94, 1.0), thick); // silver-blue tint, deeper at the thin edge

    vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
    float fres = 0.08 + 0.92 * pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    vec3 col = mix(refr, env(r), fres * 0.85);

    vec3 L1 = normalize(vec3(-0.55, 0.6, 0.6)), L2 = normalize(vec3(0.6, -0.2, 0.5));
    col += vec3(1.0) * pow(max(dot(reflect(-L1, n), vec3(0,0,1)), 0.0), 70.0) * 0.9;
    col += vec3(0.8,0.9,1.0) * pow(max(dot(reflect(-L2, n), vec3(0,0,1)), 0.0), 30.0) * 0.35;
    float rim = smoothstep(1.0 + w * 10.0, 1.0, f) * a;               // thin bright edge
    col = mix(col, vec3(1.0), rim * 0.6);

    vec3 shc = vec3(0.22, 0.27, 0.38);
    float alpha = (a + shadow) * uIntro;
    gl_FragColor = vec4((col * a + shc * shadow) * uIntro, alpha);
  }`;

  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  if (!gl.getExtension('OES_standard_derivatives')) return;   // no fwidth: leave the hero without the blob
  // low-power hint: fewer cores or little memory start at 1x resolution
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
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
  const uRes = U('uRes'), uTime = U('uTime'), uIntro = U('uIntro'), uB = U('uB'), uWarp = U('uWarp'), uFreq = U('uFreq'), uR = U('uR');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let W = 1, H = 1, dpr = 1, home = { x: 0, y: 0 }, R = 100;
  let running = false, visible = true, degraded = false, still = false, dead = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, lowPower || degraded ? 1 : 1.5);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    const narrow = r.width < 800;
    home = { x: W * 0.5, y: H * (narrow ? 0.46 : 0.44) };
    R = Math.min(W, H) * (narrow ? 0.24 : 0.2);
    if (!running) draw(performance.now());
  }

  // the cursor is an attractor on a short tether: the body stretches toward it, never splits
  const m = { x: 0, y: 0, in: false };
  const pull = { x: 0, y: 0, vx: 0, vy: 0 };
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    m.x = (e.clientX - r.left) * dpr; m.y = (e.clientY - r.top) * dpr; m.in = true;
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
      const reach = R * 1.25 * (1 - Math.exp(-d / (R * 1.4)));        // eases out: far cursor, same max stretch
      tx = dx / d * reach; ty = dy / d * reach;
    }
    pull.vx = (pull.vx + (tx - pull.x) * 0.05) * 0.84;
    pull.vy = (pull.vy + (ty - pull.y) * 0.05) * 0.84;
    pull.x += pull.vx; pull.y += pull.vy;

    const cx = home.x + pull.x * 0.25, cy = home.y + pull.y * 0.25, s = R * (0.55 + 0.45 * ease);
    const orb = (i, ax, ay, w, ph, r) => {
      B[i * 3] = cx + Math.cos(t * w + ph) * ax * R;
      B[i * 3 + 1] = cy + Math.sin(t * w * 1.13 + ph) * ay * R;
      B[i * 3 + 2] = s * r;
    };
    orb(0, 0.20, 0.14, 0.31, 0.0, 0.95);
    orb(1, 0.66, 0.36, 0.37, 1.7, 0.72);    // lobes reach out for an irregular outline, but stay fused to the body
    orb(2, 0.50, 0.60, 0.26, 3.9, 0.66);
    orb(3, 0.36, 0.68, 0.33, 5.1, 0.6);
    // the attractor lobe leans out toward the cursor, still fused to the body
    B[12] = home.x + pull.x; B[13] = home.y + pull.y; B[14] = s * (0.7 + 0.08 * Math.min(1, Math.hypot(pull.x, pull.y) / R));

    gl.uniform2f(uRes, W, H); gl.uniform1f(uTime, t); gl.uniform1f(uIntro, ease);
    gl.uniform1f(uWarp, R * 0.19); gl.uniform1f(uFreq, 1.0 / (R * 0.8)); gl.uniform1f(uR, R);
    gl.uniform3fv(uB, B);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // adaptive quality: if frames run slow, drop to 1x; if still slow, settle on a still frame
  let last = 0, slow = 0, frames = 0, total = 0, bad = 0;
  function watch(now) {
    const dt = last ? now - last : 16; last = now;
    if (document.hidden || dt > 250 || now - t0 < 2000) return;   // ignore tab switches and the load warm-up
    frames++; total += dt; if (dt > 28) slow++;
    if (frames >= 45) {
      const avg = total / frames;
      bad = slow > 30 ? bad + 1 : 0;
      if (avg > 80 || (bad >= 2 && degraded)) { still = true; running = false; draw(performance.now()); }   // cannot keep up: hold still
      else if (bad >= 2) { degraded = true; bad = 0; resize(); }                                             // struggling: drop to 1x
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
