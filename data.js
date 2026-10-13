// Библиотека упражнений и программа по умолчанию.
// type: barbell | dumbbell | machine | bodyweight — от него шаг веса и прибавка.
// mg — группа мышц для статистики подходов.
// rule: 'bench' — особая прогрессия жима лёжа (+2,5 / −10% после 2 провалов).
const DEFAULT_EXERCISES = {
  bench:          { name: 'Жим лёжа', type: 'barbell', rule: 'bench', mg: 'грудь' },
  incline_bb:     { name: 'Жим на наклонной со штангой', type: 'barbell', mg: 'грудь' },
  lat_raise:      { name: 'Махи в стороны стоя', type: 'dumbbell', mg: 'плечи' },
  french_incline: { name: 'Французский жим на наклонной', type: 'barbell', mg: 'трицепс' },
  pushdown:       { name: 'Разгибания на блоке', type: 'machine', mg: 'трицепс' },
  pullup:         { name: 'Подтягивания', type: 'bodyweight', mg: 'спина' },
  lat_wide:       { name: 'Тяга верхнего блока широким хватом', type: 'machine', mg: 'спина' },
  row_cable:      { name: 'Тяга горизонтального блока к животу', type: 'machine', mg: 'спина' },
  db_row:         { name: 'Тяга гантели одной рукой с упором', type: 'dumbbell', perArm: true, mg: 'спина' },
  rear_delt:      { name: 'Махи на заднюю дельту с упором грудью', type: 'dumbbell', mg: 'плечи' },
  incline_curl:   { name: 'Сгибания на наклонной скамье', type: 'dumbbell', mg: 'бицепс' },
  hammer:         { name: 'Молотки', type: 'dumbbell', mg: 'бицепс' },
  bench_pause:    { name: 'Жим лёжа с паузой на груди', type: 'barbell', rule: 'bench', mg: 'грудь' },
  db_press30:     { name: 'Жим гантелей под 30°', type: 'dumbbell', mg: 'грудь' },
  fly:            { name: 'Бабочка', type: 'machine', mg: 'грудь' },
  leg_press:      { name: 'Жим ногами', type: 'machine', mg: 'ноги' },
  leg_curl:       { name: 'Сгибания ног лёжа', type: 'machine', mg: 'ноги' },
  leg_ext:        { name: 'Разгибания ног сидя', type: 'machine', mg: 'ноги' },
  calf:           { name: 'Подъёмы на носки', type: 'machine', mg: 'икры' },
  // запасные
  close_grip:     { name: 'Жим узким хватом', type: 'barbell', spare: true, mg: 'трицепс' },
  overhead_ext:   { name: 'Разгибания из-за головы', type: 'machine', spare: true, mg: 'трицепс' },
  lat_close_rev:  { name: 'Тяга верхнего блока узким обратным хватом', type: 'machine', spare: true, mg: 'спина' },
  shrug:          { name: 'Шраги', type: 'dumbbell', spare: true, mg: 'трапеции' },
  preacher:       { name: 'Сгибания на скамье Скотта', type: 'barbell', spare: true, mg: 'бицепс' },
  bb_curl:        { name: 'Сгибания со штангой', type: 'barbell', spare: true, mg: 'бицепс' },
  cable_curl:     { name: 'Сгибания на нижнем блоке', type: 'machine', spare: true, mg: 'бицепс' },
  cross_hammer:   { name: 'Молотки поперёк тела', type: 'dumbbell', spare: true, mg: 'бицепс' },
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

const MUSCLES = ['грудь', 'плечи', 'трицепс', 'спина', 'бицепс', 'ноги', 'икры', 'трапеции', 'пресс', 'другое'];

// Продукты: на 100 г (ккал, белки, жиры, углеводы) — средние табличные значения,
// у конкретной упаковки могут отличаться: правь в «Еда → Мои продукты».
// pc — вес одной штуки/порции в граммах (для кнопки «1 шт»).
const DEFAULT_FOODS = [
  { id: 'chicken', name: 'Куриная грудка (варёная)', kcal: 137, p: 29.8, f: 1.8, c: 0.5 },
  { id: 'egg', name: 'Яйцо куриное', kcal: 157, p: 12.7, f: 11.5, c: 0.7, pc: 55 },
  { id: 'cottage5', name: 'Творог 5%', kcal: 121, p: 17.2, f: 5, c: 1.8 },
  { id: 'milk25', name: 'Молоко 2,5%', kcal: 52, p: 2.8, f: 2.5, c: 4.7 },
  { id: 'kefir1', name: 'Кефир 1%', kcal: 40, p: 3, f: 1, c: 4 },
  { id: 'whey', name: 'Протеин (сывороточный)', kcal: 390, p: 75, f: 6, c: 8, pc: 30 },
  { id: 'rice', name: 'Рис (варёный)', kcal: 116, p: 2.2, f: 0.5, c: 24.9 },
  { id: 'buckwheat', name: 'Гречка (варёная)', kcal: 110, p: 4.2, f: 1.1, c: 21.3 },
  { id: 'oats', name: 'Овсянка (сухая)', kcal: 352, p: 12.3, f: 6.1, c: 59.5 },
  { id: 'pasta', name: 'Макароны (варёные)', kcal: 112, p: 3.5, f: 0.4, c: 23.2 },
  { id: 'potato', name: 'Картофель (варёный)', kcal: 82, p: 2, f: 0.4, c: 16.7 },
  { id: 'bread', name: 'Хлеб белый', kcal: 265, p: 7.6, f: 3.3, c: 50.6, pc: 30 },
  { id: 'beef', name: 'Говядина (тушёная)', kcal: 232, p: 16.8, f: 18.3, c: 0 },
  { id: 'pork', name: 'Свинина (запечённая)', kcal: 260, p: 25.7, f: 17, c: 0 },
  { id: 'salmon', name: 'Сёмга', kcal: 202, p: 22.5, f: 12.5, c: 0 },
  { id: 'tuna', name: 'Тунец консерв. в с/с', kcal: 96, p: 21, f: 1, c: 0 },
  { id: 'cheese', name: 'Сыр твёрдый', kcal: 360, p: 24, f: 29, c: 0, pc: 20 },
  { id: 'banana', name: 'Банан', kcal: 96, p: 1.5, f: 0.2, c: 21.8, pc: 120 },
  { id: 'apple', name: 'Яблоко', kcal: 47, p: 0.4, f: 0.4, c: 9.8, pc: 180 },
  { id: 'pbutter', name: 'Арахисовая паста', kcal: 588, p: 25, f: 50, c: 20, pc: 15 },
  { id: 'oil', name: 'Масло растительное', kcal: 899, p: 0, f: 99.9, c: 0, pc: 10 },
  { id: 'yogurt', name: 'Йогурт натуральный', kcal: 66, p: 5, f: 3.2, c: 3.5 },
];
