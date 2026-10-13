'use strict';
// «Итоги»: сводка за период человеческим языком, календарь активности, объём, мышцы, рекорды, питание, сон.

const PERIODS = [['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['all', 'Всё время']];
function firstDataDate() {
  const ds = [...S.workouts.map(w => w.date), ...S.body.map(b => b.date), ...Object.keys(S.food).filter(d => S.food[d].length), ...Object.keys(S.days), ...S.measures.map(m => m.date)];
  return ds.length ? ds.sort()[0] : todayStr();
}
function dateRange(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
const finishedIn = (from, to) => S.workouts.filter(w => w.date >= from && w.date <= to && doneSets(w).length);
const proteinHit = d => { const t = foodTotals(d); return t.n > 0 && t.p >= S.targets.p * 0.9; };
function weightAvg(from, to) { return avg(S.body.filter(b => b.date >= from && b.date <= to).map(b => b.kg)); }

// Короткий итог недели для главной
function weekSummary(mon) {
  const t = todayStr(), days = dateRange(mon, t < addDays(mon, 6) ? t : addDays(mon, 6));
  const ws = finishedIn(mon, addDays(mon, 6)), parts = [];
  parts.push('Неделя: ' + ws.length + ' из ' + S.program.length + ' ' + plural(S.program.length, 'тренировки', 'тренировок', 'тренировок'));
  const fd = days.filter(d => foodTotals(d).n);
  if (fd.length) parts.push('белок в норме ' + fd.filter(proteinHit).length + ' из ' + days.length + ' дн.');
  const sl = days.map(d => dayGet(d, 'sleep')).filter(x => x != null);
  if (sl.length) parts.push('сон ~' + fmtW(r1(avg(sl))) + ' ч');
  const a = weightAvg(mon, addDays(mon, 6)), b = weightAvg(addDays(mon, -7), addDays(mon, -1));
  if (a != null && b != null) parts.push('вес ' + (a - b >= 0 ? '+' : '') + fmtW(r1(a - b)) + ' кг к прошлой');
  return { text: parts.join(' · '), workouts: ws.length };
}

function periodFrom(p) {
  if (p === 'all') return firstDataDate();
  return addDays(todayStr(), -(+p - 1));
}
function bestRecords() {
  const out = [];
  for (const id of Object.keys(S.exercises)) {
    const h = history(id); if (!h.length) continue;
    let bw = null, be = null;
    for (const x of h) {
      const tw = topW(x.e), te = e1rm(x.e);
      if (bw == null || tw > bw.v) bw = { v: tw, d: x.w.date };
      if (te && (be == null || te > be.v)) be = { v: te, d: x.w.date };
    }
    out.push({ id, n: h.length, bw, be });
  }
  return out.sort((a, b) => b.n - a.n);
}

VIEWS.stats = function (v, pArg) {
  setTitle('Итоги');
  const p = PERIODS.some(x => x[0] === pArg) ? pArg : '30';
  const t = todayStr(), from = periodFrom(p), days = dateRange(from, t), nDays = days.length;
  const ws = finishedIn(from, t), sets = ws.flatMap(doneSets), ton = sum(ws.map(tonnage));
  const weeks = Math.max(1, nDays / 7);
  const fdays = days.filter(d => foodTotals(d).n), ft = fdays.map(foodTotals);
  const sl = days.map(d => ({ d, v: dayGet(d, 'sleep') })).filter(x => x.v != null);
  const w0 = S.body.filter(b => b.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const recs = ws.reduce((n, w) => n + recordsIn(w).length, 0);

  // ---- вывод словами ----
  const say = [];
  if (!ws.length && !fdays.length && !sl.length && !w0.length) say.push('За этот период записей нет. Начни с тренировки, еды или веса — здесь появятся итоги.');
  else {
    if (ws.length) say.push('Тренировок: ' + ws.length + ' (≈' + fmtW(r1(ws.length / weeks)) + ' в неделю), ' + sets.length + ' рабочих подходов, поднято ' + fmtW(r1(ton / 1000)) + ' т.' + (recs ? ' Рекордов: ' + recs + ' 🏆' : ''));
    else say.push('Тренировок за период не записано.');
    if (fdays.length) {
      const hit = fdays.filter(proteinHit).length;
      say.push('Еда записана ' + fdays.length + ' из ' + nDays + ' дн.: в среднем ' + Math.round(avg(ft.map(x => x.kcal))) + ' ккал (норма ' + S.targets.kcal + ') и ' + Math.round(avg(ft.map(x => x.p))) + ' г белка (норма ' + S.targets.p + '). Белок в норме ' + hit + ' ' + plural(hit, 'день', 'дня', 'дней') + '.');
      if (avg(ft.map(x => x.kcal)) < S.targets.kcal * 0.9) say.push('Калорий не хватает для набора — добавь перекус (творог, арахисовая паста, овсянка на молоке).');
    }
    if (w0.length > 1) { const dw = w0[w0.length - 1].kg - w0[0].kg, per = dw / Math.max(1, daysBetween(w0[0].date, w0[w0.length - 1].date) / 7);
      say.push('Вес: ' + (dw >= 0 ? '+' : '') + fmtW(r1(dw)) + ' кг (' + (per >= 0 ? '+' : '') + fmtW(Math.round(per * 100) / 100) + ' кг/нед.).' + (per < 0.1 ? ' Масса почти не растёт — ешь больше.' : per > 0.6 ? ' Растёт быстро — часть может быть жиром.' : ' Хороший темп для набора.')); }
    if (sl.length) {
      say.push('Сон в среднем ' + fmtW(r1(avg(sl.map(x => x.v)))) + ' ч (норма ' + fmtW(S.targets.sleep) + ').');
      const good = sl.filter(x => x.v >= 8 && dayGet(x.d, 'energy')), bad = sl.filter(x => x.v < 8 && dayGet(x.d, 'energy'));
      if (good.length >= 3 && bad.length >= 3) {
        const eg = avg(good.map(x => dayGet(x.d, 'energy'))), eb = avg(bad.map(x => dayGet(x.d, 'energy')));
        say.push('После сна от 8 ч энергия ' + fmtW(r1(eg)) + ' из 5, после короткого — ' + fmtW(r1(eb)) + '.');
      }
    }
  }
  let h = '<div class="chips">' + PERIODS.map(x => '<a class="chip ' + (x[0] === p ? 'on' : '') + '" href="#stats/' + x[0] + '">' + x[1] + '</a>').join('') + '</div>';
  h += '<section class="card"><div class="exname">Итог: ' + (p === 'all' ? 'всё время' : 'последние ' + p + ' дн.') + '</div>' + say.map(s => '<p class="say-p">' + esc(s) + '</p>').join('') + '</section>';
  const tile = (l, val, href) => '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="tile"><div class="muted">' + l + '</div><div class="big mono">' + val + '</div></' + (href ? 'a' : 'div') + '>';
  h += '<div class="tiles">' + tile('Тренировок', ws.length, '#train') + tile('Подходов', sets.length) + tile('Объём, т', fmtW(r1(ton / 1000))) +
    tile('Ккал/день', fdays.length ? Math.round(avg(ft.map(x => x.kcal))) : '—', '#food') + tile('Белок/день', fdays.length ? Math.round(avg(ft.map(x => x.p))) : '—', '#food') +
    tile('Сон, ч', sl.length ? fmtW(r1(avg(sl.map(x => x.v)))) : '—', '#day') + tile('Вес', lastBody() ? fmtW(lastBody().kg) : '—', '#body') +
    tile('Изм. веса', w0.length > 1 ? (w0[w0.length - 1].kg - w0[0].kg >= 0 ? '+' : '') + fmtW(r1(w0[w0.length - 1].kg - w0[0].kg)) : '—', '#body') + '</div>';

  // ---- календарь активности ----
  const calFrom = mondayOf(nDays < 28 ? addDays(t, -27) : nDays > 182 ? addDays(t, -181) : from), calWeeks = Math.ceil((daysBetween(calFrom, t) + 1) / 7);
  let cal = '';
  for (let c = 0; c < calWeeks; c++) for (let r = 0; r < 7; r++) {
    const d = addDays(calFrom, c * 7 + r);
    if (d > t) { cal += '<i class="cal-c fut"></i>'; continue; }
    const tr = S.workouts.some(w => w.date === d && doneSets(w).length), ph = proteinHit(d), any = foodTotals(d).n || S.days[d] || S.body.some(b => b.date === d);
    cal += '<button class="cal-c ' + (tr ? 'tr' : ph ? 'ph' : any ? 'any' : '') + (d === t ? ' today' : '') + '" data-act="calDay" data-date="' + d + '" aria-label="' + d + '"></button>';
  }
  h += '<section class="card"><div class="exname">Календарь</div><div class="cal" style="grid-template-columns:repeat(' + calWeeks + ',1fr);max-width:' + calWeeks * 34 + 'px">' + cal + '</div>' +
    '<div class="legend"><span><i class="cal-c tr"></i>тренировка</span><span><i class="cal-c ph"></i>белок в норме</span><span><i class="cal-c any"></i>есть записи</span></div><div class="muted small-note" style="margin:6px 0 0">Строки — пн…вс. Нажми на день, чтобы открыть его дневник.</div></section>';

  // ---- объём по неделям ----
  const wkFrom = mondayOf(nDays < 28 ? addDays(t, -55) : from), wk = [];
  for (let m = wkFrom; m <= t; m = addDays(m, 7)) { const list = finishedIn(m, addDays(m, 6)); wk.push({ label: fmtShort(m), title: 'неделя с ' + fmtDate(m) + ' · ' + list.length + ' трен.', y: sum(list.map(tonnage)) / 1000 }); }
  h += '<section class="card"><div class="exname">Объём по неделям, т</div>' + barChart('wkv', wk, { unit: 'т', empty: 'Тренировок пока нет.' }) + '</section>';

  // ---- подходы по мышцам ----
  const mg = {};
  for (const w of ws) for (const e of w.entries) { const n = e.sets.filter(s => s.done).length; if (n) mg[exOf(e.ex).mg || 'другое'] = (mg[exOf(e.ex).mg || 'другое'] || 0) + n; }
  const mgList = Object.entries(mg).sort((a, b) => b[1] - a[1]), mgMax = Math.max(1, ...mgList.map(x => x[1] / weeks), 20);
  h += '<section class="card"><div class="exname">Подходы на мышцу в неделю</div>' + (mgList.length ? mgList.map(([m, n]) => {
    const pw = n / weeks;
    return '<div class="hbar"><span>' + esc(m) + '</span><div class="hbar-b"><i style="width:' + (pw / mgMax * 100) + '%"></i><b class="zone" style="left:' + (10 / mgMax * 100) + '%;width:' + (10 / mgMax * 100) + '%"></b></div><span class="mono">' + fmtW(r1(pw)) + '</span></div>';
  }).join('') + '<div class="muted small-note" style="margin:8px 0 0">Светлая зона — ориентир 10–20 рабочих подходов в неделю на мышцу для роста.</div>' : '<div class="empty">Нет сделанных подходов за период.</div>') + '</section>';

  // ---- рекорды ----
  const rec = bestRecords();
  h += '<section class="card"><div class="exname">Рекорды</div>' + (rec.length ? '<table class="tbl"><tr><th>Упражнение</th><th>Вес</th><th>1ПМ</th></tr>' + rec.map(r =>
    '<tr data-act="goEx" data-id="' + r.id + '"><td>' + esc(exOf(r.id).name) + '<div class="muted">' + fmtShort(r.bw.d) + '</div></td><td class="mono">' + fmtW(r.bw.v) + '</td><td class="mono">' + (r.be && exOf(r.id).type !== 'bodyweight' ? Math.round(r.be.v) : '—') + '</td></tr>').join('') +
    '</table><div class="muted small-note" style="margin:8px 0 0">1ПМ — расчёт по Эпли, не проверка. Нажми на строку — график упражнения.</div>' : '<div class="empty">Рекорды появятся после тренировок.</div>') + '</section>';

  // ---- питание, сон, вода, шаги по дням ----
  const dd = days.slice(-90);
  const dayBars = fn => dd.map(d => ({ label: fmtShort(d), title: fmtDate(d), y: fn(d) }));
  h += '<section class="card"><div class="exname">Калории по дням</div>' + barChart('kc', dayBars(d => { const x = foodTotals(d); return x.n ? x.kcal : null; }), { unit: 'ккал', ref: { y: S.targets.kcal, label: 'норма' }, fmt: x => Math.round(x), empty: 'Еда не записана.' }) + '</section>';
  h += '<section class="card"><div class="exname">Белок по дням, г</div>' + barChart('pr', dayBars(d => { const x = foodTotals(d); return x.n ? x.p : null; }), { unit: 'г', color: 'var(--s2)', ref: { y: S.targets.p, label: 'норма' }, fmt: x => Math.round(x), empty: 'Еда не записана.' }) + '</section>';
  if (ft.length) {
    const mp = avg(ft.map(x => x.p)) * 4, mf = avg(ft.map(x => x.f)) * 9, mc = avg(ft.map(x => x.c)) * 4, all = mp + mf + mc || 1;
    h += '<section class="card"><div class="exname">Откуда калории (в среднем)</div><div class="split"><i style="width:' + mp / all * 100 + '%;background:var(--s2)"></i><i style="width:' + mf / all * 100 + '%;background:var(--warn)"></i><i style="width:' + mc / all * 100 + '%;background:var(--s1)"></i></div>' +
      '<div class="legend"><span><i style="background:var(--s2)"></i>белки ' + Math.round(mp / all * 100) + '%</span><span><i style="background:var(--warn)"></i>жиры ' + Math.round(mf / all * 100) + '%</span><span><i style="background:var(--s1)"></i>углеводы ' + Math.round(mc / all * 100) + '%</span></div></section>';
  }
  h += '<section class="card"><div class="exname">Сон, часов</div>' + barChart('sl', dayBars(d => dayGet(d, 'sleep')), { unit: 'ч', color: 'var(--s2)', ref: { y: S.targets.sleep, label: 'норма' }, empty: 'Сон не записан.' }) + '</section>';
  const en = dd.filter(d => dayGet(d, 'energy') || dayGet(d, 'mood'));
  if (en.length) h += '<section class="card"><div class="exname">Энергия и настроение (1–5)</div>' + lineChart('en', [
    { name: 'энергия', color: 'var(--s1)', pts: dd.filter(d => dayGet(d, 'energy')).map(d => ({ x: d, y: dayGet(d, 'energy') })) },
    { name: 'настроение', color: 'var(--s2)', pts: dd.filter(d => dayGet(d, 'mood')).map(d => ({ x: d, y: dayGet(d, 'mood') })) }]) + '</section>';
  h += '<section class="card"><div class="exname">Вода, мл</div>' + barChart('wt', dayBars(d => dayGet(d, 'water') || null), { unit: 'мл', color: 'var(--s2)', ref: { y: S.targets.water, label: 'норма' }, fmt: x => Math.round(x), empty: 'Вода не записана.' }) + '</section>';
  h += '<section class="card"><div class="exname">Шаги</div>' + barChart('st', dayBars(d => dayGet(d, 'steps') || null), { ref: { y: S.targets.steps, label: 'норма' }, fmt: x => Math.round(x).toLocaleString('ru'), empty: 'Шаги не записаны.' }) + '</section>';
  h += '<div class="grid2"><a class="btn ghost" href="#body">Вес и замеры</a><a class="btn ghost" href="#ex/bench">Упражнения</a></div>';
  v.innerHTML = h;
};
Object.assign(ACT, {
  calDay(d) { location.hash = '#day/' + d.date; return false; },
  goEx(d) { location.hash = '#ex/' + d.id; return false; },
});
