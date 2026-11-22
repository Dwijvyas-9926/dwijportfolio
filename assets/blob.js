/* Liquid chrome blob behind the hero portrait.
   Metaballs rendered in a single WebGL fragment shader with a silver-blue
   chrome finish (fake environment reflection + fresnel rim). A satellite
   droplet is pulled toward the cursor and merges back into the body; the
   body itself leans after it. Paused off-screen; static for reduced motion. */
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
  const FS = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime, uIntro, uWarp, uFreq;
  uniform vec3 uB[${N}];           // x, y (device px, y-down), radius (px)

  float field(vec2 p, out vec2 g){
    float f = 0.0; g = vec2(0.0);
    for (int i = 0; i < ${N}; i++){
      vec2 d = p - uB[i].xy;
      float r2 = uB[i].z * uB[i].z;
      float d2 = max(dot(d, d), 1.0);
      f += r2 / d2;
      g += -2.0 * r2 * d / (d2 * d2);
    }
    return f;
  }

  // a soft studio environment: bright sky, cool horizon band, deep blue floor
  vec3 env(vec3 r){
    float y = r.y;
    vec3 sky = mix(vec3(0.86,0.90,0.96), vec3(0.99,1.0,1.0), smoothstep(0.0,0.9,y));
    vec3 flo = mix(vec3(0.44,0.52,0.66), vec3(0.20,0.26,0.40), smoothstep(0.0,-0.9,y));
    vec3 c = mix(flo, sky, smoothstep(-0.08,0.08,y));
    c += vec3(0.55,0.70,1.0) * 0.35 * exp(-pow(y*9.0,2.0));                         // horizon glint
    c += 0.10 * sin(r.x*7.0 + r.y*3.0 + uTime*0.35) * vec3(0.7,0.8,1.0);           // soft streaks
    return c;
  }

  void main(){
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    // domain warp: slow layered waves make the outline wobble like a liquid
    float k = uFreq, t = uTime;
    p += uWarp * vec2(
      sin(p.y * k + t * 0.55) + 0.55 * sin(p.x * k * 1.7 - t * 0.42) + 0.3 * sin((p.x + p.y) * k * 2.9 + t * 0.8),
      cos(p.x * k * 1.13 + t * 0.47) + 0.55 * cos(p.y * k * 1.9 + t * 0.33) + 0.3 * cos((p.x - p.y) * k * 3.1 - t * 0.7));
    vec2 g;
    float f = field(p, g);
    float edge = fwidth(f);
    float a = smoothstep(1.0 - edge*1.5, 1.0 + edge*1.5, f);

    // bulge normal from the field gradient: steep at the rim, flat in the middle
    float s = 0.55 / max(f, 0.6);
    vec3 n = normalize(vec3(-g.x * s * 120.0, g.y * s * 120.0, 1.0));
    vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
    vec3 col = env(r);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);
    col = mix(col, vec3(0.96,0.98,1.0), fres * 0.55);
    col *= vec3(0.93, 0.96, 1.04);                                                   // silver-blue cast

    // a faint cool haze just outside the surface
    float halo = smoothstep(0.35, 1.0, f) * (1.0 - a) * 0.16;
    vec3 hcol = vec3(0.62, 0.72, 0.88);

    float alpha = (a + halo) * uIntro;
    vec3 c = (col * a + hcol * halo) * uIntro;
    gl_FragColor = vec4(c, alpha);
  }`;

  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  gl.getExtension('OES_standard_derivatives');
  let prog;
  try {
    const fs = '#extension GL_OES_standard_derivatives : enable\n' + FS;
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('[blob] unavailable', e); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'),
        uIntro = gl.getUniformLocation(prog, 'uIntro'), uB = gl.getUniformLocation(prog, 'uB'),
        uWarp = gl.getUniformLocation(prog, 'uWarp'), uFreq = gl.getUniformLocation(prog, 'uFreq');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let W = 1, H = 1, dpr = 1, home = { x: 0, y: 0 }, R = 100;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    const narrow = r.width < 800;
    home = { x: W * 0.5, y: H * (narrow ? 0.5 : 0.47) };
    R = Math.min(W, H) * (narrow ? 0.2 : 0.17);
    if (!running) draw(performance.now());
  }

  // pointer: the droplet is pulled toward it, the body leans after it
  const m = { x: 0, y: 0, in: false };
  const drop = { x: 0, y: 0, vx: 0, vy: 0 };
  const lean = { x: 0, y: 0 };
  hero.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    m.x = (e.clientX - r.left) * dpr; m.y = (e.clientY - r.top) * dpr; m.in = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { m.in = false; });

  const t0 = performance.now();
  const B = new Float32Array(N * 3);
  function draw(now) {
    const t = reduced ? 8 : (now - t0) / 1000;
    const intro = reduced ? 1 : Math.min(1, (now - t0) / 1600);
    const ease = 1 - Math.pow(1 - intro, 3);

    // tethered target: follows the cursor, but never too far from home
    let tx = home.x, ty = home.y;
    if (m.in && !reduced) {
      const dx = m.x - home.x, dy = m.y - home.y, d = Math.hypot(dx, dy), max = R * 3.2;
      const k = d > max ? max / d : 1;
      tx = home.x + dx * k; ty = home.y + dy * k;
    }
    // spring for the droplet, slower lean for the body
    drop.vx = (drop.vx + (tx - drop.x) * 0.045) * 0.86;
    drop.vy = (drop.vy + (ty - drop.y) * 0.045) * 0.86;
    drop.x += drop.vx; drop.y += drop.vy;
    lean.x += ((tx - home.x) * 0.16 - lean.x) * 0.05;
    lean.y += ((ty - home.y) * 0.16 - lean.y) * 0.05;

    const cx = home.x + lean.x, cy = home.y + lean.y, s = R * (0.6 + 0.4 * ease);
    const orb = (i, ax, ay, w, ph, r) => {
      B[i * 3] = cx + Math.cos(t * w + ph) * ax * R;
      B[i * 3 + 1] = cy + Math.sin(t * w * 1.13 + ph) * ay * R;
      B[i * 3 + 2] = s * r;
    };
    orb(0, 0.30, 0.22, 0.29, 0.0, 0.92);   // body
    orb(1, 1.05, 0.50, 0.37, 1.7, 0.66);   // lobes drift far enough apart that the outline is never round
    orb(2, 0.85, 0.95, 0.23, 3.9, 0.58);
    orb(3, 0.55, 1.15, 0.31, 5.1, 0.48);
    orb(4, 1.25, 0.35, 0.19, 2.6, 0.4);
    // the droplet, a little larger when it is out on its own
    const out = Math.min(1, Math.hypot(drop.x - cx, drop.y - cy) / (R * 2));
    B[15] = drop.x; B[16] = drop.y; B[17] = s * (0.42 + 0.08 * out);

    gl.uniform2f(uRes, W, H); gl.uniform1f(uTime, t); gl.uniform1f(uIntro, ease);
    gl.uniform1f(uWarp, R * 0.16); gl.uniform1f(uFreq, 1.0 / (R * 0.85));
    gl.uniform3fv(uB, B);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let running = false, visible = true;
  const loop = now => { if (!running) return; draw(now); requestAnimationFrame(loop); };
  const update = () => {
    const on = visible && !document.hidden && !reduced;
    if (on && !running) { running = true; requestAnimationFrame(loop); } else if (!on) running = false;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  new ResizeObserver(resize).observe(canvas);
  resize();
  drop.x = home.x; drop.y = home.y;
  update();
  if (reduced) draw(performance.now());
  canvas.classList.add('is-ready');
})();
