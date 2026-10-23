'use strict';
// Ядро: хранение, форматирование, окна, графики, роутинг. Всё живёт в localStorage этого браузера.

const KEY = 'fitlog-v1';
// Упражнения, для которых есть 3D-техника (gallery.html)
const TECH_IDS = ['bench','incline_bb','lat_raise','french_incline','pushdown','pullup','lat_wide','row_cable','db_row','rear_delt','incline_curl','hammer','bench_pause','db_press30','fly','leg_press','leg_curl','leg_ext','calf','close_grip','overhead_ext','lat_close_rev','shrug','preacher','bb_curl','cable_curl','cross_hammer'];
const DAY = 864e5;
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- даты и форматирование ----------
const z2 = n => String(n).padStart(2, '0');
function todayStr(d = new Date()) { return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return todayStr(d); }
function mondayOf(s) { const d = parseDate(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return todayStr(d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY); }
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
function fmtDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + WD[d.getDay()]; }
function fmtShort(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function dayLabel(s) { const t = todayStr(); return s === t ? 'Сегодня' : s === addDays(t, -1) ? 'Вчера' : fmtDate(s); }
function fmtW(w) { return String(Math.round(w * 100) / 100).replace('.', ','); }
const r1 = x => Math.round(x * 10) / 10;
function roundTo(x, step) { return Math.round(x / step) * step; }
function mmss(s) { return Math.floor(s / 60) + ':' + z2(s % 60); }
function nowHM() { const d = new Date(); return z2(d.getHours()) + ':' + z2(d.getMinutes()); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let uidN = 0;
function uid() { return Date.now().toString(36) + (uidN++).toString(36); }
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : null;
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };

// ---------- хранение ----------
function fresh() {
  return {
    v: 2, exercises: clone(DEFAULT_EXERCISES), program: clone(DEFAULT_PROGRAM),
    workouts: [], body: [], measures: [], food: {}, foods: clone(DEFAULT_FOODS), days: {}, suppLog: {}, timer: null,
    settings: { reminder: true, wake: true, sound: true, cycleStart: mondayOf(todayStr()), supps: ['Протеин', 'Креатин'] },
    profile: { h: 178, age: 16, sex: 'm' },
    targets: null,
  };
}
function migrate(s) {
  const f = fresh();
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  s.settings = Object.assign(f.settings, s.settings);
  for (const id in DEFAULT_EXERCISES) {
    if (!s.exercises[id]) s.exercises[id] = clone(DEFAULT_EXERCISES[id]);
    else if (!s.exercises[id].mg) s.exercises[id].mg = DEFAULT_EXERCISES[id].mg;
  }
  if (s.supps) { // v1: supps[дата] = true → отмечены обе добавки
    for (const d in s.supps) s.suppLog[d] = { 'Протеин': true, 'Креатин': true };
    delete s.supps;
  }
  if (!s.targets) s.targets = calcTargets(s);
  s.v = 2;
  return s;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && (s.v === 1 || s.v === 2)) return migrate(s); } catch (e) { }
  return migrate(fresh());
}
let S = load();
let saveWarned = false;
function save() {
  if (typeof sortedCache !== 'undefined') sortedCache = null;
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { if (!saveWarned) { saveWarned = true; alert('Не получилось сохранить данные: ' + e.message); } }
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

function lastBody(s = S) { return s.body.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null; }
// Нормы на набор массы: Миффлин-Сан Жеор × 1,55 (3 тренировки в неделю) + 300 ккал профицит,
// белок 2 г/кг, жиры 1 г/кг, остальное — углеводы. Вода 40 мл/кг, сон 9 ч (подросток: 8–10).
function calcTargets(s = S) {
  const lb = lastBody(s), w = lb ? lb.kg : 62, p = s.profile || { h: 178, age: 16, sex: 'm' };
  const bmr = 10 * w + 6.25 * p.h - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const kcal = Math.round((bmr * 1.55 + 300) / 50) * 50;
  const prot = Math.round(2 * w), fat = Math.round(w);
  return { kcal, p: prot, f: fat, c: Math.round((kcal - prot * 4 - fat * 9) / 4), water: Math.round(w * 40 / 100) * 100, sleep: 9, steps: 8000 };
}

// ---------- окна, тосты, ввод ----------
function closeSheet(o) { o.classList.add('out'); setTimeout(() => o.remove(), 180); }
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 2400);
}
// search: true — поле поиска сверху, фильтрует варианты по тексту
function sheet(title, opts, html, search) {
  const o = document.createElement('div'); o.className = 'sheet-bg';
  o.innerHTML = '<div class="sheet"><div class="sheet-grip"></div><div class="sheet-t">' + esc(title) + '</div>' + (html || '') +
    (search ? '<input class="txt sheet-search" type="search" placeholder="Поиск…">' : '') +
    opts.map((x, k) => '<button class="sheet-o ' + (x.cls || '') + '" data-k="' + k + '" style="--i:' + Math.min(k, 10) + '">' + (x.html || esc(x.label)) + '</button>').join('') +
    '<button class="sheet-o cancel" data-k="-1">Закрыть</button></div>';
  o.addEventListener('click', ev => {
    const b = ev.target.closest('[data-k]');
    if (ev.target !== o && !b) return;
    closeSheet(o);
    if (b && +b.dataset.k >= 0) opts[+b.dataset.k].fn();
  });
  if (search) o.querySelector('.sheet-search').addEventListener('input', ev => {
    const q = ev.target.value.trim().toLowerCase();
    o.querySelectorAll('.sheet-o:not(.cancel)').forEach(el => { el.hidden = !!q && !el.textContent.toLowerCase().includes(q); });
  });
  document.body.appendChild(o);
  return o;
}
function askNum(label, val, min, max) {
  const v = prompt(label, val == null ? '' : fmtW(val));
  if (v == null || v.trim() === '') return null;
  const n = parseFloat(v.replace(',', '.'));
  if (isNaN(n) || n < min || n > max) { toast('Нужно число от ' + min + ' до ' + max); return null; }
  return n;
}
// Форма из нескольких полей в нижнем окне. fields: [{k, label, type, value, step}]
function formSheet(title, fields, onSave, extraOpts) {
  const html = '<div class="form">' + fields.map(f => '<label class="field">' + esc(f.label) +
    (f.type === 'select' ? '<select class="sel" data-fk="' + f.k + '">' + f.options.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === f.value ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>'
      : '<input ' + (f.type === 'number' ? 'type="number" inputmode="decimal" step="' + (f.step || 'any') + '"' : 'type="' + (f.type || 'text') + '"') + ' data-fk="' + f.k + '" value="' + esc(f.value == null ? '' : f.value) + '">') +
    '</label>').join('') + '</div>';
  const o = sheet(title, [{ label: 'Сохранить', cls: 'primary-o', fn: () => {} }].concat(extraOpts || []), html);
  const saveBtn = o.querySelector('[data-k="0"]');
  saveBtn.addEventListener('click', ev => {
    const out = {};
    o.querySelectorAll('[data-fk]').forEach(el => {
      const f = fields.find(x => x.k === el.dataset.fk);
      out[f.k] = f.type === 'number' ? (el.value === '' ? null : parseFloat(String(el.value).replace(',', '.'))) : el.value;
    });
    onSave(out); save(); render();
  }, { capture: true });
  const first = o.querySelector('input'); if (first && !first.value) setTimeout(() => first.focus(), 50);
}

// ---------- графики (SVG) ----------
// charts[id].pts — точки для подсказки по касанию: {cx, title, lines:[{color,name,val}]}
const charts = {};
function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r || 1))), m = r / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function yScale(vals, H, T, B, fromZero) {
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  if (fromZero) y0 = Math.min(0, y0);
  const pad = (y1 - y0) * 0.08 || Math.max(1, Math.abs(y1) * 0.05); if (!fromZero) y0 -= pad; y1 += pad;
  const step = niceStep((y1 - y0) / 4); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  return { y0, y1, step, sy: y => T + (y1 - y) / (y1 - y0) * (H - T - B) };
}
function gridSvg(sc, L, W, R, fmt) {
  let g = '';
  for (let y = sc.y0; y <= sc.y1 + 1e-9; y += sc.step)
    g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + sc.sy(y) + '" y2="' + sc.sy(y) + '"/>' +
      '<text class="ax" x="' + (L - 6) + '" y="' + (sc.sy(y) + 4) + '" text-anchor="end">' + fmt(y) + '</text>';
  return g;
}
function refSvg(sc, L, W, R, ref) {
  if (ref == null || ref.y == null) return '';
  return '<line class="goal" x1="' + L + '" x2="' + (W - R) + '" y1="' + sc.sy(ref.y) + '" y2="' + sc.sy(ref.y) + '"/>' +
    '<text class="lbl ref" x="' + (W - R + 4) + '" y="' + (sc.sy(ref.y) + 4) + '">' + esc(ref.label) + '</text>';
}
function chartWrap(id, svg, W, H, series) {
  const legend = series && series.length > 1 ? '<div class="legend">' + series.map(s =>
    '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return legend + '<div class="chart" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + svg +
    '<line class="cross hidden" y1="10" y2="' + (H - 24) + '"/></svg><div class="tip hidden"></div></div>';
}
const axFmt = y => { const a = Math.abs(y); return a >= 10000 ? r1(y / 1000) + 'k' : fmtW(r1(y)); };
// Линии по датам. series: [{name, color, pts:[{x:'YYYY-MM-DD', y, note}]}]
function lineChart(id, series, opt = {}) {
  const W = 340, H = 200, L = 38, R = 46, T = 14, B = 26, unit = opt.unit || '';
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '<div class="empty">' + (opt.empty || 'Нет данных — график появится после первых записей.') + '</div>';
  const xs = all.map(p => parseDate(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= 3 * DAY; x1 += 3 * DAY; }
  const vals = all.map(p => p.y); if (opt.ref && opt.ref.y != null) vals.push(opt.ref.y);
  const sc = yScale(vals, H, T, B, opt.zero);
  const sx = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  let g = gridSvg(sc, L, W, R, axFmt);
  g += '<text class="ax" x="' + L + '" y="' + (H - 6) + '">' + fmtShort(todayStr(new Date(x0))) + '</text>' +
    '<text class="ax" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + fmtShort(todayStr(new Date(x1))) + '</text>';
  g += refSvg(sc, L, W, R, opt.ref);
  const labelsY = [];
  for (const s of series) {
    if (!s.pts.length) continue;
    const P = s.pts.map(p => [sx(parseDate(p.x).getTime()), sc.sy(p.y)]);
    g += '<polyline class="ln" style="stroke:' + s.color + (s.dash ? ';stroke-dasharray:4 4' : '') + '" points="' + P.map(p => p.join(',')).join(' ') + '"/>';
    if (!s.noDots) g += P.map(p => '<circle class="dot" style="fill:' + s.color + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (P.length > 40 ? 2.5 : 4) + '"/>').join('');
    const lp = P[P.length - 1];
    if (!labelsY.some(y => Math.abs(y - lp[1]) < 13)) {
      labelsY.push(lp[1]);
      g += '<text class="lbl" x="' + (lp[0] + 7) + '" y="' + (lp[1] + 4) + '">' + fmtW(r1(s.pts[s.pts.length - 1].y)) + '</text>';
    }
  }
  const dates = [...new Set(all.map(p => p.x))];
  charts[id] = { W, pts: dates.map(d => ({ cx: sx(parseDate(d).getTime()), title: fmtDate(d),
    lines: series.map(s => { const p = s.pts.find(q => q.x === d); return p ? { color: s.color, name: s.name, val: fmtW(r1(p.y)) + (unit ? ' ' + unit : '') + (p.note ? ' ' + p.note : '') } : null; }).filter(Boolean) })) };
  return chartWrap(id, g, W, H, series);
}
// Столбики. bars: [{label, y, title, color?}], opt.ref — линия нормы
function barChart(id, bars, opt = {}) {
  const W = 340, H = 190, L = 38, R = 46, T = 14, B = 26, unit = opt.unit || '';
  if (!bars.length || bars.every(b => !b.y)) return '<div class="empty">' + (opt.empty || 'Нет данных за этот период.') + '</div>';
  const vals = bars.map(b => b.y || 0); if (opt.ref && opt.ref.y != null) vals.push(opt.ref.y);
  const sc = yScale(vals, H, T, B, true);
  const n = bars.length, slot = (W - L - R) / n, bw = Math.max(3, Math.min(28, slot - 2));
  let g = gridSvg(sc, L, W, R, axFmt);
  bars.forEach((b, i) => {
    const cx = L + slot * i + slot / 2, y = sc.sy(b.y || 0), h = sc.sy(0) - y;
    if (b.y) g += '<rect class="bar" x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="' + Math.max(0, h) + '" rx="' + Math.min(4, bw / 3) + '" style="fill:' + (b.color || opt.color || 'var(--s1)') + '"/>';
    const every = Math.ceil(n / 4);
    if (i % every === 0 && (n - 1 - i >= every / 2 || i === 0) || i === n - 1) g += '<text class="ax" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(b.label) + '</text>';
  });
  g += refSvg(sc, L, W, R, opt.ref);
  charts[id] = { W, pts: bars.map((b, i) => ({ cx: L + slot * i + slot / 2, title: b.title || b.label,
    lines: [{ color: b.color || opt.color || 'var(--s1)', name: opt.name || '', val: b.y == null ? 'нет данных' : (opt.fmt ? opt.fmt(b.y) : fmtW(r1(b.y))) + (unit ? ' ' + unit : '') }] })) };
  return chartWrap(id, g, W, H);
}
// Подсказка на графике: не чаще одного раза за кадр, иначе замеры layout на каждое движение пальца
let hoverEv = null;
function chartHoverRaf(ev) {
  if (!ev.target.closest || !ev.target.closest('.chart')) return;
  if (!hoverEv) requestAnimationFrame(() => { const e = hoverEv; hoverEv = null; chartHover(e); });
  hoverEv = ev;
}
function chartHover(ev) {
  const el = ev.target.closest && ev.target.closest('.chart'); if (!el) return;
  const c = charts[el.dataset.chart]; if (!c || !c.pts.length) return;
  const rect = el.getBoundingClientRect(), vx = (ev.clientX - rect.left) / rect.width * c.W;
  let best = c.pts[0];
  for (const p of c.pts) if (Math.abs(p.cx - vx) < Math.abs(best.cx - vx)) best = p;
  const cross = el.querySelector('.cross'); cross.setAttribute('x1', best.cx); cross.setAttribute('x2', best.cx); cross.classList.remove('hidden');
  const tip = el.querySelector('.tip');
  tip.innerHTML = '<b>' + esc(best.title) + '</b>' + best.lines.map(l => '<div><i style="background:' + l.color + '"></i>' + (l.name ? esc(l.name) + ': ' : '') + '<span class="mono">' + esc(l.val) + '</span></div>').join('');
  tip.classList.remove('hidden');
  const left = best.cx / c.W * rect.width;
  tip.style.left = Math.max(0, left > rect.width / 2 ? left - tip.offsetWidth - 10 : left + 10) + 'px';
}
document.addEventListener('pointermove', chartHoverRaf, { passive: true });
document.addEventListener('pointerdown', chartHoverRaf, { passive: true });

// Полоска «сколько из нормы»
function meter(label, val, target, unit, cls) {
  const pct = target ? Math.min(100, val / target * 100) : 0, over = target && val > target * 1.1;
  return '<div class="meter ' + (cls || '') + '"><div class="meter-top"><span>' + esc(label) + '</span><span class="mono"><b>' + fmtW(Math.round(val)) + '</b>' +
    (target ? ' / ' + fmtW(target) : '') + ' ' + unit + '</span></div><div class="meter-bar"><i class="' + (over ? 'over' : pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></i></div></div>';
}
// Ряд кнопок-оценок 1–5
function rating(act, date, key, val, labels) {
  return '<div class="rating">' + [1, 2, 3, 4, 5].map(n => '<button class="' + (val === n ? 'on' : '') + '" data-act="' + act + '" data-date="' + date + '" data-key="' + key + '" data-v="' + n + '">' +
    (labels ? labels[n - 1] : n) + '</button>').join('') + '</div>';
}

// ---------- роутинг и действия ----------
const VIEWS = {}, ACT = {}, TAB_OF = {};
function setTitle(t) { $('#title').textContent = t; }
function route() { const [r, a, b] = (location.hash.slice(1) || 'home').split('/'); return { r, a, b }; }
function render() {
  if (typeof sortedCache !== 'undefined') sortedCache = null;
  const { r, a, b } = route();
  const tab = TAB_OF[r] || r;
  document.querySelectorAll('.tabs a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  (VIEWS[r] || VIEWS.home)($('#view'), a, b);
  topDetail(); if (typeof syncWake === 'function') syncWake();
}
// Анимация появления экрана — только при переходе, не при каждой перерисовке
let enterT = 0;
window.addEventListener('hashchange', () => {
  const v = $('#view'); v.classList.remove('enter'); render(); window.scrollTo(0, 0);
  void v.offsetWidth; v.classList.add('enter'); clearTimeout(enterT); enterT = setTimeout(() => v.classList.remove('enter'), 700);
});
document.addEventListener('click', ev => {
  if (typeof unlockAudio === 'function') unlockAudio();
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  const sel = [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => '[' + a.name + '="' + CSS.escape(a.value) + '"]').join('');
  if (fn(b.dataset, b) === false) return;
  save(); render();
  // после перерисовки «щёлкаем» ту же кнопку — видно, что нажатие сработало
  const nb = sel && document.querySelector(sel); if (nb) nb.classList.add('pop');
});
$('#view').classList.add('enter'); setTimeout(() => $('#view').classList.remove('enter'), 700);

// Деталь в шапке: белок и калории за сегодня
function foodTotals(date) {
  const list = S.food[date] || [];
  return { kcal: sum(list.map(x => x.kcal || 0)), p: sum(list.map(x => x.p || 0)), f: sum(list.map(x => x.f || 0)), c: sum(list.map(x => x.c || 0)), n: list.length };
}
// Цвет дня по еде: ok — норма, mid — недобор, bad — сильный перебор, '' — нет записей
function dayStatus(date) {
  const t = foodTotals(date), T = S.targets;
  if (!t.n) return '';
  const r = t.kcal / T.kcal;
  if (r > 1.2) return 'bad';
  return r >= 0.9 && t.p >= T.p * 0.9 ? 'ok' : 'mid';
}
function topDetail() {
  const t = foodTotals(todayStr()), T = S.targets;
  const pct = Math.min(100, t.p / T.p * 100);
  $('#topDetail').innerHTML = '<div class="td-row"><span class="muted">белок</span> <b class="mono">' + Math.round(t.p) + '</b><span class="muted">/' + T.p + ' г</span></div>' +
    '<div class="td-bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="td-sub muted mono">' + Math.round(t.kcal) + ' / ' + T.kcal + ' ккал</div>';
}
