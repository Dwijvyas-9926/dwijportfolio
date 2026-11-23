/* The AERONEX airframe above the block diagram.
   Studio-lit, physically based, soft shadow. It lifts off as its props spin up,
   idles with a slow turn, and when a chapter is active it eases to the pose that
   shows that chapter's parts; the section draws leader lines from the lit blocks
   to the parts through project(). Banks gently toward the cursor. Paused
   off-screen; settles to a still frame on slow devices. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/three/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from '../vendor/three/jsm/environments/RoomEnvironment.js';

// which named part each diagram block points at
export const PART_OF = {
  cam: 'Nose sensors', th: 'Camera gimbal', gps: 'Spine and tail', bat: 'Hull',
  pi: 'Canopy', px: 'Hull trim', esc: 'Arm and motor front right', srv: 'Landing skids',
};
// pose per chapter: [yaw, pitch] — perception shows the nose, flight control the arms from above, autonomy the tail
const POSES = [[0.55, 0.14], [-0.9, 0.42], [2.6, 0.12]];

export async function start(canvas, section) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.radius = 14; key.shadow.blurSamples = 20; key.shadow.bias = -0.0006;
  const rim = new THREE.DirectionalLight(0xF05627, 1.4); rim.position.set(4, 1.5, -5);
  const fill = new THREE.DirectionalLight(0xd8e3ff, 0.6); fill.position.set(5, 3, 4);
  scene.add(key, rim, fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./assets/aeronex.glb');
  const drone = gltf.scene;
  drone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(drone);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const s = 4.5 / Math.max(size.x, size.z);
  const rig = new THREE.Group(), body = new THREE.Group();
  drone.position.sub(center); body.add(drone); body.scale.setScalar(s); rig.add(body); scene.add(rig);
  ground.position.y = -size.y * s / 2 - 0.9;

  // re-pivot each propeller on its hub so it spins about its own axis
  const props = [];
  drone.updateMatrixWorld(true);
  const found = []; drone.traverse(o => { if (/^propeller/i.test(o.name || '')) found.push(o); });
  for (const o of found) {
    let hub = null, best = Infinity;
    o.traverse(m => { if (!m.isMesh) return; m.geometry.computeBoundingSphere(); const r = m.geometry.boundingSphere.radius * m.getWorldScale(new THREE.Vector3()).x; if (r < best) { best = r; hub = m; } });
    const hubWorld = hub ? hub.localToWorld(hub.geometry.boundingSphere.center.clone()) : o.getWorldPosition(new THREE.Vector3());
    const parent = o.parent, pivot = new THREE.Group();
    pivot.position.copy(parent.worldToLocal(hubWorld.clone()));
    pivot.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion())));
    const spinner = new THREE.Group(); pivot.add(spinner); parent.add(pivot); pivot.updateMatrixWorld(true); spinner.attach(o);
    props.push({ spinner, dir: /left/i.test(o.name) === /front/i.test(o.name) ? 1 : -1 });
  }
  const norm = n => String(n || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
  const parts = {};
  drone.traverse(o => { const n = norm(o.name); for (const k in PART_OF) if (n === norm(PART_OF[k])) parts[k] = o; });

  let W = 1, H = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, degraded ? 1 : 1.75));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W < 700 ? 34 : 26;
    camera.position.set(0, 2.4, W < 700 ? 11.5 : 10.2); camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
    if (!running) render(performance.now());
  }

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  section.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const r = section.getBoundingClientRect(); ptr.tx = (e.clientX - r.left) / r.width * 2 - 1; ptr.ty = (e.clientY - r.top) / innerHeight * 2 - 1; }, { passive: true });
  section.addEventListener('pointerleave', () => { ptr.tx = ptr.ty = 0; });

  const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  let started = 0, chapter = -1, yaw = -0.6, pitch = 0.1, idle = 0;
  const v = new THREE.Vector3(), bb = new THREE.Box3();
  function render(now) {
    if (!started) started = now;
    const t = (now - started) / 1000;
    const lift = sm(t / 1.8), spin = Math.min(1, t / 1.2);
    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    let ty, tp;
    if (chapter >= 0 && POSES[chapter]) { [ty, tp] = POSES[chapter]; } else { idle += 0.0035; ty = -0.6 + idle; tp = 0.12; }
    // shortest way round for the yaw
    let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += dy * 0.045; pitch += (tp - pitch) * 0.05;
    rig.rotation.y = yaw + ptr.x * 0.16;
    rig.rotation.x = pitch + ptr.y * 0.05;
    rig.rotation.z = -ptr.x * 0.08;
    body.position.y = (1 - lift) * -0.5 + Math.sin(t * 1.4) * 0.05;
    for (const pr of props) pr.spinner.rotation.y += pr.dir * (0.02 + 0.5 * spin);
    ground.material.opacity = 0.1 * lift;
    renderer.render(scene, camera);
  }
  // screen position (canvas px) of a block's part, or null
  function project(key) {
    const o = parts[key]; if (!o) return null;
    bb.setFromObject(o).getCenter(v); v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
  }

  let running = false, visible = false, still = false, last = 0, frames = 0, slow = 0, total = 0, bad = 0, t0 = performance.now();
  function watch(now) {
    const dt = last ? now - last : 16; last = now;
    if (document.hidden || dt > 250 || now - t0 < 2500) return;
    frames++; total += dt; if (dt > 28) slow++;
    if (frames >= 45) { bad = slow > 30 ? bad + 1 : 0; if (total / frames > 80 || (bad >= 2 && degraded)) { still = true; running = false; } else if (bad >= 2) { degraded = true; bad = 0; resize(); } frames = slow = 0; total = 0; }
  }
  const loop = now => { if (!running) return; render(now); watch(now); requestAnimationFrame(loop); };
  const update = () => { const on = visible && !document.hidden && !still; if (on && !running) { running = true; last = 0; requestAnimationFrame(loop); } else if (!on) running = false; };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !started) t0 = performance.now(); update(); }).observe(section);
  document.addEventListener('visibilitychange', update);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; still = true; section.classList.add('sys--nodrone'); });
  new ResizeObserver(resize).observe(canvas);
  resize(); update();
  section.classList.add('sys--drone');
  return { project, setChapter(i) { chapter = i; }, get running() { return running; } };
}
