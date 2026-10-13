// Библиотека упражнений и программа по умолчанию.
// type: barbell | dumbbell | machine | bodyweight — от него шаг веса и прибавка.
// rule: 'bench' — особая прогрессия жима лёжа (+2,5 / −10% после 2 провалов).
const DEFAULT_EXERCISES = {
  bench:          { name: 'Жим лёжа', type: 'barbell', rule: 'bench' },
  incline_bb:     { name: 'Жим на наклонной со штангой', type: 'barbell' },
  lat_raise:      { name: 'Махи в стороны стоя', type: 'dumbbell' },
  french_incline: { name: 'Французский жим на наклонной', type: 'barbell' },
  pushdown:       { name: 'Разгибания на блоке', type: 'machine' },
  pullup:         { name: 'Подтягивания', type: 'bodyweight' },
  lat_wide:       { name: 'Тяга верхнего блока широким хватом', type: 'machine' },
  row_cable:      { name: 'Тяга горизонтального блока к животу', type: 'machine' },
  db_row:         { name: 'Тяга гантели одной рукой с упором', type: 'dumbbell', perArm: true },
  rear_delt:      { name: 'Махи на заднюю дельту с упором грудью', type: 'dumbbell' },
  incline_curl:   { name: 'Сгибания на наклонной скамье', type: 'dumbbell' },
  hammer:         { name: 'Молотки', type: 'dumbbell' },
  bench_pause:    { name: 'Жим лёжа с паузой на груди', type: 'barbell', rule: 'bench' },
  db_press30:     { name: 'Жим гантелей под 30°', type: 'dumbbell' },
  fly:            { name: 'Бабочка', type: 'machine' },
  leg_press:      { name: 'Жим ногами', type: 'machine' },
  leg_curl:       { name: 'Сгибания ног лёжа', type: 'machine' },
  leg_ext:        { name: 'Разгибания ног сидя', type: 'machine' },
  calf:           { name: 'Подъёмы на носки', type: 'machine' },
  // запасные
  close_grip:     { name: 'Жим узким хватом', type: 'barbell', spare: true },
  overhead_ext:   { name: 'Разгибания из-за головы', type: 'machine', spare: true },
  lat_close_rev:  { name: 'Тяга верхнего блока узким обратным хватом', type: 'machine', spare: true },
  shrug:          { name: 'Шраги', type: 'dumbbell', spare: true },
  preacher:       { name: 'Сгибания на скамье Скотта', type: 'barbell', spare: true },
  bb_curl:        { name: 'Сгибания со штангой', type: 'barbell', spare: true },
  cable_curl:     { name: 'Сгибания на нижнем блоке', type: 'machine', spare: true },
  cross_hammer:   { name: 'Молотки поперёк тела', type: 'dumbbell', spare: true },
};

// it(exId, подходы, повторы от, до, отдых от (сек), до (сек), доп. поля)
function it(ex, sets, rMin, rMax, restMin, restMax, extra) {
  return Object.assign({ ex, sets, rMin, rMax, restMin, restMax, start: 0, warmup: 0 }, extra || {});
}

const DEFAULT_PROGRAM = [
  { id: 'tue', dow: 2, title: 'Вторник', sub: 'Тяжёлый жим + плечи + трицепс', items: [
    it('bench', 5, 5, 5, 180, 240, { start: 62.5, warmup: 3 }),
    it('incline_bb', 3, 6, 8, 120, 180),
    it('lat_raise', 4, 12, 15, 60, 60),
    it('french_incline', 3, 8, 12, 120, 120),
    it('pushdown', 3, 10, 15, 90, 90),
  ]},
  { id: 'thu', dow: 4, title: 'Четверг', sub: 'Спина + бицепс + задняя дельта', items: [
    it('pullup', 3, 6, 10, 120, 180),
    it('lat_wide', 3, 8, 12, 120, 120),
    it('row_cable', 3, 8, 12, 120, 120),
    it('db_row', 2, 10, 12, 90, 90),
    it('rear_delt', 3, 12, 20, 60, 60),
    it('incline_curl', 3, 8, 12, 90, 90),
    it('hammer', 3, 10, 12, 90, 90),
  ]},
  { id: 'sat', dow: 6, title: 'Суббота', sub: 'Объёмный жим + ноги + плечи', items: [
    it('bench_pause', 4, 8, 8, 120, 180, { start: 50 }),
    it('db_press30', 3, 8, 12, 120, 120),
    it('fly', 3, 12, 15, 90, 90),
    it('leg_press', 3, 10, 15, 120, 120),
    it('leg_curl', 3, 10, 15, 90, 90),
    it('leg_ext', 2, 12, 15, 90, 90),
    it('calf', 3, 12, 15, 60, 60),
    it('lat_raise', 4, 12, 15, 60, 60),
  ]},
];
