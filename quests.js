// quests.js — поручения жителей: принести предмет, сделать что-то N раз или побывать в месте
import { ITEMS } from './economy.js';
import { ZONES } from './zones.js';

const KEY = 'quiet-shore-quests-v1';
export const MAX_ACTIVE = 3;

// type: 'deliver' — принести предмет (item, amount)
//       'count'   — сделать действие N раз с момента, как взяла задание (stat, amount)
//       'visit'   — побывать в зоне острова (zone)
// minLevel — нужный уровень, minAffection — нужная симпатия, after — какие задания должны быть сделаны раньше
const QUESTS = [
  // ——— Уровень 1: первые поручения ———
  { id: 'mira-shells', npc: 'mira', title: 'Подарок для Миры', text: 'Хочу собрать подвески из ракушек. Принесёшь три обычные?', type: 'deliver', item: 'shell', amount: 3, reward: 80, xp: 15 },
  { id: 'timofey-fish', npc: 'timofey', title: 'Улов для Тимофея', text: 'Сети пустые, а на ужин что-то нужно. Две мелкие рыбки — и я спасён.', type: 'deliver', item: 'smallFish', amount: 2, reward: 100, xp: 20 },
  { id: 'anna-flowers', npc: 'anna', title: 'Цветы для пекарни', text: 'Хочу поставить свежие цветы у прилавка. Два букетика с луга — и станет уютнее.', type: 'deliver', item: 'flower', amount: 2, reward: 60, xp: 12 },
  { id: 'lea-pinkshell', npc: 'lea', title: 'Ракушка для этюда', text: 'Мне нужна розовая ракушка для этюда с бухтой.', type: 'deliver', item: 'pinkShell', amount: 1, reward: 90, xp: 20 },
  { id: 'noah-fish', npc: 'noah', title: 'Обед смотрителя', text: 'Захотелось ухи. Одна средняя рыба — и я твой должник.', type: 'deliver', item: 'mediumFish', amount: 1, reward: 120, xp: 25 },
  { id: 'rosa-flowers', npc: 'rosa', title: 'Букет с луга', text: 'Нужен букет для витрины. Три цветка с луга, пожалуйста.', type: 'deliver', item: 'flower', amount: 3, reward: 70, xp: 15 },
  { id: 'kai-shells', npc: 'kai', title: 'Охота за ракушками', text: 'Давай устроим охоту за ракушками! Мне нужны две.', type: 'deliver', item: 'shell', amount: 2, reward: 45, xp: 10 },
  { id: 'uma-fish', npc: 'uma', title: 'Угощение для кота', text: 'Мой кот отказывается от всего, кроме рыбки. Одну мелкую?', type: 'deliver', item: 'smallFish', amount: 1, reward: 55, xp: 10 },
  { id: 'felix-fish', npc: 'felix', title: 'Рыбацкая песня', text: 'Хочу написать песню о рыбаках. Принеси среднюю рыбу — вдохновлюсь.', type: 'deliver', item: 'mediumFish', amount: 1, reward: 80, xp: 18 },
  { id: 'sam-shell', npc: 'sam', title: 'Сувенир в дорогу', text: 'Хочу увезти сувенир с острова. Одна ракушка — и я счастлив.', type: 'deliver', item: 'shell', amount: 1, reward: 50, xp: 10 },
  { id: 'boris-fish', npc: 'boris', title: 'Обед для докера', text: 'После разгрузки зверски голоден. Три мелкие рыбки — и я снова в строю.', type: 'deliver', item: 'smallFish', amount: 3, reward: 90, xp: 18 },
  { id: 'lena-flower', npc: 'lena', title: 'Цветочек для лентяйки', text: 'Мне лень идти на луг... Принесёшь один цветочек?', type: 'deliver', item: 'flower', amount: 1, reward: 40, xp: 8 },

  // ——— Уровень 2: прогулки и вторые просьбы ———
  { id: 'kai-pines', npc: 'kai', title: 'Тайна соснового леса', text: 'Сходи в Сосновый лес и поищи жуков! Потом расскажешь, что видела.', type: 'visit', zone: 'pines', reward: 60, xp: 15, minLevel: 2 },
  { id: 'lea-cove', npc: 'lea', title: 'Свет над бухтой', text: 'Мне не хватает вдохновения. Прогуляйся до Тихой бухты и посмотри, какой там свет.', type: 'visit', zone: 'cove', reward: 90, xp: 22, minLevel: 2 },
  { id: 'anna-bread', npc: 'anna', title: 'Хлеб для маяка', text: 'Отнеси тёплый хлеб деду Ною на маяк. Просто дойди — я заверну.', type: 'visit', zone: 'lighthouse', reward: 110, xp: 25, minLevel: 2 },
  { id: 'felix-harbor', npc: 'felix', title: 'Тихое место для песни', text: 'Хочу сыграть вечером у гавани. Сходи, проверь, не слишком ли там шумно.', type: 'visit', zone: 'harbor', reward: 100, xp: 22, minLevel: 2 },
  { id: 'uma-fish2', npc: 'uma', title: 'Рыба посытнее', text: 'Теперь кот хочет рыбу посытнее. Две средние найдутся?', type: 'deliver', item: 'mediumFish', amount: 2, reward: 110, xp: 25, minLevel: 2 },
  { id: 'vera-patrol', npc: 'vera', title: 'Патруль на рынке', text: 'Сходи на Торговую улицу и проверь порядок. Меня ждут дела на площади.', type: 'visit', zone: 'market', reward: 75, xp: 18, minLevel: 2 },
  { id: 'sam-letters', npc: 'sam', title: 'Весточки жителям', text: 'Разнеси мои приветы: поговори с четырьмя жителями, они уже ждут.', type: 'count', stat: 'talks', amount: 4, reward: 100, xp: 22, minLevel: 2 },

  // ——— Уровень 3 ———
  { id: 'mira-pink', npc: 'mira', title: 'Розовое ожерелье', text: 'Для ожерелья нужны розовые ракушки. Две штуки, пожалуйста.', type: 'deliver', item: 'pinkShell', amount: 2, reward: 150, xp: 30, minLevel: 3 },
  { id: 'timofey-big', npc: 'timofey', title: 'Настоящий улов', text: 'Хочу показать мальчишкам настоящий улов. Одну крупную рыбу, а?', type: 'deliver', item: 'largeFish', amount: 1, reward: 180, xp: 40, minLevel: 3 },
  { id: 'rosa-bouquet', npc: 'rosa', title: 'Ярмарочный букет', text: 'Завтра ярмарка! Мне нужен большой букет — шесть цветков.', type: 'deliver', item: 'flower', amount: 6, reward: 130, xp: 30, minLevel: 3 },
  { id: 'kai-fish', npc: 'kai', title: 'Урок рыбалки', text: 'Научи меня рыбачить! Поймай две рыбы, а я посмотрю.', type: 'count', stat: 'fish', amount: 2, reward: 80, xp: 20, minLevel: 3 },

  // ——— Уровень 4 ———
  { id: 'anna-festival', npc: 'anna', title: 'Пирог к празднику', text: 'Для праздничного пирога нужны цветы. Принеси пять.', type: 'deliver', item: 'flower', amount: 5, reward: 140, xp: 32, minLevel: 4, minAffection: 2 },
  { id: 'felix-pink', npc: 'felix', title: 'Гитара в ракушках', text: 'Хочу украсить гитару розовыми ракушками. Две штуки хватит.', type: 'deliver', item: 'pinkShell', amount: 2, reward: 170, xp: 35, minLevel: 4 },

  // ——— Главная цель: огни маяка (дед Ной) ———
  { id: 'noah-lamp1', npc: 'noah', title: 'Масло для маяка', text: 'Чтобы зажечь маяк, нужно масло, а его получают из рыбы. Принеси две крупные.', type: 'deliver', item: 'largeFish', amount: 2, reward: 200, xp: 50, minLevel: 5, minAffection: 2 },
  { id: 'noah-lamp2', npc: 'noah', title: 'Линза для маяка', text: 'Линзе нужны розовые ракушки: они красиво ловят свет. Три штуки.', type: 'deliver', item: 'pinkShell', amount: 3, reward: 220, xp: 55, minLevel: 5, minAffection: 2 },
  { id: 'noah-lamp3', npc: 'noah', title: 'Цветы для праздника', text: 'Чтобы у маяка было светло и на душе, принеси пять цветков с луга.', type: 'deliver', item: 'flower', amount: 5, reward: 260, xp: 70, minLevel: 6, minAffection: 2, after: ['noah-lamp1', 'noah-lamp2'] },
];

const STAT_LABELS = { fish: 'Поймать рыбу', shells: 'Найти ракушки', flowers: 'Собрать цветы', talks: 'Новые разговоры с жителями' };
const zoneName = (id) => (ZONES.find((z) => z.id === id) || {}).name || id;

export function createQuestSystem({ economy, goals, notify = () => {} }) {
  let state = { active: [], done: [], base: {}, visited: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Старое сохранение хранило одно задание строкой — переносим в список
    const active = Array.isArray(raw.active) ? raw.active : raw.active ? [raw.active] : [];
    state = {
      active: active.filter((id) => QUESTS.some((q) => q.id === id)),
      done: Array.isArray(raw.done) ? raw.done : [],
      base: raw.base || {},
      visited: raw.visited || {},
    };
  } catch { /* повреждённое сохранение начнётся заново */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* приватный режим */ } };
  const get = (id) => QUESTS.find((q) => q.id === id);

  // Задания, сделанные до появления уровней, тоже засчитываем в главную цель
  state.done.forEach((id) => goals.questDone(id, true));

  function progressOf(q) {
    if (q.type === 'deliver') return { have: Math.min(economy.inventory[q.item] || 0, q.amount), need: q.amount };
    if (q.type === 'count') return { have: Math.max(0, Math.min(goals.stat(q.stat) - (state.base[q.id] || 0), q.amount)), need: q.amount };
    return { have: state.visited[q.id] ? 1 : 0, need: 1 };
  }

  function describe(q) {
    if (q.type === 'deliver') return 'Принести: ' + ITEMS[q.item].label.toLowerCase() + ' × ' + q.amount;
    if (q.type === 'count') return (STAT_LABELS[q.stat] || q.stat) + ' × ' + q.amount;
    return 'Побывать: ' + zoneName(q.zone);
  }

  const isReady = (q, level, affection) =>
    level >= (q.minLevel || 1) && affection >= (q.minAffection || 0) && (q.after || []).every((id) => state.done.includes(id));

  return {
    get activeCount() { return state.active.length; },
    get full() { return state.active.length >= MAX_ACTIVE; },
    isDone(id) { return state.done.includes(id); },

    // Что житель может предложить сейчас и что откроется позже
    offerFor(npcId, level, affection) {
      const mine = QUESTS.filter((q) => q.npc === npcId && !state.done.includes(q.id) && !state.active.includes(q.id));
      const available = mine.find((q) => isReady(q, level, affection)) || null;
      const locked = available ? null : mine[0] || null;
      let lockText = '';
      if (locked) {
        if (level < (locked.minLevel || 1)) lockText = 'нужен ' + locked.minLevel + ' уровень';
        else if (affection < (locked.minAffection || 0)) lockText = 'нужна симпатия ' + locked.minAffection;
        else lockText = 'сначала помоги с другими делами';
      }
      return { available: available && { ...available, objective: describe(available) }, locked, lockText };
    },

    // Список активных заданий для журнала
    active() {
      return state.active.map((id) => {
        const q = get(id), p = progressOf(q);
        return { ...q, ...p, ready: p.have >= p.need, objective: describe(q) };
      });
    },

    accept(id) {
      const q = get(id);
      if (!q) return { ok: false, message: 'Задание не найдено.' };
      if (state.done.includes(id)) return { ok: false, message: 'Это задание уже выполнено.' };
      if (state.active.includes(id)) return { ok: false, message: 'Это задание уже в журнале.' };
      if (state.active.length >= MAX_ACTIVE) return { ok: false, message: 'В журнале уже ' + MAX_ACTIVE + ' задания. Сначала закончи одно.' };
      state.active.push(id);
      if (q.type === 'count') state.base[id] = goals.stat(q.stat);
      if (q.type === 'visit') state.visited[id] = false;
      save();
      return { ok: true, message: 'Задание добавлено в журнал.' };
    },

    finish(id) {
      const q = get(id);
      if (!q || !state.active.includes(id)) return { ok: false, message: 'Нет такого задания.' };
      const p = progressOf(q);
      if (p.have < p.need) return { ok: false, message: 'Пока не всё выполнено.' };
      if (q.type === 'deliver' && !economy.remove(q.item, q.amount)) return { ok: false, message: 'Пока не хватает предметов.' };
      state.active = state.active.filter((x) => x !== id);
      state.done.push(id);
      delete state.base[id]; delete state.visited[id];
      save();
      economy.addCoins(q.reward);
      goals.questDone(id);
      goals.addXp(q.xp);
      return { ok: true, message: 'Задание выполнено! +' + q.reward + ' монет, +' + q.xp + ' опыта.' };
    },

    // Вызывается каждый кадр: отмечает, что игрок дошёл до нужной зоны
    notePosition(x, z) {
      const waiting = state.active.map(get).filter((q) => q.type === 'visit' && !state.visited[q.id]);
      if (!waiting.length) return;
      for (const q of waiting) {
        const zone = ZONES.find((zn) => zn.id === q.zone);
        if (zone && Math.hypot(x - zone.x, z - zone.z) <= zone.radius) {
          state.visited[q.id] = true;
          save();
          notify('Ты на месте: ' + zone.name + '. Можно сдавать задание.', 'wave');
        }
      }
    },
  };
}
