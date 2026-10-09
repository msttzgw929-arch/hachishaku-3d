import * as THREE from 'three';
import { Hachi, K } from './hachi.js';
import { World, shadowTex } from './world.js';
import { Player } from './player.js';
import { Audio } from './audio.js';

const $ = (s) => document.querySelector(s);
const VOICE = {
  start: ['start1'], tease: ['tease1', 'tease2', 'tease3', 'tease4', 'tease5'], near: ['near1', 'near2'],
  irr: ['irr1', 'irr2', 'irr3', 'irr4'], grow: ['grow1', 'grow2', 'grow3', 'grow4'], grab: ['grab1', 'grab2', 'grab3'],
  slap: ['slap1', 'slap2', 'slap3', 'slap4', 'slap5', 'slap6'], esc: ['esc1', 'esc2'], crash: ['crash1', 'crash2', 'crash3'], over: ['over1'],
};
const SUB = {};

// ---------------- renderer / scene ----------------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x101226, 0.012);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const world = new World(scene);
const player = new Player(); scene.add(player.root);
const shTex = shadowTex();
const mkShadow = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1; scene.add(m); return m; };
const pShadow = mkShadow(); const hShadow = mkShadow();
const audio = new Audio();

// ---------------- load assets ----------------
const loader = new THREE.TextureLoader();
const loadTex = (u) => new Promise((res, rej) => loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));
let hachi, meta;
async function loadAll() {
  meta = await (await fetch('assets/layers.json')).json();
  try { Object.assign(SUB, await (await fetch('assets/voice/lines.json')).json()); } catch (e) { }
  const [upper, belly, skirt, faces] = await Promise.all(['upper', 'belly', 'skirt', 'faces'].map((n) => loadTex(`assets/${n}.webp`)));
  faces.minFilter = THREE.LinearFilter; faces.generateMipmaps = false;
  hachi = new Hachi({ upper, belly, skirt, faces }, meta);
  scene.add(hachi.root);
  hachi.onStep = () => {
    const d = hachi.root.position.distanceTo(player.root.position);
    audio.footstep(hachi.bellyScale, d);
    if (hachi.bellyScale > 1.8) { shake(Math.min(0.5, 0.05 * hachi.bellyScale) / (1 + d * 0.05)); if (hachi.speed > 0.5) world.puff(hachi.root.position, 2, 1.5 * hachi.legScale, 0x77737f, hachi.bellyRadius); }
  };
}

// ---------------- state ----------------
const G = {
  mode: 'title', t: 0, hearts: 3, irritation: 0, stage: 0, invuln: 0,
  pv: new THREE.Vector3(), hv: new THREE.Vector3(), hp: new THREE.Vector3(),
  dash: { state: 'none', t: 0, cd: 8, dir: new THREE.Vector3() }, stun: 0,
  grab: null, shake: 0, voiceT: 4, nearT: 0, crashCd: 0, destroyed: 0,
  best: +(localStorage.getItem('hachi3d_best') || 0), stuck: 0, detour: 0, detourDir: 1,
  tapTarget: null,
};
const PLAYER_SPEED = 5.4;
function shake(a) { G.shake = Math.min(1.5, G.shake + a); }
function stageScale(st) { return 1 + 0.6 * st + 0.04 * st * st; }

function resetGame() {
  G.t = 0; G.hearts = 3; G.irritation = 0; G.stage = 0; G.invuln = 2; G.stun = 0; G.destroyed = 0;
  G.dash.state = 'none'; G.dash.cd = 9; G.voiceT = 5; G.grab = null; G.tapTarget = null;
  player.root.position.set(0, 0, 8); hachi.root.position.set(0, 0, -22);
  hachi.bellyScale = hachi.bellyScaleTarget = 1; hachi.layout();
  G.pv.set(0, 0, 0); G.hv.set(0, 0, 0);
  camPos.set(0, 9, 20);
}

// ---------------- input ----------------
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'Enter', 'KeyZ', 'KeyJ'].includes(e.code)) { if (G.mode === 'grab') { slapAt(null); e.preventDefault(); } }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, t0: 0, moved: 0 };
const joyBase = $('#joy'), joyKnob = $('#joyKnob');
canvas.addEventListener('pointerdown', (e) => {
  audio.resume();
  if (G.mode === 'grab') { slapAt(e); return; }
  if (G.mode !== 'play') return;
  joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; joy.t0 = performance.now(); joy.moved = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const L = Math.hypot(dx, dy); joy.moved = Math.max(joy.moved, L);
  const R = 60; const k = L > R ? R / L : 1; joy.x = dx * k / R; joy.y = dy * k / R;
  if (joy.moved > 12) {
    G.tapTarget = null;
    joyBase.style.display = 'block'; joyBase.style.left = joy.ox + 'px'; joyBase.style.top = joy.oy + 'px';
    joyKnob.style.transform = `translate(${joy.x * R}px, ${joy.y * R}px)`;
  }
});
const endJoy = (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  if (joy.moved < 12 && performance.now() - joy.t0 < 350) { // tap to move
    const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
    const p = new THREE.Vector3(); if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) { G.tapTarget = p; spawnTapMark(e.clientX, e.clientY); }
  }
  joy.active = false; joy.x = joy.y = 0; joyBase.style.display = 'none';
};
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
function spawnTapMark(x, y) { const d = document.createElement('div'); d.className = 'tapmark'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 500); }

// ---------------- UI ----------------
const ui = {
  title: $('#title'), hud: $('#hud'), over: $('#over'), grab: $('#grabui'), pause: $('#pause'), loading: $('#loading'),
  time: $('#time'), hearts: $('#hearts'), irr: $('#irrFill'), lv: $('#lv'), banner: $('#banner'), sub: $('#sub'),
  gauge: $('#gaugeFill'), gtime: $('#gtimeFill'), arrow: $('#arrow'), excl: $('#excl'), best: $('#bestTitle'),
};
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`; }
function showBanner(txt, cls = '') { ui.banner.textContent = txt; ui.banner.className = 'show ' + cls; clearTimeout(showBanner.t); showBanner.t = setTimeout(() => (ui.banner.className = ''), 2200); }
function subtitle(k) { if (!k) return; const s = SUB[k]; const txt = typeof s === 'string' ? s : s && s.text; if (!txt) return; ui.sub.textContent = '八尺様「' + txt.replace(/\s+/g, '') + '」'; ui.sub.classList.add('show'); clearTimeout(subtitle.t); subtitle.t = setTimeout(() => ui.sub.classList.remove('show'), 2600); }
function say(cat, opt) { const k = audio.say(cat, VOICE[cat], opt); if (k) subtitle(k); return k; }
function updateHearts() { ui.hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < G.hearts ? 'on' : 'off'}">♥</span>`).join(''); }
ui.best.textContent = G.best > 0 ? `ベスト記録 ${fmt(G.best)}` : '';

async function startGame() {
  ui.title.classList.add('hide'); ui.over.classList.add('hide');
  ui.loading.classList.remove('hide');
  await audio.init(Object.values(VOICE).flat());
  audio.resume();
  ui.loading.classList.add('hide');
  resetGame(); updateHearts();
  G.mode = 'play'; ui.hud.classList.remove('hide');
  setTimeout(() => say('start', { force: true }), 600);
  showBanner('八尺様から逃げろ！');
}
$('#startBtn').addEventListener('click', startGame);
$('#retryBtn').addEventListener('click', startGame);
$('#titleBtn').addEventListener('click', () => { ui.over.classList.add('hide'); ui.title.classList.remove('hide'); ui.hud.classList.add('hide'); G.mode = 'title'; ui.best.textContent = G.best > 0 ? `ベスト記録 ${fmt(G.best)}` : ''; });
$('#muteBtn').addEventListener('click', (e) => { e.stopPropagation(); audio.setMuted(!audio.muted); e.target.textContent = audio.muted ? '🔇' : '🔊'; });
$('#pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
$('#resumeBtn').addEventListener('click', togglePause);
function togglePause() {
  if (G.mode === 'play' || G.mode === 'grab') { G.prevMode = G.mode; G.mode = 'pause'; ui.pause.classList.remove('hide'); audio.ctx && audio.ctx.suspend(); }
  else if (G.mode === 'pause') { G.mode = G.prevMode; ui.pause.classList.add('hide'); audio.ctx && audio.ctx.resume(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'play' || G.mode === 'grab')) togglePause(); });

// ---------------- grab ----------------
function startGrab() {
  G.hearts--; updateHearts();
  const final = G.hearts <= 0;
  G.mode = 'grab';
  G.grab = { t: 0, taps: 0, need: 12, limit: 7.5, final, lastSlap: 0, slapFace: 0 };
  G.pv.set(0, 0, 0); G.dash.state = 'none';
  G.irritation = Math.max(0, G.irritation - 0.35);
  hachi.setFace('grin');
  audio.sting();
  say('grab', { force: true, cooldown: 0.4 });
  shake(0.4);
  hachi.impulse(0, 50, 1.2);
  ui.grab.classList.remove('hide'); document.body.classList.add('grabbing');
  ui.grab.classList.toggle('final', final);
  $('#grabTitle').textContent = final ? 'つかまってしまった…' : 'お腹を連打して脱出！';
  $('#grabHint').textContent = final ? '' : (matchMedia('(pointer:coarse)').matches ? '画面をタップ連打！' : 'クリック / スペース連打！');
}
function slapAt(e) {
  const g = G.grab; if (!g || g.final || g.done) return;
  g.taps++; audio.slap(1);
  // where on the belly? intersect the billboard plane
  let cx = 496 + (Math.random() - 0.5) * 500, cy = 760 + (Math.random() - 0.5) * 300;
  let sx = innerWidth / 2 + (Math.random() - .5) * 200, sy = innerHeight * 0.6;
  if (e) {
    sx = e.clientX; sy = e.clientY;
    const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
    const pz = hachi.root.position.z + 0.03;
    const p = new THREE.Vector3();
    if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -pz), p)) {
      const s = hachi.bellyScale; const by = hachi.belly.position.y + hachi.body.position.y;
      const lx = p.x - hachi.root.position.x, ly = p.y - by;
      const x = 496 + lx / (K * s), y = hachi.anchorTop[1] - ly / (K * s);
      if (x > 80 && x < 930 && y > 330 && y < 1180) { cx = x; cy = y; }
    }
  }
  hachi.poke(cx, cy, 1);
  shake(0.12);
  // slap FX
  const d = document.createElement('div'); d.className = 'slapfx'; d.style.left = sx + 'px'; d.style.top = sy + 'px';
  d.innerHTML = `<span class="hand">✋</span><span class="pow">${['ペチン！', 'ぺちっ', 'バチン！', 'ぽよん', 'ぷるんっ'][Math.floor(Math.random() * 5)]}</span>`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 600);
  // face + voice
  g.slapFace = 0.45; hachi.setFace(Math.random() < 0.5 ? 'shock' : 'wince');
  if (G.t - g.lastSlap > 0.9 && Math.random() < 0.75) { const k = audio.say('slap', VOICE.slap, { force: true, cooldown: 0.2, rate: 1 + Math.random() * 0.06 }); if (k) subtitle(k); g.lastSlap = G.t; }
  if (g.taps >= g.need) escapeGrab();
}
function escapeGrab() {
  const g = G.grab; g.done = true;
  G.mode = 'play'; ui.grab.classList.add('hide'); document.body.classList.remove('grabbing');
  G.invuln = 2.5; G.stun = 1.4;
  const away = new THREE.Vector3().subVectors(player.root.position, hachi.root.position).setY(0);
  if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
  player.root.position.addScaledVector(away, 1.5);
  G.pv.copy(away).multiplyScalar(14);
  hachi.setFace('angry'); hachi.impulse(0, 40, 1.0);
  setTimeout(() => say('esc', { force: true }), 150);
  showBanner('脱出成功！', 'good');
  G.irritation = Math.min(0.99, G.irritation + 0.25);
}
function gameOver() {
  G.mode = 'over';
  ui.grab.classList.add('hide'); ui.hud.classList.add('hide'); document.body.classList.remove('grabbing');
  const best = G.t > G.best; if (best) { G.best = G.t; localStorage.setItem('hachi3d_best', String(G.t)); }
  $('#score').textContent = fmt(G.t);
  $('#overStage').textContent = `お腹 Lv.${G.stage + 1}　／　破壊した建物 ${G.destroyed}`;
  $('#overBest').textContent = best ? '★ ベスト記録更新！' : `ベスト ${fmt(G.best)}`;
  ui.over.classList.remove('hide');
}

// ---------------- camera ----------------
const camPos = new THREE.Vector3(0, 9, 20), camLook = new THREE.Vector3();
function updateCamera(dt) {
  const pp = player.root.position, hp = hachi.root.position;
  let want = new THREE.Vector3(), look = new THREE.Vector3();
  if (G.mode === 'grab' || G.mode === 'overcut') {
    const top = hachi.height;
    const fovR = THREE.MathUtils.degToRad(camera.fov) / 2;
    const tgtH = top * 0.62;
    const dist = Math.max((tgtH / Math.tan(fovR)) * (camera.aspect < 1 ? 1.15 : 1.0), 4);
    look.set(hp.x, top * 0.55, hp.z);
    want.set(hp.x, top * 0.42, hp.z + dist);
  } else {
    const s = hachi ? hachi.bellyScale : 1;
    const zoom = 1 + Math.max(0, s - 1) * 0.42;
    const portrait = camera.aspect < 1 ? 1.25 : 1;
    const back = 11.5 * zoom * portrait, up = 6.2 * zoom * portrait;
    // bias look slightly toward hachi so she stays framed
    const toH = new THREE.Vector3().subVectors(hp, pp); const dH = toH.length();
    const bias = toH.multiplyScalar(Math.min(0.35, 6 / Math.max(dH, 1)) * (dH < 30 ? 1 : 0));
    const near = THREE.MathUtils.clamp(1.4 - dH / (25 + hachi.height * 1.5), 0, 1);
    const ly = THREE.MathUtils.lerp(1.6 + Math.min(4, (s - 1) * 1.6), Math.min(hachi.height * 0.5, up * 0.62), near);
    look.set(pp.x + bias.x, Math.max(1.6, ly), pp.z + bias.z);
    want.set(look.x, up, look.z + back);
  }
  const k = Math.min(1, dt * (G.mode === 'grab' ? 3 : 5));
  camPos.lerp(want, k); camLook.lerp(look, k);
  camera.position.copy(camPos);
  if (G.shake > 0.001) { camera.position.x += (Math.random() - .5) * G.shake; camera.position.y += (Math.random() - .5) * G.shake; G.shake *= Math.exp(-dt * 6); }
  camera.lookAt(camLook);
}

// ---------------- main update ----------------
const tmp = new THREE.Vector3();
function update(dt) {
  G.t += dt;
  const pp = player.root.position, hp = hachi.root.position;
  // --- player movement
  let ix = 0, iz = 0;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1;
  if (joy.active && joy.moved > 12) { ix += joy.x; iz += joy.y; }
  if (ix || iz) G.tapTarget = null;
  if (G.tapTarget) { tmp.subVectors(G.tapTarget, pp).setY(0); if (tmp.length() < 0.4) G.tapTarget = null; else { tmp.normalize(); ix = tmp.x; iz = tmp.z; } }
  const L = Math.hypot(ix, iz); if (L > 1) { ix /= L; iz /= L; }
  const want = new THREE.Vector3(ix, 0, iz).multiplyScalar(PLAYER_SPEED);
  G.pv.lerp(want, Math.min(1, dt * 10));
  pp.addScaledVector(G.pv, dt);
  world.pushOut(pp, 0.35);
  G.invuln = Math.max(0, G.invuln - dt);
  // --- irritation & growth
  const dist = Math.hypot(pp.x - hp.x, pp.z - hp.z);
  const R = hachi.bellyRadius;
  G.irritation += dt / (16 + G.stage * 1.5) * (dist > 15 ? 1.35 : 1);
  if (G.irritation >= 1) {
    G.irritation = 0; G.stage++;
    hachi.bellyScaleTarget = stageScale(G.stage);
    audio.grow(); shake(0.8); hachi.impulse(0, 70, 1.5);
    hachi.setFace('angryoh'); G.faceHold = 2.2;
    say('grow', { force: true, cooldown: 2 });
    showBanner(`イライラ限界！ お腹 Lv.${G.stage + 1}`, 'bad');
    world.puff(hp, 14, 2.5 * hachi.legScale, 0x8d8a96, R * 1.5);
  }
  // --- hachi AI
  const sp = Math.min(PLAYER_SPEED * 0.9, 2.7 + G.stage * 0.22) * (G.irritation > 0.6 ? 1.08 : 1);
  let hv = new THREE.Vector3();
  G.stun = Math.max(0, G.stun - dt);
  const toP = new THREE.Vector3(pp.x - hp.x, 0, pp.z - hp.z); const dP = toP.length(); toP.normalize();
  const D = G.dash;
  D.cd -= dt;
  if (G.stun > 0) { hv.set(0, 0, 0); }
  else if (D.state === 'wind') {
    D.t -= dt; hv.set(0, 0, 0); if (D.t <= 0) { D.state = 'go'; D.t = 1.1; D.dir.copy(toP); }
  } else if (D.state === 'go') {
    D.t -= dt; hv.copy(D.dir).multiplyScalar(sp * 2.3); if (D.t <= 0) { D.state = 'none'; D.cd = 7 + Math.random() * 5; }
  } else {
    if (D.cd <= 0 && G.stage >= 1 && dP < 22 && dP > R + 3) { D.state = 'wind'; D.t = 0.85; hachi.setFace('angryoh'); G.faceHold = 1; say('near', { force: true, cooldown: 1 }); }
    let dir = toP.clone();
    if (G.detour > 0) { G.detour -= dt; dir.set(-toP.z * G.detourDir, 0, toP.x * G.detourDir).multiplyScalar(0.8).addScaledVector(toP, 0.4).normalize(); }
    hv.copy(dir).multiplyScalar(sp);
  }
  ui.excl.style.display = D.state === 'wind' ? 'block' : 'none';
  G.hv.lerp(hv, Math.min(1, dt * 5));
  const before = hp.clone();
  hp.addScaledVector(G.hv, dt);
  // destruction / collision
  const power = R * R * 6.5;
  for (const h of world.collideCircle(hp, R * 0.85)) {
    const b = h.b; const strength = (b.w * b.d * b.h) / 40;
    if (strength < power) {
      const vol = world.destroy(b, hp); G.destroyed++;
      shake(Math.min(1.2, 0.2 + Math.cbrt(vol) * 0.08)); audio.crash(Math.cbrt(vol) / 4);
      hachi.impulse(-(b.x - hp.x) * 4, 30, 0.8);
      if (b.isBuilding && G.crashCd <= 0) { say('crash', { cooldown: 2 }); G.crashCd = 9; }
    }
  }
  G.crashCd -= dt;
  world.pushOut(hp, R * 0.85);
  const moved = before.distanceTo(hp), intended = G.hv.length() * dt;
  if (intended > 0.01 && moved < intended * 0.35) { G.stuck += dt; if (G.stuck > 0.35 && G.detour <= 0) { G.detour = 1.4; G.detourDir = Math.random() < .5 ? -1 : 1; G.stuck = 0; } } else G.stuck = Math.max(0, G.stuck - dt);
  const realV = new THREE.Vector3().subVectors(hp, before).divideScalar(Math.max(dt, 1e-4));
  // --- faces & voice
  G.faceHold = Math.max(0, (G.faceHold || 0) - dt);
  if (G.faceHold <= 0) hachi.setFace(G.stun > 0 ? 'angry' : (G.irritation > 0.55 || G.stage >= 3 ? 'angry' : (dP < 8 ? 'smug' : 'base')));
  G.voiceT -= dt;
  if (G.voiceT <= 0 && !audio.speaking) {
    if (dP < 7 + R) say('near', { cooldown: 2 }) || say('tease');
    else if (G.irritation > 0.5) say('irr');
    else say('tease');
    G.voiceT = 6 + Math.random() * 6;
  }
  // --- grab check
  if (G.invuln <= 0 && G.stun <= 0 && dP < R * 0.85 + 0.75) {
    startGrab();
    // put player in front of her belly (toward camera)
    pp.set(hp.x - R * 0.55, 0, hp.z + 0.6);
  }
  // HUD
  ui.time.textContent = fmt(G.t);
  ui.irr.style.width = (G.irritation * 100).toFixed(1) + '%';
  ui.lv.textContent = `お腹 Lv.${G.stage + 1}`;
  updateArrow();
  audio.tick(Math.max(0, Math.min(1, 1 - (dP - R) / 25)));
  return realV;
}
function updateGrab(dt) {
  const g = G.grab; g.t += dt;
  g.slapFace -= dt;
  if (g.slapFace <= 0 && !g.final) hachi.setFace(g.taps > 6 ? 'angry' : 'grin');
  ui.gauge.style.width = Math.min(100, g.taps / g.need * 100) + '%';
  ui.gtime.style.width = Math.max(0, 100 - g.t / g.limit * 100) + '%';
  if (g.final && g.t > 0.6 && !g.saidOver) { g.saidOver = true; setTimeout(() => say('over', { force: true }), 1600); hachi.setFace('grin'); }
  if (g.final && g.t > 5.5) gameOver();
  if (!g.final && g.t > g.limit) { g.final = true; g.t = 0.61; $('#grabTitle').textContent = '時間切れ…'; }
  // hug squeeze
  const pp = player.root.position, hp = hachi.root.position;
  pp.x += (hp.x - hachi.bellyRadius * 0.55 - pp.x) * Math.min(1, dt * 4);
  pp.z += (hp.z + 0.6 - pp.z) * Math.min(1, dt * 4);
  ui.time.textContent = fmt(G.t);
}
function updateArrow() {
  const hp = hachi.root.position.clone(); hp.y = hachi.height * 0.5;
  const v = hp.project(camera);
  const off = v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
  if (!off) { ui.arrow.style.display = 'none'; return; }
  let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; }
  const m = Math.max(Math.abs(x), Math.abs(y)); x /= m; y /= m;
  const sx = (x * 0.9 + 1) / 2 * innerWidth, sy = (1 - (y * 0.88 + 1) / 2) * innerHeight;
  ui.arrow.style.display = 'block'; ui.arrow.style.left = sx + 'px'; ui.arrow.style.top = sy + 'px';
  ui.arrow.style.setProperty('--rot', Math.atan2(-y, x) + 'rad');
  const d = Math.hypot(player.root.position.x - hachi.root.position.x, player.root.position.z - hachi.root.position.z);
  ui.arrow.dataset.d = `${Math.round(d)}m`;
}

// ---------------- loop ----------------
let last = performance.now();
const zero = new THREE.Vector3();
const titleT = { a: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!hachi) { renderer.render(scene, camera); return; }
  if (G.fixedDt) dt = G.fixedDt;
  step(dt);
  renderer.render(scene, camera);
}
function step(dt) {
  let hvel = zero;
  const talk = audio.level();
  if (G.mode === 'play') hvel = update(dt);
  else if (G.mode === 'grab') updateGrab(dt);
  else if (G.mode === 'test') { hvel = G.testVel || zero; }
  else if (G.mode === 'title') {
    // attract mode: she strolls on the right side of the title screen
    titleT.a += dt;
    const portrait0 = camera.aspect < 1;
    const x = (portrait0 ? 0 : 2.3) + Math.sin(titleT.a * 0.35) * 0.5;
    hachi.root.position.set(x, 0, -4 + Math.sin(titleT.a * 0.22) * 0.8);
    hvel = new THREE.Vector3(Math.cos(titleT.a * 0.35) * 0.18, 0, 0.18 * Math.cos(titleT.a * 0.22)).multiplyScalar(4).add(new THREE.Vector3(0, 0, 0.9));
    hachi.setFace(['base', 'smug', 'base', 'grin'][Math.floor(titleT.a / 3) % 4]);
    const portrait = camera.aspect < 1;
    camPos.set(0.2, portrait ? 3.4 : 2.7, portrait ? 6.0 : 2.4); camLook.set(0.2, portrait ? 3.4 : 2.65, -4);
    player.root.position.set(-30, 0, 30);
  }
  if (G.mode !== 'pause') {
    const opts = { talk };
    if (G.mode === 'grab') { opts.arms = 0.25 + Math.sin(G.t * 3) * 0.05; opts.nod = -4; }
    if (G.dash.state === 'wind') opts.arms = 0.35;
    opts.red = G.mode === 'play' ? Math.max(0, G.irritation - 0.5) * 0.6 + (G.dash.state !== 'none' ? 0.3 : 0) : 0;
    hachi.update(dt, hvel, 0, opts);
    player.update(dt, G.mode === 'grab' ? zero : G.pv, G.t);
    player.root.visible = !(G.invuln > 0 && G.mode === 'play' && Math.sin(G.t * 30) > 0.3);
    world.update(dt);
    if (G.camOverride) { camera.position.copy(G.camOverride[0]); camera.lookAt(G.camOverride[1]); }
    else if (G.mode !== 'title') updateCamera(dt); else { camera.position.copy(camPos); camera.lookAt(camLook); }
    // shadows
    pShadow.position.set(player.root.position.x, 0.03, player.root.position.z); pShadow.scale.set(1.2, 1.2, 1);
    const R = hachi.bellyRadius; hShadow.position.set(hachi.root.position.x, 0.025, hachi.root.position.z); hShadow.scale.set(R * 2.6, R * 1.6, 1);
    world.spawnLight.position.set(player.root.position.x, 5, player.root.position.z + 2);
    // exclamation above her head
    if (ui.excl.style.display === 'block') {
      const p = hachi.root.position.clone(); p.y = hachi.height + 0.5; p.project(camera);
      ui.excl.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; ui.excl.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
    }
  }
}
loadAll().then(() => { $('#startBtn').disabled = false; $('#startBtn').textContent = 'はじめる'; requestAnimationFrame(frame); })
  .catch((e) => { console.error(e); $('#startBtn').textContent = '読み込み失敗…再読み込みしてください'; });

// ---------------- test hooks (used by automated screenshots) ----------------
window.__game = {
  G, get hachi() { return hachi; }, player, world, camera, startGame,
  setStage(n) { G.stage = n; hachi.bellyScaleTarget = hachi.bellyScale = stageScale(n); hachi.layout(); },
  grab() { startGrab(); }, slap(n = 1) { for (let i = 0; i < n; i++) slapAt(null); },
  step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) step(dt); },
  cam(p, l) { G.camOverride = p ? [new THREE.Vector3(...p), new THREE.Vector3(...l)] : null; },
  place(px, pz, hx, hz) { player.root.position.set(px, 0, pz); hachi.root.position.set(hx, 0, hz); camPos.set(px, 9, pz + 12); },
};
