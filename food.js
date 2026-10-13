'use strict';
// Питание: записи за день, нормы, быстрый белок, база продуктов.

const foodOf = id => S.foods.find(f => f.id === id);
function foodEntry(f, g) {
  const k = g / 100;
  return { id: uid(), t: nowHM(), name: f.name, fid: f.id, g, kcal: r1(f.kcal * k), p: r1(f.p * k), f: r1(f.f * k), c: r1(f.c * k) };
}
function addFood(date, e) { (S.food[date] = S.food[date] || []).push(e); }
const MEALS = [['Утро', '00:00', '11:00'], ['День', '11:00', '16:00'], ['Вечер', '16:00', '21:00'], ['Поздно', '21:00', '24:00']];
function recentFoods(n) {
  const seen = new Set(), out = [];
  for (const d of Object.keys(S.food).sort().reverse()) for (const e of S.food[d].slice().reverse()) {
    const key = e.name + '|' + (e.g || '');
    if (!seen.has(key)) { seen.add(key); out.push(e); if (out.length >= n) return out; }
  }
  return out;
}
const macroLine = e => '<span class="mono">' + Math.round(e.kcal) + ' ккал · Б ' + fmtW(r1(e.p)) + ' · Ж ' + fmtW(r1(e.f)) + ' · У ' + fmtW(r1(e.c)) + '</span>';

function dateNav(base, date) {
  const t = todayStr();
  return '<div class="datenav"><a class="btn ghost" href="#' + base + '/' + addDays(date, -1) + '">‹</a><button class="btn ghost grow" data-act="pickDate" data-base="' + base + '" data-date="' + date + '">' + dayLabel(date) + '</button>' +
    (date < t ? '<a class="btn ghost" href="#' + base + '/' + addDays(date, 1) + '">›</a>' : '<span class="btn ghost off">›</span>') + '</div>';
}

VIEWS.food = function (v, dateArg) {
  setTitle('Питание');
  const date = dateArg || todayStr(), T = S.targets, tot = foodTotals(date), list = (S.food[date] || []).slice().sort((a, b) => a.t.localeCompare(b.t));
  const left = [];
  if (tot.p < T.p) left.push(Math.round(T.p - tot.p) + ' г белка');
  if (tot.kcal < T.kcal) left.push(Math.round(T.kcal - tot.kcal) + ' ккал');
  let h = dateNav('food', date);
  h += '<section class="card">' + meter('Калории', tot.kcal, T.kcal, 'ккал', 'kcal') + meter('Белки', tot.p, T.p, 'г', 'p') + meter('Жиры', tot.f, T.f, 'г', 'f') + meter('Углеводы', tot.c, T.c, 'г', 'c') +
    '<div class="say">' + (tot.n === 0 ? 'Записей за этот день нет.' : left.length ? 'Осталось добрать: ' + left.join(' и ') + '.' : 'Норма по белку и калориям выполнена 💪') + '</div></section>';
  h += '<div class="sec-t">Быстро добавить белок</div><div class="grid3">' + [10, 20, 30].map(g => '<button class="btn ghost" data-act="quickP" data-g="' + g + '" data-date="' + date + '">+' + g + ' г</button>').join('') + '</div>';
  h += '<div class="grid2"><button class="btn primary" data-act="foodPick" data-date="' + date + '">+ из продуктов</button><button class="btn ghost" data-act="foodCustom" data-date="' + date + '">+ своя запись</button></div>';
  const rec = recentFoods(8);
  if (rec.length) h += '<div class="sec-t">Повторить</div><div class="chips">' + rec.map((e, k) => '<button class="chip" data-act="foodRepeat" data-k="' + k + '" data-date="' + date + '">' + esc(e.name) + (e.g ? ' · ' + e.g + ' г' : '') + '</button>').join('') + '</div>';
  h += '<div class="sec-t">Съедено' + (list.length ? ' · ' + list.length + ' ' + plural(list.length, 'запись', 'записи', 'записей') : '') + '</div>';
  if (!list.length) h += '<div class="empty">Добавь еду кнопками выше. Можно и вечером одним списком — время поправишь.</div>';
  for (const [name, a, b] of MEALS) {
    const part = list.filter(e => e.t >= a && e.t < b);
    if (!part.length) continue;
    const pt = { kcal: sum(part.map(e => e.kcal)), p: sum(part.map(e => e.p)) };
    h += '<section class="card"><div class="meal-h"><b>' + name + '</b><span class="muted mono">' + Math.round(pt.kcal) + ' ккал · Б ' + Math.round(pt.p) + '</span></div>' +
      part.map(e => '<button class="food-row" data-act="foodMenu" data-id="' + e.id + '" data-date="' + date + '"><span class="mono muted">' + e.t + '</span><span class="grow"><b>' + esc(e.name) + '</b>' + (e.g ? ' <span class="muted">' + e.g + ' г</span>' : '') + '<br>' + macroLine(e) + '</span></button>').join('') + '</section>';
  }
  h += '<div class="grid2"><a class="btn ghost" href="#foods">Мои продукты</a><a class="btn ghost" href="#targets">Нормы</a></div>';
  v.innerHTML = h;
};
TAB_OF.food = 'food';

VIEWS.foods = function (v) {
  setTitle('Продукты');
  v.innerHTML = '<div class="muted small-note">Значения на 100 г — средние по таблицам. Сверь со своей упаковкой и поправь (нажми на продукт).</div>' +
    '<button class="btn primary wide" data-act="foodNew">+ новый продукт</button>' +
    '<section class="card">' + S.foods.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(f =>
      '<button class="food-row" data-act="foodEdit" data-id="' + f.id + '"><span class="grow"><b>' + esc(f.name) + '</b>' + (f.pc ? ' <span class="muted">· 1 шт ≈ ' + f.pc + ' г</span>' : '') + '<br><span class="mono muted">на 100 г: ' +
      f.kcal + ' ккал · Б ' + fmtW(f.p) + ' · Ж ' + fmtW(f.f) + ' · У ' + fmtW(f.c) + '</span></span></button>').join('') + '</section>';
};
TAB_OF.foods = 'food';

VIEWS.targets = function (v) {
  setTitle('Нормы');
  const T = S.targets, c = calcTargets(), p = S.profile, lb = lastBody();
  const row = (k, label, unit) => '<button class="row-line big-line" data-act="tEdit" data-k="' + k + '" data-label="' + label + '"><span>' + label + '</span><span class="mono"><b>' + fmtW(T[k]) + '</b> ' + unit + '</span></button>';
  v.innerHTML = '<section class="card"><div class="exname">Твои нормы в день</div><div class="muted">Нажми на строку, чтобы поменять.</div>' +
    row('kcal', 'Калории', 'ккал') + row('p', 'Белки', 'г') + row('f', 'Жиры', 'г') + row('c', 'Углеводы', 'г') + row('water', 'Вода', 'мл') + row('sleep', 'Сон', 'ч') + row('steps', 'Шаги', '') + '</section>' +
    '<section class="card"><div class="exname">Расчёт под набор массы</div><div class="muted">Вес ' + (lb ? fmtW(lb.kg) + ' кг (последняя запись)' : '62 кг (запиши свой во вкладке «Тело»)') + ', рост ' + p.h + ' см, возраст ' + p.age + '. ' +
    'Обмен по Миффлину–Сан Жеору × 1,55 (3 тренировки в неделю) + 300 ккал на рост. Белок 2 г/кг, жиры 1 г/кг, остальное — углеводы.</div>' +
    '<div class="say mono">' + c.kcal + ' ккал · Б ' + c.p + ' · Ж ' + c.f + ' · У ' + c.c + ' · вода ' + c.water + ' мл</div>' +
    '<div class="grid2"><button class="btn primary" data-act="tCalc">Применить расчёт</button><button class="btn ghost" data-act="profileEdit">Рост и возраст</button></div>' +
    '<div class="muted small-note" style="margin-top:10px">Если 2–3 недели вес не растёт — прибавь 200 ккал. Растёт быстрее 0,5 кг в неделю — убавь 200.</div></section>';
};
TAB_OF.targets = 'food';

function gramsSheet(f, date) {
  const opts = [];
  if (f.pc) [1, 2, 3].forEach(n => opts.push({ label: n + ' шт · ' + n * f.pc + ' г', fn: () => done(n * f.pc) }));
  [50, 100, 150, 200, 250, 300].forEach(g => opts.push({ label: g + ' г · ' + Math.round(f.kcal * g / 100) + ' ккал, Б ' + fmtW(r1(f.p * g / 100)), fn: () => done(g) }));
  opts.push({ label: 'Вписать граммы…', fn: () => { const g = askNum(f.name + ' — сколько грамм?', null, 1, 5000); if (g) done(g); } });
  function done(g) { addFood(date, foodEntry(f, g)); save(); render(); toast('+ ' + f.name + ', ' + g + ' г'); }
  sheet(f.name, opts);
}
function foodForm(title, e, onSave, extra) {
  formSheet(title, [
    { k: 'name', label: 'Что съел', value: e.name || '' },
    { k: 't', label: 'Время', type: 'time', value: e.t || nowHM() },
    { k: 'kcal', label: 'Ккал', type: 'number', value: e.kcal }, { k: 'p', label: 'Белки, г', type: 'number', value: e.p },
    { k: 'f', label: 'Жиры, г', type: 'number', value: e.f }, { k: 'c', label: 'Углеводы, г', type: 'number', value: e.c },
  ], o => {
    const out = { name: (o.name || '').trim() || 'Без названия', t: o.t || nowHM(), kcal: o.kcal || 0, p: o.p || 0, f: o.f || 0, c: o.c || 0 };
    if (!o.kcal && (out.p || out.f || out.c)) out.kcal = r1(out.p * 4 + out.f * 9 + out.c * 4); // не вписал ккал — посчитаем по БЖУ
    onSave(out);
  }, extra);
}
function findFood(date, id) { return (S.food[date] || []).find(e => e.id === id); }
Object.assign(ACT, {
  pickDate(d) {
    formSheet('Перейти к дню', [{ k: 'date', label: 'Дата', type: 'date', value: d.date }], o => { if (o.date && o.date <= todayStr()) setTimeout(() => { location.hash = '#' + d.base + '/' + o.date; }, 0); });
    return false;
  },
  quickP(d) { const g = +d.g; addFood(d.date, { id: uid(), t: nowHM(), name: 'Белок (быстро)', g: null, kcal: g * 4, p: g, f: 0, c: 0 }); toast('+' + g + ' г белка'); },
  foodPick(d) {
    const rec = recentFoods(30).map(e => e.fid).filter(Boolean);
    const ids = [...new Set(rec.concat(S.foods.map(f => f.id)))].filter(foodOf);
    sheet('Продукт', ids.map(id => { const f = foodOf(id); return { html: '<b>' + esc(f.name) + '</b> <span class="muted mono">' + f.kcal + ' ккал · Б ' + fmtW(f.p) + '</span>', fn: () => gramsSheet(f, d.date) }; }));
    return false;
  },
  foodCustom(d) { foodForm('Своя запись', {}, o => addFood(d.date, Object.assign({ id: uid(), g: null }, o))); return false; },
  foodRepeat(d) {
    const e = recentFoods(8)[+d.k]; if (!e) return false;
    addFood(d.date, Object.assign({}, e, { id: uid(), t: nowHM() })); toast('+ ' + e.name);
  },
  foodMenu(d) {
    const e = findFood(d.date, d.id); if (!e) return false;
    const f = e.fid && foodOf(e.fid);
    const opts = [];
    if (f && e.g) opts.push({ label: 'Изменить граммы (' + e.g + ' г)', fn: () => { const g = askNum('Сколько грамм?', e.g, 1, 5000); if (g) { Object.assign(e, foodEntry(f, g), { id: e.id, t: e.t }); save(); render(); } } });
    opts.push({ label: 'Изменить запись', fn: () => foodForm('Изменить', e, o => Object.assign(e, o)) });
    opts.push({ label: 'Повторить ещё раз', fn: () => { addFood(d.date, Object.assign({}, e, { id: uid(), t: nowHM() })); save(); render(); } });
    opts.push({ label: 'Удалить', cls: 'danger', fn: () => { S.food[d.date] = S.food[d.date].filter(x => x.id !== e.id); save(); render(); } });
    sheet(e.name, opts, '<div class="sheet-sub">' + macroLine(e) + '</div>');
    return false;
  },
  foodNew() { foodLibForm({ id: 'my_' + uid(), name: '', kcal: null, p: null, f: null, c: null }, true); return false; },
  foodEdit(d) { foodLibForm(foodOf(d.id), false); return false; },
  tEdit(d) { const n = askNum(d.label, S.targets[d.k], 0, 100000); if (n == null) return false; S.targets[d.k] = n; },
  tCalc() { S.targets = calcTargets(); toast('Нормы пересчитаны'); },
  profileEdit() {
    formSheet('Профиль', [{ k: 'h', label: 'Рост, см', type: 'number', value: S.profile.h }, { k: 'age', label: 'Возраст', type: 'number', value: S.profile.age },
      { k: 'sex', label: 'Пол', type: 'select', value: S.profile.sex, options: [['m', 'мужской'], ['f', 'женский']] }],
      o => { if (o.h > 100 && o.h < 250) S.profile.h = o.h; if (o.age > 5 && o.age < 100) S.profile.age = Math.round(o.age); S.profile.sex = o.sex; });
    return false;
  },
});
function foodLibForm(f, isNew) {
  formSheet(isNew ? 'Новый продукт' : 'Продукт', [
    { k: 'name', label: 'Название', value: f.name },
    { k: 'kcal', label: 'Ккал на 100 г', type: 'number', value: f.kcal }, { k: 'p', label: 'Белки на 100 г', type: 'number', value: f.p },
    { k: 'f', label: 'Жиры на 100 г', type: 'number', value: f.f }, { k: 'c', label: 'Углеводы на 100 г', type: 'number', value: f.c },
    { k: 'pc', label: 'Вес 1 шт/порции, г (можно пусто)', type: 'number', value: f.pc },
  ], o => {
    if (!o.name || !o.name.trim()) { toast('Впиши название'); return; }
    Object.assign(f, { name: o.name.trim(), kcal: o.kcal || 0, p: o.p || 0, f: o.f || 0, c: o.c || 0, pc: o.pc || undefined });
    if (isNew) S.foods.push(f);
  }, isNew ? [] : [{ label: 'Удалить продукт', cls: 'danger', fn: () => { if (confirm('Удалить «' + f.name + '»? Прошлые записи останутся.')) { S.foods = S.foods.filter(x => x.id !== f.id); save(); render(); } } }]);
}
