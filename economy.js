// economy.js — предметы, сумка и сохранение прогресса
const SAVE_KEY = 'quiet-shore-save-v1';
export const ITEMS = {
  shell: { label: 'Обычная ракушка', price: 5, currency: 'coins' },
  pinkShell: { label: 'Розовая ракушка', price: 15, currency: 'coins' },
  starShell: { label: 'Звёздная ракушка', price: 1, currency: 'pearls' },
  smallFish: { label: 'Мелкая рыба', price: 10, currency: 'coins' },
  mediumFish: { label: 'Средняя рыба', price: 25, currency: 'coins' },
  largeFish: { label: 'Крупная рыба', price: 60, currency: 'coins' },
  goldFish: { label: 'Золотая рыбка', price: 150, currency: 'coins' },
  flower: { label: 'Цветы и травы', price: 8, currency: 'coins' },
};
const RODS = ['bamboo', 'sturdy', 'gilded'];
const ROD_LABELS = { bamboo: 'Бамбуковая', sturdy: 'Крепкая', gilded: 'Позолоченная' };
function freshSave() {
  return { coins: 0, pearls: 0, bagSize: 12, rod: 'bamboo', inventory: {} };
}
export function createEconomy() {
  let data = freshSave();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && typeof saved === 'object') data = { ...data, ...saved, inventory: { ...saved.inventory } };
  } catch { /* повреждённое сохранение начнётся заново */ }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* приватный режим */ } };
  const usedSlots = () => Object.values(data.inventory).reduce((sum, count) => sum + count, 0);
  return {
    get coins() { return data.coins; },
    get pearls() { return data.pearls; },
    get bagSize() { return data.bagSize; },
    get usedSlots() { return usedSlots(); },
    get rod() { return RODS.includes(data.rod) ? data.rod : 'bamboo'; },
    get hasRod() { return RODS.includes(data.rod); },
    get rodLabel() { return ROD_LABELS[data.rod] || ROD_LABELS.bamboo; },
    get inventory() { return { ...data.inventory }; },
    add(item, count = 1) {
      if (!ITEMS[item] || count < 1 || usedSlots() + count > data.bagSize) return false;
      data.inventory[item] = (data.inventory[item] || 0) + count; persist(); return true;
    },
    sell(item, count = 1) {
      const def = ITEMS[item], have = data.inventory[item] || 0;
      if (!def || count < 1 || have < count) return false;
      data.inventory[item] -= count;
      if (!data.inventory[item]) delete data.inventory[item];
      data[def.currency] += def.price * count; persist(); return true;
    },
    upgradeBag() {
      const levels = { 12: 150, 18: 400, 24: 900 };
      const price = levels[data.bagSize];
      if (!price || data.coins < price) return false;
      data.coins -= price; data.bagSize += 6; persist(); return true;
    },
    buyRod(rod) {
      const offers = { sturdy: { coins: 200 }, gilded: { coins: 1000, pearls: 3 } };
      const price = offers[rod];
      if (!price || RODS.indexOf(rod) <= RODS.indexOf(data.rod)) return false;
      if (data.coins < price.coins || data.pearls < (price.pearls || 0)) return false;
      data.coins -= price.coins; data.pearls -= price.pearls || 0; data.rod = rod; persist(); return true;
    },
    catchFish() {
      const r = Math.random();
      let item;
      if (data.rod === 'gilded' && r < 0.10) item = 'goldFish';
      else if (r < (data.rod === 'sturdy' ? 0.48 : 0.28)) item = 'largeFish';
      else if (r < 0.76) item = 'mediumFish';
      else item = 'smallFish';
      return this.add(item) ? item : null;
    },
    summary() { return Object.entries(data.inventory).map(([id, count]) => ({ id, ...ITEMS[id], count })); },
  };
}
