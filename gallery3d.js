// 3D-техника упражнений: своя модель из отдельных мышц, универсальный скелет, снаряды и тренажёры.
// Координаты мира в метрах: y — вверх, x — куда смотрит человек (стоя) / к ногам (лёжа на спине), z — его левая сторона.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UPW = V(0, 1, 0), DW = V(1, 0, 0), ZW = V(0, 0, 1), DOWNW = V(0, -1, 0), BACKW = V(-1, 0, 0);
const nrm = (...vs) => { const r = V(); for (const [v, k] of vs) r.addScaledVector(v, k); return r.normalize(); };
const lerpV = (a, b, u) => a.clone().lerp(b, u);
const bez = (a, c, b, u) => { const w = 1 - u; return V().addScaledVector(a, w * w).addScaledVector(c, 2 * w * u).addScaledVector(b, u * u); };
const slerpDir = (a, b, u) => { const q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); return a.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(q, u)); };
const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);

// ---------- сцена ----------
export function createStage(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.prepend(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.05, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 1.2, maxDistance: 7, maxPolarAngle: Math.PI * 0.495 });
  return { renderer, camera, controls };
}

export const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced6, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(1.6, 4.2, 2.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.6, bottom: -2, near: 0.5, far: 10 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0xdfe7ff, 0.6); rim.position.set(-2.5, 2, -2); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.14 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

export const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.58 }),
  skinHi: new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.5 }),
  core: new THREE.MeshStandardMaterial({ color: 0xc9ced5, roughness: 0.7 }),
  prim: new THREE.MeshStandardMaterial({ color: 0xd63a3f, roughness: 0.45, emissive: 0xff2a2a, emissiveIntensity: 0.1 }),
  sec: new THREE.MeshStandardMaterial({ color: 0xf0a35a, roughness: 0.5 }),
  shorts: new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.8 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 0.65 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xeceef1, roughness: 0.35, metalness: 0.15 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.25, metalness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.2, transparent: true }),
  plate: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.55, metalness: 0.1, transparent: true }),
};
function mesh(geo, mat, parent = scene) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
const SPH = new THREE.SphereGeometry(1, 40, 28);
function ell(c, r, mat, rot, parent) { const m = mesh(SPH, mat, parent); m.position.copy(c); m.scale.set(r[0], r[1], r[2]); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); return m; }
const Y = V(0, 1, 0);
// конусная «капсула» между двумя точками
function seg(mat, r0, r1, parent = scene) {
  const g = new THREE.Group(); parent.add(g);
  const body = mesh(new THREE.CylinderGeometry(r1, r0, 1, 28, 1, true), mat, g);
  const c0 = mesh(SPH, mat, g), c1 = mesh(SPH, mat, g); c0.scale.setScalar(r0); c1.scale.setScalar(r1);
  return { g, set(a, b) {
    const d = V().subVectors(b, a), L = d.length();
    body.position.copy(a).addScaledVector(d, 0.5); body.scale.set(1, L, 1); body.quaternion.setFromUnitVectors(Y, d.normalize());
    c0.position.copy(a); c1.position.copy(b);
  } };
}

// ---------- формы мышц ----------
// Длина по y (0→1), ширина по x, толщина по z; внутренняя сторона приплюснута — мышца лежит на теле.
const PROFILES = {
  spindle: u => { const s = Math.sin(Math.PI * u) ** 0.75; return [s, s]; },
  fan: u => [(1 - 0.8 * u) * Math.sin(Math.PI * (0.22 + 0.78 * u)) ** 0.35 + 0.05, Math.sin(Math.PI * u) ** 0.6],
  drop: u => { const s = Math.sin(Math.PI * u ** 1.6) ** 0.7; return [s, s]; },
  block: u => { const s = Math.sin(Math.PI * u) ** 0.28; return [s, s * 0.9]; },
  strap: u => { const s = Math.sin(Math.PI * u) ** 0.35; return [s, s * 0.8]; },
};
const GEO = {};
function muscleGeo(name) {
  if (GEO[name]) return GEO[name];
  const prof = PROFILES[name], R = 22, S = 18, pos = [], idx = [];
  for (let i = 0; i <= R; i++) {
    const u = i / R, [w, t] = prof(u);
    for (let j = 0; j <= S; j++) { const v = j / S * Math.PI * 2, s = Math.sin(v); pos.push(w * Math.cos(v), u, t * (s < 0 ? s * 0.22 : s)); }
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return (GEO[name] = g);
}
const MUS = [];       // все мышцы: красим под упражнение
function muscle(profile, grp, parent = scene, base = M.skin) {
  const m = mesh(muscleGeo(profile), base, parent); m.matrixAutoUpdate = false; m.userData = { grp, base }; MUS.push(m); return m;
}
function ellM(c, r, grp, parent, base = M.skin) { const m = ell(c, r, base, null, parent); m.userData = { grp, base }; MUS.push(m); return m; }
const _bx = V(), _by = V(), _bz = V();
function place(m, a, b, w, t, n) {
  _by.subVectors(b, a); const L = _by.length() || 1e-4; _by.divideScalar(L);
  _bz.copy(n).addScaledVector(_by, -n.dot(_by)); if (_bz.lengthSq() < 1e-8) _bz.set(_by.y, -_by.x, 0); _bz.normalize();
  _bx.crossVectors(_by, _bz);
  m.matrix.makeBasis(_bx.multiplyScalar(w), _by.multiplyScalar(L), _bz.multiplyScalar(t)).setPosition(a); m.matrixWorldNeedsUpdate = true;
}
// эллипсоид по трём осям (для стоп, ладоней)
function placeEll(m, c, ax, ay, az) { m.matrixAutoUpdate = false; m.matrix.makeBasis(ax, ay, az).setPosition(c); m.matrixWorldNeedsUpdate = true; }
function surf(e, x, z, lift = 0) {
  const dx = (x - e.c.x) / e.r.x, dz = (z - e.c.z) / e.r.z, y = e.c.y + e.r.y * Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz));
  const n = V((x - e.c.x) / (e.r.x * e.r.x), (y - e.c.y) / (e.r.y * e.r.y), (z - e.c.z) / (e.r.z * e.r.z)).normalize();
  return { p: V(x, y, z).addScaledVector(n, lift), n };
}

// ---------- корпус ----------
// Корпус строится один раз в «позе покоя» (лёжа на спине, голова к −x, грудь вверх) и потом целиком
// поворачивается матрицей. Позвоночник с небольшим прогибом грудью.
const P0 = V(0.3, 0.53, 0);
const S_R = { L: V(-0.33, 0.565, 0.195), R: V(-0.33, 0.565, -0.195) };
const HIP_R = { L: V(0.3, 0.53, 0.09), R: V(0.3, 0.53, -0.09) };
const CH = { c: V(-0.22, 0.57, 0), r: V(0.19, 0.108, 0.172) }, AB = { c: V(0.04, 0.54, 0), r: V(0.17, 0.078, 0.142) };
const torsoG = new THREE.Group(); torsoG.matrixAutoUpdate = false; scene.add(torsoG);
const UPr = V(0, 1, 0), DOWNr = V(0, -1, 0);
{
  const T = torsoG, st = (p, a, b, w, t, n, grp, base) => place(muscle(p, grp, T, base), a, b, w, t, n);
  ell(CH.c, [CH.r.x, CH.r.y, CH.r.z], M.core, [0, 0, 0.06], T);
  ell(AB.c, [AB.r.x, AB.r.y, AB.r.z], M.core, null, T);
  ell(V(-0.25, 0.53, 0.15), [0.15, 0.07, 0.06], M.core, null, T);
  ell(V(-0.25, 0.53, -0.15), [0.15, 0.07, 0.06], M.core, null, T);
  ell(V(0.27, 0.535, 0), [0.125, 0.095, 0.17], M.shorts, null, T);
  for (const k of [1, -1]) ell(S_R[k > 0 ? 'L' : 'R'], [0.05, 0.05, 0.05], M.core, null, T);
  // голова: лицо вперёд (в покое — вверх)
  ell(V(-0.535, 0.528, 0), [0.092, 0.088, 0.08], M.skin, [0, 0, -0.12], T);
  ell(V(-0.475, 0.565, 0), [0.04, 0.038, 0.056], M.skin, null, T);
  ell(V(-0.448, 0.578, 0), [0.016, 0.016, 0.022], M.skin, null, T);
  ell(V(-0.548, 0.606, 0), [0.016, 0.011, 0.058], M.skin, null, T);
  ell(V(-0.515, 0.624, 0), [0.024, 0.014, 0.013], M.skin, [0, 0, -0.35], T);
  for (const k of [1, -1]) { ell(V(-0.512, 0.596, k * 0.038), [0.022, 0.012, 0.022], M.skin, null, T); ell(V(-0.528, 0.538, k * 0.08), [0.026, 0.03, 0.011], M.skin, null, T); }
  seg(M.core, 0.05, 0.05, T).set(V(-0.47, 0.545, 0), V(-0.41, 0.56, 0));
  for (const k of [1, -1]) {
    const Z = V(0, 0, k);
    st('strap', V(-0.515, 0.53, k * 0.062), V(-0.42, 0.6, k * 0.014), 0.012, 0.012, nrm([UPr, 1], [Z, 0.6]), 'neck');
    st('fan', V(-0.47, 0.565, k * 0.035), V(-0.355, 0.605, k * 0.175), 0.045, 0.022, nrm([UPr, 1], [Z, 0.4]), 'traps');
    st('strap', V(-0.42, 0.61, k * 0.02), V(-0.37, 0.625, k * 0.16), 0.01, 0.01, UPr, 'bone', M.skinHi);
    // зубчатые
    for (let i = 0; i < 4; i++) { const x = -0.28 + i * 0.045, a = surf(CH, x, k * 0.162, 0.004), b = surf(CH, x + 0.03, k * 0.118, 0.006); st('spindle', a.p, b.p, 0.012, 0.01, a.n, 'abs'); }
    const o1 = surf(CH, -0.1, k * 0.15, 0.006), o2 = surf(AB, 0.19, k * 0.115, 0.006);
    st('fan', o1.p, o2.p, 0.05, 0.02, nrm([o1.n, 1], [o2.n, 1]), 'abs');                                    // косые
    for (const [x, len] of [[-0.118, 0.056], [-0.05, 0.058], [0.02, 0.06], [0.115, 0.1]]) {                 // пресс
      const e = x < -0.06 ? CH : AB, a = surf(e, x - len / 2, k * 0.036, 0.004), b = surf(e, x + len / 2, k * 0.036, 0.004);
      st('block', a.p, b.p, 0.03, 0.016, surf(e, x, k * 0.036).n, 'abs');
    }
    // грудная: объём на груди
    const c = surf(CH, -0.235, k * 0.088, 0.006), m = ellM(c.p, [0.085, 0.032, 0.072], 'chest', T);
    m.quaternion.setFromUnitVectors(Y, c.n); m.rotateY(0.25 * k);
    // спина (в покое — снизу): трапеция средняя, ромбовидные, разгибатели, ягодицы
    st('fan', V(-0.42, 0.47, k * 0.02), V(-0.2, 0.465, k * 0.12), 0.06, 0.02, DOWNr, 'traps');
    st('spindle', V(-0.33, 0.462, k * 0.03), V(-0.22, 0.46, k * 0.11), 0.03, 0.016, DOWNr, 'rhomboids');
    st('spindle', V(-0.12, 0.47, k * 0.035), V(0.22, 0.46, k * 0.035), 0.028, 0.022, DOWNr, 'lower_back');
    ellM(V(0.33, 0.448, k * 0.075), [0.085, 0.045, 0.075], 'glutes', T, M.shorts);
  }
}

// ---------- скелет: состояние кадра ----------
const UPPER = 0.3, FORE = 0.268, THIGH = 0.449, SHIN = 0.43;
export const RIG = { M: new THREE.Matrix4(), U: V(), F: V(), Lw: V(0, 0, 1), shrug: 0, J: { E: {}, W: {}, K: {}, A: {}, S: {}, H: {} } };
const _m3 = new THREE.Matrix3();
// корпус: таз в точке P, наклон phi (0 — стоя, 90 — лицом вниз, −90 — на спине), shrug — подъём плеч
export function torso(P, phi, shrug = 0) {
  const a = phi * Math.PI / 180;
  RIG.U.copy(UPW).multiplyScalar(Math.cos(a)).addScaledVector(DW, Math.sin(a));
  RIG.F.copy(DW).multiplyScalar(Math.cos(a)).addScaledVector(UPW, -Math.sin(a));
  RIG.Lw.crossVectors(RIG.F, RIG.U);
  RIG.M.makeBasis(RIG.U.clone().negate(), RIG.F, RIG.Lw);
  const t = P.clone().sub(P0.clone().applyMatrix3(_m3.setFromMatrix4(RIG.M)));
  RIG.M.setPosition(t);
  torsoG.matrix.copy(RIG.M); torsoG.matrixWorldNeedsUpdate = true;
  RIG.shrug = shrug;
}
const tw = p => p.clone().applyMatrix4(RIG.M), td = d => d.clone().transformDirection(RIG.M);
export const sh = s => tw(S_R[s]).addScaledVector(RIG.U, RIG.shrug);
export const hip = s => tw(HIP_R[s]);
export const outw = s => RIG.Lw.clone().multiplyScalar(s === 'L' ? 1 : -1);
export const chestPt = (x, z, lift = 0.02) => { const q = surf(CH, x, z); return tw(q.p).addScaledVector(td(q.n), lift); };
function ik(Sh, W, a, b, pole) {
  const d = V().subVectors(W, Sh); let L = d.length(); L = Math.min(Math.max(L, Math.abs(a - b) + 1e-3), a + b - 1e-4);
  const dir = d.normalize(), along = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = V().subVectors(pole, Sh); p.addScaledVector(dir, -p.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(dir.y, -dir.x, 0); p.normalize();
  return Sh.clone().addScaledVector(dir, along).addScaledVector(p, h);
}

// ---------- руки ----------
const ARM = {};
for (const s of ['L', 'R']) ARM[s] = {
  core: seg(M.core, 0.036, 0.03), fcore: seg(M.core, 0.03, 0.021), elbow: ell(V(), [0.034, 0.034, 0.034], M.core),
  pecS: muscle('fan', 'chest'), pecC: muscle('fan', 'chest'), lat: muscle('fan', 'lats'),
  dF: muscle('fan', 'front_delt'), dS: muscle('fan', 'side_delt'), dR: muscle('fan', 'rear_delt'),
  bic: muscle('spindle', 'biceps'), triL: muscle('spindle', 'triceps'), triH: muscle('spindle', 'triceps'), brach: muscle('spindle', 'biceps'),
  br: muscle('spindle', 'forearm'), flex: muscle('spindle', 'forearm'), ext: muscle('spindle', 'forearm'),
  palm: ell(V(), [1, 1, 1], M.skin),
  fingers: [0, 1, 2, 3].map(() => mesh(new THREE.TorusGeometry(0.022, 0.0095, 10, 24, Math.PI * 1.45), M.skin)),
  thumb: ell(V(), [0.012, 0.03, 0.012], M.skin),
};
// G — точка хвата, pole — куда смотрит локоть, axis — ось снаряда в кисти
export function arm(s, G, pole, axis) {
  axis = axis || ZW;
  const k = s === 'L' ? 1 : -1, Sh = sh(s), a = ARM[s];
  const E = ik(Sh, G, UPPER, FORE, pole);
  RIG.J.S[s] = Sh; RIG.J.E[s] = E; RIG.J.W[s] = G;
  const P = u => lerpV(Sh, E, u), Fp = u => lerpV(E, G, u);
  const ua = V().subVectors(E, Sh).normalize();
  const back = V().subVectors(pole, Sh); back.addScaledVector(ua, -back.dot(ua)); if (back.lengthSq() < 1e-8) back.copy(RIG.F).negate(); back.normalize();
  const front = back.clone().negate(), side = V().crossVectors(ua, back); if (side.dot(outw(s)) < 0) side.negate();
  a.core.set(Sh, E); a.fcore.set(E, G); a.elbow.position.copy(E);
  const lift = RIG.U.clone().multiplyScalar(RIG.shrug);
  const up = RIG.F, Zs = outw(s);
  place(a.dF, tw(V(-0.355, 0.628, k * 0.15)).add(lift), P(0.44).addScaledVector(front, 0.02), 0.042, 0.036, nrm([up, 1], [front, 1]));
  place(a.dS, tw(V(-0.34, 0.6, k * 0.222)).add(lift), P(0.46).addScaledVector(side, 0.022), 0.04, 0.034, nrm([Zs, 1], [side, 1]));
  place(a.dR, tw(V(-0.385, 0.53, k * 0.205)).add(lift), P(0.42).addScaledVector(back, 0.02), 0.036, 0.03, nrm([up, -1], [back, 1]));
  const po = surf(CH, -0.25, k * 0.03, 0.004);
  place(a.pecS, tw(po.p), P(0.2).addScaledVector(front, 0.012), 0.072, 0.03, td(po.n));
  place(a.pecC, tw(V(-0.385, 0.642, k * 0.07)), P(0.22).addScaledVector(front, 0.014), 0.05, 0.026, nrm([up, 1], [front, 0.4]));
  place(a.lat, tw(V(0.02, 0.48, k * 0.13)), P(0.2).addScaledVector(back, 0.012), 0.085, 0.026, nrm([Zs, 1], [up, -0.4]));
  place(a.bic, P(0.18).addScaledVector(front, 0.022), P(0.86).addScaledVector(front, 0.02), 0.034, 0.036, front);
  const n1 = nrm([back, 0.85], [side, -0.5]), n2 = nrm([back, 0.7], [side, 0.75]);
  place(a.triL, P(0.08).addScaledVector(n1, 0.022), P(0.8).addScaledVector(n1, 0.018), 0.03, 0.034, n1);
  place(a.triH, P(0.15).addScaledVector(n2, 0.022), P(0.7).addScaledVector(n2, 0.018), 0.028, 0.03, n2);
  place(a.brach, P(0.5).addScaledVector(side, 0.022), P(0.93).addScaledVector(side, 0.016), 0.022, 0.02, side);
  const fa = V().subVectors(G, E).normalize(), orth = v => { const r = v.clone().addScaledVector(fa, -v.dot(fa)); return r.lengthSq() < 1e-8 ? side.clone() : r.normalize(); };
  const nTh = orth(side), nPalm = orth(front), nBack = orth(back);
  place(a.br, P(0.74).addScaledVector(nTh, 0.022), Fp(0.75).addScaledVector(nTh, 0.012), 0.026, 0.026, nTh);
  place(a.flex, Fp(0.04).addScaledVector(nPalm, 0.02), Fp(0.72).addScaledVector(nPalm, 0.012), 0.032, 0.028, nPalm);
  place(a.ext, Fp(0.08).addScaledVector(nBack, 0.02), Fp(0.76).addScaledVector(nBack, 0.012), 0.03, 0.026, nBack);
  // кисть: ладонь вдоль предплечья, пальцы кольцом вокруг оси снаряда, щель кольца — к локтю
  const ax = axis.clone().normalize();
  const toE = V().subVectors(E, G); toE.addScaledVector(ax, -toE.dot(ax)); if (toE.lengthSq() < 1e-8) toE.set(0, -1, 0); toE.normalize();
  const yb = V().crossVectors(ax, toE);
  placeEll(a.palm, G.clone().addScaledVector(fa, -0.018), toE.clone().multiplyScalar(0.034), fa.clone().multiplyScalar(0.042), ax.clone().multiplyScalar(0.036));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(toE, yb, ax)).multiply(new THREE.Quaternion().setFromAxisAngle(ZW, Math.PI * 0.275));
  a.fingers.forEach((f, i) => { f.position.copy(G).addScaledVector(ax, (i - 1.5) * 0.022 * k); f.quaternion.copy(q); });
  a.thumb.position.copy(G).addScaledVector(ax, -k * 0.055).addScaledVector(yb, 0.012);
  a.thumb.quaternion.setFromUnitVectors(Y, ax);
  return E;
}

// ---------- ноги ----------
const LEG = {};
for (const s of ['L', 'R']) LEG[s] = {
  core: seg(M.core, 0.06, 0.045), shorts: seg(M.shorts, 0.102, 0.092), score: seg(M.core, 0.038, 0.027),
  knee: ell(V(), [0.05, 0.05, 0.05], M.core), patella: ell(V(), [0.026, 0.024, 0.026], M.skin), ankle: ell(V(), [0.032, 0.032, 0.032], M.skin),
  rf: muscle('spindle', 'quads'), vl: muscle('spindle', 'quads'), vm: muscle('drop', 'quads'), sar1: muscle('strap', 'none'), sar2: muscle('strap', 'none'),
  add: muscle('spindle', 'adductors'), ham: muscle('spindle', 'hamstrings'),
  ta: muscle('spindle', 'none'), gm: muscle('drop', 'calves'), gl: muscle('drop', 'calves'), sol: muscle('spindle', 'calves'), ach: muscle('strap', 'none'),
  foot: mesh(SPH, M.skin), heel: mesh(SPH, M.skin), toes: mesh(SPH, M.skin),
};
// A — лодыжка, pole — куда смотрит колено, toe — направление стопы (или точка носка toePt)
export function leg(s, A, pole, toe, toePt) {
  const k = s === 'L' ? 1 : -1, H = hip(s), l = LEG[s];
  const K = ik(H, A, THIGH, SHIN, pole);
  RIG.J.H[s] = H; RIG.J.K[s] = K; RIG.J.A[s] = A;
  const T = u => lerpV(H, K, u), Sh = u => lerpV(K, A, u);
  const d = V().subVectors(K, H).normalize();
  const fr = V().crossVectors(RIG.Lw, d).normalize();
  const lat = outw(s); lat.addScaledVector(d, -lat.dot(d)).normalize();
  const med = lat.clone().negate(), bk = fr.clone().negate();
  l.core.set(H, K); l.shorts.set(H, T(0.42));
  place(l.rf, T(0.12).addScaledVector(fr, 0.045), T(0.9).addScaledVector(fr, 0.03), 0.042, 0.04, fr);
  const nVL = nrm([fr, 0.45], [lat, 0.9]), nVM = nrm([fr, 0.6], [med, 0.8]), nAd = nrm([med, 0.9], [fr, 0.2]);
  place(l.vl, T(0.1).addScaledVector(nVL, 0.045), T(0.88).addScaledVector(nVL, 0.035), 0.05, 0.042, nVL);
  place(l.vm, T(0.45).addScaledVector(nVM, 0.04), T(0.96).addScaledVector(nVM, 0.032), 0.042, 0.04, nVM);
  const sMid = T(0.5).addScaledVector(nrm([fr, 0.9], [med, 0.55]), 0.066);
  place(l.sar1, T(0.04).addScaledVector(nrm([fr, 1], [lat, 1]), 0.062), sMid, 0.014, 0.013, fr);
  place(l.sar2, sMid, T(0.97).addScaledVector(nrm([med, 1], [bk, 0.3]), 0.045), 0.014, 0.013, nrm([fr, 0.5], [med, 1]));
  place(l.add, T(0.05).addScaledVector(nAd, 0.04), T(0.62).addScaledVector(nAd, 0.03), 0.05, 0.04, nAd);
  place(l.ham, T(0.1).addScaledVector(bk, 0.04), T(0.9).addScaledVector(bk, 0.03), 0.05, 0.04, bk);
  const d2 = V().subVectors(A, K).normalize();
  const fr2 = V().crossVectors(RIG.Lw, d2).normalize();
  const lat2 = outw(s); lat2.addScaledVector(d2, -lat2.dot(d2)).normalize();
  const med2 = lat2.clone().negate(), bk2 = fr2.clone().negate();
  l.knee.position.copy(K); l.patella.position.copy(K).addScaledVector(nrm([fr, 1], [fr2, 1]), 0.04);
  l.score.set(K, A); l.ankle.position.copy(A);
  const nTA = nrm([fr2, 0.8], [lat2, 0.6]), nGM = nrm([bk2, 0.8], [med2, 0.6]), nGL = nrm([bk2, 0.8], [lat2, 0.6]);
  place(l.ta, Sh(0.12).addScaledVector(nTA, 0.03), Sh(0.75).addScaledVector(nTA, 0.02), 0.022, 0.02, nTA);
  place(l.gm, Sh(0.56).addScaledVector(nGM, 0.026), Sh(0.03).addScaledVector(nGM, 0.034), 0.036, 0.04, nGM);
  place(l.gl, Sh(0.5).addScaledVector(nGL, 0.024), Sh(0.04).addScaledVector(nGL, 0.03), 0.03, 0.034, nGL);
  place(l.sol, Sh(0.35).addScaledVector(bk2, 0.028), Sh(0.85).addScaledVector(bk2, 0.018), 0.036, 0.022, bk2);
  place(l.ach, Sh(0.78).addScaledVector(bk2, 0.018), A.clone().addScaledVector(bk2, 0.012), 0.009, 0.008, bk2);
  // стопа: подошва вниз от «тыла» стопы
  let t = toePt ? V().subVectors(toePt, A).normalize() : (toe ? toe.clone().normalize() : V().crossVectors(ZW, d2).normalize().addScaledVector(lat, 0.3).normalize());
  const sd = V().crossVectors(t, RIG.Lw.clone().multiplyScalar(-1)); if (sd.lengthSq() < 1e-6) sd.copy(UPW);
  const n = V().crossVectors(RIG.Lw, t); if (n.lengthSq() < 1e-6) n.copy(UPW); n.normalize();
  const sideAx = V().crossVectors(n, t).normalize();
  placeEll(l.foot, A.clone().addScaledVector(t, 0.07).addScaledVector(n, -0.05), t.clone().multiplyScalar(0.1), n.clone().multiplyScalar(0.034), sideAx.clone().multiplyScalar(0.044));
  placeEll(l.heel, A.clone().addScaledVector(t, -0.025).addScaledVector(n, -0.05), t.clone().multiplyScalar(0.035), n.clone().multiplyScalar(0.033), sideAx.clone().multiplyScalar(0.033));
  placeEll(l.toes, A.clone().addScaledVector(t, 0.15).addScaledVector(n, -0.066), t.clone().multiplyScalar(0.032), n.clone().multiplyScalar(0.017), sideAx.clone().multiplyScalar(0.048));
  return K;
}

// ---------- снаряды в руках ----------
const GEAR = {};
function barGroup(len, plateR, sleeves) {
  const g = new THREE.Group(); scene.add(g);
  const sh = mesh(new THREE.CylinderGeometry(0.0145, 0.0145, len, 20), M.steel, g); sh.rotation.x = Math.PI / 2;
  if (plateR) for (const s of [1, -1]) {
    const z = len / 2 - 0.02;
    const sl = mesh(new THREE.CylinderGeometry(0.026, 0.026, sleeves, 20), M.steel, g); sl.rotation.x = Math.PI / 2; sl.position.z = s * (z + sleeves / 2 - 0.05);
    const pl = mesh(new THREE.CylinderGeometry(plateR, plateR, 0.05, 64), M.plate, g); pl.rotation.x = Math.PI / 2; pl.position.z = s * (z + 0.03);
    const rm = mesh(new THREE.TorusGeometry(plateR * 0.89, 0.012, 10, 64), M.dark, g); rm.position.z = s * (z + 0.058);
    const hb = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.056, 32), M.dark, g); hb.rotation.x = Math.PI / 2; hb.position.z = s * (z + 0.03);
    const cl = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), M.steel, g); cl.rotation.x = Math.PI / 2; cl.position.z = s * (z - 0.015);
  }
  g.visible = false; return g;
}
function dumbbell() {
  const g = new THREE.Group(); scene.add(g);
  const h = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 16), M.steel, g); h.rotation.x = Math.PI / 2;
  for (const s of [1, -1]) { const w = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 6), M.plate, g); w.rotation.x = Math.PI / 2; w.position.z = s * 0.115; }
  g.visible = false; return g;
}
GEAR.barbell = barGroup(1.7, 0.225, 0.42);
GEAR.ez = barGroup(1.2, 0.15, 0.25);
GEAR.handle = barGroup(0.42, 0, 0);
GEAR.wideBar = (() => {
  const g = new THREE.Group(); scene.add(g);
  const m = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 16), M.steel, g); m.rotation.x = Math.PI / 2;
  for (const s of [1, -1]) { const e = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 16), M.steel, g); e.rotation.x = Math.PI / 2 - s * 0.35; e.position.set(-0.04, 0, s * 0.57); }
  g.visible = false; return g;
})();
GEAR.vHandle = (() => {
  const g = new THREE.Group(); scene.add(g);
  for (const s of [1, -1]) { const b = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12), M.steel, g); b.position.set(0.08, 0, s * 0.035); b.rotation.set(0, 0, Math.PI / 2); b.rotateX(s * 0.35); }
  const gr = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12), M.dark, g); gr.rotation.x = Math.PI / 2;
  g.visible = false; return g;
})();
GEAR.dbL = dumbbell(); GEAR.dbR = dumbbell();
const cableMat = new THREE.LineBasicMaterial({ color: 0x3a3f47 });
const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), cableMat); scene.add(cable); cable.visible = false;
const rope = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(), V(), V(), V()]), new THREE.LineBasicMaterial({ color: 0x23262c })); scene.add(rope); rope.visible = false;
function orientBar(g, a, b) { g.position.copy(a).add(b).multiplyScalar(0.5); g.quaternion.setFromUnitVectors(ZW, V().subVectors(a, b).normalize()); g.visible = true; }
export function gear(type, opt = {}) {
  for (const g of Object.values(GEAR)) g.visible = false; cable.visible = rope.visible = false;
  const WL = RIG.J.W.L, WR = RIG.J.W.R;
  if (type === 'barbell' || type === 'ez' || type === 'handle' || type === 'wideBar') orientBar(GEAR[type], WL, WR);
  if (type === 'vHandle') { orientBar(GEAR.vHandle, WL, WR); GEAR.vHandle.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Y, opt.vYaw || 0)); }
  if (type === 'dumbbell') for (const s of opt.sides || ['L', 'R']) {
    const g = s === 'L' ? GEAR.dbL : GEAR.dbR; g.visible = true; g.position.copy(RIG.J.W[s]);
    g.quaternion.setFromUnitVectors(ZW, (opt.axis && opt.axis[s]) || ZW);
  }
  if (opt.cable) {
    const end = opt.cableEnd || WL.clone().add(WR).multiplyScalar(0.5);
    cable.geometry.setFromPoints([opt.cable, type === 'rope' ? end.clone().lerp(opt.cable, 0.12) : end]); cable.visible = true;
    if (type === 'rope') { const apex = end.clone().lerp(opt.cable, 0.12); rope.geometry.setFromPoints([apex, WL, apex, WR]); rope.visible = true; }
  }
}

// ---------- оборудование ----------
function G0() { const g = new THREE.Group(); g.visible = false; scene.add(g); return g; }
function bx(g, w, h, d, mat, p, rot) { const m = mesh(new THREE.BoxGeometry(w, h, d), mat, g); m.position.copy(p); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); return m; }
function cyl(g, r, a, b, mat) { const d = V().subVectors(b, a), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 16), mat, g); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.normalize()); return m; }
// подушка-плоскость: центр, ось длины, нормаль, размеры
function padAt(g, c, along, n, len, wid, th = 0.07) {
  const m = mesh(new THREE.BoxGeometry(wid, th, len), M.pad, g);
  const z = along.clone().normalize(), y = n.clone().normalize(), x = V().crossVectors(y, z).normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); m.position.copy(c).addScaledVector(y, -th / 2); return m;
}
function legsTo(g, p, w = 0.5) { cyl(g, 0.025, p, V(p.x, 0.02, p.z), M.frame); bx(g, 0.06, 0.04, w, M.frame, V(p.x, 0.02, p.z)); }
function rack(g, x, hookY, rz = 0.5) {
  for (const s of [1, -1]) {
    bx(g, 0.065, hookY + 0.16, 0.065, M.frame, V(x, (hookY + 0.16) / 2, s * rz));
    bx(g, 0.42, 0.045, 0.065, M.frame, V(x + 0.05, 0.022, s * rz));
    bx(g, 0.11, 0.035, 0.05, M.dark, V(x + 0.07, hookY - 0.04, s * rz));
    for (const y of [0.42, 0.78]) cyl(g, 0.022, V(x, y, s * rz), V(x, y, s * (rz + 0.2)), M.dark);
  }
  bx(g, 0.065, 0.05, rz * 2, M.frame, V(x, hookY + 0.14, 0));
}
function tower(g, x, z, h = 2.2) { bx(g, 0.24, h, 0.24, M.frame, V(x, h / 2, z)); bx(g, 0.5, 0.04, 0.5, M.frame, V(x, 0.02, z)); }
function pulley(g, p) { const m = mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20), M.dark, g); m.position.copy(p); return m; }

// ---------- упражнения ----------
// Каждое: build(R) — оборудование (по позе в середине движения), pose(u, R) — поза при u∈[0,1] (A→B), view — центр камеры.
const BENCH = { pad: 0.43 };
function flatBenchEq(g, rackX = -0.74) {
  bx(g, 1.22, 0.075, 0.29, M.pad, V(-0.06, BENCH.pad - 0.0375, 0)); bx(g, 1.16, 0.03, 0.2, M.frame, V(-0.06, BENCH.pad - 0.09, 0));
  for (const x of [0.44, -0.5]) { bx(g, 0.05, BENCH.pad - 0.1, 0.05, M.frame, V(x, (BENCH.pad - 0.1) / 2, 0)); bx(g, 0.06, 0.04, 0.5, M.frame, V(x, 0.02, 0)); }
  if (rackX != null) rack(g, rackX, 1.08);
}
function benchLegs(u, R, ankX = 0.61) {
  for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(ankX, 0.085, k * 0.41), V(0.7, 0.9, k * 0.5), nrm([DW, 1], [ZW, k * 0.35]));
}
// жим лёжа: J-траектория от низа груди к линии плеч
function benchPress(grip, touchX, poleIn, gearType = 'barbell') {
  return {
    build(g) { flatBenchEq(g); },
    pose(u, R) {
      torso(P0.clone(), -90);
      const SL = sh('L'), top = V(SL.x, SL.y + Math.sqrt((UPPER + FORE) ** 2 - (grip - 0.195) ** 2) - 0.012, 0);
      const bot = chestPt(touchX, 0, 0.016); bot.z = 0;
      const B = bez(top, V(bot.x + 0.02, bot.y + (top.y - bot.y) * 0.7, 0), bot, u);
      R.barPos = B;
      for (const [s, k] of [['L', 1], ['R', -1]]) { const Sh = sh(s); arm(s, V(B.x, B.y - 0.004, k * grip), V(Sh.x + 0.22, Sh.y - 0.6, Sh.z + k * poleIn)); }
      benchLegs(u, R);
      gear(gearType);
      R.path = [top, V(bot.x + 0.02, bot.y + (top.y - bot.y) * 0.7, 0), bot, grip];
    },
    view: () => V(-0.12, 0.58, 0), lying: true,
  };
}
// наклонная скамья: спинка под углом ang к полу
function inclineEq(g, P, ang, rackX) {
  const U = V(-Math.cos(ang), Math.sin(ang), 0), F = V(Math.sin(ang), Math.cos(ang), 0);
  const back = P.clone().addScaledVector(F, -0.115);
  padAt(g, back.clone().addScaledVector(U, 0.36), U, F, 0.78, 0.29);
  padAt(g, V(P.x + 0.16, P.y - 0.09, 0), DW, UPW, 0.36, 0.3);
  cyl(g, 0.03, V(P.x + 0.15, P.y - 0.16, 0), V(P.x + 0.15, 0.02, 0), M.frame);
  cyl(g, 0.03, back.clone().addScaledVector(U, 0.45).addScaledVector(F, -0.05), V(back.x - 0.2, 0.02, 0), M.frame);
  bx(g, 1.0, 0.04, 0.06, M.frame, V(P.x - 0.2, 0.02, 0)); bx(g, 0.06, 0.04, 0.5, M.frame, V(P.x + 0.2, 0.02, 0));
  if (rackX != null) rack(g, rackX, 1.32, 0.52);
}
function seatedLegs(P, footX = 0.45, w = 0.26) {
  for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(P.x + footX, 0.085, k * w), V(P.x + 1, P.y + 0.8, k * 0.35), nrm([DW, 1], [ZW, k * 0.25]));
}
function standLegs(P, w = 0.14, fwd = 0) {
  for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(P.x + fwd + 0.01, 0.085, k * w), V(P.x + 1, P.y, k * 0.25), nrm([DW, 1], [ZW, k * 0.18]));
}
const STAND_Y = 0.94;
// сгибание руки: локоть почти неподвижен, предплечье по дуге
function curlArm(s, E0dir, from, to, u, axis, poleDir) {
  const Sh = sh(s), E0 = Sh.clone().addScaledVector(E0dir.clone().normalize(), UPPER - 0.004);
  const G = E0.clone().addScaledVector(slerpDir(from, to, u), FORE - 0.004);
  return arm(s, G, Sh.clone().add(poleDir), axis);
}

export const EX3D = {
  bench: benchPress(0.405, -0.13, 0.38),
  bench_pause: benchPress(0.405, -0.13, 0.38),
  close_grip: Object.assign(benchPress(0.25, -0.1, 0.12), {}),

  incline_bb: {
    build(g) { inclineEq(g, V(0.22, 0.5, 0), Math.PI / 6, -0.52); },
    pose(u, R) {
      torso(V(0.22, 0.5, 0), -60);
      const SL = sh('L'), grip = 0.38, top = V(SL.x + 0.02, SL.y + Math.sqrt((UPPER + FORE) ** 2 - (grip - 0.195) ** 2) - 0.012, 0);
      const bot = chestPt(-0.37, 0, 0.018); bot.z = 0;
      const ctrl = V(bot.x + 0.01, bot.y + (top.y - bot.y) * 0.65, 0), B = bez(top, ctrl, bot, u);
      for (const [s, k] of [['L', 1], ['R', -1]]) { const Sh = sh(s); arm(s, V(B.x, B.y - 0.004, k * grip), V(Sh.x - 0.05, Sh.y - 0.6, Sh.z + k * 0.4)); }
      seatedLegs(V(0.22, 0.5, 0), 0.5, 0.3); gear('barbell'); R.path = [top, ctrl, bot, grip];
    },
    view: () => V(-0.05, 0.8, 0),
  },
  db_press30: {
    build(g) { inclineEq(g, V(0.22, 0.5, 0), Math.PI / 6); },
    pose(u, R) {
      torso(V(0.22, 0.5, 0), -60);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const Sh = sh(s), top = V(Sh.x + 0.03, Sh.y + 0.52, k * 0.15), bot = V(Sh.x + 0.1, Sh.y + 0.08, k * 0.36);
        arm(s, bez(top, V(bot.x, bot.y + 0.3, k * 0.3), bot, u), V(Sh.x - 0.05, Sh.y - 0.6, Sh.z + k * 0.5));
      }
      seatedLegs(V(0.22, 0.5, 0), 0.5, 0.3); gear('dumbbell');
    },
    view: () => V(-0.05, 0.85, 0),
  },
  lat_raise: {
    build() {},
    pose(u, R) {
      const P = V(0, STAND_Y, 0); torso(P, 4);
      for (const s of ['L', 'R']) {
        const o = outw(s), Sh = sh(s);
        const d = slerpDir(nrm([DOWNW, 1], [o, 0.18], [DW, 0.12]), nrm([o, 1], [DW, 0.2], [DOWNW, 0.05]), u);
        arm(s, Sh.clone().addScaledVector(d, 0.545), Sh.clone().addScaledVector(o, 0.3).addScaledVector(DW, -0.5).addScaledVector(UPW, 0.2), DW);
      }
      standLegs(P); gear('dumbbell', { axis: { L: DW, R: DW } });
    },
    view: () => V(0, 1.2, 0), standing: true,
  },
  french_incline: {
    build(g) { inclineEq(g, V(0.22, 0.5, 0), Math.PI / 6); },
    pose(u, R) {
      torso(V(0.22, 0.5, 0), -60);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const Sh = sh(s), dirU = nrm([UPW, 1], [BACKW, 0.22], [ZW, -k * 0.12]);
        const E0 = Sh.clone().addScaledVector(dirU, UPPER - 0.004);
        const G = E0.clone().addScaledVector(slerpDir(nrm([BACKW, 0.8], [DOWNW, 0.6]), dirU, u), FORE - 0.004); G.z = k * 0.1;
        arm(s, G, Sh.clone().addScaledVector(UPW, 1).addScaledVector(DW, 0.4));
      }
      seatedLegs(V(0.22, 0.5, 0), 0.5, 0.3); gear('ez');
    },
    view: () => V(-0.05, 0.9, 0),
  },
  pushdown: {
    build(g) { tower(g, 0.62, 0, 2.25); pulley(g, V(0.5, 2.1, 0)); },
    pose(u, R) {
      const P = V(0, STAND_Y, 0); torso(P, 8);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const G = curlArm(s, nrm([DOWNW, 1], [DW, 0.08], [ZW, -k * 0.05]), nrm([DW, 0.75], [UPW, 0.6]), nrm([DOWNW, 1], [DW, 0.2]), u, ZW, V(-0.8, 0, k * 0.1));
      }
      standLegs(P); gear('handle', { cable: V(0.5, 2.1, 0) });
    },
    view: () => V(0.1, 1.2, 0), standing: true, camPhoto: V(0.9, 0.45, -3.0),
  },
  pullup: {
    build(g) { for (const s of [1, -1]) cyl(g, 0.035, V(-0.02, 0, s * 0.62), V(-0.02, 2.42, s * 0.62), M.frame); cyl(g, 0.018, V(0, 2.3, -0.66), V(0, 2.3, 0.66), M.steel); bx(g, 0.5, 0.04, 1.3, M.frame, V(-0.02, 0.02, 0)); },
    pose(u, R) {
      const P = lerpV(V(-0.035, 1.12, 0), V(-0.07, 1.48, 0), u); torso(P, lerpV(V(0), V(-12), u).x);
      for (const [s, k] of [['L', 1], ['R', -1]]) { const Sh = sh(s); arm(s, V(0, 2.3, k * 0.42), Sh.clone().addScaledVector(outw(s), 0.5).addScaledVector(DOWNW, 0.6).addScaledVector(DW, 0.15)); }
      for (const [s, k] of [['L', 1], ['R', -1]]) { const H = hip(s); leg(s, H.clone().add(V(-0.28, -0.76, k * 0.02)), H.clone().add(V(1, -0.2, k * 0.1)), nrm([DOWNW, 0.8], [BACKW, 0.3])); }
      gear('none');
    },
    view: () => V(0, 1.75, 0), standing: true,
  },
  lat_wide: pulldown(0.45, 'wideBar', u => [V(0.05, 0.5, 0), V(0.13, 0.02, 0)], [DOWNW, 1, BACKW, 0.3]),
  lat_close_rev: pulldown(0.15, 'handle', u => [V(0.05, 0.55, 0), V(0.16, -0.06, 0)], [DOWNW, 1, DW, 0.35]),
  row_cable: {
    build(g) {
      padAt(g, V(0.02, 0.42, 0), DW, UPW, 0.9, 0.3); bx(g, 1.5, 0.05, 0.12, M.frame, V(0.3, 0.2, 0)); legsTo(g, V(-0.35, 0.38, 0)); legsTo(g, V(0.38, 0.38, 0));
      padAt(g, V(0.8, 0.25, 0), UPW, BACKW, 0.32, 0.42, 0.04); tower(g, 1.12, 0, 0.9); pulley(g, V(0.98, 0.3, 0));
    },
    pose(u, R) {
      const P = V(0.02, 0.51, 0); torso(P, lerpV(V(14), V(-4), u).x);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const Sh = sh(s), A = V(Sh.x + 0.56, Sh.y - 0.12, k * 0.06), B = V(Sh.x + 0.14, Sh.y - 0.33, k * 0.06);
        arm(s, bez(A, V(Sh.x + 0.3, Sh.y - 0.3, k * 0.06), B, u), Sh.clone().add(V(-0.8, -0.2, k * 0.25)));
      }
      for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(0.78, 0.26, k * 0.12), V(0.6, 1.2, k * 0.3), null, V(0.8, 0.42, k * 0.13));
      gear('vHandle', { cable: V(0.98, 0.3, 0) });
    },
    view: () => V(0.25, 0.75, 0),
  },
  db_row: {
    build(g) { bx(g, 1.2, 0.07, 0.3, M.pad, V(0.1, 0.445, -0.16)); for (const x of [-0.4, 0.55]) { cyl(g, 0.025, V(x, 0.41, -0.16), V(x, 0.02, -0.16), M.frame); bx(g, 0.06, 0.04, 0.5, M.frame, V(x, 0.02, -0.16)); } },
    pose(u, R) {
      const P = V(-0.08, 0.86, 0.02); torso(P, 76);
      const SR = sh('R'); arm('R', V(SR.x + 0.02, 0.49, -0.19), SR.clone().add(V(-0.3, 0, -0.4)));
      const SL = sh('L'), A = SL.clone().add(V(0.03, -0.53, 0.02)), B = SL.clone().add(V(-0.24, -0.18, 0.0));
      arm('L', bez(A, SL.clone().add(V(-0.08, -0.46, 0.02)), B, u), SL.clone().add(V(-0.6, 1, 0.15)), DW);
      const HR = hip('R'); leg('R', V(HR.x - 0.42, 0.53, -0.14), HR.clone().add(V(0, -1, 0)), null, V(HR.x - 0.6, 0.49, -0.14));
      leg('L', V(P.x + 0.08, 0.085, 0.36), P.clone().add(V(1, 0, 0.3)), nrm([DW, 1], [ZW, 0.2]));
      gear('dumbbell', { sides: ['L'], axis: { L: DW } });
    },
    view: () => V(0.1, 0.8, 0), camPhoto: V(1.2, 0.8, 2.4),
  },
  rear_delt: {
    build(g) {
      padAt(g, V(0.0, 0.83, 0), nrm([DW, 1], [UPW, 1]), nrm([BACKW, 1], [UPW, 1]), 0.75, 0.3); cyl(g, 0.03, V(-0.05, 0.6, 0), V(-0.05, 0.02, 0), M.frame); bx(g, 0.8, 0.04, 0.06, M.frame, V(-0.05, 0.02, 0)); bx(g, 0.06, 0.04, 0.5, M.frame, V(-0.4, 0.02, 0)); },
    pose(u, R) {
      const P = V(-0.2, 0.74, 0); torso(P, 45);
      for (const s of ['L', 'R']) {
        const o = outw(s), Sh = sh(s);
        const d = slerpDir(nrm([DOWNW, 1], [DW, 0.1], [o, 0.12]), nrm([o, 1], [DOWNW, 0.25], [DW, 0.05]), u);
        arm(s, Sh.clone().addScaledVector(d, 0.53), Sh.clone().addScaledVector(UPW, 0.8).addScaledVector(o, 0.2), DW);
      }
      for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(P.x - 0.42, 0.085, k * 0.16), P.clone().add(V(1, -0.3, k * 0.2)), nrm([DW, 1], [ZW, k * 0.2]));
      gear('dumbbell', { axis: { L: DW, R: DW } });
    },
    view: () => V(0.0, 0.9, 0),
  },
  incline_curl: {
    build(g) { inclineEq(g, V(0.2, 0.52, 0), Math.PI * 0.29); },
    pose(u, R) {
      torso(V(0.2, 0.52, 0), -40);
      for (const [s, k] of [['L', 1], ['R', -1]]) curlArm(s, nrm([DOWNW, 1], [BACKW, 0.08], [ZW, k * 0.05]), DOWNW, nrm([UPW, 0.75], [DW, 0.66]), u, ZW, V(-1, -0.2, k * 0.2));
      seatedLegs(V(0.2, 0.52, 0), 0.5, 0.3); gear('dumbbell');
    },
    view: () => V(0.05, 0.85, 0),
  },
  hammer: standingCurl('dumbbell', 'neutral'),
  bb_curl: standingCurl('barbell', 'bar'),
  cable_curl: Object.assign(standingCurl('handle', 'bar', V(0.62, 0.15, 0)), { camPhoto: V(0.9, 0.45, -3.0) }),
  cross_hammer: {
    build() {},
    pose(u, R) {
      const P = V(0, STAND_Y, 0); torso(P, 2);
      curlArm('L', nrm([DOWNW, 1], [DW, 0.06]), DOWNW, nrm([UPW, 0.62], [DW, 0.45], [ZW, -0.62]), u, null, V(-0.8, 0, 0.2));
      const E = RIG.J.E.L, fa = V().subVectors(RIG.J.W.L, E).normalize();
      curlArm('R', nrm([DOWNW, 1], [DW, 0.06]), DOWNW, DOWNW, 0, null, V(-0.8, 0, -0.2));
      arm('L', RIG.J.W.L, sh('L').add(V(-0.8, 0, 0.2)), V().crossVectors(ZW, fa).normalize());
      const faR = V().subVectors(RIG.J.W.R, RIG.J.E.R).normalize(); arm('R', RIG.J.W.R, sh('R').add(V(-0.8, 0, -0.2)), V().crossVectors(ZW, faR).normalize());
      standLegs(P); gear('dumbbell', { axis: { L: V().crossVectors(ZW, fa).normalize(), R: V().crossVectors(ZW, faR).normalize() } });
    },
    view: () => V(0, 1.2, 0), standing: true,
  },
  fly: {
    build(g) {
      padAt(g, V(0.0, 0.47, 0), DW, UPW, 0.38, 0.36); padAt(g, V(-0.12, 0.95, 0), UPW, DW, 0.62, 0.3); bx(g, 0.08, 1.9, 0.08, M.frame, V(-0.22, 0.95, 0)); bx(g, 0.6, 0.04, 0.6, M.frame, V(-0.05, 0.02, 0));
      cyl(g, 0.03, V(0.0, 0.4, 0), V(0.0, 0.02, 0), M.frame); bx(g, 0.1, 0.06, 0.9, M.frame, V(-0.18, 1.62, 0));
    },
    pose(u, R) {
      const P = V(-0.02, 0.585, 0); torso(P, -4);
      for (const s of ['L', 'R']) {
        const o = outw(s), Sh = sh(s), d = slerpDir(nrm([o, 1], [DW, 0.22]), nrm([DW, 1], [o, 0.14]), u);
        arm(s, Sh.clone().addScaledVector(d, 0.53).addScaledVector(DOWNW, 0.02), Sh.clone().addScaledVector(BACKW, 0.5).addScaledVector(DOWNW, 0.4), UPW);
      }
      seatedLegs(P, 0.42, 0.22); gear('none');
      R.deck = true;
    },
    move(R, g) {
      if (!g.userData.arms) { g.userData.arms = ['L', 'R'].map(() => { const a = new THREE.Group(); g.add(a); cyl(a, 0.02, V(0, 0, 0), V(0, -0.4, 0), M.frame); cyl(a, 0.03, V(0, -0.4, 0), V(0, -0.62, 0), M.pad); return a; }); }
      ['L', 'R'].forEach((s, i) => { const W = RIG.J.W[s], a = g.userData.arms[i]; a.position.copy(W).add(V(0, 0.51, 0)); });
    },
    view: () => V(0, 1.0, 0), standing: true,
  },
  leg_press: {
    build(g) {
      const n = nrm([DW, 0.7], [UPW, 0.7]);
      padAt(g, V(-0.02, 0.43, 0), DW, UPW, 0.42, 0.42); padAt(g, V(-0.28, 0.62, 0), nrm([BACKW, 0.57], [UPW, 0.82]), nrm([DW, 0.82], [UPW, 0.57]), 0.6, 0.42);
      for (const s of [1, -1]) cyl(g, 0.03, V(0.2, 0.3, s * 0.32), V(0.2, 0.3, s * 0.32).addScaledVector(n, 1.5), M.frame);
      bx(g, 1.8, 0.05, 0.8, M.frame, V(0.45, 0.025, 0)); cyl(g, 0.04, V(-0.05, 0.37, 0), V(-0.05, 0.02, 0), M.frame);
      for (const s of [1, -1]) cyl(g, 0.016, V(0.05, 0.4, s * 0.27), V(0.18, 0.4, s * 0.27), M.dark);
    },
    pose(u, R) {
      const P = V(0.0, 0.5, 0); torso(P, -55);
      const n = nrm([DW, 0.7], [UPW, 0.7]), dist = 0.5 + 0.34 * u, toeDir = nrm([BACKW, 0.7], [UPW, 0.7]);
      R.sled = P.clone().addScaledVector(n, dist + 0.06);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const A = P.clone().addScaledVector(n, dist).add(V(0, 0, k * 0.15));
        leg(s, A, P.clone().addScaledVector(n, 0.5).add(V(-0.3, 0.7, k * 0.25)), toeDir);
        arm(s, V(0.12, 0.4, k * 0.27), sh(s).add(V(0, -0.5, k * 0.5)));
      }
      gear('none');
    },
    move(R, g) {
      if (!g.userData.sled) { const n = nrm([DW, 0.7], [UPW, 0.7]); g.userData.sled = padAt(g, V(), V(0, 0, 1), n.clone().negate(), 0.6, 0.5, 0.05); g.userData.sled.material = M.frame; g.userData.base = g.userData.sled.quaternion.clone(); }
      g.userData.sled.position.copy(R.sled);
    },
    view: () => V(0.25, 0.8, 0), camPhoto: V(0.5, 0.7, -2.7),
  },
  leg_curl: {
    build(g) { padAt(g, V(0.15, 0.5, 0), DW, UPW, 1.1, 0.34); for (const x of [-0.3, 0.6]) { cyl(g, 0.03, V(x, 0.43, 0), V(x, 0.02, 0), M.frame); bx(g, 0.06, 0.04, 0.5, M.frame, V(x, 0.02, 0)); } for (const s of [1, -1]) cyl(g, 0.016, V(0.72, 0.42, s * 0.2), V(0.72, 0.55, s * 0.2), M.dark); },
    pose(u, R) {
      const P = V(0.0, 0.61, 0); torso(P, 90);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const K0 = V(-0.445, 0.56, k * 0.1), d = slerpDir(BACKW, nrm([UPW, 0.92], [DW, 0.38]), u), A = K0.clone().addScaledVector(d, SHIN - 0.003);
        leg(s, A, K0.clone().add(V(0, -1, 0)), V().crossVectors(ZW, d).normalize());
        arm(s, V(0.72, 0.52, k * 0.2), sh(s).add(V(0, 0.5, k * 0.4)), UPW);
      }
      gear('none');
    },
    move(R, g) { roller(g, ['L', 'R'].map(s => RIG.J.A[s].clone().addScaledVector(V().crossVectors(V().subVectors(RIG.J.A[s], RIG.J.K[s]).normalize(), ZW).normalize(), -0.06))); },
    view: () => V(0.0, 0.6, 0),
  },
  leg_ext: {
    build(g) { padAt(g, V(0.0, 0.5, 0), DW, UPW, 0.42, 0.4); padAt(g, V(-0.16, 0.85, 0), UPW, DW, 0.62, 0.36); cyl(g, 0.04, V(0, 0.43, 0), V(0, 0.02, 0), M.frame); bx(g, 0.6, 0.04, 0.6, M.frame, V(0, 0.02, 0)); for (const s of [1, -1]) cyl(g, 0.016, V(0.0, 0.5, s * 0.25), V(0.15, 0.5, s * 0.25), M.dark); },
    pose(u, R) {
      const P = V(0.0, 0.6, 0); torso(P, -8);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const K0 = V(0.44, 0.585, k * 0.11), d = slerpDir(nrm([DOWNW, 1], [BACKW, 0.12]), nrm([DW, 1], [UPW, 0.1]), u), A = K0.clone().addScaledVector(d, SHIN - 0.003);
        leg(s, A, K0.clone().add(V(0, 1, 0)), V().crossVectors(ZW, d).normalize());
        arm(s, V(0.12, 0.5, k * 0.25), sh(s).add(V(0, -0.5, k * 0.4)));
      }
      gear('none');
    },
    move(R, g) { roller(g, ['L', 'R'].map(s => RIG.J.A[s].clone().addScaledVector(V().crossVectors(ZW, V().subVectors(RIG.J.A[s], RIG.J.K[s]).normalize()).normalize(), 0.06))); },
    view: () => V(0.2, 0.75, 0),
  },
  calf: {
    build(g) { bx(g, 0.32, 0.15, 0.7, M.pad, V(-0.04, 0.075, 0)); cyl(g, 0.03, V(0.45, 0, 0.32), V(0.45, 1.15, 0.32), M.frame); cyl(g, 0.03, V(0.45, 0, -0.32), V(0.45, 1.15, -0.32), M.frame); cyl(g, 0.02, V(0.45, 1.1, -0.34), V(0.45, 1.1, 0.34), M.steel); },
    pose(u, R) {
      const ay = 0.185 + 0.14 * u, P = V(-0.03 - 0.02 * u, ay + 0.83, 0); torso(P, 3);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        leg(s, V(-0.06 + 0.02 * u, ay, k * 0.12), P.clone().add(V(1, 0, k * 0.2)), null, V(0.11, 0.165, k * 0.13));
        arm(s, V(0.45, 1.1, k * 0.24), sh(s).add(V(-0.3, -0.6, k * 0.4)));
      }
      gear('none');
    },
    view: () => V(0.0, 1.0, 0), standing: true,
  },
  overhead_ext: {
    build(g) { tower(g, -0.7, 0, 2.2); pulley(g, V(-0.58, 0.45, 0)); },
    pose(u, R) {
      const P = V(0, 0.92, 0); torso(P, 18);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const dirU = nrm([UPW, 0.86], [DW, 0.5], [ZW, -k * 0.08]);
        curlArm(s, dirU, nrm([BACKW, 0.6], [DOWNW, 0.8]), dirU, u, ZW, V(0.4, 1, k * 0.15));
        RIG.J.W[s].z = k * 0.07; arm(s, RIG.J.W[s], sh(s).add(V(0.4, 1, k * 0.15)));
      }
      leg('L', V(0.32, 0.085, 0.15), V(1.2, 1, 0.3), nrm([DW, 1], [ZW, 0.2])); leg('R', V(-0.36, 0.11, -0.15), V(1, 0.6, -0.3), null, V(-0.24, 0.02, -0.17));
      gear('rope', { cable: V(-0.58, 0.45, 0) });
    },
    view: () => V(0, 1.3, 0), standing: true,
  },
  shrug: {
    build() {},
    pose(u, R) {
      const P = V(0, STAND_Y, 0); torso(P, 2, 0.065 * u);
      for (const s of ['L', 'R']) { const Sh = sh(s); arm(s, Sh.clone().addScaledVector(DOWNW, 0.56).addScaledVector(outw(s), 0.06).addScaledVector(DW, 0.02), Sh.clone().add(V(-1, 0, 0)), DW); }
      standLegs(P); gear('dumbbell', { axis: { L: DW, R: DW } });
    },
    view: () => V(0, 1.3, 0), standing: true,
  },
  preacher: {
    build(g) {
      padAt(g, V(-0.02, 0.6, 0), DW, UPW, 0.36, 0.34); cyl(g, 0.04, V(0, 0.55, 0), V(0, 0.02, 0), M.frame); bx(g, 0.7, 0.04, 0.6, M.frame, V(0.15, 0.02, 0));
      padAt(g, V(0.36, 0.98, 0), nrm([DW, 0.75], [DOWNW, 0.66]), nrm([BACKW, 0.66], [UPW, 0.75]), 0.4, 0.44); cyl(g, 0.035, V(0.4, 0.85, 0), V(0.4, 0.02, 0), M.frame);
    },
    pose(u, R) {
      const P = V(-0.02, 0.69, 0); torso(P, 12);
      for (const [s, k] of [['L', 1], ['R', -1]]) curlArm(s, nrm([DW, 0.75], [DOWNW, 0.66], [ZW, -k * 0.02]), nrm([DW, 0.8], [DOWNW, 0.55]), nrm([UPW, 0.9], [BACKW, 0.3]), u, ZW, V(0.6, -0.9, k * 0.1));
      RIG.J.W.L.z = 0.13; RIG.J.W.R.z = -0.13; for (const [s, k] of [['L', 1], ['R', -1]]) arm(s, RIG.J.W[s], sh(s).add(V(0.6, -0.9, k * 0.1)));
      seatedLegs(P, 0.38, 0.2); gear('ez');
    },
    view: () => V(0.15, 0.95, 0),
  },
};
function pulldown(grip, type, ends, pole) {
  return {
    build(g) {
      padAt(g, V(0, 0.48, 0), DW, UPW, 0.42, 0.42); cyl(g, 0.045, V(0, 0.44, 0), V(0, 0.02, 0), M.frame);
      bx(g, 0.08, 0.12, 0.62, M.pad, V(0.42, 0.72, 0)); cyl(g, 0.03, V(0.42, 0.66, 0), V(0.42, 0.02, 0), M.frame);
      bx(g, 0.24, 2.45, 0.24, M.frame, V(-0.55, 1.225, 0)); bx(g, 0.8, 0.08, 0.1, M.frame, V(-0.2, 2.42, 0)); pulley(g, V(0.12, 2.36, 0)); bx(g, 1.1, 0.04, 0.7, M.frame, V(-0.1, 0.02, 0));
    },
    pose(u, R) {
      const P = V(0, 0.57, 0); torso(P, -12);
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        const Sh = sh(s), [a, b] = ends(u), A = V(Sh.x + a.x, Sh.y + a.y, k * grip), B = V(Sh.x + b.x, Sh.y + b.y, k * grip);
        arm(s, bez(A, V(Sh.x + b.x + 0.05, Sh.y + (a.y + b.y) / 2, k * grip), B, u), Sh.clone().addScaledVector(pole[0], pole[1]).addScaledVector(pole[2], pole[3]).addScaledVector(outw(s), 0.3));
      }
      for (const [s, k] of [['L', 1], ['R', -1]]) leg(s, V(0.5, 0.085, k * 0.16), V(1.2, 1.2, k * 0.2), nrm([DW, 1], [ZW, k * 0.2]));
      gear(type, { cable: V(0.12, 2.36, 0) });
    },
    view: () => V(0.05, 1.15, 0),
  };
}
function standingCurl(gearType, grip, cableAt) {
  return {
    build(g) { if (cableAt) { tower(g, cableAt.x + 0.12, 0, 1.6); pulley(g, cableAt); } },
    pose(u, R) {
      const P = V(0, STAND_Y, 0); torso(P, 2);
      const axes = {};
      for (const [s, k] of [['L', 1], ['R', -1]]) {
        curlArm(s, nrm([DOWNW, 1], [DW, 0.06]), nrm([DOWNW, 1], [DW, 0.05]), nrm([UPW, 0.72], [DW, 0.69]), u, ZW, V(-0.8, 0, k * 0.2));
        if (grip === 'bar') { RIG.J.W[s].z = k * 0.2; arm(s, RIG.J.W[s], sh(s).add(V(-0.8, 0, k * 0.2))); }
        const fa = V().subVectors(RIG.J.W[s], RIG.J.E[s]).normalize(); axes[s] = grip === 'neutral' ? V().crossVectors(ZW, fa).normalize() : ZW;
        if (grip === 'neutral') arm(s, RIG.J.W[s], sh(s).add(V(-0.8, 0, k * 0.2)), axes[s]);
      }
      standLegs(P); gear(gearType, { axis: axes, cable: cableAt });
    },
    view: () => V(0, 1.2, 0), standing: true,
  };
}
function roller(g, pts) {
  if (!g.userData.rollers) g.userData.rollers = pts.map(() => { const m = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 20), M.pad, g); m.rotation.x = Math.PI / 2; return m; });
  const c = pts[0].clone().add(pts[1]).multiplyScalar(0.5); g.userData.rollers.forEach((m, i) => { m.position.copy(c); m.position.z = i ? -0.1 : 0.1; });
}

// ---------- переключение и кадр ----------
const EQ_GROUPS = {};
export function activate(id) {
  for (const g of Object.values(EQ_GROUPS)) g.visible = false;
  const def = EX3D[id];
  if (!EQ_GROUPS[id]) { const g = G0(); EQ_GROUPS[id] = g; def.pose(0.5, {}); def.build(g); }
  EQ_GROUPS[id].visible = true;
}
export function highlight(prim, sec) {
  for (const m of MUS) { const g = m.userData.grp; m.material = prim.includes(g) ? M.prim : sec.includes(g) ? M.sec : m.userData.base; }
}
export function frame(id, u, effort) {
  const def = EX3D[id], R = {};
  def.pose(u, R);
  if (def.move) def.move(R, EQ_GROUPS[id]);
  M.prim.emissiveIntensity = 0.06 + 0.32 * effort;
  M.prim.color.setRGB(0.62 + 0.22 * effort, 0.16 + 0.04 * (1 - effort), 0.18);
  return R;
}
export { V, ease };
