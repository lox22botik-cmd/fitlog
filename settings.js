'use strict';
// «Ещё»: настройки, добавки, цикл разгрузки, резервная копия. И запуск приложения.

VIEWS.settings = function (v) {
  setTitle('Ещё');
  const st = S.settings, wn = weekNo(todayStr());
  const link = (href, t, sub) => '<a class="card row-card" href="' + href + '"><div><div class="exname">' + t + '</div><div class="muted">' + sub + '</div></div><div class="big">›</div></a>';
  const tg = (k, label, sub) => '<label class="card row-card"><div><div class="exname">' + label + '</div><div class="muted">' + sub + '</div></div>' +
    '<input type="checkbox" class="sw" data-set="' + k + '"' + (st[k] ? ' checked' : '') + '></label>';
  const perm = 'Notification' in window ? Notification.permission : 'нет';
  v.innerHTML = '<div class="grid2">' + link('#program', 'Программа', 'упражнения, подходы') + link('#targets', 'Нормы', 'ккал, БЖУ, вода, сон') + link('#foods', 'Продукты', 'база еды') + link('#body', 'Тело', 'вес и замеры') + '</div>' +
    link('gallery.html', '🏋️ Техника упражнений', '3D-модель, все упражнения программы') +
    tg('reminder', 'Напоминание о добавках в 17:00', 'карточка на главной + уведомление') +
    '<section class="card"><div class="exname">Мои добавки</div><div class="muted">Отмечаются каждый день на главной.</div><div class="chips">' +
    st.supps.map((n, i) => '<button class="chip" data-act="suppDel" data-i="' + i + '">' + esc(n) + ' ✕</button>').join('') + '<button class="chip on" data-act="suppAdd">+ добавить</button></div></section>' +
    tg('wake', 'Не гасить экран на тренировке', 'экран горит, пока открыта тренировка') +
    tg('sound', 'Звук таймера', 'вибрация работает всегда') +
    '<section class="card"><div class="exname">Уведомления</div><div class="muted">Сейчас: ' + ({ granted: 'разрешены', denied: 'запрещены (включи в настройках Chrome)', default: 'не спрашивали' }[perm] || perm) +
    '. Таймер и напоминание приходят, пока приложение открыто или недавно свёрнуто.</div>' +
    (perm === 'default' ? '<button class="btn ghost wide" data-act="notifPerm">Разрешить уведомления</button>' : '') + '</section>' +
    '<section class="card"><div class="exname">Цикл разгрузки</div><div class="muted">Каждая 6-я неделя — лёгкая (−30%). Сейчас: ' +
    (wn >= 0 ? 'неделя ' + (wn % 6 + 1) + ' из 6' : 'цикл ещё не начался') + '.</div><label class="field">Начало цикла (понедельник)<input type="date" id="cycleStart" value="' + st.cycleStart + '"></label></section>' +
    '<section class="card hero"><div class="exname">📊 Таблица Excel</div><div class="muted">Все данные одним файлом: дни, еда, тренировки по подходам, вес, замеры, нормы. Открывается в Excel и Google Таблицах, можно отправить ИИ на разбор.</div>' +
    '<div class="grid2"><button class="btn primary" data-act="exportXlsx">Скачать</button>' + (canShareFiles() ? '<button class="btn ghost" data-act="shareXlsx">Отправить…</button>' : '<span></span>') + '</div></section>' +
    '<section class="card"><div class="exname">Резервная копия</div><div class="muted">Всё хранится только в этом браузере на телефоне. Делай копию раз в пару недель и кидай себе в Telegram.</div>' +
    '<div class="grid2"><button class="btn primary" data-act="export">Экспорт JSON</button><button class="btn ghost" data-act="import">Импорт</button></div>' +
    '<input type="file" id="importFile" accept="application/json,.json" hidden></section>' +
    '<div class="muted center small-note">Тренировок: ' + S.workouts.length + ' · дней с едой: ' + Object.keys(S.food).filter(d => S.food[d].length).length + ' · записей веса: ' + S.body.length + '</div>' +
    '<button class="btn danger wide" data-act="wipe">Стереть все данные</button>';
  $('#cycleStart').onchange = e => { if (e.target.value) { S.settings.cycleStart = mondayOf(e.target.value); save(); render(); } };
  $('#importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const o = JSON.parse(txt);
      if (!o || (o.v !== 1 && o.v !== 2) || !Array.isArray(o.workouts)) throw new Error('не тот формат');
      if (!confirm('Заменить все данные данными из файла? (тренировок в файле: ' + o.workouts.length + ')')) return;
      S = migrate(o); S.timer = null; save(); toast('Данные загружены'); render();
    }).catch(err => alert('Не получилось прочитать файл: ' + err.message));
  };
};

Object.assign(ACT, {
  notifPerm() { askNotify(); setTimeout(render, 1500); return false; },
  suppAdd() { const n = prompt('Название добавки (например, Омега-3)'); if (!n || !n.trim()) return false; if (!S.settings.supps.includes(n.trim())) S.settings.supps.push(n.trim()); },
  suppDel(d) { const n = S.settings.supps[d.i]; if (!confirm('Убрать «' + n + '» из списка? Прошлые отметки останутся.')) return false; S.settings.supps.splice(d.i, 1); },
  export() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fitlog-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return false;
  },
  exportXlsx() { exportXlsx(); return false; },
  shareXlsx() { shareXlsx(); return false; },
  import() { $('#importFile').click(); return false; },
  wipe() {
    if (!confirm('Стереть ВСЕ тренировки, еду, вес и настройки? Сначала сделай экспорт!')) return false;
    if (prompt('Точно? Напиши: стереть') !== 'стереть') return false;
    S = migrate(fresh()); toast('Данные стёрты');
  },
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); render(); }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
render(); tick(); suppCheck();
