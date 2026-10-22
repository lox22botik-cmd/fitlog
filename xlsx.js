'use strict';
// Выгрузка всех данных в Excel (.xlsx) без библиотек: несколько листов → XML → zip без сжатия.

// ---------- zip (метод «store») ----------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) { // files: [{name, text}]
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(c.buffer, name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((s, x) => s + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------- листы ----------
const xEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function sheetXml(rows, widths) {
  const body = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
    if (v == null || v === '') return '';
    const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
    return typeof v === 'number' && isFinite(v) ? '<c r="' + ref + '"' + st + '><v>' + Math.round(v * 100) / 100 + '</v></c>'
      : '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xEsc(v) + '</t></is></c>';
  }).join('') + '</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
    '<sheetData>' + body + '</sheetData></worksheet>';
}
function workbook(sheets) { // sheets: [{name, rows, widths}]
  const files = [
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => '<sheet name="' + xEsc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE3CC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
  ];
  sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: sheetXml(s.rows, s.widths) }));
  return zip(files);
}

// ---------- данные приложения → листы ----------
function buildSheets() {
  const T = S.targets, num = x => x == null ? null : +x;
  const dates = [...new Set([...Object.keys(S.food).filter(d => S.food[d].length), ...Object.keys(S.days), ...S.workouts.map(w => w.date), ...S.body.map(b => b.date), ...Object.keys(S.suppLog)])].sort().reverse();
  const stName = { ok: 'норма', mid: 'недобор', bad: 'перебор', '': '' };
  const days = [['Дата', 'День', 'Ккал', 'Белки, г', 'Жиры, г', 'Углеводы, г', 'Питание', 'Вода, мл', 'Сон, ч', 'Качество сна', 'Шаги', 'Энергия', 'Настроение', 'Крепатура', 'Стресс', 'Вес, кг', 'Тренировка', 'Добавки', 'Заметка']]
    .concat(dates.map(d => {
      const f = foodTotals(d), r = S.days[d] || {}, b = S.body.find(x => x.date === d), ws = S.workouts.filter(w => w.date === d), sl = S.suppLog[d] || {};
      return [d, WD[parseDate(d).getDay()], f.n ? f.kcal : null, f.n ? f.p : null, f.n ? f.f : null, f.n ? f.c : null, stName[dayStatus(d)], num(r.water), num(r.sleep), num(r.sleepQ), num(r.steps),
        num(r.energy), num(r.mood), num(r.sore), num(r.stress), b ? b.kg : null, ws.map(w => w.title).join(', '), Object.keys(sl).filter(k => sl[k]).join(', '), r.note || ''];
    }));
  const food = [['Дата', 'Время', 'Продукт', 'Граммы', 'Ккал', 'Белки, г', 'Жиры, г', 'Углеводы, г']];
  for (const d of Object.keys(S.food).sort().reverse()) for (const e of S.food[d].slice().sort((a, b) => a.t.localeCompare(b.t)))
    food.push([d, e.t, e.name, num(e.g), num(e.kcal), num(e.p), num(e.f), num(e.c)]);
  const tr = [['Дата', 'Тренировка', 'Упражнение', 'Мышцы', 'Подход', 'Вес, кг', 'Повторы', 'Сделан', 'Объём, кг', 'Самочувствие', 'Заметка']];
  for (const w of sortedWorkouts()) for (const e of w.entries) {
    e.warm.forEach((s, j) => tr.push([w.date, w.title, exOf(e.ex).name, exOf(e.ex).mg || '', 'Р' + (j + 1), s.w, s.r, s.done ? 'да' : 'нет', null, '', '']));
    e.sets.forEach((s, j) => tr.push([w.date, w.title, exOf(e.ex).name, exOf(e.ex).mg || '', j + 1, s.w, s.r, s.done ? 'да' : 'нет', s.done ? s.w * s.r : null, j === 0 ? w.feel || '' : '', j === 0 ? w.note || '' : '']));
  }
  const body = [['Дата', 'Вес, кг']].concat(S.body.slice().sort((a, b) => b.date.localeCompare(a.date)).map(b => [b.date, b.kg]));
  const meas = [['Дата'].concat(MEASURES.map(m => m[1] + ', см'))].concat(S.measures.slice().sort((a, b) => b.date.localeCompare(a.date)).map(m => [m.date].concat(MEASURES.map(([k]) => num(m[k])))));
  const norms = [['Норма', 'Значение'], ['Калории, ккал', T.kcal], ['Белки, г', T.p], ['Жиры, г', T.f], ['Углеводы, г', T.c], ['Вода, мл', T.water], ['Сон, ч', T.sleep], ['Шаги', T.steps],
    ['Рост, см', S.profile.h], ['Возраст', S.profile.age], ['Выгружено', todayStr() + ' ' + nowHM()]];
  return [
    { name: 'Дни', rows: days, widths: [12, 5, 8, 9, 8, 11, 10, 9, 7, 12, 8, 8, 11, 10, 8, 8, 22, 20, 40] },
    { name: 'Еда', rows: food, widths: [12, 7, 30, 8, 8, 9, 8, 11] },
    { name: 'Тренировки', rows: tr, widths: [12, 14, 34, 10, 7, 8, 8, 7, 10, 13, 30] },
    { name: 'Вес', rows: body, widths: [12, 9] },
    { name: 'Замеры', rows: meas, widths: [12].concat(MEASURES.map(() => 14)) },
    { name: 'Нормы', rows: norms, widths: [16, 16] },
  ];
}
function exportXlsx() {
  const blob = workbook(buildSheets()), name = 'fitlog-' + todayStr() + '.xlsx';
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Таблица ' + name + ' сохранена');
}
// Отправить файл через меню «Поделиться» телефона (Telegram, ИИ-чат и т.д.)
async function shareXlsx() {
  const file = new File([workbook(buildSheets())], 'fitlog-' + todayStr() + '.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  try { await navigator.share({ files: [file], title: 'FitLog — мои данные' }); }
  catch (e) { if (e.name !== 'AbortError') exportXlsx(); }
}
const canShareFiles = () => { try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.xlsx')] }); } catch (e) { return false; } };
