// 夜の町：手続き生成の路地・建物（看板・窓明かり）・電柱・自販機・街灯。建物は破壊可能。
import * as THREE from 'three';

const rand = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const pick = (a) => a[Math.floor(rand() * a.length)];

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const SIGN_WORDS = ['スナック', '居酒屋', 'クリニック', '質', '本', '理容', 'たばこ', '酒', 'カラオケ', '喫茶', '薬', '中華', 'ラーメン', '旅館', '湯', '占い', '整骨院', 'コインランドリー'];
function facadeTex(variant) {
  return canvasTex(256, 512, (g, w, h) => {
    const base = [['#3a3f4c', '#2b2f3a'], ['#4a4238', '#36302a'], ['#3b4440', '#2a322f'], ['#4b4650', '#38343d'], ['#5a5550', '#433f3b']][variant % 5];
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // grime streaks
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`; g.fillRect(rand() * w, rand() * h, 2 + rand() * 4, 20 + rand() * 120); }
    // floor bands
    for (let y = 64; y < h; y += 128) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, w, 4); }
    // windows
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 3; fx++) {
      const x = 22 + fx * 78, y = 24 + fy * 128;
      const lit = rand() < 0.38;
      const col = lit ? pick(['#ffd58a', '#ffe9b8', '#9fd2ff', '#ffb070']) : '#151a24';
      g.fillStyle = '#0d1016'; g.fillRect(x - 3, y - 3, 58, 78);
      g.fillStyle = col; g.fillRect(x, y, 52, 72);
      if (lit) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 34, 52, 3); g.fillRect(x + 25, y, 3, 72); if (rand() < .5) { g.fillStyle = 'rgba(40,20,10,0.5)'; g.fillRect(x + 4, y + 40, 20, 32); } }
      else { g.fillStyle = 'rgba(120,140,180,0.12)'; g.fillRect(x + 4, y + 4, 18, 30); }
    }
    // AC units
    for (let i = 0; i < 2; i++) { const x = 20 + rand() * 200, y = 100 + rand() * 360; g.fillStyle = '#9aa0a8'; g.fillRect(x, y, 34, 22); g.fillStyle = '#5c6168'; g.beginPath(); g.arc(x + 12, y + 11, 8, 0, 7); g.fill(); }
  });
}
function signTex(word, color) {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#ffffff'; g.font = 'bold 44px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif'; g.textAlign = 'center';
    const chars = [...word].slice(0, 5); const step = (h - 20) / Math.max(chars.length, 1);
    chars.forEach((ch, i) => g.fillText(ch, w / 2, 20 + step * (i + 0.72)));
  });
}
function groundTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#23262d'; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (rand() - 0.5) * 26; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n * 1.1; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(10,10,12,${0.3 + rand() * 0.3})`; g.lineWidth = 1 + rand() * 2; g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(120,140,170,${0.03 + rand() * 0.04})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 40, 8 + rand() * 20, rand() * 3, 0, 7); g.fill(); }
  }, true);
}
function glowTex() {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}
export function shadowTex() {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(0.6, 'rgba(0,0,0,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.size = 150; // half-extent
    this.buildings = [];
    this.props = [];
    this.glow = glowTex();
    this.build();
    this.initDebris();
    this.initDust();
  }
  build() {
    const S = this.size, scene = this.scene;
    // sky dome gradient
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 a=vec3(0.035,0.04,0.085), b=vec3(0.10,0.07,0.16);
        vec3 c=mix(b,a,smoothstep(-0.05,0.5,h)); vec3 d=normalize(vP); float m=pow(max(dot(d,normalize(vec3(-0.4,0.55,-0.75))),0.0),900.0);
        c+=vec3(1.0,0.95,0.8)*m*2.0 + vec3(0.25,0.25,0.35)*pow(max(dot(d,normalize(vec3(-0.4,0.55,-0.75))),0.0),30.0)*0.25; gl_FragColor=vec4(c,1.0);}`
    }));
    sky.renderOrder = -10; scene.add(sky); this.sky = sky;
    // ground
    const gt = groundTex(); gt.repeat.set(S / 6, S / 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S * 2.4, S * 2.4), new THREE.MeshLambertMaterial({ map: gt, color: 0xd0d6e6 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = false; scene.add(ground); this.ground = ground;
    // road markings: white lines on main roads
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0.35 });
    // grid of blocks
    const block = 26, road = 10;
    const facades = [0, 1, 2, 3, 4].map(facadeTex);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2b2e36 });
    const signColors = ['#c0392b', '#2471a3', '#1e8449', '#7d3c98', '#b9770e', '#cb4335'];
    this.signTexs = SIGN_WORDS.map((w, i) => signTex(w, signColors[i % signColors.length]));
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = -S + road; bx < S - block; bx += block + road) {
      for (let bz = -S + road; bz < S - block; bz += block + road) {
        // keep a plaza around the spawn
        if (Math.abs(bx + block / 2) < 20 && Math.abs(bz + block / 2) < 20) { this.addPlaza(bx, bz, block); continue; }
        // subdivide block into 2-3 x 2-3 buildings with alleys
        const nx = 2 + (rand() < 0.5 ? 1 : 0), nz = 2 + (rand() < 0.4 ? 1 : 0);
        const alley = 2.4;
        const cw = (block - alley * (nx - 1)) / nx, cd = (block - alley * (nz - 1)) / nz;
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          if (rand() < 0.12) { this.addProps(bx + i * (cw + alley) + cw / 2, bz + j * (cd + alley) + cd / 2); continue; }
          const w = cw * (0.82 + rand() * 0.18), d = cd * (0.82 + rand() * 0.18);
          const h = 5 + rand() * (rand() < 0.12 ? 16 : 9);
          const x = bx + i * (cw + alley) + cw / 2, z = bz + j * (cd + alley) + cd / 2;
          this.addBuilding(x, z, w, d, h, facades, roofMat, boxGeo);
        }
      }
    }
    // street lamps & poles along roads
    for (let x = -S + road / 2; x < S; x += block + road) {
      for (let z = -S; z < S; z += 14) {
        if (rand() < 0.5) this.addLamp(x + (rand() < .5 ? -3.6 : 3.6), z + rand() * 4);
      }
    }
    for (let z = -S + road / 2; z < S; z += block + road) {
      for (let x = -S; x < S; x += 18) if (rand() < 0.4) this.addPole(x, z + 4);
    }
    // a few real lights (cheap): moon + hemisphere + few point lights near spawn
    scene.add(new THREE.HemisphereLight(0x7080c0, 0x2a2030, 2.2));
    const moon = new THREE.DirectionalLight(0xaab8ff, 1.1); moon.position.set(-40, 80, -60); scene.add(moon);
    const pl = new THREE.PointLight(0xdfe6ff, 14, 26, 1.6); pl.position.set(0, 6, 0); scene.add(pl); this.spawnLight = pl;
    void lineMat;
  }
  addPlaza(bx, bz, block) {
    // shrine-ish empty lot with torii & vending machines
    const cx = bx + block / 2, cz = bz + block / 2;
    const red = new THREE.MeshLambertMaterial({ color: 0xa8322a, emissive: 0x220000 });
    const t = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 5, 10), red); p1.position.set(-2.4, 2.5, 0);
    const p2 = p1.clone(); p2.position.x = 2.4;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), red); b1.position.y = 5;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 0.45), red); b2.position.y = 4.2;
    t.add(p1, p2, b1, b2); t.position.set(cx, 0, cz - 9); this.scene.add(t);
    this.registerDestructible(t, cx, cz - 9, 7, 1, 5.5, 0xa8322a);
  }
  addProps(x, z) {
    // vending machines cluster
    for (let k = 0; k < 2; k++) {
      const vm = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.8), new THREE.MeshLambertMaterial({ color: pick([0xd8dde6, 0xc0392b, 0x2e86c1]) }));
      body.position.y = 0.9;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
      face.position.set(0, 1.1, 0.41);
      vm.add(body, face); vm.position.set(x + k * 1.1 - 0.5, 0, z);
      this.scene.add(vm);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0x9fd8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.scale.set(4, 4, 1); gl.position.set(0, 1.2, 0.8); vm.add(gl);
      this.registerDestructible(vm, x + k * 1.1 - 0.5, z, 1, 0.8, 1.8, 0xd8dde6);
    }
  }
  addLamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5, 6), new THREE.MeshLambertMaterial({ color: 0x555b66 }));
    pole.position.y = 2.5; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
    head.position.set(0, 5, 0.2); g.add(head);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffd9a0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.scale.set(5, 5, 1); gl.position.set(0, 4.9, 0.2); g.add(gl);
    // light pool on ground
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ map: this.glow, color: 0xffcf8a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; g.add(pool);
    g.position.set(x, 0, z); this.scene.add(g);
    this.registerDestructible(g, x, z, 0.4, 0.4, 5, 0x555b66);
  }
  addPole(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 9, 6), new THREE.MeshLambertMaterial({ color: 0x6b6458 }));
    pole.position.y = 4.5; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0x4a443c }));
    arm.position.y = 8.2; g.add(arm);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0x777777 }));
    tr.position.set(0.4, 7.2, 0); g.add(tr);
    g.position.set(x, 0, z); this.scene.add(g);
    this.registerDestructible(g, x, z, 0.5, 0.5, 9, 0x6b6458);
  }
  addBuilding(x, z, w, d, h, facades, roofMat, boxGeo) {
    const fm = facades[Math.floor(rand() * facades.length)].clone(); fm.needsUpdate = true;
    fm.wrapS = fm.wrapT = THREE.RepeatWrapping; fm.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, h / 12));
    const side = new THREE.MeshLambertMaterial({ map: fm });
    const fm2 = fm.clone(); fm2.repeat.set(Math.max(1, Math.round(d / 6)), Math.max(1, h / 12)); fm2.needsUpdate = true;
    const side2 = new THREE.MeshLambertMaterial({ map: fm2 });
    const mesh = new THREE.Mesh(boxGeo, [side2, side2, roofMat, roofMat, side, side]);
    mesh.scale.set(w, h, d); mesh.position.set(x, h / 2, z);
    const g = new THREE.Group(); g.add(mesh);
    // vertical neon sign
    if (rand() < 0.45) {
      const st = pick(this.signTexs);
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), new THREE.MeshBasicMaterial({ map: st, side: THREE.DoubleSide }));
      const sideX = rand() < 0.5 ? -1 : 1;
      sm.position.set(x + sideX * (w / 2 - 0.6), Math.min(h - 2, 4 + rand() * 3), z + d / 2 + 0.5); g.add(sm);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xff8090, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.scale.set(4, 6, 1); gl.position.copy(sm.position); gl.position.z += 0.3; g.add(gl);
    }
    // rooftop water tank / railing
    if (rand() < 0.4) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), new THREE.MeshLambertMaterial({ color: 0x8a8f99 }));
      tank.position.set(x + (rand() - .5) * w * .5, h + 0.8, z + (rand() - .5) * d * .5); g.add(tank);
    }
    this.scene.add(g);
    this.registerDestructible(g, x, z, w, d, h, 0x4a4a55, true);
  }
  registerDestructible(obj, x, z, w, d, h, color, isBuilding = false) {
    this.buildings.push({ obj, x, z, w, d, h, color, alive: true, isBuilding, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  // circle vs AABB push-out. returns list of hit entries
  collideCircle(pos, r, solidOnly = true) {
    const hits = [];
    for (const b of this.buildings) {
      if (!b.alive) continue;
      if (solidOnly && !b.isBuilding && b.w < 0.6) { /* thin poles still block */ }
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) hits.push({ b, cx, cz, dx, dz, d: Math.sqrt(d2) });
    }
    return hits;
  }
  pushOut(pos, r) {
    for (let it = 0; it < 2; it++) {
      for (const h of this.collideCircle(pos, r)) {
        if (h.d > 1e-4) { const k = (r - h.d) / h.d; pos.x += h.dx * k; pos.z += h.dz * k; }
        else { // inside: push to nearest face
          const b = h.b; const opts = [[pos.x - b.minX, -1, 0], [b.maxX - pos.x, 1, 0], [pos.z - b.minZ, 0, -1], [b.maxZ - pos.z, 0, 1]].sort((a, c) => a[0] - c[0]);
          pos.x += opts[0][1] * (opts[0][0] + r); pos.z += opts[0][2] * (opts[0][0] + r);
        }
      }
    }
    const L = this.size - 1; pos.x = Math.max(-L, Math.min(L, pos.x)); pos.z = Math.max(-L, Math.min(L, pos.z));
  }
  // ---------------- destruction ----------------
  initDebris() {
    this.maxDebris = 420;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.debris = new THREE.InstancedMesh(geo, mat, this.maxDebris);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    this.debrisData = [];
    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisData.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), life: 0 });
      this.debris.setColorAt(i, new THREE.Color(0x555555));
    }
    this.debrisI = 0; this.dummy = new THREE.Object3D();
    this.dummy.scale.set(0, 0, 0); this.dummy.updateMatrix();
    for (let i = 0; i < this.maxDebris; i++) this.debris.setMatrixAt(i, this.dummy.matrix);
    this.dummy.scale.set(1, 1, 1);
    this.scene.add(this.debris);
    // rubble piles
    this.rubbleGeo = new THREE.DodecahedronGeometry(1, 0);
  }
  initDust() {
    this.maxDust = 260;
    const tex = this.glow;
    this.dust = [];
    this.dustGroup = new THREE.Group(); this.scene.add(this.dustGroup);
    for (let i = 0; i < this.maxDust; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x9a96a0, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false; s.renderOrder = 20; this.dustGroup.add(s);
      this.dust.push({ s, v: new THREE.Vector3(), life: 0, max: 1, size: 1 });
    }
    this.dustI = 0;
  }
  puff(p, n, size, color = 0x9a96a0, spread = 3) {
    for (let i = 0; i < n; i++) {
      const d = this.dust[this.dustI]; this.dustI = (this.dustI + 1) % this.maxDust;
      d.s.visible = true; d.s.material.color.setHex(color);
      d.s.position.set(p.x + (Math.random() - .5) * spread, p.y + Math.random() * spread * 0.5, p.z + (Math.random() - .5) * spread);
      d.v.set((Math.random() - .5) * 4, 1 + Math.random() * 3, (Math.random() - .5) * 4);
      d.life = 0; d.max = 1.2 + Math.random() * 1.6; d.size = size * (0.6 + Math.random() * 0.8);
    }
  }
  destroy(b, from) {
    if (!b.alive) return;
    b.alive = false; b.obj.visible = false;
    const vol = b.w * b.d * b.h;
    const n = Math.min(90, Math.max(10, Math.round(vol / 18)));
    const col = new THREE.Color(b.color);
    for (let i = 0; i < n; i++) {
      const k = this.debrisI; this.debrisI = (this.debrisI + 1) % this.maxDebris;
      const D = this.debrisData[k];
      D.alive = true; D.life = 0;
      D.p.set(b.x + (Math.random() - .5) * b.w, Math.random() * b.h, b.z + (Math.random() - .5) * b.d);
      const away = new THREE.Vector3(D.p.x - from.x, 0, D.p.z - from.z).normalize();
      D.v.set(away.x * (3 + Math.random() * 7), 4 + Math.random() * 10, away.z * (3 + Math.random() * 7));
      D.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      D.w.set((Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8);
      const sz = Math.min(3.2, 0.5 + Math.random() * Math.cbrt(vol) * 0.28);
      D.s.set(sz * (0.6 + Math.random()), sz * (0.4 + Math.random() * .6), sz * (0.6 + Math.random()));
      const c = col.clone().multiplyScalar(0.7 + Math.random() * 0.6);
      if (Math.random() < 0.15) c.setHex(0xffd58a); // lit window shards
      this.debris.setColorAt(k, c);
    }
    this.debris.instanceColor.needsUpdate = true;
    // dust
    const cp = new THREE.Vector3(b.x, b.h * 0.3, b.z);
    this.puff(cp, Math.min(40, 8 + Math.round(vol / 60)), Math.max(3, Math.cbrt(vol) * 0.9), 0x8d8a96, Math.max(b.w, b.d));
    // rubble pile
    if (b.isBuilding) {
      const m = new THREE.Mesh(this.rubbleGeo, new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.6), flatShading: true }));
      m.scale.set(b.w * 0.55, Math.min(2.2, b.h * 0.12), b.d * 0.55); m.position.set(b.x, 0, b.z); m.rotation.y = Math.random() * 3;
      this.scene.add(m);
    }
    return vol;
  }
  update(dt) {
    const dm = this.dummy;
    for (let i = 0; i < this.maxDebris; i++) {
      const D = this.debrisData[i];
      if (!D.alive) { continue; }
      D.life += dt;
      D.v.y -= 22 * dt;
      D.p.addScaledVector(D.v, dt);
      if (D.p.y < D.s.y * 0.5) { D.p.y = D.s.y * 0.5; D.v.y *= -0.3; D.v.x *= 0.7; D.v.z *= 0.7; D.w.multiplyScalar(0.7); }
      D.r.x += D.w.x * dt; D.r.y += D.w.y * dt; D.r.z += D.w.z * dt;
      let sc = 1; if (D.life > 5) sc = Math.max(0, 1 - (D.life - 5) / 1.5);
      if (sc <= 0) { D.alive = false; dm.scale.set(0, 0, 0); dm.updateMatrix(); this.debris.setMatrixAt(i, dm.matrix); continue; }
      dm.position.copy(D.p); dm.rotation.copy(D.r); dm.scale.copy(D.s).multiplyScalar(sc); dm.updateMatrix();
      this.debris.setMatrixAt(i, dm.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    for (const d of this.dust) {
      if (!d.s.visible) continue;
      d.life += dt; const t = d.life / d.max;
      if (t >= 1) { d.s.visible = false; continue; }
      d.v.multiplyScalar(Math.exp(-dt * 1.5)); d.s.position.addScaledVector(d.v, dt);
      const sz = d.size * (0.6 + t * 1.6); d.s.scale.set(sz, sz, 1);
      d.s.material.opacity = Math.sin(t * Math.PI) * 0.55;
    }
  }
}
