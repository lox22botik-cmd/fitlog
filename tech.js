'use strict';
// Анимация техники: 2D-фигура по позам из tech-data.js, работающие мышцы подсвечены на фигуре и на карте тела.

const TL = { t: 64, u: 36, f: 32, th: 44, sh: 42, ft: 16, head: 17, hr: 11 };
const FLOOR = 240;
const C = { near: '#d6dde6', far: '#6b7685', torso: '#c3ccd8', prim: '#ef4444', sec: '#f59e0b', eq: '#5b6573', eqLight: '#8a94a3', base: '#232831', mus: '#2f3640' };
const rad = a => a * Math.PI / 180;
const vec = (a, l) => [l * Math.sin(rad(a)), l * Math.cos(rad(a))];
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const ln = (a, b, w, col, op) => '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"' + (op ? ' opacity="' + op + '"' : '') + '/>';
const circ = (p, r, fill, stroke) => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="2"' : '') + '/>';

// Какие сегменты фигуры подсветить по мышцам
const SEG_OF = { chest: 'torso', abs: 'torso', lats: 'torso', rhomboids: 'torso', lower_back: 'torso', traps: 'torso',
  front_delt: 'upper', side_delt: 'upper', rear_delt: 'upper', triceps: 'upper', biceps: 'upper',
  forearm: 'fore', quads: 'thigh', hamstrings: 'thigh', glutes: 'thigh', adductors: 'thigh', calves: 'shin' };
function segColor(ex, seg) {
  if (ex.prim.some(m => SEG_OF[m] === seg)) return C.prim;
  if (ex.sec.some(m => SEG_OF[m] === seg)) return C.sec;
  return null;
}

function lerpPose(A, B, u) {
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k] != null ? A[k] : B[k], b = B[k] != null ? B[k] : A[k];
    out[k] = a + (b - a) * u;
  }
  return out;
}

// ---------- вид сбоку ----------
function solveSide(p, anchor) {
  const P = [p.px, p.py], td = [Math.sin(rad(p.t)), -Math.cos(rad(p.t))];
  const S = add(P, td, TL.t), H = add(S, td, TL.head), Se = [S[0], S[1] - (p.el || 0)];
  const pts = { P, S, H, Se };
  pts.E = add(Se, vec(p.ua, TL.u)); pts.W = add(pts.E, vec(p.fa, TL.f));
  pts.K = add(P, vec(p.th, TL.th)); pts.A = add(pts.K, vec(p.sh, TL.sh)); pts.T = add(pts.A, vec(p.ft != null ? p.ft : 90, TL.ft));
  const o = [-3, -3];
  pts.E2 = add(add(Se, vec(p.ua2 != null ? p.ua2 : p.ua, TL.u)), o); pts.Se2 = add(Se, o);
  pts.W2 = add(pts.E2, vec(p.fa2 != null ? p.fa2 : p.fa, TL.f));
  pts.P2 = add(P, o); pts.K2 = add(pts.P2, vec(p.th2 != null ? p.th2 : p.th, TL.th));
  pts.A2 = add(pts.K2, vec(p.sh2 != null ? p.sh2 : p.sh, TL.sh)); pts.T2 = add(pts.A2, vec(p.ft2 != null ? p.ft2 : (p.ft != null ? p.ft : 90), TL.ft));
  if (anchor) {
    const d = [anchor.x - pts[anchor.pt][0], anchor.y - pts[anchor.pt][1]];
    for (const k in pts) pts[k] = add(pts[k], d);
  }
  return pts;
}
function gearAt(g, W) {
  if (g === 'barbell') return circ(W, 18, '#2b3038', C.eqLight) + circ(W, 3, C.eqLight);
  if (g === 'ez') return circ(W, 12, '#2b3038', C.eqLight) + circ(W, 3, C.eqLight);
  if (g === 'dumbbell') return circ(W, 8, '#2b3038', C.eqLight);
  if (g === 'handle' || g === 'rope' || g === 'wideBar' || g === 'vHandle') return '<rect x="' + (W[0] - 6) + '" y="' + (W[1] - 3) + '" width="12" height="6" rx="3" fill="' + C.eqLight + '"/>';
  return '';
}
function padAlong(a, b, side, off, w) {
  const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1, n = [d[1] / L * side, -d[0] / L * side];
  return ln(add(a, n, off), add(b, n, off), w, C.eq);
}
function cable(from, W) { return ln(from, W, 2, C.eqLight) + circ(from, 6, '#2b3038', C.eqLight); }
const EQ = {
  flatBench: q => ln([108, 188], [222, 188], 9, C.eq) + ln([118, 192], [118, FLOOR], 5, C.eq) + ln([210, 192], [210, FLOOR], 5, C.eq) + ln([126, FLOOR], [126, 92], 4, C.eq) + ln([118, 96], [134, 96], 4, C.eq),
  inclineBench: q => padAlong(q.P, add(q.S, [0, 0]), 1, 15, 10) + ln(add(q.P, [-8, 16]), add(q.P, [34, 16]), 9, C.eq) + ln(add(q.P, [10, 20]), [q.P[0] + 10, FLOOR], 5, C.eq),
  curlBench: q => EQ.inclineBench(q),
  pullBar: q => ln([92, 14], [208, 14], 5, C.eqLight) + ln([96, 14], [96, FLOOR], 4, C.eq) + ln([204, 14], [204, FLOOR], 4, C.eq),
  cableHigh: q => '<rect x="214" y="16" width="22" height="' + (FLOOR - 16) + '" rx="3" fill="#1c2128" stroke="' + C.eq + '"/>' + cable([206, 22], q.W),
  cableLow: q => '<rect x="62" y="' + (q.P[1] + 12) + '" width="84" height="' + (FLOOR - q.P[1] - 12) + '" rx="3" fill="' + C.eq + '"/>' + ln([206, 186], [206, 232], 6, C.eq) + '<rect x="226" y="60" width="20" height="' + (FLOOR - 60) + '" rx="3" fill="#1c2128" stroke="' + C.eq + '"/>' + cable([222, 176], q.W),
  cableLowFront: q => '<rect x="212" y="40" width="22" height="' + (FLOOR - 40) + '" rx="3" fill="#1c2128" stroke="' + C.eq + '"/>' + cable([206, 232], q.W),
  cableBehind: q => '<rect x="74" y="40" width="22" height="' + (FLOOR - 40) + '" rx="3" fill="#1c2128" stroke="' + C.eq + '"/>' + cable([104, 232], q.W),
  pulldown: q => '<rect x="112" y="' + (q.P[1] + 12) + '" width="76" height="' + (FLOOR - q.P[1] - 12) + '" rx="3" fill="' + C.eq + '"/>' + ln([96, 8], [96, FLOOR], 5, C.eq) + ln([96, 8], [160, 8], 5, C.eq) + circ(add(q.K, [0, -14]), 7, C.eq) + cable([152, 10], q.W),
  rowBench: q => ln([58, 200], [208, 200], 9, C.eq) + ln([70, 204], [70, FLOOR], 5, C.eq) + ln([196, 204], [196, FLOOR], 5, C.eq),
  legPress: q => padAlong(q.P, q.S, 1, 15, 10) + ln(add(q.P, [-6, 16]), add(q.P, [26, 16]), 9, C.eq) + ln([150, 232], [262, 120], 3, C.eq) +
    (() => { const m = [(q.A[0] + q.T[0]) / 2, (q.A[1] + q.T[1]) / 2]; return ln(add(m, [-14, -14]), add(m, [16, 16]), 8, C.eqLight); })(),
  curlMachine: q => ln([62, 184], [236, 184], 9, C.eq) + ln([78, 188], [78, FLOOR], 5, C.eq) + ln([222, 188], [222, FLOOR], 5, C.eq) + circ(add(q.A, [2, -9]), 7, C.eqLight),
  extMachine: q => ln([108, 194], [184, 194], 9, C.eq) + padAlong(q.P, q.S, 1, 15, 10) + ln([140, 198], [140, FLOOR], 5, C.eq) + circ(add(q.A, vec(94, 9)), 7, C.eqLight),
  calfStep: q => '<rect x="158" y="' + q.T[1] + '" width="48" height="' + (FLOOR - q.T[1]) + '" rx="3" fill="' + C.eq + '"/>',
  preacher: q => padAlong(q.Se, q.E, -1, 9, 8) + ln([q.E[0] - 6, q.E[1] + 14], [q.E[0] - 6, FLOOR], 5, C.eq) + '<rect x="96" y="' + (q.P[1] + 12) + '" width="70" height="' + (FLOOR - q.P[1] - 12) + '" rx="3" fill="' + C.eq + '"/>',
};
function drawSide(ex, p) {
  const q = solveSide(p, ex.anchor);
  const col = seg => segColor(ex, seg);
  let g = '';
  // дальние конечности
  g += ln(q.P2, q.K2, 15, C.far) + ln(q.K2, q.A2, 12, C.far) + ln(q.A2, q.T2, 7, C.far);
  g += ln(q.Se2, q.E2, 11, C.far) + ln(q.E2, q.W2, 9, C.far);
  if (ex.eq && EQ[ex.eq]) g += EQ[ex.eq](q);
  // корпус и голова
  g += ln(q.P, q.S, 24, C.torso); if (col('torso')) g += ln(q.P, q.S, 14, col('torso'), 0.9);
  g += ln(q.S, add(q.S, [q.H[0] - q.S[0], q.H[1] - q.S[1]], 0.45), 8, C.torso) + circ(q.H, TL.hr, C.near);
  // ближние ноги и руки
  g += ln(q.P, q.K, 16, C.near) + (col('thigh') ? ln(q.P, q.K, 9, col('thigh'), 0.9) : '');
  g += ln(q.K, q.A, 12, C.near) + (col('shin') ? ln(q.K, q.A, 7, col('shin'), 0.9) : '') + ln(q.A, q.T, 7, C.near);
  g += ln(q.Se, q.E, 12, C.near) + (col('upper') ? ln(q.Se, q.E, 7, col('upper'), 0.9) : '');
  g += ln(q.E, q.W, 10, C.near) + (col('fore') ? ln(q.E, q.W, 6, col('fore'), 0.9) : '');
  g += gearAt(ex.gear, q.W);
  return g;
}

// ---------- вид спереди ----------
function drawFront(ex, p) {
  const cx = 150, sy = 82, py = 150, hw = 22, col = seg => segColor(ex, seg);
  let g = '';
  if (ex.gear === 'machinePad') g += '<rect x="112" y="60" width="76" height="110" rx="10" fill="' + C.eq + '"/>' + ln([150, 170], [150, FLOOR], 6, C.eq);
  g += ln([cx - 10, py], [cx - 14, FLOOR - 4], 15, C.near) + ln([cx + 10, py], [cx + 14, FLOOR - 4], 15, C.near);
  if (col('thigh')) g += ln([cx - 10, py], [cx - 12, py + 44], 8, col('thigh'), 0.9) + ln([cx + 10, py], [cx + 12, py + 44], 8, col('thigh'), 0.9);
  g += '<rect x="' + (cx - hw) + '" y="' + (sy - 6) + '" width="' + hw * 2 + '" height="' + (py - sy + 12) + '" rx="12" fill="' + C.torso + '"/>';
  if (col('torso')) g += '<rect x="' + (cx - hw + 7) + '" y="' + (sy + 2) + '" width="' + (hw * 2 - 14) + '" height="40" rx="8" fill="' + col('torso') + '" opacity="0.9"/>';
  g += ln([cx, sy - 8], [cx, sy - 16], 9, C.torso) + circ([cx, sy - 28], TL.hr, C.near);
  for (const s of [1, -1]) {
    const Sh = [cx + s * hw, sy], k = p.k != null ? p.k : 1;
    const v = vec(p.a, TL.u * k), E = [Sh[0] + s * v[0], Sh[1] + v[1]];
    const v2 = vec(p.f, TL.f), W = [E[0] + s * v2[0], E[1] + v2[1]];
    g += circ(Sh, 9, col('upper') || C.near);
    g += ln(Sh, E, 12, C.near) + (col('upper') ? ln(Sh, E, 7, col('upper'), 0.9) : '') + ln(E, W, 10, C.near) + (col('fore') ? ln(E, W, 6, col('fore'), 0.9) : '');
    g += ex.gear === 'machinePad' ? ln(add(E, [0, 6]), add(W, [0, -4]), 6, C.eqLight) : gearAt(ex.gear, W);
  }
  return g;
}

// ---------- карта мышц ----------
// Одна половина тела (правая на картинке), вторая — зеркально. Ширина фигуры 120, центр x=60.
const MAP_FRONT = {
  traps: 'M64,38 L80,46 L66,48 Z',
  front_delt: 'M76,46 Q92,46 94,60 Q90,66 82,64 Q76,56 76,46 Z',
  chest: 'M61,50 Q78,46 84,58 Q83,72 66,76 Q61,66 61,50 Z',
  biceps: 'M85,66 Q95,70 95,86 Q93,98 88,98 Q83,90 84,72 Z',
  forearm: 'M88,102 Q98,104 99,118 Q98,134 94,138 Q88,130 87,112 Z',
  abs: 'M61,80 L70,80 L70,124 Q64,126 61,124 Z',
  quads: 'M62,132 Q78,128 82,142 Q82,178 73,196 Q65,190 63,170 Z',
  adductors: 'M60.5,134 L63,134 Q64,160 63,168 L60.5,168 Z',
  calves: 'M66,206 Q74,204 76,218 Q76,236 70,242 Q65,230 66,206 Z',
};
const MAP_BACK = {
  traps: 'M60.5,36 L78,46 L68,72 L60.5,80 Z',
  rear_delt: 'M78,46 Q92,46 94,60 Q90,66 82,64 Q76,56 78,46 Z',
  rhomboids: 'M62,50 L70,56 L70,74 L62,80 Z',
  lats: 'M68,74 Q86,62 86,74 Q82,98 66,112 L64,90 Z',
  triceps: 'M85,66 Q95,70 95,86 Q93,98 88,98 Q83,90 84,72 Z',
  forearm: 'M88,102 Q98,104 99,118 Q98,134 94,138 Q88,130 87,112 Z',
  lower_back: 'M61,96 L67,96 L67,122 L61,122 Z',
  glutes: 'M61,124 Q80,118 82,138 Q78,152 62,150 Z',
  hamstrings: 'M62,154 Q78,150 80,162 Q80,190 72,198 Q64,192 62,175 Z',
  calves: 'M64,204 Q76,200 77,216 Q76,234 70,240 Q63,228 64,204 Z',
};
const BASE_BODY = '<circle cx="60" cy="22" r="13"/><rect x="54" y="32" width="12" height="10"/>' +
  '<path d="M38,44 Q60,36 82,44 L80,124 Q60,134 40,124 Z"/>' +
  '<path d="M82,46 Q96,48 98,64 L101,138 Q96,146 90,142 L84,70 Z"/><path d="M38,46 Q24,48 22,64 L19,138 Q24,146 30,142 L36,70 Z"/>' +
  '<path d="M60,128 L82,128 Q84,180 76,200 L78,246 L66,246 L62,200 Z"/><path d="M60,128 L38,128 Q36,180 44,200 L42,246 L54,246 L58,200 Z"/>';
function bodyMap(ex, map, title) {
  const fill = m => ex.prim.includes(m) ? C.prim : ex.sec.includes(m) ? C.sec : C.mus;
  const half = Object.entries(map).map(([m, d]) => '<path d="' + d + '" fill="' + fill(m) + '"/>').join('');
  return '<figure class="bm"><svg viewBox="0 0 120 250" aria-label="' + title + '"><g fill="' + C.base + '">' + BASE_BODY + '</g>' +
    half + '<g transform="translate(120,0) scale(-1,1)">' + half + '</g></svg><figcaption>' + title + '</figcaption></figure>';
}

// ---------- проигрыватель ----------
function techPlayer(stage, ex, onPhase) {
  const [ab, hb, ba, ha] = ex.tempo, total = ab + hb + ba + ha;
  let t0 = performance.now(), speed = 1, paused = false, pausedAt = 0, raf = 0, lastPh = '';
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
  function frame(now) {
    const el = paused ? pausedAt : (now - t0) / 1000 * speed;
    const c = el % total, rep = Math.floor(el / total) + 1;
    let u, ph;
    if (c < ab) { u = ease(c / ab); ph = ex.phase[0] + ' · ' + ab + ' с'; }
    else if (c < ab + hb) { u = 1; ph = hb >= 0.8 ? (ex.pauseLabel || 'задержка') + ' · ' + hb + ' с' : ex.phase[0] + ' · ' + ab + ' с'; }
    else if (c < ab + hb + ba) { u = 1 - ease((c - ab - hb) / ba); ph = ex.phase[1] + ' · ' + ba + ' с'; }
    else { u = 0; ph = ex.phase[1] + ' · ' + ba + ' с'; }
    const p = lerpPose(ex.A, ex.B, u);
    stage.innerHTML = '<line x1="0" y1="' + FLOOR + '" x2="300" y2="' + FLOOR + '" stroke="#2a303a" stroke-width="2"/>' + (ex.view === 'front' ? drawFront(ex, p) : drawSide(ex, p));
    if (ph + rep !== lastPh) { lastPh = ph + rep; onPhase(ph, rep); }
    if (!paused) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    setSpeed(s) { const now = performance.now(), el = (now - t0) / 1000 * speed; speed = s; t0 = now - el * 1000 / s; },
    toggle() {
      if (paused) { paused = false; t0 = performance.now() - pausedAt * 1000 / speed; raf = requestAnimationFrame(frame); }
      else { paused = true; pausedAt = (performance.now() - t0) / 1000 * speed; cancelAnimationFrame(raf); }
      return paused;
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
