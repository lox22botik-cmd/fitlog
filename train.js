'use strict';
// Тренировки: программа, подсказка веса, разгрузка, таймер, экран тренировки, история, прогресс упражнения.

function fmtRest(a, b) {
  const f = s => s % 60 === 0 ? String(s / 60) : fmtW(s / 60);
  return a === b ? (a < 120 ? a + ' с' : f(a) + ' мин') : f(a) + '–' + f(b) + ' мин';
}
const exOf = id => S.exercises[id] || { name: id, type: 'machine', mg: 'другое' };
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
const doneSets = w => w.entries.flatMap(e => e.sets.filter(s => s.done));
const tonnage = w => sum(doneSets(w).map(s => s.w * s.r));
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
  if (!h.length) return { w: item.start || 0, why: item.start ? 'стартовый вес' : 'первый раз — подбери рабочий вес (нажми на число)' };
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
function weekNo(dateStr) { return Math.floor(daysBetween(S.settings.cycleStart, mondayOf(dateStr)) / 7); }
function isDeload(dateStr) { const n = weekNo(dateStr); return n >= 0 && n % 6 === 5; }
function plannedWeight(exId, item, deload) {
  const sg = suggest(exId, item);
  if (!deload) return { w: sg.w, hint: sg.why };
  return { w: roundTo(sg.w * 0.7, stepOf(exId)), hint: 'лёгкая неделя: −30% от ' + fmtW(sg.w) + ' кг' };
}

// ---------- создание тренировки ----------
function warmups(w, n) {
  const p = [0, 0.5, 0.75, 0.85], r = [10, 5, 3, 2], out = [];
  for (let i = 0; i < n; i++) out.push({ w: i === 0 ? 20 : Math.max(20, roundTo(w * p[i], 2.5)), r: r[i], done: false });
  return out;
}
const freeItem = id => ({ ex: id, sets: 3, rMin: 8, rMax: 12, restMin: 90, restMax: 120, start: 0, warmup: 0 });
function makeEntry(item, deload) {
  const pw = plannedWeight(item.ex, item, deload);
  return {
    ex: item.ex, rMin: item.rMin, rMax: item.rMax, restMin: item.restMin, restMax: item.restMax, hint: pw.hint,
    warm: item.warmup ? warmups(pw.w, item.warmup) : [],
    sets: Array.from({ length: item.sets }, () => ({ w: pw.w, r: item.rMin, done: false })),
  };
}
// dayId = null — пустая тренировка. date — можно задним числом.
function startWorkout(dayId, date) {
  date = date || todayStr();
  const day = dayId ? S.program.find(d => d.id === dayId) : null, deload = isDeload(date);
  const w = {
    id: uid(), date, started: Date.now(), dayId: dayId || null, title: day ? day.title : 'Своя тренировка', sub: day ? day.sub : '',
    deload, finished: false, feel: '', note: '', entries: day ? day.items.map(it => makeEntry(it, deload)) : [],
  };
  S.workouts.push(w); save(); askNotify();
  location.hash = '#w/' + w.id;
}
const activeWorkout = () => sortedWorkouts().find(w => !w.finished);
function startMenu(date) {
  const past = date && date !== todayStr();
  sheet(past ? 'Тренировка за ' + fmtDate(date) : 'Новая тренировка', S.program.map(d => ({
    html: '<b>' + esc(d.title) + '</b><span class="muted"> · ' + esc(d.sub) + '</span>', fn: () => startWorkout(d.id, date),
  })).concat([{ html: '<b>Своя тренировка</b><span class="muted"> · пустая, добавлю упражнения сам</span>', fn: () => startWorkout(null, date) }]));
}
// Рекорды: лучший вес и лучший расчётный 1ПМ по упражнению до этой тренировки
function recordsIn(w) {
  const out = [];
  for (const e of w.entries) {
    if (!e.sets.some(s => s.done) || w.deload) continue;
    const prev = history(e.ex, { before: w });
    if (!prev.length) continue;
    const bw = Math.max(...prev.map(x => topW(x.e))), be = Math.max(...prev.map(x => e1rm(x.e) || 0));
    const tw = topW(e), te = e1rm(e) || 0;
    if (tw > bw) out.push(exOf(e.ex).name + ': ' + fmtW(tw) + ' кг');
    else if (te > be + 0.5) out.push(exOf(e.ex).name + ': 1ПМ ≈ ' + Math.round(te));
  }
  return out;
}

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
  const { r, a } = route();
  const w = r === 'w' && S.workouts.find(x => x.id === a);
  const want = S.settings.wake && w && !w.finished && !document.hidden;
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } syncWake(); });

// ---------- ближайшая тренировка по плану ----------
function nextDay() {
  const dow = new Date().getDay(), t = todayStr();
  let best = null;
  for (const d of S.program) {
    let diff = (d.dow - dow + 7) % 7;
    if (diff === 0 && S.workouts.some(w => w.date === t && w.finished)) diff = 7;
    if (!best || diff < best.diff) best = { d, diff };
  }
  return best;
}
function planCard(nd, hero) {
  const d = nd.d, dl = isDeload(addDays(todayStr(), nd.diff));
  const when = nd.diff === 0 ? 'Сегодня по плану' : nd.diff === 1 ? 'Завтра' : 'Через ' + nd.diff + ' ' + plural(nd.diff, 'день', 'дня', 'дней');
  return '<section class="card ' + (hero ? 'hero' : '') + '"><div class="muted">' + when + '</div><div class="big">' + esc(d.title) + '</div><div class="muted">' + esc(d.sub) + '</div><ul class="plan">' +
    d.items.map(it => {
      const pw = plannedWeight(it.ex, it, dl), bw = exOf(it.ex).type === 'bodyweight';
      return '<li><span>' + esc(exOf(it.ex).name) + '</span><span class="mono">' + it.sets + '×' + (it.rMin === it.rMax ? it.rMin : it.rMin + '–' + it.rMax) +
        (pw.w || bw ? ' · ' + (bw ? '+' : '') + fmtW(pw.w) + ' кг' : '') + '</span></li>';
    }).join('') + '</ul>' +
    (nd.diff === 0 && !activeWorkout() ? '<button class="btn primary wide" data-act="start" data-day="' + d.id + '">Начать</button>' : '') + '</section>';
}

// ---------- экран тренировки ----------
function setRow(w, e, i, kind, j, s, p, label) {
  const bw = exOf(e.ex).type === 'bodyweight';
  const a = 'data-w="' + w.id + '" data-i="' + i + '" data-k="' + kind + '" data-j="' + j + '"';
  return '<div class="set ' + (s.done ? 'done' : '') + (kind === 'warm' ? ' warm' : '') + '">' +
    '<div class="sn mono">' + label + '</div>' +
    '<div class="stepper"><button data-act="w" data-d="-1" ' + a + '>−</button><div class="val mono" data-act="wEdit" ' + a + '>' + (bw ? '+' : '') + fmtW(s.w) + '<small>кг</small></div><button data-act="w" data-d="1" ' + a + '>+</button></div>' +
    '<div class="stepper"><button data-act="r" data-d="-1" ' + a + '>−</button><div class="val mono" data-act="rEdit" ' + a + '>' + s.r + '<small>повт</small></div><button data-act="r" data-d="1" ' + a + '>+</button></div>' +
    '<button class="check ' + (s.done ? 'on' : '') + '" data-act="done" ' + a + ' aria-label="подход сделан">' + (s.done ? '✓' : '') + '</button></div>' +
    (p ? '<div class="prev mono">прошлый раз: ' + fmtW(p.w) + ' × ' + p.r + (p.done ? '' : ' (не сделан)') + '</div>' : '');
}
function entryCard(w, e, i) {
  const ex = exOf(e.ex), prev = history(e.ex, { before: w, deload: true })[0];
  const rep = e.rMin === e.rMax ? e.rMin : e.rMin + '–' + e.rMax;
  let h = '<section class="card ex"><div class="exhead"><div><div class="exname">' + esc(ex.name) + '</div><div class="muted">' +
    e.sets.length + '×' + rep + (ex.perArm ? ' на руку' : '') + ' · отдых ' + fmtRest(e.restMin, e.restMax) + ' · ' + esc(ex.mg || '') + (typeof TECH_IDS !== 'undefined' && TECH_IDS.includes(e.ex) ? ' · <a class="tlink" href="tech.html#' + e.ex + '">▶ техника</a>' : '') + '</div></div>' +
    '<button class="icon" data-act="exMenu" data-w="' + w.id + '" data-i="' + i + '" aria-label="меню">⋯</button></div>';
  if (e.hint) h += '<div class="hint">→ ' + esc(e.hint) + '</div>';
  if (e.warm.length) {
    h += '<div class="sub">Разминка · не в зачёт</div>';
    e.warm.forEach((s, j) => { h += setRow(w, e, i, 'warm', j, s, null, 'Р' + (j + 1)); });
    h += '<div class="sub">Рабочие</div>';
  }
  e.sets.forEach((s, j) => { h += setRow(w, e, i, 'sets', j, s, prev && prev.e.sets[j], j + 1); });
  h += '<div class="rowbtns"><button class="btn small ghost" data-act="setCount" data-d="-1" data-w="' + w.id + '" data-i="' + i + '">− подход</button>' +
    '<button class="btn small ghost" data-act="setCount" data-d="1" data-w="' + w.id + '" data-i="' + i + '">+ подход</button>' +
    '<button class="btn small ghost" data-act="allDone" data-w="' + w.id + '" data-i="' + i + '">все ✓</button></div></section>';
  return h;
}
VIEWS.w = function (v, id) {
  const w = S.workouts.find(x => x.id === id);
  if (!w) { setTitle('Тренировка'); v.innerHTML = '<div class="card">Тренировка не найдена.</div>'; return; }
  setTitle(w.title);
  const ds = doneSets(w), all = w.entries.flatMap(e => e.sets);
  let h = '<div class="whead"><button class="chip" data-act="wDate" data-w="' + w.id + '">📅 ' + fmtDate(w.date) + '</button>' +
    '<button class="chip" data-act="wTitle" data-w="' + w.id + '">✎ название</button>' + (w.finished ? '<span class="pill ok">завершена</span>' : '') + '</div>';
  h += '<div class="tiles"><div class="tile"><div class="muted">Подходы</div><div class="big mono">' + ds.length + '/' + all.length + '</div></div>' +
    '<div class="tile"><div class="muted">Объём, кг</div><div class="big mono">' + Math.round(tonnage(w)).toLocaleString('ru') + '</div></div>' +
    '<div class="tile"><div class="muted">Упражнений</div><div class="big mono">' + w.entries.length + '</div></div></div>';
  if (w.deload) h += '<div class="banner deload"><b>Лёгкая неделя.</b> Веса −30%. Без отказа — техника и восстановление.</div>';
  if (!w.entries.length) h += '<div class="empty">Добавь упражнения, которые сделал, — кнопка ниже.</div>';
  w.entries.forEach((e, i) => { h += entryCard(w, e, i); });
  h += '<button class="btn ghost wide" data-act="addEx" data-w="' + w.id + '">+ упражнение</button>';
  h += '<section class="card"><div class="exname">Самочувствие на тренировке</div><div class="feel">' + ['легко', 'нормально', 'тяжело'].map(f =>
    '<button class="btn ' + (w.feel === f ? 'primary' : 'ghost') + '" data-act="feel" data-v="' + f + '" data-w="' + w.id + '">' + f + '</button>').join('') + '</div>' +
    '<div class="exname" style="margin-top:14px">Заметки</div><textarea id="note" data-w="' + w.id + '" rows="3" placeholder="как шло, что болело, что поменять">' + esc(w.note) + '</textarea></section>';
  h += w.finished ? '<button class="btn danger wide" data-act="delWorkout" data-w="' + w.id + '">Удалить тренировку</button>'
    : '<button class="btn primary wide" data-act="finish" data-w="' + w.id + '">Завершить тренировку</button>' +
      '<button class="btn danger wide" data-act="delWorkout" data-w="' + w.id + '">Отменить и удалить</button>';
  v.innerHTML = h;
};
TAB_OF.w = 'train';

// ---------- вкладка «Тренировки» ----------
VIEWS.train = function (v) {
  setTitle('Тренировки');
  const act = activeWorkout(), nd = nextDay(), t = todayStr();
  let h = '';
  if (isDeload(t)) h += '<div class="banner deload"><b>Лёгкая неделя.</b> Веса −30%, без отказа — восстанавливаемся.</div>';
  if (act) h += '<a class="card hero row-card" href="#w/' + act.id + '"><div><div class="muted">Идёт · ' + fmtDate(act.date) + '</div><div class="big">' + esc(act.title) + '</div></div><div class="big">›</div></a>';
  h += '<div class="grid2"><button class="btn primary" data-act="startMenu">Начать тренировку</button><button class="btn ghost" data-act="pastWorkout">Записать прошедшую</button></div>';
  if (nd) h += planCard(nd, false);
  h += '<div class="grid2"><a class="btn ghost" href="#program">Программа</a><a class="btn ghost" href="#ex/bench">Прогресс упражнений</a></div>';
  const list = sortedWorkouts();
  h += '<div class="sec-t">История</div>';
  if (!list.length) h += '<div class="empty">Пока пусто. Начни тренировку или запиши прошедшую.</div>';
  h += list.map(w => {
    const sets = w.entries.flatMap(e => e.sets), done = sets.filter(s => s.done);
    return '<a class="card hist" href="#w/' + w.id + '"><div class="hist-top"><b>' + esc(w.title) + '</b><span class="muted">' + fmtDate(w.date) + '</span></div>' +
      '<div class="hist-meta">' + w.entries.map(e => esc(exOf(e.ex).name)).join(' · ') + '</div>' +
      '<div class="hist-meta mono">' + done.length + '/' + sets.length + ' подх. · ' + Math.round(tonnage(w)).toLocaleString('ru') + ' кг объём</div><div class="pills">' +
      (w.deload ? '<span class="pill">разгрузка</span>' : '') + (w.feel ? '<span class="pill">' + esc(w.feel) + '</span>' : '') +
      (w.finished ? '' : '<span class="pill warn">не завершена</span>') + (w.note ? '<span class="pill">заметка</span>' : '') + '</div></a>';
  }).join('');
  v.innerHTML = h;
};

// ---------- прогресс по упражнению ----------
VIEWS.ex = function (v, exArg) {
  setTitle('Упражнение');
  const withData = Object.keys(S.exercises).filter(id => history(id).length);
  const exId = exArg && S.exercises[exArg] ? exArg : 'bench';
  if (!withData.includes(exId)) withData.unshift(exId);
  const ex = exOf(exId), h = history(exId).slice().reverse(), bw = ex.type === 'bodyweight';
  const pw = h.map(x => { const tw = topW(x.e), s = x.e.sets.find(q => q.done && q.w === tw); return { x: x.w.date, y: tw, note: s ? '× ' + s.r : '' }; });
  const pe = bw ? [] : h.map(x => ({ x: x.w.date, y: e1rm(x.e) })).filter(p => p.y);
  const pv = h.map(x => ({ label: fmtShort(x.w.date), title: fmtDate(x.w.date), y: sum(x.e.sets.filter(s => s.done).map(s => s.w * s.r)) }));
  const pr = h.map(x => ({ label: fmtShort(x.w.date), title: fmtDate(x.w.date), y: sum(x.e.sets.filter(s => s.done).map(s => s.r)) }));
  const series = [{ name: bw ? 'доп. вес' : 'рабочий вес', color: 'var(--s1)', pts: pw }];
  if (!bw) series.push({ name: 'расчётный 1ПМ', color: 'var(--s2)', pts: pe });
  const bestW = pw.length ? Math.max(...pw.map(p => p.y)) : null, bestE = pe.length ? Math.max(...pe.map(p => p.y)) : null;
  const d = pw.length > 1 ? pw[pw.length - 1].y - pw[0].y : null;
  const tile = (l, val) => '<div class="tile"><div class="muted">' + l + '</div><div class="big mono">' + val + '</div></div>';
  const rows = h.slice().reverse().slice(0, 15).map(x => '<tr><td>' + fmtShort(x.w.date) + '</td><td class="mono">' +
    x.e.sets.filter(s => s.done).map(s => fmtW(s.w) + '×' + s.r).join(' ') + '</td><td class="mono">' + (bw ? '' : Math.round(e1rm(x.e) || 0)) + '</td></tr>').join('');
  v.innerHTML = '<select id="exSel" class="sel">' + withData.map(id => '<option value="' + id + '"' + (id === exId ? ' selected' : '') + '>' + esc(exOf(id).name) + '</option>').join('') + '</select>' +
    '<div class="tiles">' + tile('Сейчас', pw.length ? fmtW(pw[pw.length - 1].y) : '—') + tile('Лучший вес', bestW != null ? fmtW(bestW) : '—') +
    (bw ? tile('Тренировок', h.length) : tile('Лучший 1ПМ', bestE ? Math.round(bestE) : '—')) + tile('С начала', d == null ? '—' : (d >= 0 ? '+' : '') + fmtW(d)) + '</div>' +
    '<section class="card"><div class="exname">Вес' + (bw ? '' : ' и расчётный 1ПМ') + '</div>' + lineChart('exw', series, { unit: 'кг', empty: 'По этому упражнению ещё нет сделанных подходов.' }) + '</section>' +
    (bw ? '' : '<div class="muted small-note">1ПМ — расчёт по формуле Эпли: вес × (1 + повторы / 30). Не проверка максимума. Разгрузочные недели не входят.</div>') +
    (h.length ? '<section class="card"><div class="exname">' + (bw ? 'Сумма повторов' : 'Объём за тренировку, кг') + '</div>' + barChart('exv', bw ? pr : pv, { unit: bw ? 'повт' : 'кг', fmt: x => Math.round(x).toLocaleString('ru') }) + '</section>' : '') +
    (rows ? '<section class="card"><table class="tbl"><tr><th>Дата</th><th>Подходы</th><th>' + (bw ? '' : '1ПМ') + '</th></tr>' + rows + '</table></section>' : '');
  $('#exSel').onchange = e => { location.hash = '#ex/' + e.target.value; };
};
TAB_OF.ex = 'stats';

// ---------- программа ----------
function exOptions(sel) {
  return Object.keys(S.exercises).sort((a, b) => (!!exOf(a).spare - !!exOf(b).spare) || exOf(a).name.localeCompare(exOf(b).name, 'ru'))
    .map(id => '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(exOf(id).name) + (exOf(id).spare ? ' (запасное)' : '') + '</option>').join('');
}
VIEWS.program = function (v) {
  setTitle('Программа');
  const num = (di, ii, f, val, label, step) => '<label class="field">' + label + '<input type="number" inputmode="decimal" step="' + (step || 1) + '" min="0" data-p="' + di + '" data-ii="' + ii + '" data-f="' + f + '" value="' + val + '"></label>';
  let h = '<div class="muted small-note">Изменения применяются к следующим тренировкам. Прошлые записи не меняются. Отдых — в секундах.</div>';
  S.program.forEach((d, di) => {
    h += '<section class="card"><div class="big">' + esc(d.title) + '</div><input class="txt" data-p="' + di + '" data-f="sub" value="' + esc(d.sub) + '">' +
      '<label class="field">День недели<select class="sel" data-p="' + di + '" data-f="dow">' + [1, 2, 3, 4, 5, 6, 0].map(n => '<option value="' + n + '"' + (n === d.dow ? ' selected' : '') + '>' + ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][n] + '</option>').join('') + '</select></label>';
    d.items.forEach((it, ii) => {
      h += '<div class="pitem"><div class="pitem-top"><span class="sn mono">' + (ii + 1) + '</span><select class="sel" data-p="' + di + '" data-ii="' + ii + '" data-f="ex">' + exOptions(it.ex) + '</select></div>' +
        '<div class="pgrid">' + num(di, ii, 'sets', it.sets, 'Подходы') + num(di, ii, 'rMin', it.rMin, 'Повт. от') + num(di, ii, 'rMax', it.rMax, 'Повт. до') +
        num(di, ii, 'restMin', it.restMin, 'Отдых от', 15) + num(di, ii, 'restMax', it.restMax, 'Отдых до', 15) + num(di, ii, 'start', it.start, 'Старт, кг', 0.5) +
        num(di, ii, 'warmup', it.warmup, 'Разминка') + '</div>' +
        '<div class="rowbtns"><button class="btn small ghost" data-act="pMove" data-d="-1" data-p="' + di + '" data-ii="' + ii + '">↑</button>' +
        '<button class="btn small ghost" data-act="pMove" data-d="1" data-p="' + di + '" data-ii="' + ii + '">↓</button>' +
        '<button class="btn small danger" data-act="pDel" data-p="' + di + '" data-ii="' + ii + '">Убрать</button></div></div>';
    });
    h += '<button class="btn ghost wide" data-act="pAdd" data-p="' + di + '">+ упражнение</button></section>';
  });
  h += '<section class="card"><div class="exname">Библиотека упражнений</div><div class="muted">Своё упражнение — появится в выборе везде.</div>' +
    '<button class="btn primary wide" data-act="libAdd">+ своё упражнение</button>' +
    Object.keys(S.exercises).filter(id => S.exercises[id].custom).map(id => '<div class="row-line"><span>' + esc(exOf(id).name) + ' <span class="muted">· ' + esc(exOf(id).mg) + '</span></span><button class="icon" data-act="libDel" data-id="' + id + '">✕</button></div>').join('') +
    '</section><button class="btn danger wide" data-act="resetProgram">Вернуть программу по умолчанию</button>';
  v.innerHTML = h;
};
TAB_OF.program = 'train';

// ---------- действия ----------
const getW = id => S.workouts.find(x => x.id === id);
function pickExercise(title, fn) {
  const ids = Object.keys(S.exercises).sort((a, b) =>
    (!!exOf(a).spare - !!exOf(b).spare) || exOf(a).name.localeCompare(exOf(b).name, 'ru'));
  sheet(title, ids.map(id => ({ html: esc(exOf(id).name) + ' <span class="muted">· ' + esc(exOf(id).mg || '') + (exOf(id).spare ? ', запасное' : '') + '</span>', fn: () => fn(id) })));
}
function setWeight(d, val) {
  const e = getW(d.w).entries[d.i], arr = e[d.k], s = arr[d.j], old = s.w;
  s.w = Math.max(0, Math.round(val * 100) / 100);
  if (d.k === 'sets') for (let k = +d.j + 1; k < arr.length; k++) if (!arr[k].done && arr[k].w === old) arr[k].w = s.w;
}
Object.assign(ACT, {
  start(d) { if (!activeWorkout()) startWorkout(d.day); return false; },
  startMenu() { const a = activeWorkout(); if (a && !confirm('Есть незавершённая тренировка (' + a.title + '). Начать новую всё равно?')) return false; startMenu(); return false; },
  pastWorkout() {
    formSheet('Записать прошедшую', [{ k: 'date', label: 'Дата', type: 'date', value: addDays(todayStr(), -1) }], o => { if (o.date) setTimeout(() => startMenu(o.date), 50); });
    return false;
  },
  w(d) { const s = getW(d.w).entries[d.i][d.k][d.j]; setWeight(d, s.w + d.d * stepOf(getW(d.w).entries[d.i].ex)); },
  wEdit(d) {
    const e = getW(d.w).entries[d.i], n = askNum(exOf(e.ex).name + ' — вес, кг', e[d.k][d.j].w, 0, 500);
    if (n == null) return false; setWeight(d, n);
  },
  r(d) { const s = getW(d.w).entries[d.i][d.k][d.j]; s.r = Math.min(100, Math.max(0, s.r + +d.d)); },
  rEdit(d) { const s = getW(d.w).entries[d.i][d.k][d.j], n = askNum('Повторений', s.r, 0, 100); if (n == null) return false; s.r = Math.round(n); },
  done(d) {
    const w = getW(d.w), e = w.entries[d.i], s = e[d.k][d.j];
    s.done = !s.done;
    if (s.done && !w.finished && w.date === todayStr()) d.k === 'warm' ? startTimer(60, 90, 'разминка') : startTimer(e.restMin, e.restMax, exOf(e.ex).name);
  },
  allDone(d) { const e = getW(d.w).entries[d.i]; const v = !e.sets.every(s => s.done); e.sets.forEach(s => { s.done = v; }); },
  setCount(d) {
    const e = getW(d.w).entries[d.i];
    if (+d.d > 0) { const l = e.sets[e.sets.length - 1] || { w: 0, r: e.rMin }; e.sets.push({ w: l.w, r: l.r, done: false }); }
    else if (e.sets.length > 1) e.sets.pop();
  },
  exMenu(d) {
    const w = getW(d.w), i = +d.i, e = w.entries[i];
    sheet(exOf(e.ex).name, [
      { label: 'Заменить упражнение (только здесь)', fn: () => pickExercise('Заменить на', id => {
        w.entries[i] = makeEntry({ ex: id, sets: e.sets.length, rMin: e.rMin, rMax: e.rMax, restMin: e.restMin, restMax: e.restMax, start: 0, warmup: 0 }, w.deload);
        save(); render();
      }) },
      { label: 'Повторы и отдых', fn: () => formSheet('Цель по упражнению', [
        { k: 'rMin', label: 'Повторы от', type: 'number', value: e.rMin }, { k: 'rMax', label: 'Повторы до', type: 'number', value: e.rMax },
        { k: 'restMin', label: 'Отдых от, сек', type: 'number', value: e.restMin }, { k: 'restMax', label: 'Отдых до, сек', type: 'number', value: e.restMax }],
        o => { for (const k in o) if (o[k] != null && o[k] >= 0) e[k] = Math.round(o[k]); if (e.rMax < e.rMin) e.rMax = e.rMin; if (e.restMax < e.restMin) e.restMax = e.restMin; }) },
      { label: 'Разминочный подход +', fn: () => { e.warm.push({ w: 20, r: 10, done: false }); save(); render(); } },
      { label: 'Выше', fn: () => { if (i > 0) { w.entries.splice(i - 1, 0, w.entries.splice(i, 1)[0]); save(); render(); } } },
      { label: 'Ниже', fn: () => { if (i < w.entries.length - 1) { w.entries.splice(i + 1, 0, w.entries.splice(i, 1)[0]); save(); render(); } } },
      { label: '▶ Техника выполнения', fn: () => { location.href = 'tech.html#' + e.ex; } },
      { label: 'График этого упражнения', fn: () => { location.hash = '#ex/' + e.ex; } },
      { label: 'Убрать из этой тренировки', cls: 'danger', fn: () => { w.entries.splice(i, 1); save(); render(); } },
    ]);
    return false;
  },
  addEx(d) {
    const w = getW(d.w);
    pickExercise('Добавить упражнение', id => { w.entries.push(makeEntry(freeItem(id), w.deload)); save(); render(); });
    return false;
  },
  wDate(d) {
    const w = getW(d.w);
    formSheet('Дата тренировки', [{ k: 'date', label: 'Дата', type: 'date', value: w.date }], o => { if (o.date) { w.date = o.date; w.deload = isDeload(o.date); } });
    return false;
  },
  wTitle(d) { const w = getW(d.w), t = prompt('Название тренировки', w.title); if (t == null || !t.trim()) return false; w.title = t.trim(); },
  feel(d) { const w = getW(d.w); w.feel = w.feel === d.v ? '' : d.v; },
  finish(d) {
    const w = getW(d.w); w.finished = true; S.timer = null; save(); tick();
    const rec = recordsIn(w);
    toast(rec.length ? '🏆 Рекорд! ' + rec.join(', ') : 'Сохранено: ' + doneSets(w).length + ' подходов');
    location.hash = '#train'; return false;
  },
  delWorkout(d) {
    if (!confirm('Удалить эту тренировку насовсем?')) return false;
    S.workouts = S.workouts.filter(w => w.id !== d.w); save(); location.hash = '#train'; return false;
  },
  resetProgram() { if (!confirm('Вернуть стандартную программу? История тренировок останется.')) return false; S.program = clone(DEFAULT_PROGRAM); toast('Программа сброшена'); },
  pMove(d) { const items = S.program[d.p].items, i = +d.ii, j = i + +d.d; if (j >= 0 && j < items.length) items.splice(j, 0, items.splice(i, 1)[0]); },
  pDel(d) { const it = S.program[d.p].items[d.ii]; if (!confirm('Убрать «' + exOf(it.ex).name + '» из программы?')) return false; S.program[d.p].items.splice(d.ii, 1); },
  pAdd(d) { pickExercise('Добавить в программу', id => { S.program[d.p].items.push(freeItem(id)); save(); render(); }); return false; },
  libAdd() {
    formSheet('Своё упражнение', [
      { k: 'name', label: 'Название', value: '' },
      { k: 'type', label: 'Тип', type: 'select', value: 'machine', options: [['barbell', 'штанга (шаг 2,5)'], ['dumbbell', 'гантели (шаг 1)'], ['machine', 'блок / тренажёр (шаг 2,5)'], ['bodyweight', 'свой вес (+доп. вес)']] },
      { k: 'mg', label: 'Мышцы', type: 'select', value: 'другое', options: MUSCLES.map(m => [m, m]) }],
      o => { if (!o.name.trim()) return; S.exercises['my_' + uid()] = { name: o.name.trim(), type: o.type, mg: o.mg, custom: true }; toast('Добавлено: ' + o.name.trim()); });
    return false;
  },
  libDel(d) {
    const used = S.workouts.some(w => w.entries.some(e => e.ex === d.id)) || S.program.some(p => p.items.some(i => i.ex === d.id));
    if (used) { toast('Упражнение уже есть в тренировках или программе'); return false; }
    delete S.exercises[d.id];
  },
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'note') { const w = getW(ev.target.dataset.w); if (w) { w.note = ev.target.value; save(); } }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.p == null || !t.dataset.f) return;
  const day = S.program[t.dataset.p];
  if (t.dataset.f === 'sub') day.sub = t.value;
  else if (t.dataset.f === 'dow') day.dow = +t.value;
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
