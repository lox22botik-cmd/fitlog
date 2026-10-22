'use strict';
// «Сегодня», дневник дня (сон, вода, шаги, самочувствие, добавки) и тело (вес, замеры).

const dayRec = date => S.days[date] || (S.days[date] = {});
const dayGet = (date, k) => (S.days[date] || {})[k];
const SUPP_DUE_HOUR = 17;

function suppBlock(date) {
  const log = S.suppLog[date] || {}, list = S.settings.supps;
  if (!list.length) return '';
  const due = date === todayStr() && S.settings.reminder && new Date().getHours() >= SUPP_DUE_HOUR && list.some(n => !log[n]);
  return '<section class="card ' + (due ? 'due' : '') + '"><div class="meal-h"><b>Добавки</b><span class="muted">' + (due ? 'уже ' + SUPP_DUE_HOUR + ':00 — пора' : list.filter(n => log[n]).length + ' из ' + list.length) + '</span></div><div class="grid2">' +
    list.map(n => '<button class="btn ' + (log[n] ? 'okb' : 'ghost') + '" data-act="supp" data-date="' + date + '" data-n="' + esc(n) + '">' + (log[n] ? '✓ ' : '') + esc(n) + '</button>').join('') + '</div></section>';
}
function waterBlock(date) {
  const w = dayGet(date, 'water') || 0;
  return '<section class="card">' + meter('Вода', w, S.targets.water, 'мл', 'water') +
    '<div class="grid3"><button class="btn ghost" data-act="water" data-d="-250" data-date="' + date + '">−250</button><button class="btn ghost" data-act="water" data-d="250" data-date="' + date + '">+250</button><button class="btn ghost" data-act="water" data-d="500" data-date="' + date + '">+500</button></div></section>';
}
function sleepBlock(date) {
  const s = dayGet(date, 'sleep');
  return '<section class="card"><div class="meal-h"><b>Сон прошлой ночью</b><span class="muted">норма ' + fmtW(S.targets.sleep) + ' ч</span></div>' +
    '<div class="stepper big-step"><button data-act="dayStep" data-key="sleep" data-d="-0.5" data-date="' + date + '">−</button><div class="val mono" data-act="dayEdit" data-key="sleep" data-label="Сон, часов" data-max="24" data-date="' + date + '">' + (s == null ? '—' : fmtW(s)) + '<small>часов</small></div><button data-act="dayStep" data-key="sleep" data-d="0.5" data-date="' + date + '">+</button></div>' +
    '<div class="sub">Качество сна</div>' + rating('dayRate', date, 'sleepQ', dayGet(date, 'sleepQ'), ['ужас', 'плохо', 'норм', 'хорошо', 'супер']) + '</section>';
}

// Лента последних 7 дней: нажми на день — откроется его дневник, можно заполнить задним числом
function weekStrip(sel) {
  const t = todayStr(), end = sel && sel < addDays(t, -6) ? addDays(sel, 3) : t, out = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(end, -i);
    if (d > t) continue;
    const tr = S.workouts.some(w => w.date === d && doneSets(w).length), st = dayStatus(d), wd = WD[parseDate(d).getDay()];
    out.push('<a class="wd ' + (d === sel ? 'on ' : '') + (d === t ? 'today' : '') + '" href="#day/' + d + '"><span class="wd-n">' + wd + '</span><b class="mono">' + parseDate(d).getDate() + '</b>' +
      '<span class="wd-dots"><i class="fd ' + st + '"></i>' + (tr ? '<i class="fd tr"></i>' : '') + '</span></a>');
  }
  return '<section class="card strip-card"><div class="meal-h"><b>Дни</b><button class="linkbtn" data-act="pickDate" data-base="day" data-date="' + (sel || t) + '">📅 другой день</button></div>' +
    '<div class="strip">' + out.join('') + '</div><div class="strip-leg muted"><span><i class="fd ok"></i>норма</span><span><i class="fd mid"></i>недобор</span><span><i class="fd bad"></i>перебор</span><span><i class="fd tr"></i>тренировка</span></div></section>';
}

VIEWS.home = function (v) {
  setTitle('Сегодня');
  const t = todayStr(), act = activeWorkout(), nd = nextDay(), T = S.targets, tot = foodTotals(t);
  let h = '';
  const ws = weekSummary(mondayOf(t));
  h += '<div class="say top-say">' + esc(ws.text) + '</div>';
  h += weekStrip(t);
  h += '<a class="btn ghost wide fill-day" href="#day/' + addDays(t, -1) + '">✎ Заполнить вчерашний день</a>';
  if (isDeload(t)) h += '<div class="banner deload"><b>Лёгкая неделя.</b> Веса −30%, без отказа — восстанавливаемся.</div>';
  if (act) h += '<a class="card hero row-card" href="#w/' + act.id + '"><div><div class="muted">Идёт тренировка · ' + fmtDate(act.date) + '</div><div class="big">' + esc(act.title) + '</div><div class="muted mono">' +
    doneSets(act).length + ' / ' + act.entries.flatMap(e => e.sets).length + ' подходов</div></div><div class="big">›</div></a>';
  const doneToday = S.workouts.filter(w => w.date === t && w.finished);
  if (doneToday.length) h += doneToday.map(w => '<a class="card row-card okc" href="#w/' + w.id + '"><div><div class="muted">Сегодня сделано ✓</div><div class="exname">' + esc(w.title) + '</div><div class="muted mono">' + doneSets(w).length + ' подх. · ' + Math.round(tonnage(w)).toLocaleString('ru') + ' кг</div></div><div class="big">›</div></a>').join('');
  if (nd && !act) h += planCard(nd, nd.diff === 0 && !doneToday.length);
  if (!act) h += '<div class="grid2"><button class="btn ghost" data-act="startMenu">Другая тренировка</button><button class="btn ghost" data-act="pastWorkout">Записать прошедшую</button></div>';
  h += '<a class="card" href="#food"><div class="meal-h"><b>Питание</b><span class="muted">открыть ›</span></div>' + meter('Калории', tot.kcal, T.kcal, 'ккал', 'kcal') + meter('Белки', tot.p, T.p, 'г', 'p') + '</a>' +
    '<div class="grid3">' + [10, 20, 30].map(g => '<button class="btn ghost" data-act="quickP" data-g="' + g + '" data-date="' + t + '">+' + g + ' г белка</button>').join('') + '</div>';
  h += waterBlock(t) + suppBlock(t) + sleepBlock(t);
  h += '<section class="card"><div class="meal-h"><b>Энергия сегодня</b><a class="linkbtn" href="#day/' + t + '">весь дневник ›</a></div>' + rating('dayRate', t, 'energy', dayGet(t, 'energy'), ['0', 'мало', 'норм', 'бодро', 'огонь']) + '</section>';
  const lb = lastBody();
  h += '<a class="card row-card" href="#body"><div><div class="exname">Вес тела</div><div class="muted">' + (lb ? (lb.date === t ? 'записан сегодня' : 'последний: ' + fmtDate(lb.date)) : 'ещё нет записей') + '</div></div><div class="big mono">' + (lb ? fmtW(lb.kg) : '—') + '</div></a>';
  const wn = weekNo(t);
  if (wn >= 0) { const left = 5 - wn % 6; h += '<div class="muted center small-note">Неделя цикла ' + (wn % 6 + 1) + ' из 6 · ' + (left === 0 ? 'сейчас разгрузка' : 'разгрузка через ' + left + ' нед.') + '</div>'; }
  v.innerHTML = h;
};

VIEWS.day = function (v, dateArg) {
  setTitle('Дневник дня');
  const date = dateArg || todayStr(), r = S.days[date] || {}, tot = foodTotals(date);
  const ws = S.workouts.filter(w => w.date === date);
  let h = weekStrip(date) + dateNav('day', date);
  h += '<div class="tiles"><a class="tile" href="#food/' + date + '"><div class="muted">Еда</div><div class="big mono">' + Math.round(tot.kcal) + '</div><div class="muted mono">Б ' + Math.round(tot.p) + ' г</div></a>' +
    (ws.length ? '<a class="tile" href="#w/' + ws[0].id + '"><div class="muted">Тренировка</div><div class="big">✓</div><div class="muted">' + esc(ws[0].title) + '</div></a>'
      : '<button class="tile tile-btn" data-act="dayWorkout" data-date="' + date + '"><div class="muted">Тренировка</div><div class="big">+</div><div class="muted">записать</div></button>') +
    '<div class="tile"><div class="muted">Вес</div><div class="big mono">' + ((S.body.find(b => b.date === date) || {}).kg != null ? fmtW(S.body.find(b => b.date === date).kg) : '—') + '</div></div></div>';
  h += sleepBlock(date) + waterBlock(date);
  h += '<section class="card"><div class="meal-h"><b>Шаги</b><span class="muted">норма ' + S.targets.steps.toLocaleString('ru') + '</span></div>' + meter('Шаги', r.steps || 0, S.targets.steps, '', 'steps') +
    '<div class="grid3"><button class="btn ghost" data-act="dayEdit" data-key="steps" data-label="Шагов за день" data-max="100000" data-date="' + date + '">вписать</button><button class="btn ghost" data-act="dayStep" data-key="steps" data-d="1000" data-date="' + date + '">+1000</button><button class="btn ghost" data-act="dayStep" data-key="steps" data-d="-1000" data-date="' + date + '">−1000</button></div></section>';
  const rate = (k, title, labels) => '<div class="sub">' + title + '</div>' + rating('dayRate', date, k, r[k], labels);
  h += '<section class="card"><div class="exname">Самочувствие</div>' +
    rate('energy', 'Энергия', ['0', 'мало', 'норм', 'бодро', 'огонь']) +
    rate('mood', 'Настроение', ['😞', '😕', '😐', '🙂', '😄']) +
    rate('sore', 'Крепатура (боль в мышцах)', ['нет', 'чуть', 'средне', 'сильно', 'жесть']) +
    rate('stress', 'Стресс / учёба', ['нет', 'мало', 'средне', 'много', 'завал']) + '</section>';
  h += suppBlock(date);
  h += '<section class="card"><div class="exname">Заметка дня</div><textarea id="dayNote" data-date="' + date + '" rows="3" placeholder="что было, почему так спал/ел, что болит">' + esc(r.note || '') + '</textarea></section>';
  v.innerHTML = h;
};
TAB_OF.day = 'home';

const MEASURES = [['chest', 'Грудь'], ['arm', 'Бицепс (напряжённый)'], ['waist', 'Талия'], ['hips', 'Ягодицы'], ['thigh', 'Бедро'], ['calf', 'Икра'], ['neck', 'Шея']];
let bodyDraft = null;
VIEWS.body = function (v, mArg) {
  setTitle('Тело');
  const list = S.body.slice().sort((a, b) => a.date.localeCompare(b.date)), last = list[list.length - 1];
  if (bodyDraft == null) bodyDraft = last ? last.kg : 62;
  const first = list[0], monthAgo = list.filter(b => b.date <= addDays(todayStr(), -28)).pop(), weekAgo = list.filter(b => b.date <= addDays(todayStr(), -7)).pop();
  const sg = x => x == null ? '—' : (x >= 0 ? '+' : '') + fmtW(r1(x));
  // скользящее среднее за 7 дней — сглаживает скачки воды
  const ma = list.map(b => { const win = list.filter(x => x.date <= b.date && x.date > addDays(b.date, -7)); return { x: b.date, y: avg(win.map(x => x.kg)) }; });
  const mKey = MEASURES.some(m => m[0] === mArg) ? mArg : 'arm';
  const ms = S.measures.slice().sort((a, b) => a.date.localeCompare(b.date));
  const mPts = ms.filter(m => m[mKey] != null).map(m => ({ x: m.date, y: m[mKey] }));
  const lm = ms[ms.length - 1], fm = ms[0];
  let h = '<section class="card hero center"><div class="muted">Вес на ' + fmtDate(todayStr()) + ' · нажми на число, чтобы вписать</div>' +
    '<div class="huge mono" data-act="bodyEdit">' + fmtW(bodyDraft) + '</div><div class="body-in">' +
    ['-0.5', '-0.1', '0.1', '0.5'].map(d => '<button class="btn ghost" data-act="bodyStep" data-d="' + d + '">' + (d[0] === '-' ? '−' + d.slice(1) : '+' + d).replace('.', ',') + '</button>').join('') +
    '</div><button class="btn primary wide" data-act="bodySave">Записать</button></section>';
  h += '<div class="tiles"><div class="tile"><div class="muted">Сейчас</div><div class="big mono">' + (last ? fmtW(last.kg) : '—') + '</div></div>' +
    '<div class="tile"><div class="muted">За неделю</div><div class="big mono">' + sg(last && weekAgo ? last.kg - weekAgo.kg : null) + '</div></div>' +
    '<div class="tile"><div class="muted">За 4 нед.</div><div class="big mono">' + sg(last && monthAgo ? last.kg - monthAgo.kg : null) + '</div></div>' +
    '<div class="tile"><div class="muted">С начала</div><div class="big mono">' + sg(last && first && list.length > 1 ? last.kg - first.kg : null) + '</div></div></div>';
  h += '<section class="card"><div class="exname">Вес тела</div>' + lineChart('bw', [{ name: 'вес', color: 'var(--s1)', pts: list.map(b => ({ x: b.date, y: b.kg })) },
    { name: 'среднее за 7 дней', color: 'var(--s2)', pts: list.length > 2 ? ma : [], noDots: true }], { unit: 'кг', empty: 'Запиши вес — появится график.' }) +
    '<div class="muted small-note">Для набора хорошо +0,25…0,5 кг в неделю. Взвешивайся утром натощак — так точнее.</div></section>';
  h += '<div class="sec-t">Замеры, см</div><button class="btn primary wide" data-act="measureAdd">+ записать замеры</button>';
  if (ms.length) {
    h += '<div class="chips">' + MEASURES.map(m => '<a class="chip ' + (m[0] === mKey ? 'on' : '') + '" href="#body/' + m[0] + '">' + m[1] + '</a>').join('') + '</div>' +
      '<section class="card">' + lineChart('ms', [{ name: MEASURES.find(m => m[0] === mKey)[1], color: 'var(--s1)', pts: mPts }], { unit: 'см', empty: 'Этот замер ещё не записывал.' }) + '</section>' +
      '<section class="card"><table class="tbl"><tr><th>Замер</th><th>Сейчас</th><th>Изм.</th></tr>' + MEASURES.map(([k, n]) => {
        const lv = [...ms].reverse().find(m => m[k] != null), fv = ms.find(m => m[k] != null);
        return '<tr><td>' + n + '</td><td class="mono">' + (lv ? fmtW(lv[k]) : '—') + '</td><td class="mono">' + (lv && fv && lv !== fv ? sg(lv[k] - fv[k]) : '') + '</td></tr>';
      }).join('') + '</table><div class="muted small-note" style="margin:8px 0 0">Последние замеры: ' + fmtDate(lm.date) + (fm !== lm ? ', первые: ' + fmtDate(fm.date) : '') + '. Нажми на дату ниже, чтобы поправить.</div>' +
      '<div class="chips">' + ms.slice().reverse().map(m => '<button class="chip" data-act="measureEdit" data-date="' + m.date + '">' + fmtShort(m.date) + '</button>').join('') + '</div></section>';
  }
  if (list.length) h += '<div class="sec-t">Записи веса</div><section class="card"><table class="tbl">' + list.slice().reverse().slice(0, 30).map(b =>
    '<tr><td>' + fmtDate(b.date) + '</td><td class="mono">' + fmtW(b.kg) + ' кг</td><td><button class="icon" data-act="bodyFix" data-date="' + b.date + '" aria-label="изменить">✎</button><button class="icon" data-act="bodyDel" data-date="' + b.date + '" aria-label="удалить">✕</button></td></tr>').join('') + '</table></section>';
  v.innerHTML = h;
};
TAB_OF.body = 'stats';

function measureForm(m, isNew) {
  formSheet(isNew ? 'Замеры' : 'Замеры за ' + fmtDate(m.date), [{ k: 'date', label: 'Дата', type: 'date', value: m.date }]
    .concat(MEASURES.map(([k, n]) => ({ k, label: n + ', см', type: 'number', value: m[k] }))), o => {
    if (!o.date) return;
    const rec = { date: o.date }; MEASURES.forEach(([k]) => { if (o[k] != null && o[k] > 0) rec[k] = o[k]; });
    S.measures = S.measures.filter(x => x.date !== m.date && x.date !== o.date); S.measures.push(rec);
  }, isNew ? [] : [{ label: 'Удалить эти замеры', cls: 'danger', fn: () => { S.measures = S.measures.filter(x => x.date !== m.date); save(); render(); } }]);
}

Object.assign(ACT, {
  dayWorkout(d) { startMenu(d.date); return false; },
  supp(d) { const log = S.suppLog[d.date] = S.suppLog[d.date] || {}; log[d.n] = !log[d.n]; },
  water(d) { const r = dayRec(d.date); r.water = Math.max(0, (r.water || 0) + +d.d); },
  dayStep(d) {
    const r = dayRec(d.date), step = +d.d;
    if (d.key === 'sleep') r.sleep = Math.min(24, Math.max(0, (r.sleep == null ? 8 - step : r.sleep) + step));
    else r[d.key] = Math.max(0, (r[d.key] || 0) + step);
  },
  dayEdit(d) { const n = askNum(d.label, dayGet(d.date, d.key), 0, +d.max); if (n == null) return false; dayRec(d.date)[d.key] = d.key === 'steps' ? Math.round(n) : n; },
  dayRate(d) { const r = dayRec(d.date); r[d.key] = r[d.key] === +d.v ? undefined : +d.v; },
  bodyStep(d) { bodyDraft = Math.max(30, r1(bodyDraft + +d.d)); },
  bodyEdit() { const n = askNum('Вес тела, кг', bodyDraft, 30, 250); if (n == null) return false; bodyDraft = r1(n); },
  bodySave() { const t = todayStr(); S.body = S.body.filter(b => b.date !== t); S.body.push({ date: t, kg: bodyDraft }); toast('Вес ' + fmtW(bodyDraft) + ' кг записан'); },
  bodyFix(d) { const b = S.body.find(x => x.date === d.date), n = askNum('Вес за ' + fmtDate(d.date), b.kg, 30, 250); if (n == null) return false; b.kg = r1(n); },
  bodyDel(d) { if (!confirm('Удалить вес за ' + fmtDate(d.date) + '?')) return false; S.body = S.body.filter(b => b.date !== d.date); },
  measureAdd() { const last = S.measures.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || {}; measureForm(Object.assign({}, last, { date: todayStr() }), true); return false; },
  measureEdit(d) { measureForm(S.measures.find(m => m.date === d.date), false); return false; },
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'dayNote') { dayRec(ev.target.dataset.date).note = ev.target.value; save(); }
});
// Напоминание о добавках: уведомление в 17:00, если приложение открыто или висит в фоне.
function suppCheck() {
  const t = todayStr(), log = S.suppLog[t] || {};
  if (S.settings.reminder && new Date().getHours() >= SUPP_DUE_HOUR && S.settings.supps.some(n => !log[n]) && S.suppNotified !== t) {
    S.suppNotified = t; save(); notify(S.settings.supps.join(' + '), 'Пора выпить — отметь в приложении');
  }
}
setInterval(suppCheck, 30000);
