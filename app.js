'use strict';
// Дневник силовых тренировок. Всё хранится в localStorage этого браузера.

const KEY = 'fitlog-v1';
const DAY = 864e5;
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- даты и форматирование ----------
const z2 = n => String(n).padStart(2, '0');
function todayStr(d = new Date()) { return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function mondayOf(s) { const d = parseDate(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return todayStr(d); }
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
function fmtDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + WD[d.getDay()]; }
function fmtShort(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function fmtW(w) { return String(Math.round(w * 100) / 100).replace('.', ','); }
function roundTo(x, step) { return Math.round(x / step) * step; }
function mmss(s) { return Math.floor(s / 60) + ':' + z2(s % 60); }
function fmtRest(a, b) {
  const f = s => s % 60 === 0 ? String(s / 60) : fmtW(s / 60);
  return a === b ? (a < 120 ? a + ' с' : f(a) + ' мин') : f(a) + '–' + f(b) + ' мин';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return Date.now().toString(36) + Math.floor(performance.now() * 1000 % 46656).toString(36); }

// ---------- хранение ----------
function fresh() {
  return {
    v: 1, exercises: clone(DEFAULT_EXERCISES), program: clone(DEFAULT_PROGRAM),
    workouts: [], body: [], supps: {}, timer: null,
    settings: { reminder: true, wake: true, sound: true, cycleStart: mondayOf(todayStr()) },
  };
}
function migrate(s) {
  const f = fresh();
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  s.settings = Object.assign(f.settings, s.settings);
  for (const id in DEFAULT_EXERCISES) if (!s.exercises[id]) s.exercises[id] = clone(DEFAULT_EXERCISES[id]);
  return s;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return migrate(s); } catch (e) { }
  return fresh();
}
let S = load();
let saveWarned = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { if (!saveWarned) { saveWarned = true; alert('Не получилось сохранить данные: ' + e.message); } }
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

// ---------- упражнения и история ----------
const exOf = id => S.exercises[id] || { name: id, type: 'machine' };
const stepOf = id => exOf(id).type === 'dumbbell' ? 1 : 2.5;
const incOf = (id, w) => exOf(id).type === 'dumbbell' ? (w >= 10 ? 2 : 1) : 2.5;
const allDone = e => e.sets.length > 0 && e.sets.every(s => s.done);
const benchOk = e => allDone(e) && e.sets.every(s => s.r >= e.rMin);
const topOk = e => allDone(e) && e.sets.every(s => s.r >= e.rMax);
function topW(e) { const d = e.sets.filter(s => s.done); return d.length ? Math.max(...d.map(s => s.w)) : null; }
// Расчётный 1ПМ по Эпли: вес × (1 + повторы/30). Только расчёт, не проверка.
function e1rm(e) {
  let b = 0;
  for (const s of e.sets) if (s.done && s.r > 0 && s.w > 0) b = Math.max(b, s.r === 1 ? s.w : s.w * (1 + s.r / 30));
  return b || null;
}
function sortedWorkouts() { return S.workouts.slice().sort((a, b) => b.date.localeCompare(a.date) || b.started - a.started); }
// Прошлые выполнения упражнения, новые сначала. before — тренировка, раньше которой искать.
function history(exId, opt = {}) {
  const out = [], cur = opt.before;
  for (const w of sortedWorkouts()) {
    if (cur && (w.id === cur.id || w.date > cur.date || (w.date === cur.date && w.started >= cur.started))) continue;
    if (!opt.deload && w.deload) continue;
    const e = w.entries.find(x => x.ex === exId);
    if (e && e.sets.some(s => s.done)) out.push({ w, e });
  }
  return out;
}

// ---------- подсказка веса ----------
function suggest(exId, item) {
  const h = history(exId);
  if (!h.length) return { w: item.start || 0, why: item.start ? 'стартовый вес' : 'первый раз — подбери рабочий вес' };
  const last = h[0].e, lw = topW(last);
  if (exOf(exId).rule === 'bench') {
    if (!benchOk(last) && h[1] && !benchOk(h[1].e) && topW(h[1].e) === lw)
      return { w: Math.max(20, roundTo(lw * 0.9, 2.5)), why: '2 провала подряд → −10%' };
    if (benchOk(last)) return { w: lw + 2.5, why: 'все повторения сделаны → +2,5 кг' };
    return { w: lw, why: 'не все повторения — тот же вес' };
  }
  if (topOk(last)) { const inc = incOf(exId, lw); return { w: lw + inc, why: 'везде ' + last.rMax + ' повт. → +' + fmtW(inc) + ' кг' }; }
  return { w: lw, why: 'тот же вес, добери до ' + last.rMax + ' во всех подходах' };
}

// ---------- разгрузка: каждая 6-я неделя ----------
function weekNo(dateStr) {
  const d = Math.round((parseDate(mondayOf(dateStr)) - parseDate(S.settings.cycleStart)) / DAY);
  return Math.floor(d / 7);
}
function isDeload(dateStr) { const n = weekNo(dateStr); return n >= 0 && n % 6 === 5; }
function plannedWeight(exId, item, deload) {
  const sg = suggest(exId, item);
  if (!deload) return { w: sg.w, hint: sg.why };
  return { w: roundTo(sg.w * 0.7, stepOf(exId)), hint: 'лёгкая неделя: −30% от ' + fmtW(sg.w) + ' кг' };
}

// ---------- тренировка ----------
function warmups(w, n) {
  const p = [0, 0.5, 0.75, 0.85], r = [10, 5, 3, 2], out = [];
  for (let i = 0; i < n; i++) out.push({ w: i === 0 ? 20 : Math.max(20, roundTo(w * p[i], 2.5)), r: r[i], done: false });
  return out;
}
function makeEntry(item, deload) {
  const pw = plannedWeight(item.ex, item, deload);
  return {
    ex: item.ex, rMin: item.rMin, rMax: item.rMax, restMin: item.restMin, restMax: item.restMax, hint: pw.hint,
    warm: item.warmup ? warmups(pw.w, item.warmup) : [],
    sets: Array.from({ length: item.sets }, () => ({ w: pw.w, r: item.rMin, done: false })),
  };
}
function startWorkout(dayId) {
  const day = S.program.find(d => d.id === dayId);
  const date = todayStr(), deload = isDeload(date);
  const w = {
    id: uid(), date, started: Date.now(), dayId, title: day.title, sub: day.sub, deload,
    finished: false, feel: '', note: '', entries: day.items.map(it => makeEntry(it, deload)),
  };
  S.workouts.push(w); save(); askNotify();
  location.hash = '#w/' + w.id;
}
const activeWorkout = () => sortedWorkouts().find(w => !w.finished);

// ---------- таймер отдыха ----------
let audio = null;
function unlockAudio() {
  try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { }
}
function beep() {
  if (!audio || !S.settings.sound) return;
  const t = audio.currentTime;
  [0, 0.35, 0.7].forEach((d, k) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = k === 2 ? 1320 : 880;
    o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.6, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
    o.start(t + d); o.stop(t + d + 0.32);
  });
}
function startTimer(sec, max, label) {
  const now = Date.now();
  S.timer = { end: now + sec * 1000, max: now + Math.max(sec, max) * 1000, label, fired: false };
  save(); tick();
}
function fireTimer() {
  S.timer.fired = true; save();
  try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 800]); } catch (e) { }
  beep();
  if (document.hidden) notify('Отдых окончен', S.timer.label);
}
function tick() {
  const t = S.timer, el = $('#timer');
  if (!t) { el.classList.add('hidden'); document.body.classList.remove('has-timer'); return; }
  const now = Date.now(), left = Math.ceil((t.end - now) / 1000);
  if (left <= 0 && !t.fired) fireTimer();
  if (now > t.max + 300000) { S.timer = null; save(); return tick(); }
  el.classList.remove('hidden'); document.body.classList.add('has-timer');
  el.classList.toggle('over', left <= 0);
  $('#timerTime').textContent = left > 0 ? mmss(left) : '+' + mmss(-left);
  $('#timerLabel').textContent = left > 0 ? 'Отдых · ' + t.label
    : now < t.max ? 'Можно идти · отдых до ' + mmss(Math.ceil((t.max - now) / 1000)) : 'Пора! Следующий подход';
}
setInterval(tick, 250);
$('#timerPlus').onclick = () => { if (S.timer) { S.timer.end += 30000; S.timer.max = Math.max(S.timer.max, S.timer.end); S.timer.fired = S.timer.end <= Date.now(); save(); tick(); } };
$('#timerStop').onclick = () => { S.timer = null; save(); tick(); };

// ---------- уведомления, экран ----------
function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { } }
async function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    if (reg) reg.showNotification(title, { body, tag: 'fitlog', renotify: true, vibrate: [400, 200, 400, 200, 800], icon: 'icon-192.png' });
  } catch (e) { }
}
let wakeLock = null;
async function syncWake() {
  const [r, id] = location.hash.slice(1).split('/');
  const w = r === 'w' && S.workouts.find(x => x.id === id);
  const want = S.settings.wake && w && !w.finished && !document.hidden;
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}
// Напоминание «протеин + креатин» в 17:00 — срабатывает, если приложение открыто или висит в фоне.
function suppCheck() {
  const t = todayStr();
  if (S.settings.reminder && new Date().getHours() >= 17 && !S.supps[t] && S.suppNotified !== t) {
    S.suppNotified = t; save(); notify('Протеин + креатин', 'Пора выпить — отметь в приложении');
  }
}
setInterval(suppCheck, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } syncWake(); });

// ---------- окна и тосты ----------
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
function sheet(title, opts) {
  const o = document.createElement('div'); o.className = 'sheet-bg';
  o.innerHTML = '<div class="sheet"><div class="sheet-t">' + esc(title) + '</div>' +
    opts.map((x, k) => '<button class="sheet-o ' + (x.cls || '') + '" data-k="' + k + '">' + esc(x.label) + '</button>').join('') +
    '<button class="sheet-o cancel" data-k="-1">Отмена</button></div>';
  o.addEventListener('click', ev => {
    const b = ev.target.closest('[data-k]');
    if (ev.target !== o && !b) return;
    o.remove();
    if (b && +b.dataset.k >= 0) opts[+b.dataset.k].fn();
  });
  document.body.appendChild(o);
}
function pickExercise(title, fn) {
  const ids = Object.keys(S.exercises).sort((a, b) =>
    (!!exOf(a).spare - !!exOf(b).spare) || exOf(a).name.localeCompare(exOf(b).name, 'ru'));
  sheet(title, ids.map(id => ({ label: exOf(id).name + (exOf(id).spare ? ' · запасное' : ''), fn: () => fn(id) })));
}

// ---------- графики (SVG) ----------
const charts = {};
function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function lineChart(id, series, opt = {}) {
  const W = 340, H = 200, L = 36, R = 44, T = 14, B = 26;
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '<div class="empty">' + (opt.empty || 'Нет данных — график появится после первой записи.') + '</div>';
  const xs = all.map(p => parseDate(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= 3 * DAY; x1 += 3 * DAY; }
  const ys = all.map(p => p.y); if (opt.goal) ys.push(opt.goal);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.08 || 2; y0 -= pad; y1 += pad;
  const step = niceStep((y1 - y0) / 4); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const sx = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  const sy = y => T + (y1 - y) / (y1 - y0) * (H - T - B);
  let g = '';
  for (let y = y0; y <= y1 + 1e-9; y += step) {
    g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(y) + '" y2="' + sy(y) + '"/>' +
      '<text class="ax" x="' + (L - 6) + '" y="' + (sy(y) + 4) + '" text-anchor="end">' + fmtW(Math.round(y * 10) / 10) + '</text>';
  }
  const dFirst = todayStr(new Date(x0)), dLast = todayStr(new Date(x1));
  g += '<text class="ax" x="' + L + '" y="' + (H - 6) + '">' + fmtShort(dFirst) + '</text>' +
    '<text class="ax" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + fmtShort(dLast) + '</text>';
  if (opt.goal) {
    g += '<line class="goal" x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(opt.goal) + '" y2="' + sy(opt.goal) + '"/>' +
      '<text class="lbl" x="' + (W - R + 4) + '" y="' + (sy(opt.goal) + 4) + '">цель ' + opt.goal + '</text>';
  }
  for (const s of series) {
    if (!s.pts.length) continue;
    const P = s.pts.map(p => [sx(parseDate(p.x).getTime()), sy(p.y)]);
    g += '<polyline class="ln" style="stroke:' + s.color + '" points="' + P.map(p => p.join(',')).join(' ') + '"/>';
    g += P.map(p => '<circle class="dot" style="fill:' + s.color + '" cx="' + p[0] + '" cy="' + p[1] + '" r="4"/>').join('');
    const lp = P[P.length - 1], lv = s.pts[s.pts.length - 1].y;
    if (!opt.goal || Math.abs(sy(opt.goal) - lp[1]) > 12)
      g += '<text class="lbl" x="' + (lp[0] + 7) + '" y="' + (lp[1] + 4) + '">' + fmtW(Math.round(lv * 10) / 10) + '</text>';
  }
  g += '<line class="cross hidden" y1="' + T + '" y2="' + (H - B) + '"/>';
  charts[id] = { series, sx, x0, x1, W, unit: opt.unit || 'кг' };
  const legend = series.length > 1 ? '<div class="legend">' + series.map(s =>
    '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return legend + '<div class="chart" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
    esc(series.map(s => s.name).join(', ')) + '">' + g + '</svg><div class="tip hidden"></div></div>';
}
function chartHover(ev) {
  const el = ev.target.closest('.chart'); if (!el) return;
  const c = charts[el.dataset.chart]; if (!c) return;
  const rect = el.getBoundingClientRect(), vx = (ev.clientX - rect.left) / rect.width * c.W;
  const dates = [...new Set(c.series.flatMap(s => s.pts.map(p => p.x)))];
  let best = null, bd = Infinity;
  for (const d of dates) { const dx = Math.abs(c.sx(parseDate(d).getTime()) - vx); if (dx < bd) { bd = dx; best = d; } }
  if (!best) return;
  const px = c.sx(parseDate(best).getTime());
  const cross = el.querySelector('.cross'); cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.classList.remove('hidden');
  const tip = el.querySelector('.tip');
  tip.innerHTML = '<b>' + fmtDate(best) + '</b>' + c.series.map(s => {
    const p = s.pts.find(q => q.x === best);
    return p ? '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + ': <span class="mono">' + fmtW(Math.round(p.y * 10) / 10) + ' ' + c.unit + '</span>' + (p.note ? ' <span class="muted">' + esc(p.note) + '</span>' : '') + '</div>' : '';
  }).join('');
  tip.classList.remove('hidden');
  const left = px / c.W * rect.width;
  tip.style.left = (left > rect.width / 2 ? left - tip.offsetWidth - 10 : left + 10) + 'px';
}
document.addEventListener('pointermove', chartHover);
document.addEventListener('pointerdown', chartHover);

// ---------- шапка: деталь с данными ----------
function benchStatus() {
  const h = history('bench');
  if (!h.length) return { w: S.program.flatMap(d => d.items).find(i => i.ex === 'bench')?.start || null, e: null };
  return { w: topW(h[0].e), e: Math.max(...h.slice(0, 6).map(x => e1rm(x.e) || 0)) };
}
function topDetail() {
  const b = benchStatus();
  const pct = b.e ? Math.min(100, Math.round(b.e)) : 0;
  $('#topDetail').innerHTML = b.w == null ? '<span class="muted">жим: нет данных</span>' :
    '<div class="td-row"><span class="muted">жим</span> <b class="mono">' + fmtW(b.w) + '</b><span class="muted"> кг</span>' +
    (b.e ? ' · <span class="muted">1ПМ≈</span><b class="mono">' + Math.round(b.e) + '</b>' : '') + '</div>' +
    '<div class="td-bar" title="расчётный 1ПМ к цели 100 кг"><i style="width:' + pct + '%"></i></div>' +
    '<div class="td-sub muted">' + (b.e ? 'до 100 кг: ' + Math.max(0, Math.round(100 - b.e)) + ' кг' : 'старт · цель 100 кг') + '</div>';
}

// ---------- экраны ----------
let titleText = 'Сегодня';
function setTitle(t) { titleText = t; $('#title').textContent = t; }

function nextDay() {
  const now = new Date(), dow = now.getDay(), t = todayStr();
  let best = null;
  for (const d of S.program) {
    let diff = (d.dow - dow + 7) % 7;
    if (diff === 0 && S.workouts.some(w => w.date === t && w.dayId === d.id && w.finished)) diff = 7;
    if (!best || diff < best.diff) best = { d, diff };
  }
  return best;
}
function vHome(v) {
  setTitle('Сегодня');
  const t = todayStr(), act = activeWorkout(), nd = nextDay();
  let h = '';
  if (isDeload(t)) h += '<div class="banner deload"><b>Лёгкая неделя.</b> Веса −30%, без отказа — восстанавливаемся.</div>';
  if (act) {
    const all = act.entries.flatMap(e => e.sets), done = all.filter(s => s.done).length;
    h += '<section class="card hero"><div class="muted">Идёт тренировка · ' + fmtDate(act.date) + '</div><div class="big">' + esc(act.title) + '</div>' +
      '<div class="muted mono">' + done + ' / ' + all.length + ' подходов</div>' +
      '<a class="btn primary wide" href="#w/' + act.id + '">Продолжить</a></section>';
  }
  if (nd) {
    const d = nd.d, dl = isDeload(todayStr(new Date(Date.now() + nd.diff * DAY)));
    const when = nd.diff === 0 ? 'Сегодня' : nd.diff === 1 ? 'Завтра' : 'Через ' + nd.diff + ' дн.';
    h += '<section class="card ' + (act ? '' : 'hero') + '"><div class="muted">' + when + '</div><div class="big">' + esc(d.title) + '</div><div class="muted">' + esc(d.sub) + '</div><ul class="plan">' +
      d.items.map(it => {
        const pw = plannedWeight(it.ex, it, dl), bw = exOf(it.ex).type === 'bodyweight';
        return '<li><span>' + esc(exOf(it.ex).name) + '</span><span class="mono">' + it.sets + '×' + (it.rMin === it.rMax ? it.rMin : it.rMin + '–' + it.rMax) +
          (pw.w || bw ? ' · ' + (bw ? '+' : '') + fmtW(pw.w) + ' кг' : '') + '</span></li>';
      }).join('') + '</ul>' +
      (act ? '' : '<button class="btn primary wide" data-act="start" data-day="' + d.id + '">Начать</button>') + '</section>';
  }
  if (!act) h += '<div class="others"><span class="muted">Другой день:</span>' + S.program.filter(d => !nd || d.id !== nd.d.id)
    .map(d => '<button class="btn ghost" data-act="start" data-day="' + d.id + '">' + esc(d.title) + '</button>').join('') + '</div>';
  if (S.settings.reminder) {
    const ok = !!S.supps[t], due = !ok && new Date().getHours() >= 17;
    h += '<section class="card row-card ' + (due ? 'due' : '') + '"><div><div class="exname">Протеин + креатин</div><div class="muted">' +
      (ok ? 'сегодня отмечено' : due ? 'уже 17:00 — пора' : 'напомню в 17:00') + '</div></div>' +
      '<button class="check big-check ' + (ok ? 'on' : '') + '" data-act="supp">' + (ok ? '✓' : '') + '</button></section>';
  }
  const lb = S.body.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  h += '<a class="card row-card" href="#body"><div><div class="exname">Вес тела</div><div class="muted">' + (lb ? fmtDate(lb.date) : 'ещё нет записей') + '</div></div><div class="big mono">' + (lb ? fmtW(lb.kg) : '—') + '</div></a>';
  const wn = weekNo(t);
  if (wn >= 0) { const left = 5 - wn % 6; h += '<div class="muted center small-note">Неделя ' + (wn % 6 + 1) + ' из 6 · ' + (left === 0 ? 'сейчас разгрузка' : 'разгрузка через ' + left + ' нед.') + '</div>'; }
  v.innerHTML = h;
}

function setRow(w, e, i, kind, j, s, p, label) {
  const bw = exOf(e.ex).type === 'bodyweight';
  const a = 'data-w="' + w.id + '" data-i="' + i + '" data-k="' + kind + '" data-j="' + j + '"';
  return '<div class="set ' + (s.done ? 'done' : '') + (kind === 'warm' ? ' warm' : '') + '">' +
    '<div class="sn mono">' + label + '</div>' +
    '<div class="stepper"><button data-act="w" data-d="-1" ' + a + '>−</button><div class="val mono" data-act="wEdit" ' + a + '>' + (bw ? '+' : '') + fmtW(s.w) + '<small>кг</small></div><button data-act="w" data-d="1" ' + a + '>+</button></div>' +
    '<div class="stepper"><button data-act="r" data-d="-1" ' + a + '>−</button><div class="val mono">' + s.r + '<small>повт</small></div><button data-act="r" data-d="1" ' + a + '>+</button></div>' +
    '<button class="check ' + (s.done ? 'on' : '') + '" data-act="done" ' + a + ' aria-label="подход сделан">' + (s.done ? '✓' : '') + '</button></div>' +
    (p ? '<div class="prev mono">прошлый раз: ' + fmtW(p.w) + ' × ' + p.r + (p.done ? '' : ' (не сделан)') + '</div>' : '');
}
function entryCard(w, e, i) {
  const ex = exOf(e.ex), prev = history(e.ex, { before: w, deload: true })[0];
  const rep = e.rMin === e.rMax ? e.rMin : e.rMin + '–' + e.rMax;
  let h = '<section class="card ex"><div class="exhead"><div><div class="exname">' + esc(ex.name) + '</div><div class="muted">' +
    e.sets.length + '×' + rep + (ex.perArm ? ' на руку' : '') + ' · отдых ' + fmtRest(e.restMin, e.restMax) + '</div></div>' +
    '<button class="icon" data-act="exMenu" data-w="' + w.id + '" data-i="' + i + '" aria-label="меню">⋯</button></div>';
  if (e.hint) h += '<div class="hint">→ ' + esc(e.hint) + '</div>';
  if (e.warm.length) {
    h += '<div class="sub">Разминка · не в зачёт</div>';
    e.warm.forEach((s, j) => { h += setRow(w, e, i, 'warm', j, s, null, 'Р' + (j + 1)); });
    h += '<div class="sub">Рабочие</div>';
  }
  e.sets.forEach((s, j) => { h += setRow(w, e, i, 'sets', j, s, prev && prev.e.sets[j], j + 1); });
  h += '<div class="rowbtns"><button class="btn small ghost" data-act="setCount" data-d="-1" data-w="' + w.id + '" data-i="' + i + '">− подход</button>' +
    '<button class="btn small ghost" data-act="setCount" data-d="1" data-w="' + w.id + '" data-i="' + i + '">+ подход</button></div></section>';
  return h;
}
function vWorkout(v, id) {
  const w = S.workouts.find(x => x.id === id);
  if (!w) { setTitle('Тренировка'); v.innerHTML = '<div class="card">Тренировка не найдена.</div>'; return; }
  setTitle(w.title);
  let h = '<div class="whead"><div class="muted">' + fmtDate(w.date) + ' · ' + esc(w.sub || '') + '</div>' + (w.finished ? '<span class="pill ok">завершена</span>' : '') + '</div>';
  if (w.deload) h += '<div class="banner deload"><b>Лёгкая неделя.</b> Веса −30%. Без отказа — техника и восстановление.</div>';
  w.entries.forEach((e, i) => { h += entryCard(w, e, i); });
  h += '<button class="btn ghost wide" data-act="addEx" data-w="' + w.id + '">+ упражнение</button>';
  h += '<section class="card"><div class="exname">Самочувствие</div><div class="feel">' + ['легко', 'нормально', 'тяжело'].map(f =>
    '<button class="btn ' + (w.feel === f ? 'primary' : 'ghost') + '" data-act="feel" data-v="' + f + '" data-w="' + w.id + '">' + f + '</button>').join('') + '</div>' +
    '<div class="exname" style="margin-top:14px">Заметки</div><textarea id="note" data-w="' + w.id + '" rows="3" placeholder="как шло, что болело, что поменять">' + esc(w.note) + '</textarea></section>';
  h += w.finished ? '<button class="btn danger wide" data-act="delWorkout" data-w="' + w.id + '">Удалить тренировку</button>'
    : '<button class="btn primary wide" data-act="finish" data-w="' + w.id + '">Завершить тренировку</button>' +
      '<button class="btn danger wide" data-act="delWorkout" data-w="' + w.id + '">Отменить и удалить</button>';
  v.innerHTML = h;
}

function vHistory(v) {
  setTitle('История');
  const list = sortedWorkouts();
  if (!list.length) { v.innerHTML = '<div class="empty">Пока пусто. Первая тренировка появится здесь после «Начать».</div>'; return; }
  v.innerHTML = list.map(w => {
    const sets = w.entries.flatMap(e => e.sets), done = sets.filter(s => s.done);
    const ton = done.reduce((a, s) => a + s.w * s.r, 0);
    const b = w.entries.find(e => exOf(e.ex).rule === 'bench' && e.sets.some(s => s.done));
    return '<a class="card hist" href="#w/' + w.id + '"><div class="hist-top"><b>' + esc(w.title) + '</b><span class="muted">' + fmtDate(w.date) + '</span></div>' +
      '<div class="hist-meta mono">' + done.length + '/' + sets.length + ' подх. · ' + Math.round(ton).toLocaleString('ru') + ' кг объём' +
      (b ? ' · жим ' + fmtW(topW(b)) : '') + '</div><div class="pills">' +
      (w.deload ? '<span class="pill">разгрузка</span>' : '') + (w.feel ? '<span class="pill">' + esc(w.feel) + '</span>' : '') +
      (w.finished ? '' : '<span class="pill warn">не завершена</span>') + (w.note ? '<span class="pill">заметка</span>' : '') + '</div></a>';
  }).join('');
}

function vProgress(v, exArg) {
  setTitle('Прогресс');
  const withData = Object.keys(S.exercises).filter(id => history(id).length);
  const exId = exArg && S.exercises[exArg] ? exArg : 'bench';
  if (!withData.includes(exId)) withData.unshift(exId);
  const ex = exOf(exId), h = history(exId).slice().reverse(), bw = ex.type === 'bodyweight';
  const pw = h.map(x => { const tw = topW(x.e), s = x.e.sets.find(q => q.done && q.w === tw); return { x: x.w.date, y: tw, note: s ? '× ' + s.r : '' }; });
  const pe = bw ? [] : h.map(x => ({ x: x.w.date, y: e1rm(x.e) })).filter(p => p.y);
  const series = [{ name: bw ? 'доп. вес' : 'рабочий вес', color: 'var(--s1)', pts: pw }];
  if (!bw) series.push({ name: 'расчётный 1ПМ', color: 'var(--s2)', pts: pe });
  const goal = ex.rule === 'bench' ? 100 : null;
  const lastE = pe.length ? pe[pe.length - 1].y : null, bestE = pe.length ? Math.max(...pe.map(p => p.y)) : null;
  let tiles = '<div class="tile"><div class="muted">Рабочий вес</div><div class="big mono">' + (pw.length ? fmtW(pw[pw.length - 1].y) : '—') + '</div></div>';
  if (!bw) tiles += '<div class="tile"><div class="muted">1ПМ (расчёт)</div><div class="big mono">' + (lastE ? Math.round(lastE) : '—') + '</div></div>';
  if (goal) tiles += '<div class="tile"><div class="muted">До цели 100</div><div class="big mono">' + (bestE ? Math.max(0, Math.round(goal - bestE)) : '—') + '</div></div>';
  else if (pw.length > 1) { const d = pw[pw.length - 1].y - pw[0].y; tiles += '<div class="tile"><div class="muted">С начала</div><div class="big mono">' + (d >= 0 ? '+' : '') + fmtW(d) + '</div></div>'; }
  const rows = h.slice().reverse().slice(0, 12).map(x => '<tr><td>' + fmtShort(x.w.date) + '</td><td class="mono">' +
    x.e.sets.filter(s => s.done).map(s => fmtW(s.w) + '×' + s.r).join(' ') + '</td><td class="mono">' + (bw ? '' : Math.round(e1rm(x.e) || 0)) + '</td></tr>').join('');
  v.innerHTML = '<select id="exSel" class="sel">' + withData.map(id => '<option value="' + id + '"' + (id === exId ? ' selected' : '') + '>' + esc(exOf(id).name) + '</option>').join('') + '</select>' +
    '<div class="tiles">' + tiles + '</div>' +
    '<section class="card">' + lineChart('pr', series, { goal, empty: 'По этому упражнению ещё нет сделанных подходов.' }) + '</section>' +
    (bw ? '' : '<div class="muted small-note">1ПМ — расчёт по формуле Эпли: вес × (1 + повторы / 30). Это не проверка максимума — проверять его не нужно. Разгрузочные недели в график не входят.</div>') +
    (rows ? '<section class="card"><table class="tbl"><tr><th>Дата</th><th>Подходы</th><th>' + (bw ? '' : '1ПМ') + '</th></tr>' + rows + '</table></section>' : '');
  $('#exSel').onchange = e => { location.hash = '#progress/' + e.target.value; };
}

let bodyDraft = null;
function vBody(v) {
  setTitle('Вес тела');
  const list = S.body.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = list[list.length - 1];
  if (bodyDraft == null) bodyDraft = last ? last.kg : 62;
  const first = list[0], monthAgo = list.filter(b => b.date <= todayStr(new Date(Date.now() - 28 * DAY))).pop();
  const d4 = last && monthAgo ? last.kg - monthAgo.kg : null, dAll = last && first && list.length > 1 ? last.kg - first.kg : null;
  const sg = x => x == null ? '—' : (x >= 0 ? '+' : '') + fmtW(Math.round(x * 10) / 10);
  v.innerHTML = '<section class="card hero center"><div class="muted">Сегодня, ' + fmtDate(todayStr()) + '</div>' +
    '<div class="huge mono" data-act="bodyEdit">' + fmtW(bodyDraft) + '</div><div class="body-in"><button class="btn ghost" data-act="bodyStep" data-d="-0.5">−0,5</button><button class="btn ghost" data-act="bodyStep" data-d="-0.1">−0,1</button>' +
    '<button class="btn ghost" data-act="bodyStep" data-d="0.1">+0,1</button><button class="btn ghost" data-act="bodyStep" data-d="0.5">+0,5</button></div>' +
    '<button class="btn primary wide" data-act="bodySave">Записать</button></section>' +
    '<div class="tiles"><div class="tile"><div class="muted">Сейчас</div><div class="big mono">' + (last ? fmtW(last.kg) : '—') + '</div></div>' +
    '<div class="tile"><div class="muted">За 4 недели</div><div class="big mono">' + sg(d4) + '</div></div>' +
    '<div class="tile"><div class="muted">С начала</div><div class="big mono">' + sg(dAll) + '</div></div></div>' +
    '<section class="card">' + lineChart('body', [{ name: 'вес тела', color: 'var(--s1)', pts: list.map(b => ({ x: b.date, y: b.kg })) }], { empty: 'Запиши вес — появится график.' }) + '</section>' +
    (list.length ? '<section class="card"><table class="tbl">' + list.slice().reverse().slice(0, 20).map(b =>
      '<tr><td>' + fmtDate(b.date) + '</td><td class="mono">' + fmtW(b.kg) + ' кг</td><td><button class="icon" data-act="bodyDel" data-date="' + b.date + '" aria-label="удалить">✕</button></td></tr>').join('') + '</table></section>' : '');
}

function vSettings(v) {
  setTitle('Ещё');
  const st = S.settings, wn = weekNo(todayStr());
  const tg = (k, label, sub) => '<label class="card row-card"><div><div class="exname">' + label + '</div><div class="muted">' + sub + '</div></div>' +
    '<input type="checkbox" class="sw" data-set="' + k + '"' + (st[k] ? ' checked' : '') + '></label>';
  const perm = 'Notification' in window ? Notification.permission : 'нет';
  v.innerHTML = '<a class="card row-card" href="#program"><div><div class="exname">Программа тренировок</div><div class="muted">упражнения, подходы, повторы, отдых, замены</div></div><div class="big">›</div></a>' +
    tg('reminder', 'Протеин + креатин в 17:00', 'карточка на главной + уведомление') +
    tg('wake', 'Не гасить экран на тренировке', 'экран горит, пока открыта тренировка') +
    tg('sound', 'Звук таймера', 'вибрация работает всегда') +
    '<section class="card"><div class="exname">Уведомления</div><div class="muted">Сейчас: ' + ({ granted: 'разрешены', denied: 'запрещены (включи в настройках Chrome)', default: 'не спрашивали' }[perm] || perm) +
    '. Таймер и напоминание приходят, пока приложение открыто или недавно свёрнуто.</div>' +
    (perm === 'default' ? '<button class="btn ghost wide" data-act="notifPerm">Разрешить уведомления</button>' : '') + '</section>' +
    '<section class="card"><div class="exname">Цикл разгрузки</div><div class="muted">Каждая 6-я неделя — лёгкая (−30%). Сейчас: ' +
    (wn >= 0 ? 'неделя ' + (wn % 6 + 1) + ' из 6' : 'цикл ещё не начался') + '.</div><label class="field">Начало цикла (понедельник)<input type="date" id="cycleStart" value="' + st.cycleStart + '"></label></section>' +
    '<section class="card"><div class="exname">Резервная копия</div><div class="muted">Всё хранится только в этом браузере. Делай копию раз в пару недель и кидай себе в Telegram/на диск.</div>' +
    '<div class="rowbtns"><button class="btn primary" data-act="export">Экспорт JSON</button><button class="btn ghost" data-act="import">Импорт</button></div>' +
    '<input type="file" id="importFile" accept="application/json,.json" hidden></section>' +
    '<button class="btn danger wide" data-act="resetProgram">Вернуть программу по умолчанию</button>' +
    '<div class="muted center small-note">Тренировок: ' + S.workouts.length + ' · записей веса: ' + S.body.length + '</div>';
  $('#cycleStart').onchange = e => { if (e.target.value) { S.settings.cycleStart = mondayOf(e.target.value); save(); render(); } };
  $('#importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const o = JSON.parse(txt);
      if (!o || o.v !== 1 || !Array.isArray(o.workouts)) throw new Error('не тот формат');
      if (!confirm('Заменить все данные данными из файла? (тренировок в файле: ' + o.workouts.length + ')')) return;
      S = migrate(o); S.timer = null; save(); toast('Данные загружены'); render();
    }).catch(err => alert('Не получилось прочитать файл: ' + err.message));
  };
}

function vProgram(v) {
  setTitle('Программа');
  const opts = sel => Object.keys(S.exercises).sort((a, b) => (!!exOf(a).spare - !!exOf(b).spare) || exOf(a).name.localeCompare(exOf(b).name, 'ru'))
    .map(id => '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(exOf(id).name) + (exOf(id).spare ? ' (запасное)' : '') + '</option>').join('');
  const num = (di, ii, f, val, label, step) => '<label class="field">' + label + '<input type="number" inputmode="decimal" step="' + (step || 1) + '" min="0" data-p="' + di + '" data-ii="' + ii + '" data-f="' + f + '" value="' + val + '"></label>';
  let h = '<div class="muted small-note">Изменения применяются к следующим тренировкам. Отдых — в секундах.</div>';
  S.program.forEach((d, di) => {
    h += '<section class="card"><div class="big">' + esc(d.title) + '</div><input class="txt" data-p="' + di + '" data-f="sub" value="' + esc(d.sub) + '">';
    d.items.forEach((it, ii) => {
      h += '<div class="pitem"><div class="pitem-top"><span class="sn mono">' + (ii + 1) + '</span><select class="sel" data-p="' + di + '" data-ii="' + ii + '" data-f="ex">' + opts(it.ex) + '</select></div>' +
        '<div class="pgrid">' + num(di, ii, 'sets', it.sets, 'Подходы') + num(di, ii, 'rMin', it.rMin, 'Повт. от') + num(di, ii, 'rMax', it.rMax, 'Повт. до') +
        num(di, ii, 'restMin', it.restMin, 'Отдых от', 15) + num(di, ii, 'restMax', it.restMax, 'Отдых до', 15) + num(di, ii, 'start', it.start, 'Старт, кг', 0.5) +
        num(di, ii, 'warmup', it.warmup, 'Разминка') + '</div>' +
        '<div class="rowbtns"><button class="btn small ghost" data-act="pMove" data-d="-1" data-p="' + di + '" data-ii="' + ii + '">↑</button>' +
        '<button class="btn small ghost" data-act="pMove" data-d="1" data-p="' + di + '" data-ii="' + ii + '">↓</button>' +
        '<button class="btn small danger" data-act="pDel" data-p="' + di + '" data-ii="' + ii + '">Убрать</button></div></div>';
    });
    h += '<button class="btn ghost wide" data-act="pAdd" data-p="' + di + '">+ упражнение</button></section>';
  });
  h += '<section class="card"><div class="exname">Своё упражнение в библиотеку</div><input class="txt" id="newExName" placeholder="название">' +
    '<select class="sel" id="newExType"><option value="barbell">штанга (шаг 2,5)</option><option value="dumbbell">гантели (шаг 1)</option><option value="machine">блок / тренажёр (шаг 2,5)</option><option value="bodyweight">свой вес (+доп. вес)</option></select>' +
    '<button class="btn primary wide" data-act="libAdd">Добавить</button></section>';
  v.innerHTML = h;
}

// ---------- роутинг ----------
const VIEWS = { home: vHome, w: vWorkout, history: vHistory, progress: vProgress, body: vBody, settings: vSettings, program: vProgram };
function render() {
  const [r, a] = (location.hash.slice(1) || 'home').split('/');
  const tab = { w: 'home', program: 'settings' }[r] || r;
  document.querySelectorAll('.tabs a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  (VIEWS[r] || vHome)($('#view'), a);
  topDetail(); syncWake();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---------- действия ----------
const getW = id => S.workouts.find(x => x.id === id);
const ACT = {
  start(d) { if (!activeWorkout()) startWorkout(d.day); },
  w(d) {
    const w = getW(d.w), e = w.entries[d.i], arr = e[d.k], s = arr[d.j], old = s.w;
    s.w = Math.max(0, Math.round((s.w + d.d * stepOf(e.ex)) * 100) / 100);
    if (d.k === 'sets') for (let k = +d.j + 1; k < arr.length; k++) if (!arr[k].done && arr[k].w === old) arr[k].w = s.w;
  },
  wEdit(d) {
    const w = getW(d.w), e = w.entries[d.i], arr = e[d.k], s = arr[d.j], old = s.w;
    const v = prompt(exOf(e.ex).name + ' — вес, кг', fmtW(s.w)); if (v == null) return false;
    const n = parseFloat(v.replace(',', '.')); if (isNaN(n) || n < 0 || n > 500) return false;
    s.w = Math.round(n * 100) / 100;
    if (d.k === 'sets') for (let k = +d.j + 1; k < arr.length; k++) if (!arr[k].done && arr[k].w === old) arr[k].w = s.w;
  },
  r(d) { const s = getW(d.w).entries[d.i][d.k][d.j]; s.r = Math.min(100, Math.max(0, s.r + +d.d)); },
  done(d) {
    const e = getW(d.w).entries[d.i], s = e[d.k][d.j];
    s.done = !s.done;
    if (s.done) d.k === 'warm' ? startTimer(60, 90, 'разминка') : startTimer(e.restMin, e.restMax, exOf(e.ex).name);
  },
  setCount(d) {
    const e = getW(d.w).entries[d.i];
    if (+d.d > 0) { const l = e.sets[e.sets.length - 1] || { w: 0, r: e.rMin }; e.sets.push({ w: l.w, r: l.r, done: false }); }
    else if (e.sets.length > 1) e.sets.pop();
  },
  exMenu(d) {
    const w = getW(d.w), i = +d.i, e = w.entries[i];
    sheet(exOf(e.ex).name, [
      { label: 'Заменить упражнение', fn: () => pickExercise('Заменить на', id => {
        const ne = makeEntry({ ex: id, sets: e.sets.length, rMin: e.rMin, rMax: e.rMax, restMin: e.restMin, restMax: e.restMax, start: 0, warmup: 0 }, w.deload);
        w.entries[i] = ne; save(); render();
      }) },
      { label: 'Выше', fn: () => { if (i > 0) { w.entries.splice(i - 1, 0, w.entries.splice(i, 1)[0]); save(); render(); } } },
      { label: 'Ниже', fn: () => { if (i < w.entries.length - 1) { w.entries.splice(i + 1, 0, w.entries.splice(i, 1)[0]); save(); render(); } } },
      { label: 'Убрать из этой тренировки', cls: 'danger', fn: () => { w.entries.splice(i, 1); save(); render(); } },
    ]);
    return false;
  },
  addEx(d) {
    const w = getW(d.w);
    pickExercise('Добавить упражнение', id => {
      w.entries.push(makeEntry({ ex: id, sets: 3, rMin: 8, rMax: 12, restMin: 90, restMax: 120, start: 0, warmup: 0 }, w.deload));
      save(); render();
    });
    return false;
  },
  feel(d) { const w = getW(d.w); w.feel = w.feel === d.v ? '' : d.v; },
  finish(d) {
    const w = getW(d.w); w.finished = true; S.timer = null; save(); tick();
    const done = w.entries.flatMap(e => e.sets).filter(s => s.done).length;
    toast('Сохранено: ' + done + ' подходов'); location.hash = '#home'; return false;
  },
  delWorkout(d) {
    if (!confirm('Удалить эту тренировку насовсем?')) return false;
    S.workouts = S.workouts.filter(w => w.id !== d.w); save(); location.hash = '#history'; return false;
  },
  supp() { const t = todayStr(); if (S.supps[t]) delete S.supps[t]; else S.supps[t] = true;
    const keys = Object.keys(S.supps).sort(); while (keys.length > 60) delete S.supps[keys.shift()]; },
  bodyStep(d) { bodyDraft = Math.max(30, Math.round((bodyDraft + +d.d) * 10) / 10); },
  bodyEdit() {
    const v = prompt('Вес тела, кг', fmtW(bodyDraft)); if (v == null) return false;
    const n = parseFloat(v.replace(',', '.')); if (isNaN(n) || n < 30 || n > 250) return false;
    bodyDraft = Math.round(n * 10) / 10;
  },
  bodySave() { const t = todayStr(); S.body = S.body.filter(b => b.date !== t); S.body.push({ date: t, kg: bodyDraft }); toast('Вес ' + fmtW(bodyDraft) + ' кг записан'); },
  bodyDel(d) { S.body = S.body.filter(b => b.date !== d.date); },
  notifPerm() { askNotify(); setTimeout(render, 1500); },
  export() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fitlog-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return false;
  },
  import() { $('#importFile').click(); return false; },
  resetProgram() { if (!confirm('Вернуть стандартную программу? История тренировок останется.')) return false; S.program = clone(DEFAULT_PROGRAM); toast('Программа сброшена'); },
  pMove(d) { const items = S.program[d.p].items, i = +d.ii, j = i + +d.d; if (j >= 0 && j < items.length) items.splice(j, 0, items.splice(i, 1)[0]); },
  pDel(d) { const it = S.program[d.p].items[d.ii]; if (!confirm('Убрать «' + exOf(it.ex).name + '» из программы?')) return false; S.program[d.p].items.splice(d.ii, 1); },
  pAdd(d) { pickExercise('Добавить в программу', id => { S.program[d.p].items.push(it(id, 3, 8, 12, 90, 120)); save(); render(); }); return false; },
  libAdd() {
    const name = $('#newExName').value.trim(); if (!name) { toast('Впиши название'); return false; }
    S.exercises['my_' + uid()] = { name, type: $('#newExType').value, custom: true }; toast('Добавлено: ' + name);
  },
};
document.addEventListener('click', ev => {
  unlockAudio();
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  if (fn(b.dataset) === false) return;
  save(); render();
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'note') { const w = getW(ev.target.dataset.w); if (w) { w.note = ev.target.value; save(); } }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); render(); return; }
  if (t.dataset.p == null || !t.dataset.f) return;
  const day = S.program[t.dataset.p];
  if (t.dataset.f === 'sub') day.sub = t.value;
  else {
    const item = day.items[t.dataset.ii];
    if (t.dataset.f === 'ex') item.ex = t.value;
    else { const n = parseFloat(String(t.value).replace(',', '.')); if (!isNaN(n) && n >= 0) item[t.dataset.f] = n; }
    if (item.rMax < item.rMin) item.rMax = item.rMin;
    if (item.restMax < item.restMin) item.restMax = item.restMin;
    item.sets = Math.max(1, Math.round(item.sets));
  }
  save(); render();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
render(); tick(); suppCheck();
