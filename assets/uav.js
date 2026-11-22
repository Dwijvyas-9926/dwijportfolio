/* "Built to fly." — the AERONEX drone in a pinned scroll section.
   Studio-lit with physically based materials and a soft shadow. On entry it lifts
   off as the props spin up; scrolling turns it through a product rotation while
   three annotations, pinned to the real parts, step through. It banks gently
   toward the cursor. Loaded only when the section approaches; paused off-screen;
   a still pose for reduced motion; settles to a still frame on slow devices. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/three/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from '../vendor/three/jsm/environments/RoomEnvironment.js';

const section = document.getElementById('uav');
const canvas = document.getElementById('uavCanvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const notes = [...section.querySelectorAll('[data-note]')];
const pins = [...section.querySelectorAll('[data-pin]')];

export async function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { section.classList.add('uav--static'); return; }
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let degraded = lowPower;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, degraded ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  key.shadow.radius = 14; key.shadow.blurSamples = 20; key.shadow.bias = -0.0006;
  const rim = new THREE.DirectionalLight(0xF05627, 1.6); rim.position.set(4, 1.5, -5);   // a warm brand rim from behind
  const fill = new THREE.DirectionalLight(0xd8e3ff, 0.6); fill.position.set(5, 3, 4);
  scene.add(key, rim, fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // ── model ──
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./assets/aeronex.glb');
  const drone = gltf.scene;
  drone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // centre and scale to a known span
  const box = new THREE.Box3().setFromObject(drone);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const s = 3.6 / Math.max(size.x, size.z);
  const rig = new THREE.Group();          // pointer bank + scroll turn
  const body = new THREE.Group();         // hover bob + lift-off
  drone.position.sub(center); body.add(drone); body.scale.setScalar(s); rig.add(body); scene.add(rig);
  const floor = -size.y * s / 2 - 0.95;
  ground.position.y = floor;

  // re-pivot each propeller around its own hub so it spins in place
  const props = [];
  drone.updateMatrixWorld(true);
  drone.traverse(o => {
    if (!/^Propeller/i.test(o.name || '')) return;
    const pb = new THREE.Box3().setFromObject(o);
    const hubWorld = pb.getCenter(new THREE.Vector3());
    const parent = o.parent;
    const hubLocal = parent.worldToLocal(hubWorld.clone());
    const pivot = new THREE.Group(); pivot.position.copy(hubLocal);
    parent.add(pivot); pivot.attach(o);
    props.push({ pivot, dir: /left/i.test(o.name) === /front/i.test(o.name) ? 1 : -1 });
  });

  // parts the annotations point at
  const norm = n => String(n || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();   // the loader turns spaces into underscores
  const partByName = n => { let f = null; drone.traverse(o => { if (!f && norm(o.name) === norm(n)) f = o; }); return f; };
  const targets = pins.map(p => partByName(p.dataset.pin));

  // ── layout ──
  let W = 1, H = 1, narrow = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); narrow = W < 800;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, degraded ? 1 : 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = narrow ? 40 : 26;
    camera.position.set(0, 2.1, narrow ? 11.5 : 9.4); camera.lookAt(0, narrow ? 0.55 : 0.75, 0);
    camera.updateProjectionMatrix();
    if (!running) render(performance.now());
  }

  // ── input ──
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  section.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = section.getBoundingClientRect();
    ptr.tx = (e.clientX - r.left) / r.width * 2 - 1; ptr.ty = (e.clientY - r.top) / innerHeight * 2 - 1;
  }, { passive: true });
  section.addEventListener('pointerleave', () => { ptr.tx = ptr.ty = 0; });
  let progress = 0;
  const onScroll = () => {
    const r = section.getBoundingClientRect();
    progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
  };
  addEventListener('scroll', onScroll, { passive: true });

  // ── frame ──
  const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const WIN = [[0.1, 0.38], [0.38, 0.66], [0.66, 0.97]];
  const v = new THREE.Vector3();
  let started = 0, active = -1;
  function render(now) {
    if (!started) started = now;
    const t = (now - started) / 1000;
    const lift = reduced ? 1 : sm(t / 1.8);
    const spin = reduced ? 0 : Math.min(1, t / 1.2);
    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    const p = reduced ? 0.3 : progress;

    rig.rotation.y = -0.75 + sm(p) * Math.PI * 1.7 + ptr.x * 0.18;
    rig.rotation.x = 0.06 + Math.sin(sm(p) * Math.PI) * 0.22 + ptr.y * 0.05;
    rig.rotation.z = -ptr.x * 0.1;                                          // bank toward the cursor
    body.position.y = (1 - lift) * -0.5 + (reduced ? 0 : Math.sin(t * 1.4) * 0.05);
    for (const pr of props) pr.pivot.rotation.y += pr.dir * (0.02 + 0.5 * spin);
    ground.material.opacity = 0.1 * lift;

    renderer.render(scene, camera);

    // annotations: which one is showing, and where its part is on screen
    const idx = reduced ? -1 : WIN.findIndex(([a, b]) => p >= a && p < b);
    if (idx !== active) {
      active = idx;
      notes.forEach((n, i) => n.classList.toggle('on', i === idx));
      pins.forEach((n, i) => n.classList.toggle('on', i === idx));
    }
    if (idx > -1 && targets[idx]) {
      new THREE.Box3().setFromObject(targets[idx]).getCenter(v);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      pins[idx].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (!narrow) {
        const right = x > W / 2;
        const nw = notes[idx].offsetWidth, nh = notes[idx].offsetHeight;
        const nx = Math.min(W - nw - 24, Math.max(24, right ? x + 56 : x - 56 - nw));   // keep the card on screen
        const ny = Math.min(H - nh - 96, Math.max(24, y - nh / 2));
        notes[idx].style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;
        notes[idx].dataset.side = right ? 'r' : 'l';
      } else notes[idx].style.transform = '';
    }
  }

  // ── loop with adaptive quality ──
  let running = false, visible = false, still = false, last = 0, frames = 0, slow = 0, total = 0, bad = 0, t0 = performance.now();
  function watch(now) {
    const dt = last ? now - last : 16; last = now;
    if (document.hidden || dt > 250 || now - t0 < 2500) return;
    frames++; total += dt; if (dt > 28) slow++;
    if (frames >= 45) {
      bad = slow > 30 ? bad + 1 : 0;
      if (total / frames > 80 || (bad >= 2 && degraded)) { still = true; running = false; }
      else if (bad >= 2) { degraded = true; bad = 0; resize(); }
      frames = slow = 0; total = 0;
    }
  }
  const loop = now => { if (!running) return; render(now); watch(now); requestAnimationFrame(loop); };
  const update = () => {
    const on = visible && !document.hidden && !reduced && !still;
    if (on && !running) { running = true; last = 0; requestAnimationFrame(loop); } else if (!on) running = false;
  };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !started) t0 = performance.now(); update(); }).observe(section);
  document.addEventListener('visibilitychange', update);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; still = true; section.classList.add('uav--static'); });
  new ResizeObserver(resize).observe(canvas);
  resize(); onScroll();
  if (reduced) { section.classList.add('uav--static'); render(performance.now()); }
  update();
  section.classList.add('uav--ready');
}
