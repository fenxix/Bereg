// goals.js — уровни, опыт, звания и главная цель «Огни Тихого Берега»
// Здесь нет графики: файл только считает прогресс и сохраняет его в localStorage.
const KEY = 'quiet-shore-goals-v1';

// Сколько всего опыта нужно, чтобы получить уровень (первый элемент = уровень 1)
const LEVEL_XP = [0, 30, 80, 150, 250, 380, 540, 740, 980, 1260];
export const MAX_LEVEL = LEVEL_XP.length;
const RANKS = [
  'Новенькая', 'Гостья острова', 'Помощница', 'Своя на берегу', 'Мастер улова',
  'Хозяйка тропинок', 'Подруга маяка', 'Любимица жителей', 'Хранительница берега', 'Душа Тихого Берега',
];

// Опыт за действия (его выдаёт main.js)
export const XP = {
  shell: 2, pinkShell: 5, starShell: 25, flower: 2,
  smallFish: 4, mediumFish: 7, largeFish: 14, goldFish: 45, talk: 3,
};

// Что открывается с уровнем
export const ROD_LEVEL = { sturdy: 3, gilded: 6 };
const BAG_LEVEL = { 12: 2, 18: 4, 24: 6 }; // размер сумки сейчас -> нужный уровень для расширения
export const bagLevel = (size) => BAG_LEVEL[size] || 0;
const PERKS = [
  { level: 2, text: 'можно расширить сумку' },
  { level: 3, text: 'крепкая удочка в магазине' },
  { level: 4, text: 'сумку можно расширить ещё раз' },
  { level: 6, text: 'позолоченная удочка и самая большая сумка' },
];

// Главная цель: четыре главы. Глава закрывается сама, когда выполнены все её шаги.
const CHAPTERS = [
  {
    title: 'Новое лицо',
    story: 'Остров встречает тебя тихо. Познакомься с жителями и помоги им с первыми делами.',
    steps: [
      { text: 'Поговорить с разными жителями', stat: 'talked', need: 4 },
      { text: 'Выполнить задания', stat: 'quests', need: 2 },
    ],
    reward: { coins: 80, xp: 20 },
  },
  {
    title: 'Дары моря и луга',
    story: 'Жителям нужны рыба, ракушки и цветы. Набей руку на берегу и на лугу.',
    steps: [
      { text: 'Поймать рыбу', stat: 'fish', need: 5 },
      { text: 'Найти ракушки', stat: 'shells', need: 8 },
      { text: 'Собрать цветы', stat: 'flowers', need: 6 },
    ],
    reward: { coins: 150, xp: 40 },
  },
  {
    title: 'Свои люди',
    story: 'Жители начинают считать тебя своей. Подружись с ними по-настоящему.',
    steps: [
      { text: 'Подружиться с жителями (симпатия 3)', stat: 'friends', need: 4 },
      { text: 'Достичь 4 уровня', stat: 'level', need: 4 },
      { text: 'Выполнить задания', stat: 'quests', need: 8 },
    ],
    reward: { coins: 250, xp: 80 },
  },
  {
    title: 'Огни маяка',
    story: 'Дед Ной мечтает снова зажечь маяк к празднику острова. Выполни три его поручения.',
    steps: [
      { text: 'Поручение Ноя: рыба для масла', done: 'noah-lamp1' },
      { text: 'Поручение Ноя: ракушки для линзы', done: 'noah-lamp2' },
      { text: 'Поручение Ноя: цветы для праздника', done: 'noah-lamp3' },
      { text: 'Заработать монет за всё время', stat: 'coins', need: 1000 },
    ],
    reward: { coins: 500, xp: 200 },
    final: true,
  },
];

const levelOf = (xp) => { let l = 1; while (l < MAX_LEVEL && xp >= LEVEL_XP[l]) l++; return l; };

function freshState() {
  return {
    xp: 0,
    stats: { quests: 0, fish: 0, shells: 0, flowers: 0, talks: 0, coins: 0 },
    talked: [],      // с кем уже разговаривала
    affection: {},   // лучшая симпатия с каждым жителем
    done: [],        // выполненные задания (по id)
    chapter: 0,
    finished: false,
    lastCoins: null, // сколько монет было в прошлый раз (чтобы считать заработанное)
  };
}

export function createGoals({ economy, notify = () => {}, onChange = () => {} }) {
  let state = freshState();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      state = { ...state, ...saved, stats: { ...state.stats, ...saved.stats } };
    }
  } catch { /* повреждённое сохранение начнётся заново */ }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* приватный режим */ } };
  const level = () => levelOf(state.xp);

  // Считаем монеты, которые игрок заработал (потраченные не вычитаем)
  function sync() {
    const coins = economy.coins;
    const gained = state.lastCoins != null && coins > state.lastCoins ? coins - state.lastCoins : 0;
    state.lastCoins = coins;
    if (gained) { state.stats.coins += gained; checkChapter(); }
  }

  // Награда от самой игры: не должна считаться «заработанными» монетами
  function giveCoins(amount) {
    sync();
    economy.addCoins(amount);
    state.lastCoins = economy.coins;
  }

  function value(step) {
    if (step.done) return state.done.includes(step.done) ? 1 : 0;
    if (step.stat === 'talked') return state.talked.length;
    if (step.stat === 'friends') return Object.values(state.affection).filter((a) => a >= 3).length;
    if (step.stat === 'level') return level();
    return state.stats[step.stat] || 0;
  }
  const needOf = (step) => step.done ? 1 : step.need;

  let checking = false;
  function checkChapter() {
    if (checking) return;
    checking = true;
    try {
      while (!state.finished) {
        const chapter = CHAPTERS[state.chapter];
        if (!chapter || !chapter.steps.every((s) => value(s) >= needOf(s))) break;
        giveCoins(chapter.reward.coins);
        notify('Глава «' + chapter.title + '» пройдена! +' + chapter.reward.coins + ' монет', 'coin');
        if (chapter.final) {
          state.finished = true;
          notify('Маяк снова горит! Ты — душа Тихого Берега.', 'star');
        } else {
          state.chapter += 1;
          notify('Новая цель: «' + CHAPTERS[state.chapter].title + '»', 'wave');
        }
        addXpInner(chapter.reward.xp);
      }
    } finally { checking = false; }
    save(); onChange();
  }

  function addXpInner(amount) {
    if (amount <= 0) return;
    const before = level();
    state.xp += amount;
    const after = level();
    for (let l = before + 1; l <= after; l++) {
      const bonus = 30 * l;
      giveCoins(bonus);
      const perk = PERKS.find((p) => p.level === l);
      notify('Уровень ' + l + ': ' + RANKS[l - 1] + '! +' + bonus + ' монет' + (perk ? ' · ' + perk.text : ''), 'star');
    }
  }

  return {
    get level() { return level(); },
    get xp() { return state.xp; },
    get rank() { return RANKS[level() - 1]; },
    get maxed() { return level() >= MAX_LEVEL; },
    get xpInLevel() { return state.xp - LEVEL_XP[level() - 1]; },
    get xpForLevel() { return this.maxed ? 0 : LEVEL_XP[level()] - LEVEL_XP[level() - 1]; },
    get levelProgress() { return this.maxed ? 1 : this.xpInLevel / this.xpForLevel; },
    get lighthouseLit() { return state.finished; },
    nextPerk() { const p = PERKS.find((x) => x.level > level()); return p ? 'Ур. ' + p.level + ': ' + p.text : ''; },

    sync,
    addXp(amount) { addXpInner(amount); save(); onChange(); checkChapter(); },
    count(stat, amount = 1) { state.stats[stat] = (state.stats[stat] || 0) + amount; save(); onChange(); checkChapter(); },
    stat(name) { return state.stats[name] || 0; },

    // Разговор с жителем: gained = true, если сегодня это первый разговор с ним
    noteTalk(id, affection, gained) {
      if (!state.talked.includes(id)) state.talked.push(id);
      state.affection[id] = Math.max(state.affection[id] || 0, affection || 0);
      if (gained) { state.stats.talks += 1; addXpInner(XP.talk); }
      save(); onChange(); checkChapter();
    },

    // Задание выполнено. silent = true, когда переносим старое сохранение
    questDone(id, silent = false) {
      if (state.done.includes(id)) return;
      state.done.push(id);
      state.stats.quests += 1;
      save();
      if (!silent) { onChange(); checkChapter(); }
    },

    chapter() {
      if (state.finished) {
        return { finished: true, title: 'Маяк горит', story: 'Остров празднует. Можно продолжать помогать жителям и расти в уровне.', steps: [], doneCount: 0 };
      }
      const c = CHAPTERS[state.chapter];
      const steps = c.steps.map((s) => {
        const need = needOf(s), have = Math.min(value(s), need);
        return { text: s.text, have, need, done: have >= need };
      });
      return {
        finished: false, index: state.chapter + 1, total: CHAPTERS.length,
        title: c.title, story: c.story, steps, doneCount: steps.filter((s) => s.done).length,
        reward: c.reward,
      };
    },
  };
}
