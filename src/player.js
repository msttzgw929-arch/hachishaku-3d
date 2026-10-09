import * as THREE from 'three';
function gm() { const d = new Uint8Array([100, 180, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
function ol(mesh, w = 0.03) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x15131a, side: THREE.BackSide }));
  o.material.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${w.toFixed(3)};`); };
  mesh.add(o); return mesh;
}
export class Player {
  constructor() {
    const g = gm();
    const M = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: g });
    const skin = M(0xffd9c4), shirt = M(0xf2f4fa), pants = M(0x2c3550), hair = M(0x221d22), shoe = M(0x5a3a2a), bag = M(0xc0392b);
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    const torso = ol(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.32, 6, 14), shirt)); torso.position.y = 0.92; this.body.add(torso);
    const head = ol(new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), skin)); head.position.y = 1.43; this.body.add(head);
    const hairM = ol(new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hair)); hairM.position.y = 1.46; hairM.rotation.x = -0.25; this.body.add(hairM);
    // eyes
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });
    for (const x of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeM); e.scale.set(1, 1.5, 0.6); e.position.set(x, 1.42, 0.25); this.body.add(e); }
    this.sweat = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fd8ff })); this.sweat.position.set(0.24, 1.52, 0.12); this.body.add(this.sweat);
    const pack = ol(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.2), bag)); pack.position.set(0, 0.98, -0.26); this.body.add(pack);
    const mkLimb = (mat, r, len, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = ol(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat)); m.position.y = -len / 2 - r * 0.5; p.add(m); this.body.add(p); return p; };
    this.legL = mkLimb(pants, 0.085, 0.38, -0.1, 0.62); this.legR = mkLimb(pants, 0.085, 0.38, 0.1, 0.62);
    for (const l of [this.legL, this.legR]) { const s = ol(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.24), shoe)); s.position.set(0, -0.58, 0.04); l.add(s); }
    this.armL = mkLimb(shirt, 0.065, 0.3, -0.3, 1.12); this.armR = mkLimb(shirt, 0.065, 0.3, 0.3, 1.12);
    this.phase = 0; this.facing = 0;
    // x-ray silhouette when hidden behind things
    this.xray = [];
    // body is drawn after the x-ray pass (renderOrder 50) so self-occlusion never shows pink
    this.root.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.renderOrder = 50; } });
    this.root.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) {
      const x = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: 0xff6688, transparent: true, opacity: 0.45, depthFunc: THREE.GreaterDepth, depthWrite: false }));
      x.renderOrder = 40; o.add(x); this.xray.push(x); } });
  }
  update(dt, vel, t) {
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > 0.2) { const target = Math.atan2(vel.x, vel.z); let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 14); }
    this.root.rotation.y = this.facing;
    this.phase += dt * sp * 2.6;
    const a = Math.min(1, sp / 4) * 0.9;
    this.legL.rotation.x = Math.sin(this.phase) * a; this.legR.rotation.x = -Math.sin(this.phase) * a;
    this.armL.rotation.x = -Math.sin(this.phase) * a * 0.9; this.armR.rotation.x = Math.sin(this.phase) * a * 0.9;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.08 * a;
    this.body.rotation.x = a * 0.18;
    this.sweat.visible = Math.sin(t * 6) > 0;
  }
}
