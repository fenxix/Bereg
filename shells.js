// shells.js — ракушки на пляже: находим, собираем, считаем (прогресс хранится в браузере)
import * as THREE from 'three';

const KEY = 'tihiy-bereg-shells';
const WANT = 12;       // сколько ракушек прячем на берегу
const PICKUP_R = 1.2;  // с какого расстояния героиня подбирает ракушку

// Генератор случайных чисел с «семечком»: у всех ракушки лежат в одних и тех же местах
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createShells({ scene, groundHeight, hudEl, toastEl }) {
  const rand = makeRandom(2024);

  // Ищем места на песке у воды, не на пирсе и не слишком близко друг к другу
  const spots = [];
  for (let i = 0; i < 4000 && spots.length < WANT; i++) {
    const a = rand() * Math.PI * 2;
    const r = 14 + rand() * 18;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const g = groundHeight(x, z);
    if (g < 0.1 || g > 0.38) continue;
    if (Math.abs(x) < 3 && z > 8) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 5)) continue;
    spots.push({ x, z, y: g });
  }
  const total = spots.length;

  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* ничего страшного */ }

  const geo = new THREE.SphereGeometry(0.24, 14, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFE3D6, emissive: 0xF4A6B8, emissiveIntensity: 0.35, roughness: 0.55,
  });

  const items = spots.map((s, i) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(1, 0.5, 1.15); // приплюснутая «раковина»
    mesh.position.set(s.x, s.y + 0.45, s.z);
    if (!found.has(i)) scene.add(mesh);
    return { ...s, mesh, phase: rand() * 6.28, done: found.has(i) };
  });

  function render() { hudEl.textContent = '🐚 ' + found.size + '/' + total; }
  render();

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function collect(item, i) {
    item.done = true;
    scene.remove(item.mesh);
    found.add(i);
    try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) { /* ничего страшного */ }
    render();
    hudEl.classList.add('pop');
    setTimeout(() => hudEl.classList.remove('pop'), 250);
    toast(found.size === total
      ? 'Все ракушки собраны! Берег тобой гордится 🐚'
      : 'Ракушка найдена! ' + found.size + ' из ' + total);
  }

  if (found.size < total) toast('На пляже спрятаны ракушки — найди их все 🐚');

  // time — секунды, p — где стоит героиня
  function update(time, p) {
    items.forEach((item, i) => {
      if (item.done) return;
      item.mesh.position.y = item.y + 0.45 + Math.sin(time * 2 + item.phase) * 0.08;
      item.mesh.rotation.y = time * 1.5 + item.phase;
      if (Math.hypot(p.x - item.x, p.z - item.z) < PICKUP_R) collect(item, i);
    });
  }

  return { update };
}
