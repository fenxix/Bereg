// main.js — сцена, атмосфера, рыбалка и интерфейс
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createHeroine } from './models.js';
import { createPlayer } from './player.js';
import { createShells } from './shells.js';
import { createEconomy, ITEMS } from './economy.js';

const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const world = createWorld(scene);
const heroine = createHeroine();
scene.add(heroine);
const player = createPlayer({
  model: heroine, camera, domElement: renderer.domElement,
  groundHeight: world.surfaceHeight, colliders: world.colliders, start: world.start,
});
const economy = createEconomy();
const shells = createShells({ scene, groundHeight: world.surfaceHeight, economy });
const actionButton = document.getElementById('action');
const toastEl = document.getElementById('toast');
const fishingStatus = document.getElementById('fishing-status');
const bag = document.getElementById('bag');
const rodStatus = document.getElementById('rod-status');
let toastTimer = 0;
let fishing = { mode: 'idle' };
let fishingRod = null;
let fishingLine = null;
let bobber = null;
let splash = null;
let caughtFish = null;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function refreshBag() {
  document.getElementById('coins').textContent = '🪙 ' + economy.coins;
  document.getElementById('pearls').textContent = '🐚 ' + economy.pearls;
  document.getElementById('bag-count').textContent = economy.usedSlots + '/' + economy.bagSize;
  document.getElementById('rod-label').textContent = 'Удочка: ' + economy.rodLabel;
  rodStatus.textContent = economy.hasRod ? '🎣 ' + economy.rodLabel + ' удочка' : 'Удочки нет';
  const list = document.getElementById('inventory-list');
  list.replaceChildren();
  const entries = economy.summary();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Сумка пока пуста. Подойди к ракушке или порыбачь.';
    list.append(empty);
  }
  for (const row of entries) {
    const line = document.createElement('div');
    line.className = 'item-row';
    const label = document.createElement('span');
    label.textContent = row.label + ' × ' + row.count;
    const sell = document.createElement('button');
    sell.type = 'button';
    sell.dataset.sell = row.id;
    sell.textContent = 'Продать (' + row.price + (row.currency === 'pearls' ? ' 🐚' : ' 🪙') + ')';
    line.append(label, sell);
    list.append(line);
  }
}

document.getElementById('bag-toggle').addEventListener('click', () => { bag.hidden = !bag.hidden; refreshBag(); });
document.getElementById('bag-close').addEventListener('click', () => { bag.hidden = true; });
document.getElementById('inventory-list').addEventListener('click', (event) => {
  const id = event.target.dataset.sell;
  if (id) { economy.sell(id); refreshBag(); }
});
document.getElementById('bag-upgrade').addEventListener('click', () => {
  toast(economy.upgradeBag() ? 'Сумка стала больше!' : 'Для расширения не хватает монет или сумка уже максимальная.');
  refreshBag();
});
document.querySelector('.shop').addEventListener('click', (event) => {
  const rod = event.target.dataset.buyRod;
  if (rod) {
    toast(economy.buyRod(rod) ? 'Удочка куплена!' : 'Пока не хватает монет или жемчужин.');
    refreshBag();
  }
});

function fishingNearby() {
  return world.canFish(heroine.position.x, heroine.position.z);
}

function makeFishingRod() {
  const group = new THREE.Group();
  group.name = 'удочка-в-руках';
  group.position.set(0.29, 0.74, 0.08);
  group.rotation.set(0.55, 0, -0.22);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.032, 1.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x8A6240, roughness: 0.72 })
  );
  pole.position.y = 0.7;
  pole.castShadow = true;
  group.add(pole);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.22, 7),
    new THREE.MeshStandardMaterial({ color: 0xCDA67E, roughness: 0.8 })
  );
  handle.position.y = 0.08;
  group.add(handle);
  heroine.add(group);
  return group;
}

function castPoint() {
  const p = heroine.position;
  const length = Math.max(0.001, Math.hypot(p.x, p.z));
  const dx = p.x / length;
  const dz = p.z / length;
  return { x: p.x + dx * 4.2, z: p.z + dz * 4.2 };
}

function startFishing(now) {
  if (!economy.hasRod) {
    toast('Удочки нет. Начни с бамбуковой удочки в сумке.');
    return;
  }
  const target = castPoint();
  fishingRod = makeFishingRod();
  const rodTip = fishingRod.localToWorld(new THREE.Vector3(0, 1.4, 0));
  bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xF4A6B8, roughness: 0.35, emissive: 0x6D2B3C, emissiveIntensity: 0.18 })
  );
  bobber.castShadow = true;
  bobber.position.copy(rodTip);
  scene.add(bobber);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([rodTip, bobber.position]);
  fishingLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xFFF4E3, transparent: true, opacity: 0.88 }));
  scene.add(fishingLine);

  fishing = {
    mode: 'cast',
    started: now,
    castEnds: now + 720,
    biteAt: now + 720 + 3000 + Math.random() * 5000,
    biteUntil: 0,
    target,
  };
  fishingStatus.hidden = false;
  fishingStatus.textContent = '🎣 Забрасываем удочку…';
}

function disposeFishing() {
  if (fishingRod) { heroine.remove(fishingRod); fishingRod.traverse((obj) => { if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); } }); fishingRod = null; }
  if (fishingLine) { scene.remove(fishingLine); fishingLine.geometry.dispose(); fishingLine.material.dispose(); fishingLine = null; }
  if (bobber) { scene.remove(bobber); bobber.geometry.dispose(); bobber.material.dispose(); bobber = null; }
  if (splash) { scene.remove(splash); splash.geometry.dispose(); splash.material.dispose(); splash = null; }
}

function makeSplash(x, y, z) {
  if (splash) { scene.remove(splash); splash.geometry.dispose(); splash.material.dispose(); }
  const material = new THREE.MeshBasicMaterial({ color: 0xF5FBFF, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
  splash = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.22, 18), material);
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(x, y + 0.025, z);
  scene.add(splash);
}

function makeCaughtFish(position) {
  const group = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x6B9AC4, roughness: 0.48, flatShading: true });
  const pale = new THREE.MeshStandardMaterial({ color: 0xF5FBFF, roughness: 0.65, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 7), blue);
  body.scale.set(1.45, 0.58, 0.62);
  group.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 5), blue);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.36;
  group.add(tail);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), pale);
  eye.position.set(0.22, 0.035, 0.09);
  group.add(eye);
  group.position.copy(position);
  scene.add(group);
  return { group, start: position.clone(), elapsed: 0 };
}

function landFish(item) {
  const start = bobber ? bobber.position.clone() : heroine.position.clone().add(new THREE.Vector3(0, 1, 0));
  const label = item ? ITEMS[item].label : '';
  disposeFishing();
  if (item) {
    caughtFish = makeCaughtFish(start);
    toast('Поймана рыба: ' + label + '!');
  } else {
    toast('Сумка полна — рыба уплыла.');
  }
  refreshBag();
  fishingStatus.hidden = true;
  fishing = { mode: 'idle' };
}

function performAction() {
  // Активный клёв важнее ракушек рядом: кнопка «Подсечь» всегда делает именно подсечку.
  if (fishing.mode === 'bite') {
    if (performance.now() <= fishing.biteUntil) {
      const item = economy.catchFish();
      landFish(item);
    } else {
      landFish(null);
      toast('Рыбка сорвалась с крючка.');
    }
    return;
  }
  if (fishing.mode !== 'idle') return;
  const nearShell = shells.update(0, heroine.position);
  if (nearShell) {
    const result = shells.collect();
    if (result?.error) toast(result.error);
    else if (result?.item) toast('Найдена: ' + ITEMS[result.item].label);
    refreshBag();
    return;
  }
  if (fishingNearby()) startFishing(performance.now());
}

actionButton.addEventListener('click', performAction);
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE' && !event.repeat && bag.hidden) performAction();
});

function updateFishing(now, dt) {
  const active = fishing.mode !== 'idle';
  if (!active) {
    fishingStatus.hidden = true;
    actionButton.classList.remove('bite');
    return;
  }

  if (fishing.mode === 'cast') {
    const progress = THREE.MathUtils.clamp((now - fishing.started) / (fishing.castEnds - fishing.started), 0, 1);
    fishingRod.rotation.x = 0.55 - Math.sin(progress * Math.PI) * 0.7;
    const tip = fishingRod.localToWorld(new THREE.Vector3(0, 1.4, 0));
    const waterY = world.waterHeight(fishing.target.x, fishing.target.z, now / 1000);
    const end = new THREE.Vector3(fishing.target.x, waterY + 0.12, fishing.target.z);
    bobber.position.lerpVectors(tip, end, progress);
    bobber.position.y += Math.sin(progress * Math.PI) * 1.9;
    if (progress >= 1) {
      fishing.mode = 'waiting';
      fishingStatus.textContent = '🌊 Поплавок на волнах — ждём поклёвку';
    } else {
      fishingStatus.textContent = '🎣 Заброс…';
    }
  } else {
    const waterY = world.waterHeight(fishing.target.x, fishing.target.z, now / 1000);
    if (fishing.mode === 'waiting') {
      bobber.position.y = waterY + 0.13 + Math.sin(now * 0.003) * 0.045;
      const seconds = Math.max(0, Math.ceil((fishing.biteAt - now) / 1000));
      fishingStatus.textContent = '🌊 Ждём поклёвку · ' + seconds + ' сек.';
      if (now >= fishing.biteAt) {
        fishing.mode = 'bite';
        fishing.biteUntil = now + 2100;
        makeSplash(fishing.target.x, waterY, fishing.target.z);
        fishingStatus.textContent = '✨ Клюёт! Быстро нажми «Подсечь!»';
        toast('Поплавок дёрнулся — подсекай!');
      }
    } else if (fishing.mode === 'bite') {
      const remaining = Math.max(0, (fishing.biteUntil - now) / 2100);
      bobber.position.y = waterY + 0.13 - Math.sin((1 - remaining) * Math.PI) * 0.28;
      if (splash) {
        const age = 1 - remaining;
        splash.scale.setScalar(0.7 + age * 2.6);
        splash.material.opacity = Math.max(0, 0.62 * (1 - age));
      }
      fishingStatus.textContent = '✨ Клюёт! Нажми «Подсечь!» · ' + (Math.max(0, fishing.biteUntil - now) / 1000).toFixed(1) + ' сек.';
      if (now > fishing.biteUntil) {
        landFish(null);
        toast('Рыбка сорвалась с крючка.');
      }
    }
  }

  if (fishingLine && bobber) {
    const tip = fishingRod.localToWorld(new THREE.Vector3(0, 1.4, 0));
    const positions = fishingLine.geometry.attributes.position;
    positions.setXYZ(0, tip.x, tip.y, tip.z);
    positions.setXYZ(1, bobber.position.x, bobber.position.y, bobber.position.z);
    positions.needsUpdate = true;
    fishingLine.geometry.computeBoundingSphere();
  }
  actionButton.hidden = false;
  actionButton.disabled = fishing.mode !== 'bite';
  actionButton.classList.toggle('bite', fishing.mode === 'bite');
  actionButton.textContent = fishing.mode === 'cast' ? 'Забрасываем…'
    : fishing.mode === 'bite' ? 'Подсечь!'
      : 'Ждём поклёвку…';
}

function dayLabel(dayTime) {
  if (dayTime < 0.18 || dayTime >= 0.88) return { label: 'Ночь', icon: '🌙' };
  if (dayTime < 0.29) return { label: 'Рассвет', icon: '🌅' };
  if (dayTime < 0.46) return { label: 'Утро', icon: '☀️' };
  if (dayTime < 0.64) return { label: 'День', icon: '🌤️' };
  if (dayTime < 0.72) return { label: 'После полудня', icon: '🌤️' };
  if (dayTime < 0.81) return { label: 'Закат', icon: '🌇' };
  return { label: 'Сумерки', icon: '🌆' };
}

function updateClock() {
  const info = world.getDayInfo();
  const minuteOfDay = Math.floor(info.dayTime * 24 * 60) % (24 * 60);
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const mm = String(minuteOfDay % 60).padStart(2, '0');
  const phase = dayLabel(info.dayTime);
  document.getElementById('clock-time').textContent = hh + ':' + mm;
  document.getElementById('day-phase').textContent = phase.label;
  document.getElementById('time-icon').textContent = phase.icon;
}

function onResize() {
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

let frames = 0, lastFps = performance.now(), previous = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;

  player.update(dt);
  const position = heroine.position;
  const nearbyShell = shells.update(dt, position);
  world.update(now / 1000);
  updateFishing(now, dt);

  if (fishing.mode === 'idle') {
    actionButton.classList.remove('bite');
    actionButton.disabled = false;
    if (nearbyShell) {
      actionButton.hidden = false;
      actionButton.textContent = 'Взять ракушку';
    } else if (fishingNearby()) {
      actionButton.hidden = false;
      actionButton.textContent = economy.hasRod ? 'Закинуть удочку' : 'Нужна удочка';
    } else {
      actionButton.hidden = true;
    }
  }

  if (caughtFish) {
    caughtFish.elapsed += dt;
    const t = Math.min(1, caughtFish.elapsed / 1.05);
    const target = new THREE.Vector3(position.x, position.y + 1.1, position.z);
    caughtFish.group.position.lerpVectors(caughtFish.start, target, t);
    caughtFish.group.position.y += Math.sin(t * Math.PI) * 1.5;
    caughtFish.group.rotation.z = Math.sin(t * Math.PI * 2) * 0.25;
    caughtFish.group.scale.setScalar(1 - t * 0.35);
    if (t >= 1) {
      scene.remove(caughtFish.group);
      caughtFish.group.traverse((obj) => { if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); } });
      caughtFish = null;
    }
  }

  world.sky.position.copy(camera.position);
  renderer.render(scene, camera);
  updateClock();

  frames++;
  if (now - lastFps >= 500) {
    document.getElementById('fps').textContent = 'FPS: ' + Math.round(frames * 1000 / (now - lastFps));
    frames = 0;
    lastFps = now;
  }
}
refreshBag();
requestAnimationFrame(loop);
