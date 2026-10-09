// 八尺様リグ：元イラストを部位ごとに切り出したレイヤー（上半身・お腹・スカート）を
// 細分割メッシュ＋頂点シェーダで変形（腕の揺れ・首・呼吸・お腹のバネ揺れ・スカートの揺れ）。
// 脚（ハイヒール）はトゥーン調の3Dメッシュでヒール→トウの歩行サイクル。
import * as THREE from 'three';

export const K = 0.0029;           // canvas px -> meters
const HEM_Y = 0.92;                // hem height above ground (m)

const VERT = /* glsl */`
uniform vec4 uRect;      // canvas rect x,y,w,h
uniform vec2 uAnchor;    // canvas anchor (maps to mesh origin)
uniform vec2 uScale;
uniform float uK;
uniform float uTime;
uniform float uLean;
// upper
uniform float uArmL, uArmR, uHead, uNod, uBreath;
// belly
uniform vec2 uJig; uniform float uSquash; uniform vec4 uPoke; uniform vec4 uPoke2; uniform float uBellyH;
// skirt
uniform float uSway; uniform float uStep;
varying vec2 vUv; varying vec2 vC;
vec2 rot(vec2 p, vec2 o, float a){ vec2 d=p-o; float c=cos(a), s=sin(a); return o+vec2(c*d.x-s*d.y, s*d.x+c*d.y); }
void main(){
  vUv = uv;
  vec2 c = vec2(uRect.x + uv.x*uRect.z, uRect.y + (1.0-uv.y)*uRect.w);
  vC = c;
  vec2 p = c;
#if defined(UPPER)
  // forearms swing around elbows (canvas y down => angle sign flipped)
  float wl = smoothstep(348.0, 300.0, c.x) * smoothstep(455.0, 385.0, c.y);
  p = rot(p, vec2(344.0, 372.0), -uArmL * wl);
  float wr = smoothstep(644.0, 692.0, c.x) * smoothstep(455.0, 385.0, c.y);
  p = rot(p, vec2(670.0, 372.0), uArmR * wr);
  // head tilt / nod around neck
  float wh = smoothstep(215.0, 150.0, c.y) * (1.0 - max(wl, wr));
  p = rot(p, vec2(496.0, 205.0), uHead * wh);
  p.y += uNod * wh * smoothstep(215.0, 60.0, c.y);
  // breathing (chest)
  float wc = exp(-pow((c.x-496.0)/150.0,2.0)) * exp(-pow((c.y-260.0)/90.0,2.0));
  p.y -= uBreath * wc * 6.0;
  p.x += (c.x-496.0) * uBreath * wc * 0.02;
#endif
#if defined(BELLY)
  // belly: anchored at top centre, spring jiggle grows toward the bottom
  vec2 cen = vec2(496.0, 760.0);
  float wy = clamp((c.y - uAnchor.y) / uBellyH, 0.0, 1.0);
  float w2 = wy*wy*(3.0-2.0*wy);
  vec2 d = p - cen;
  p.x = cen.x + d.x * (1.0 + uSquash * 0.55 * w2);
  p.y = uAnchor.y + (p.y - uAnchor.y) * (1.0 - uSquash * w2);
  p += vec2(uJig.x * pow(w2,1.3), uJig.y * w2) ;
  // slap ripples
  for(int i=0;i<2;i++){
    vec4 pk = i==0 ? uPoke : uPoke2;
    if(pk.z > 0.001){
      vec2 dd = c - pk.xy; float r = length(dd);
      float env = pk.z * exp(-pk.w*3.2);
      float wave = exp(-r*r/(2.0*220.0*220.0)) * cos(r*0.022 - pk.w*26.0);
      float dent = exp(-r*r/(2.0*90.0*90.0)) * exp(-pk.w*9.0);
      vec2 n = normalize(c - cen + 0.001);
      p += n * (wave*18.0 - dent*14.0) * env * (0.3+0.7*w2);
    }
  }
#endif
#if defined(SKIRT)
  float t = clamp((c.y - 760.0) / (1478.0-760.0), 0.0, 1.0);
  p.x += uSway * t*t * 26.0 + sin(uTime*2.0 + c.x*0.012) * 3.0 * t*t*t;
  // hem flutter from steps
  p.y -= uStep * pow(t,6.0) * 10.0 * (0.6+0.4*sin(c.x*0.02 + uTime*5.0));
  p.x += uStep * pow(t,4.0) * 6.0 * sin(c.x*0.015 + uTime*7.0);
#endif
  vec2 lp = vec2((p.x - uAnchor.x), (uAnchor.y - p.y)) * uK * uScale;
  lp.x += uLean * lp.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(lp, 0.0, 1.0);
}`;

const FRAG = /* glsl */`
uniform sampler2D uTex;
uniform vec3 uTint; uniform float uFlash; uniform float uRed;
#if defined(UPPER)
uniform sampler2D uFaces; uniform vec4 uFace; uniform float uFaceA, uFaceB, uFaceMix, uFaceN;
#endif
varying vec2 vUv; varying vec2 vC;
void main(){
  vec4 col = texture2D(uTex, vUv);
#if defined(UPPER)
  vec2 fuv = (vC - uFace.xy) / uFace.zw;
  if(fuv.x>0.0 && fuv.x<1.0 && fuv.y>0.0 && fuv.y<1.0){
    vec2 a = vec2(fuv.x, 1.0 - (uFaceA + fuv.y)/uFaceN);
    vec2 b = vec2(fuv.x, 1.0 - (uFaceB + fuv.y)/uFaceN);
    vec4 fa = texture2D(uFaces, a), fb = texture2D(uFaces, b);
    vec4 f = mix(fa, fb, uFaceMix);
    col.rgb = mix(col.rgb, f.rgb, f.a);
  }
#endif
  if(col.a < 0.02) discard;
  vec3 c = col.rgb * uTint;
  c = mix(c, vec3(1.0,0.92,0.95), uFlash);
  c = mix(c, c*vec3(1.25,0.75,0.75), uRed);
  gl_FragColor = vec4(c, col.a);
  #include <colorspace_fragment>
}`;

function layerMesh(tex, rect, anchor, define, segs, extraUniforms) {
  const u = Object.assign({
    uTex: { value: tex }, uRect: { value: new THREE.Vector4(rect.x, rect.y, rect.w, rect.h) },
    uAnchor: { value: new THREE.Vector2(anchor[0], anchor[1]) }, uScale: { value: new THREE.Vector2(1, 1) },
    uK: { value: K }, uTime: { value: 0 }, uLean: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 }, uRed: { value: 0 },
    uArmL: { value: 0 }, uArmR: { value: 0 }, uHead: { value: 0 }, uNod: { value: 0 }, uBreath: { value: 0 },
    uJig: { value: new THREE.Vector2() }, uSquash: { value: 0 }, uPoke: { value: new THREE.Vector4() }, uPoke2: { value: new THREE.Vector4() },
    uBellyH: { value: 880 }, uSway: { value: 0 }, uStep: { value: 0 },
  }, extraUniforms || {});
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG, defines: { [define]: 1 },
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(1, 1, segs[0], segs[1]);
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

// ---------- toon legs with high heels ----------
function gradientMap() {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
function outlined(geo, mat, outlineW = 0.012) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); g.add(m);
  const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x24202c, side: THREE.BackSide }));
  o.onBeforeRender = () => {};
  // inflate along normals via shader
  o.material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${outlineW.toFixed(4)};`);
  };
  g.add(o);
  return g;
}
function buildLeg(gm, side) {
  const skin = new THREE.MeshToonMaterial({ color: 0xf0c8bc, emissive: 0x7a5a58, gradientMap: gm });
  const shoeM = new THREE.MeshToonMaterial({ color: 0xeef0f8, emissive: 0x5a5e70, gradientMap: gm });
  const soleM = new THREE.MeshToonMaterial({ color: 0x2a2630, gradientMap: gm });
  const leg = { hip: new THREE.Group(), knee: new THREE.Group(), ankle: new THREE.Group() };
  // thigh (hidden mostly under skirt)
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.52, 16), skin);
  thigh.position.y = -0.26; leg.hip.add(thigh);
  leg.knee.position.y = -0.52; leg.hip.add(leg.knee);
  // shin: slim tapered calf with a subtle muscle bulge (lathe)
  const pts = [];
  const prof = [[0.0, 0.098], [0.08, 0.104], [0.17, 0.106], [0.28, 0.092], [0.4, 0.07], [0.52, 0.054], [0.62, 0.046], [0.66, 0.045]];
  pts.push(new THREE.Vector2(0.0001, -0.66));
  for (const [y, r] of prof.slice().reverse()) pts.push(new THREE.Vector2(r, -y));
  pts.push(new THREE.Vector2(0.0001, 0));
  const shinG = new THREE.LatheGeometry(pts, 16); shinG.computeVertexNormals();
  const shin = outlined(shinG, skin, 0.006); leg.knee.add(shin);
  leg.ankle.position.y = -0.66; leg.knee.add(leg.ankle);
  // foot inside a pump (pointed toe), heel raised: ankle -> ball of foot slopes down forward
  const foot = new THREE.Group(); foot.scale.setScalar(1.25); leg.ankle.add(foot);
  // vamp / shoe body: a stretched, slightly flattened capsule from heel to toe
  const shoeG = new THREE.SphereGeometry(1, 20, 12);
  shoeG.scale(0.05, 0.04, 0.115);
  const shoe = outlined(shoeG, shoeM, 0.006);
  shoe.position.set(0, -0.055, 0.05); shoe.rotation.x = 0.55; foot.add(shoe);
  const toeG = new THREE.ConeGeometry(0.045, 0.09, 16); toeG.rotateX(Math.PI / 2); toeG.scale(1, 0.62, 1);
  const toe = outlined(toeG, shoeM, 0.005); toe.position.set(0, -0.108, 0.16); toe.rotation.x = 0.18; foot.add(toe);
  // instep skin (opening of the pump)
  const instep = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin); instep.scale.set(0.038, 0.03, 0.06);
  instep.position.set(0, -0.025, 0.035); instep.rotation.x = 0.55; foot.add(instep);
  // heel counter + stiletto
  const heelCup = outlined(new THREE.SphereGeometry(0.048, 14, 10), shoeM, 0.005); heelCup.scale.set(1, 0.85, 0.9);
  heelCup.position.set(0, -0.03, -0.03); foot.add(heelCup);
  const stil = outlined(new THREE.CylinderGeometry(0.012, 0.006, 0.12, 8), shoeM, 0.004);
  stil.position.set(0, -0.11, -0.045); stil.rotation.x = -0.08; foot.add(stil);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), soleM); tip.position.set(0, -0.172, -0.05); foot.add(tip);
  leg.foot = foot;
  return leg;
}

export class Hachi {
  constructor(tex, meta) {
    this.meta = meta;
    this.root = new THREE.Group();
    this.bb = new THREE.Group(); this.root.add(this.bb);
    this.body = new THREE.Group(); this.bb.add(this.body);
    const P = meta.parts;
    this.anchorTop = [496, meta.bellyTop];  // belly top centre (canvas)
    this.crease = meta.crease;
    // meshes
    this.skirt = layerMesh(tex.skirt, P.skirt, [496, 1478], 'SKIRT', [24, 40]);
    this.belly = layerMesh(tex.belly, P.belly, this.anchorTop, 'BELLY', [56, 56]);
    const F = meta.face;
    this.upper = layerMesh(tex.upper, P.upper, this.anchorTop, 'UPPER', [64, 48], {
      uFaces: { value: tex.faces }, uFace: { value: new THREE.Vector4(F.x, F.y, F.w, F.h) },
      uFaceA: { value: 0 }, uFaceB: { value: 0 }, uFaceMix: { value: 0 }, uFaceN: { value: F.names.length },
    });
    this.belly.material.uniforms.uBellyH.value = this.crease - meta.bellyTop;
    this.skirt.renderOrder = 10; this.upper.renderOrder = 11; this.belly.renderOrder = 12;
    this.skirt.position.z = 0; this.upper.position.z = 0.012; this.belly.position.z = 0.03;
    this.body.add(this.skirt, this.upper, this.belly);
    this.mats = [this.skirt.material, this.upper.material, this.belly.material];
    // legs
    const gm = gradientMap();
    this.legs = new THREE.Group(); this.bb.add(this.legs);
    this.legL = buildLeg(gm, -1); this.legR = buildLeg(gm, 1);
    this.legs.add(this.legL.hip, this.legR.hip);
    this.legs.position.z = -0.12;
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), HEM_Y);
    this.legs.traverse((o) => { if (o.isMesh) o.material.clippingPlanes = [this.clip]; });
    // expressions
    this.faceNames = F.names;
    this.face = { cur: 'base', target: 'base', mix: 1, talk: 0 };
    this.mood = 'base';
    // physics
    this.jig = new THREE.Vector2(); this.jigV = new THREE.Vector2();
    this.sq = 0; this.sqV = 0;
    this.pokes = [{ x: 0, y: 0, a: 0, t: 9 }, { x: 0, y: 0, a: 0, t: 9 }];
    this.pokeI = 0;
    this.walkPhase = 0; this.speed = 0; this.prevVel = new THREE.Vector3();
    this.bellyScale = 1; this.bellyScaleTarget = 1;
    this.lean = 0; this.blinkT = 2;
    this.armL = 0; this.armR = 0;
    this.flash = 0; this.red = 0;
    this.time = 0;
    this.onStep = null;
    this.layout();
  }
  get upperScale() { return Math.pow(this.bellyScale, 0.6); }
  get legScale() { return Math.pow(this.bellyScale, 0.55); }
  // belly half-width in metres (for collisions)
  get bellyRadius() { return 424 * K * this.bellyScale * 0.92; }
  get height() { return this.topY + 300 * K * this.upperScale; }
  layout() {
    const s = this.bellyScale, ls = this.legScale, us = this.upperScale;
    const hem = HEM_Y * ls;
    this.legs.scale.setScalar(ls);
    if (this.clip) this.clip.constant = hem - 0.015 * ls + (this.body ? this.body.position.y : 0);
    // skirt anchored at hem centre
    const sk = this.skirt.material.uniforms; sk.uScale.value.set(s, s);
    this.skirt.position.y = hem;
    const creaseY = hem + (1478 - this.crease) * K * s;
    const topY = creaseY + (this.crease - this.anchorTop[1]) * K * s;
    this.belly.material.uniforms.uScale.value.set(s, s);
    this.belly.position.y = topY;
    this.upper.material.uniforms.uScale.value.set(us, us);
    this.upper.position.y = topY;
    this.topY = topY;
    this.faceY = topY + (this.anchorTop[1] - 96) * K * us;
    this.bellyCenterY = topY - 460 * K * s;
  }
  setFace(name, hold = 0) {
    if (this.face.target === name) return;
    this.face.target = name;
  }
  poke(cx, cy, amp = 1) {
    const p = this.pokes[this.pokeI]; this.pokeI = 1 - this.pokeI;
    p.x = cx; p.y = cy; p.a = amp; p.t = 0;
    // also kick the spring
    this.jigV.x += (cx - 496) * -0.25 * amp; this.jigV.y += 60 * amp;
    this.sqV += 2.2 * amp;
    this.flash = 0.25 * amp;
  }
  impulse(jx, jy, sq) { this.jigV.x += jx; this.jigV.y += jy; this.sqV += sq; }
  update(dt, vel, camYaw, opts = {}) {
    this.time += dt;
    const U = this.mats;
    this.bb.rotation.y = camYaw;
    // --- growth (springy inflation)
    const ds = this.bellyScaleTarget - this.bellyScale;
    this.bellyScale += ds * Math.min(1, dt * 2.2);
    if (Math.abs(ds) > 0.002) { this.sqV += Math.sin(this.time * 18) * ds * 1.4 * dt * 60 * 0.02; }
    this.layout();
    // --- local velocity (in billboard space)
    const sp = Math.hypot(vel.x, vel.z);
    this.speed += (sp - this.speed) * Math.min(1, dt * 6);
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const vx = vel.x * right.x + vel.z * right.z;
    const acc = new THREE.Vector3().subVectors(vel, this.prevVel).divideScalar(Math.max(dt, 1e-3));
    this.prevVel.copy(vel);
    const ax = acc.x * right.x + acc.z * right.z;
    // --- walk cycle
    const ls = this.legScale;
    const stride = 0.55 * ls;
    const walking = this.speed > 0.15;
    const prevPhase = this.walkPhase;
    this.walkPhase += dt * (walking ? this.speed / stride * Math.PI : 0) ;
    if (!walking) this.walkPhase += (Math.round(this.walkPhase / Math.PI) * Math.PI - this.walkPhase) * Math.min(1, dt * 4);
    const amp = Math.min(1, this.speed / 2.2);
    // footfalls: each half-cycle
    if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI) && walking) {
      this.impulse(-vx * 6, 26 * amp + 6, 0.6 * amp + 0.1);
      this.stepFlutter = 1;
      this.onStep && this.onStep(Math.floor(this.walkPhase / Math.PI) % 2);
    }
    this.stepFlutter = (this.stepFlutter || 0) * Math.exp(-dt * 4);
    this.animLegs(this.walkPhase, amp, ls);
    // --- belly spring (canvas px units)
    const kS = 55, dS = 5.5;
    this.jigV.x += (-kS * this.jig.x - dS * this.jigV.x) * dt - ax * 9 * dt;
    this.jigV.y += (-kS * this.jig.y - dS * this.jigV.y) * dt;
    this.jig.x += this.jigV.x * dt; this.jig.y += this.jigV.y * dt;
    this.jig.x = THREE.MathUtils.clamp(this.jig.x, -90, 90); this.jig.y = THREE.MathUtils.clamp(this.jig.y, -70, 70);
    const kq = 90, dq = 7;
    this.sqV += (-kq * this.sq - dq * this.sqV) * dt;
    this.sq += this.sqV * dt; this.sq = THREE.MathUtils.clamp(this.sq, -0.12, 0.14);
    for (const p of this.pokes) p.t += dt;
    // --- body bob, lean
    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.035 * amp * ls;
    this.body.position.y = -bob + (opts.lift || 0);
    const leanT = THREE.MathUtils.clamp(-vx * 0.035, -0.12, 0.12);
    this.lean += (leanT - this.lean) * Math.min(1, dt * 4);
    // --- uniforms
    const t = this.time;
    const breath = Math.sin(t * 1.7) * 0.5 + 0.5;
    const swing = Math.sin(this.walkPhase) * amp;
    const armL = (opts.arms != null ? opts.arms : 0) + swing * 0.07 + Math.sin(t * 1.3) * 0.025;
    const armR = (opts.arms != null ? opts.arms : 0) - swing * 0.07 + Math.sin(t * 1.3 + 1.1) * 0.025;
    this.armL += (armL - this.armL) * Math.min(1, dt * 8); this.armR += (armR - this.armR) * Math.min(1, dt * 8);
    this.flash *= Math.exp(-dt * 10);
    this.red += ((opts.red || 0) - this.red) * Math.min(1, dt * 3);
    const tint = opts.tint || new THREE.Color(0.86, 0.88, 1.0);
    for (const m of U) {
      const u = m.uniforms;
      u.uTime.value = t; u.uLean.value = this.lean; u.uTint.value.copy(tint);
      u.uFlash.value = this.flash; u.uRed.value = this.red;
    }
    const uu = this.upper.material.uniforms;
    uu.uArmL.value = this.armL; uu.uArmR.value = this.armR;
    uu.uHead.value = Math.sin(t * 0.9) * 0.025 + swing * 0.02 + (opts.headTilt || 0);
    uu.uNod.value = Math.abs(Math.sin(this.walkPhase)) * 3 * amp + (opts.nod || 0);
    uu.uBreath.value = breath;
    const bu = this.belly.material.uniforms;
    bu.uJig.value.copy(this.jig); bu.uSquash.value = this.sq + breath * 0.008;
    const p0 = this.pokes[0], p1 = this.pokes[1];
    bu.uPoke.value.set(p0.x, p0.y, p0.t < 2.5 ? p0.a : 0, p0.t);
    bu.uPoke2.value.set(p1.x, p1.y, p1.t < 2.5 ? p1.a : 0, p1.t);
    const su = this.skirt.material.uniforms;
    su.uSway.value = this.jig.x / 90 * 0.6 - this.lean * 2; su.uStep.value = this.stepFlutter * amp;
    // --- face crossfade & talk/blink
    this.updateFace(dt, opts.talk || 0);
  }
  updateFace(dt, talk) {
    const f = this.face;
    // lip flap: map base expression to an open-mouth variant while talking
    const openOf = { base: 'oh', smug: 'oh', grin: 'grin', angry: 'angryoh', angryoh: 'angryoh', shock: 'shock', wince: 'wince', oh: 'oh' };
    const closedOf = { base: 'base', smug: 'smug', grin: 'smug', angry: 'angry', angryoh: 'angry', shock: 'shock', wince: 'wince', oh: 'base' };
    f.talk += ((talk > 0.12 ? 1 : 0) - f.talk) * Math.min(1, dt * 22);
    let want = f.target;
    if (talk > 0) want = f.talk > 0.5 ? openOf[f.target] : closedOf[f.target];
    // natural blink on calm faces
    f.blinkT = (f.blinkT ?? 2.5) - dt;
    if (f.blinkT < 0) { f.blinkT = 2.2 + Math.random() * 3.5; f.blinkOn = 0.13; }
    if (f.blinkOn > 0) { f.blinkOn -= dt; if ((want === 'base' || want === 'smug') && talk <= 0) want = 'blink'; }
    const fast = want === 'blink' || f.cur === 'blink';
    if (want !== f.cur) {
      if (f.mix >= 0.999) { f.prev = f.cur; f.cur = want; f.mix = 0; }
    }
    f.mix = Math.min(1, f.mix + dt * (talk > 0 || fast ? 26 : 9));
    const u = this.upper.material.uniforms;
    const idx = (n) => Math.max(0, this.faceNames.indexOf(n));
    u.uFaceA.value = idx(f.prev || f.cur); u.uFaceB.value = idx(f.cur); u.uFaceMix.value = f.mix;
  }
  animLegs(ph, amp, ls) {
    // simple 2-bone IK per leg, heel-toe roll. local leg space (z forward = toward camera)
    const hipY = 1.36, thighL = 0.52, shinL = 0.66, ankleH = 0.2; // ankle height in heels
    for (const [leg, off, x] of [[this.legL, 0, -0.2], [this.legR, Math.PI, 0.2]]) {
      const p = ph + off;
      const s = Math.sin(p), c = Math.cos(p);
      // foot z: stance moves back linearly, swing forward
      const fz = -c * 0.24 * amp;
      const swing = s > 0 ? s : 0;            // lift only during swing half
      const lift = swing * 0.12 * amp;
      // heel-toe: pitch of foot (radians, + = toe up)
      let pitch = 0;
      if (amp > 0.05) {
        const st = (p % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // 0..2pi
        // st in [pi,2pi): stance (heel strike at pi -> toe-off near 2pi)
        if (st >= Math.PI) {
          const u = (st - Math.PI) / Math.PI;
          pitch = u < 0.15 ? 0.22 * (1 - u / 0.15) : (u > 0.7 ? -0.75 * (u - 0.7) / 0.3 : 0);
        } else {
          const u = st / Math.PI;
          pitch = u < 0.5 ? -0.75 * (1 - u / 0.5) + 0.0 : 0.22 * ((u - 0.5) / 0.5);
        }
        pitch *= amp;
      }
      const ankle = new THREE.Vector3(x * 0.85, ankleH + lift + Math.max(0, -pitch) * 0.06, fz);
      const hip = new THREE.Vector3(x, hipY, 0);
      const d = ankle.clone().sub(hip); const L = Math.min(d.length(), thighL + shinL - 0.001);
      // angle in the y-z plane (sagittal), knee bends forward (+z)
      const base = Math.atan2(d.z, -d.y);
      const cosA = (thighL * thighL + L * L - shinL * shinL) / (2 * thighL * L);
      const a = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
      const cosK = (thighL * thighL + shinL * shinL - L * L) / (2 * thighL * shinL);
      const k = Math.PI - Math.acos(THREE.MathUtils.clamp(cosK, -1, 1));
      const roll = Math.atan2(d.x, -d.y);
      leg.hip.position.copy(hip);
      leg.hip.rotation.set(-(base + a), 0, roll, 'YXZ');
      leg.knee.rotation.set(k, 0, 0);
      leg.ankle.rotation.set(-(-(base + a) + k) - pitch, 0, 0);
    }
  }
}
