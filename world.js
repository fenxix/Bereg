// world.js — мир: небо, остров, море, свет и туман, городок, а также смена времени суток
import * as THREE from 'three';
import {
  createHouse, createTree, createLamp, createBoat, createDock,
  createBench, createFlowers, createFountain, instanceModel,
  createCrate, createBarrel, createStall, createNetRack, createFisherHut, createLighthouse,
  createFence, createMailbox, createMushrooms, createRock, createStep,
  createLounger, createUmbrella, createSwingTree,
} from './models.js';
import { ZONES, PATHS, zoneById, distToPaths, layoutZones } from './zones.js';

// ===== Настройки (удобно менять здесь) =====
const COLORS = {
  skyHorizon: 0xFFD9B8,
  skyTop: 0xBFD9F2,
  sea: 0x6EC1D6,
  foam: 0xF5FBFF,
  sand: 0xF3DDB0,
  grass: 0xA8D08D,
  darkGrass: 0x7FB069,
  plazaOuter: 0xE6D8BF,
  plazaMiddle: 0xD9C8A8,
  tileA: 0xE6D8BF,
  tileB: 0xDACBAE,
  rock: 0xC9BBA8,
};

const SEA_LEVEL = 0;     // высота воды
const SEABED = -1.5;     // дно моря
const PLATEAU = 0.6;     // высота ровной земли острова

// Городок стоит в центре острова на ровной земле
const TOWN_FLAT_R = 13;   // до этого расстояния земля идеально ровная
const TOWN_BLEND_R = 18;  // дальше она плавно возвращается к холмам
const PLAZA_R = 4.4;      // радиус площади с фонтаном

// Дальние зоны не рисуем: считаем расстояние от героини до края зоны.
// 45 — это уже в тумане, поэтому появление зоны почти не заметно
const CULL_DISTANCE = 45;
// Туман: над островом обычный, а за его пределами чуть гуще, чтобы край карты не выглядел обрезанным
const FOG_BASE = 0.008;
const FOG_SEA = 0.0105;
const SHADOW_R = 40;       // сколько единиц вокруг героини покрывают тени

// Дома: угол (в градусах, 0 — на восток, 90 — на юг), расстояние от центра, вариант дома.
// Южное направление (90) свободно: там дорога к пирсу.
const HOUSES = [
  { angle: 40, radius: 9.5, variant: 0 },
  { angle: 140, radius: 9.6, variant: 1 },
  { angle: 195, radius: 9.3, variant: 2 },
  { angle: 250, radius: 9.7, variant: 0 },
  { angle: 305, radius: 9.4, variant: 1 },
  { angle: 355, radius: 9.6, variant: 2 },
];

// ===== Настройки времени суток =====
const DAY_LENGTH = 12 * 60;      // полный круг суток: 12 реальных минут
const LAMP_GLOW_DROP = 0.25;     // насколько ниже верхушки фонаря сидит его свечение
const WINDOW_GLOW = 0xFFB45E;    // тёплый свет окон
const LAMP_GLOW = 0xFFD08A;      // тёплый свет фонарей
const GLASS_COLOR = 0xBFD9F2;    // цвет стекла в моделях: по нему находим окна у «запечённых» домов

// Время суток: 0 — полночь, 0.25 — рассвет, 0.5 — полдень, 0.75 — закат.
// Между «ключевыми точками» все цвета и числа плавно перетекают друг в друга.
// 0.72 — это тот самый «тёплый закат» из начального стиля игры.
const C = (hex) => new THREE.Color(hex);
const DAY_KEYS = [
  { t: 0.00, top: C(0x1C2B5A), horizon: C(0x3D4D80), fog: C(0x35437A), sun: C(0xFFFFFF), sunI: 0.00, moonI: 0.60, hemiSky: C(0x7F94D6), hemiGround: C(0x4A5282), hemiI: 0.80, night: 1.00 }, // полночь
  { t: 0.10, top: C(0x1C2B5A), horizon: C(0x3D4D80), fog: C(0x35437A), sun: C(0xFFFFFF), sunI: 0.00, moonI: 0.60, hemiSky: C(0x7F94D6), hemiGround: C(0x4A5282), hemiI: 0.80, night: 1.00 }, // глубокая ночь
  { t: 0.18, top: C(0x33407F), horizon: C(0x9B7FA8), fog: C(0x80709F), sun: C(0xFF9A70), sunI: 0.25, moonI: 0.40, hemiSky: C(0x8EA0D8), hemiGround: C(0x6A6080), hemiI: 0.75, night: 0.80 }, // перед рассветом
  { t: 0.25, top: C(0x8FB6E0), horizon: C(0xFFB48E), fog: C(0xFFBE9C), sun: C(0xFFB278), sunI: 1.10, moonI: 0.00, hemiSky: C(0xA9C3E6), hemiGround: C(0xE8C8A0), hemiI: 0.60, night: 0.10 }, // рассвет
  { t: 0.32, top: C(0xA3D0F2), horizon: C(0xFFE6C8), fog: C(0xFFE9D2), sun: C(0xFFE6BE), sunI: 1.50, moonI: 0.00, hemiSky: C(0xBFD9F2), hemiGround: C(0xF3DDB0), hemiI: 0.70, night: 0.00 }, // утро
  { t: 0.50, top: C(0x8EC9F2), horizon: C(0xDDF0F8), fog: C(0xE4F2F6), sun: C(0xFFF4DC), sunI: 1.80, moonI: 0.00, hemiSky: C(0xBFD9F2), hemiGround: C(0xF3DDB0), hemiI: 0.80, night: 0.00 }, // полдень
  { t: 0.64, top: C(0xA2CDF0), horizon: C(0xFFE4C2), fog: C(0xFFE6C8), sun: C(0xFFDDB0), sunI: 1.70, moonI: 0.00, hemiSky: C(0xBFD9F2), hemiGround: C(0xF3DDB0), hemiI: 0.75, night: 0.00 }, // после обеда
  { t: 0.72, top: C(0xBFD9F2), horizon: C(0xFFD9B8), fog: C(0xFFD9B8), sun: C(0xFFD2A1), sunI: 1.60, moonI: 0.00, hemiSky: C(0xBFD9F2), hemiGround: C(0xF3DDB0), hemiI: 0.70, night: 0.00 }, // тёплый закат
  { t: 0.78, top: C(0x9B9CD0), horizon: C(0xFF9F88), fog: C(0xF0A896), sun: C(0xFF9A68), sunI: 1.20, moonI: 0.00, hemiSky: C(0xB4A8D4), hemiGround: C(0xE0B090), hemiI: 0.65, night: 0.15 }, // глубокий закат
  { t: 0.84, top: C(0x44468C), horizon: C(0xC8708F), fog: C(0x8E6C9A), sun: C(0xC77A9A), sunI: 0.35, moonI: 0.35, hemiSky: C(0x7F8CCC), hemiGround: C(0x5E5480), hemiI: 0.72, night: 0.75 }, // сумерки
  { t: 0.92, top: C(0x1F2E5E), horizon: C(0x3F4F84), fog: C(0x384680), sun: C(0xFFFFFF), sunI: 0.00, moonI: 0.60, hemiSky: C(0x7F94D6), hemiGround: C(0x4A5282), hemiI: 0.80, night: 1.00 }, // ночь
  { t: 1.00, top: C(0x1C2B5A), horizon: C(0x3D4D80), fog: C(0x35437A), sun: C(0xFFFFFF), sunI: 0.00, moonI: 0.60, hemiSky: C(0x7F94D6), hemiGround: C(0x4A5282), hemiI: 0.80, night: 1.00 }, // снова полночь
];

// Здесь лежит «текущее» состояние неба и света (пересчитывается каждый кадр)
const cur = {
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  fog: new THREE.Color(),
  sun: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sunI: 0, moonI: 0, hemiI: 0, night: 0,
};

// Берёт две ближайшие ключевые точки и смешивает их
function sampleDay(t) {
  let i = 0;
  while (i < DAY_KEYS.length - 2 && t >= DAY_KEYS[i + 1].t) i++;
  const a = DAY_KEYS[i];
  const b = DAY_KEYS[i + 1];
  const k = (t - a.t) / (b.t - a.t);
  cur.top.lerpColors(a.top, b.top, k);
  cur.horizon.lerpColors(a.horizon, b.horizon, k);
  cur.fog.lerpColors(a.fog, b.fog, k);
  cur.sun.lerpColors(a.sun, b.sun, k);
  cur.hemiSky.lerpColors(a.hemiSky, b.hemiSky, k);
  cur.hemiGround.lerpColors(a.hemiGround, b.hemiGround, k);
  cur.sunI = a.sunI + (b.sunI - a.sunI) * k;
  cur.moonI = a.moonI + (b.moonI - a.moonI) * k;
  cur.hemiI = a.hemiI + (b.hemiI - a.hemiI) * k;
  cur.night = a.night + (b.night - a.night) * k;
}

// Время суток берём из настоящих часов. Поэтому у всех игроков
// в одном мире сейчас одно и то же время — синхронизировать по сети не нужно.
// Для проверки: адрес с ?time=0.9 «замораживает» время (0.9 — ночь).
const urlTime = new URLSearchParams(window.location.search).get('time');
const FIXED_TIME = urlTime !== null && !Number.isNaN(Number(urlTime)) ? Number(urlTime) : null;
let timeShift = 0; // сдвиг для проверки (клавиша T), в долях суток

function currentDayTime() {
  if (FIXED_TIME !== null) return ((FIXED_TIME % 1) + 1) % 1;
  const t = Date.now() / 1000 / DAY_LENGTH + timeShift;
  return t - Math.floor(t);
}

// ===== Помощники =====
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Генератор случайных чисел с «семечком»: у всех игроков деревья будут стоять в одних и тех же местах
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Мягкие светящиеся пятна, нарисованные на canvas (файлов-картинок нет)
const textureCache = {};
function makeGlowTexture(kind) {
  if (textureCache[kind]) return textureCache[kind];
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (kind === 'moon') {
    g.addColorStop(0, 'rgba(255,252,235,1)');
    g.addColorStop(0.36, 'rgba(255,252,235,1)');
    g.addColorStop(0.42, 'rgba(255,252,235,0.30)');
    g.addColorStop(1, 'rgba(255,252,235,0)');
  } else if (kind === 'sun') {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache[kind] = texture;
  return texture;
}

// ===== Рельеф =====
// Вся высота земли считается формулой, случайных чисел здесь нет.
// Поэтому у всех игроков остров одинаковый.

// Радиус острова был 26, теперь 48 (в 1,85 раза): площадь выросла примерно в 3,4 раза.
const ISLAND_R = 48;
const SHORE_FROM = -4;   // профиль берега: на этом расстоянии от кромки острова земля на дне...
const SHORE_TO = 9;      // ...а здесь уже выходит на ровную землю
const WALK_MIN = -0.1;   // глубже этого героиню в воду не пускаем

// Обратная функция к smoothstep: по высоте находит расстояние. Нужна, чтобы узнать, где кромка воды.
function invSmoothstep(y) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (mid * mid * (3 - 2 * mid) < y) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// Расстояние от кромки острова, на котором земля ровно на уровне моря
const D_WATER = SHORE_FROM + (SHORE_TO - SHORE_FROM) * invSmoothstep((SEA_LEVEL - SEABED) / (PLATEAU - SEABED));

// Зоны, которым нужен свой рельеф
const Z_LIGHTHOUSE = zoneById('lighthouse');
const Z_MEADOW = zoneById('meadow');
const Z_MARKET = zoneById('market');
const Z_QUARTER = zoneById('quarter');
const Z_HARBOR = zoneById('harbor');
const Z_COVE = zoneById('cove');

// Водоёмы, вырезанные в острове. Это отрезок (a — b), r — расстояние от оси до кромки воды.
const HARBOR_BAY_Z = 30.6; // подобрано так, чтобы пирс начинался там же, где раньше (z ≈ 17,85)
const COVE_CENTER = { x: 36, z: 27.5 };
const WATER_BODIES = [
  // бухта гавани у пирса и канал, который уходит на юг к открытому морю
  { ax: 0, az: HARBOR_BAY_Z, bx: 0, bz: 90, r: 11 },
  // Тихая бухта: круглая выемка в юго-восточном берегу
  { ax: COVE_CENTER.x, az: COVE_CENTER.z, bx: COVE_CENTER.x, bz: COVE_CENTER.z, r: 9 },
];

// Радиус берега в зависимости от угла: делает остров неровным, не круглым
function shoreRadius(angle) {
  return ISLAND_R + 4.6 * Math.sin(3 * angle + 1) + 2.8 * Math.sin(5 * angle + 2);
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// Мягкий минимум: в местах, где бухта встречается с берегом, углы получаются скруглёнными
function smoothMin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Насколько точка «в глубине суши»: больше 0 — внутри острова, меньше 0 — в море
function landDistance(x, z) {
  let d = shoreRadius(Math.atan2(z, x)) - Math.hypot(x, z);
  for (const w of WATER_BODIES) {
    d = smoothMin(d, distToSegment(x, z, w.ax, w.az, w.bx, w.bz) - (w.r - D_WATER), 3);
  }
  return d;
}

// Вокруг Тихой бухты берег пологий, поэтому песчаная полоса получается широкой
function beachMask(x, z) {
  return 1 - smoothstep(11, 24, Math.hypot(x - COVE_CENTER.x, z - COVE_CENTER.z));
}

// Холмы: центр, высота h, ровная вершина (top), где холм кончается (out).
// edgeFrom..edgeTo — на каком расстоянии от берега холм набирает полную высоту.
const HILLS = [
  { x: Z_LIGHTHOUSE.x, z: Z_LIGHTHOUSE.z, h: 5, top: 4, out: 16.5, edgeFrom: 0, edgeTo: 16 }, // скала с маяком
  { x: Z_MEADOW.x, z: Z_MEADOW.z, h: 1.7, top: 3, out: 11, edgeFrom: 8, edgeTo: 16 },               // холм цветочного луга
  { x: 44, z: -10, h: 1.5, top: 0, out: 10, edgeFrom: 8, edgeTo: 16 },                         // мягкие холмы для красоты
  { x: -40, z: 26, h: 1.6, top: 0, out: 11, edgeFrom: 8, edgeTo: 16 },
  { x: 12, z: -43, h: 1.4, top: 0, out: 10, edgeFrom: 8, edgeTo: 16 },
];

// Места, где земля остаётся ровной (там стоят дома, лавки, лодки). Работает на холмы и неровности.
const FLAT_AREAS = [
  { x: 0, z: 0, from: TOWN_FLAT_R, to: TOWN_BLEND_R },                        // городок
  { x: Z_MARKET.x, z: Z_MARKET.z, from: 8, to: 13 },                          // торговая улица
  { x: Z_QUARTER.x, z: Z_QUARTER.z, from: 10, to: 16 },                       // жилой квартал
  { x: Z_HARBOR.x, z: Z_HARBOR.z, from: 14, to: 22 },                         // гавань
  { x: Z_COVE.x, z: Z_COVE.z, from: 8, to: 14 },                              // пляж
];

function flatness(x, z) {
  let f = 0;
  for (const a of FLAT_AREAS) {
    f = Math.max(f, 1 - smoothstep(a.from, a.to, Math.hypot(x - a.x, z - a.z)));
  }
  return f;
}

// Холмы и мягкие неровности сверху на базовой земле
function extraHeight(x, z, d) {
  let h = 0;
  for (const hill of HILLS) {
    const dist = Math.hypot(x - hill.x, z - hill.z);
    h += hill.h * (1 - smoothstep(hill.top, hill.out, dist)) * smoothstep(hill.edgeFrom, hill.edgeTo, d);
  }
  const wave = 0.22 * Math.sin(x * 0.13 + 0.7) * Math.sin(z * 0.11 + 2.1);
  return h + wave * smoothstep(15, 24, Math.hypot(x, z)) * smoothstep(6, 12, d);
}

// Высота земли в точке (x, z). Единый источник правды: по ней ходит героиня и на ней стоят все модели.
export function groundHeight(x, z) {
  const d = landDistance(x, z);
  const k = 1 - 0.6 * beachMask(x, z);
  const s = smoothstep(SHORE_FROM, SHORE_TO, D_WATER + (d - D_WATER) * k); // плавный пологий берег
  const base = SEABED + s * (PLATEAU - SEABED);
  return base + extraHeight(x, z, d) * (1 - flatness(x, z));
}

// ===== Пирс: где начинается и куда идёт =====
// Идёт строго на юг от площади. Начало там, где земля опускается примерно до 0.35.
const PIER = (() => {
  let z = 10;
  while (z < 40 && groundHeight(0, z) > 0.35) z += 0.05;
  return { x: 0, z0: z, length: 10.5, halfW: 1.2, deckTop: 0.45 };
})();

// Высота, по которой ходит героиня: земля или настил пирса
export function surfaceHeight(x, z) {
  const g = groundHeight(x, z);
  const onPier = Math.abs(x - PIER.x) <= PIER.halfW && z >= PIER.z0 && z <= PIER.z0 + PIER.length;
  return onPier ? Math.max(g, PIER.deckTop) : g;
}

// Высота волны: нужна и морю, и лодке, чтобы лодка качалась вместе с водой
function waveHeight(x, z, t) {
  return 0.10 * Math.sin(x * 0.35 + t * 1.1) +
    0.08 * Math.sin(z * 0.28 + t * 0.9) +
    0.05 * Math.sin((x + z) * 0.5 + t * 1.6);
}

// ===== Небо: большая сфера с градиентом, звёзды, солнце и луна =====
// Цвета неба меняются каждый кадр, поэтому градиент считает маленькая программа (шейдер)
const SKY_VERTEX = `
  varying float vHeight;
  void main() {
    vHeight = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAGMENT = `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying float vHeight;
  void main() {
    float k = smoothstep(0.0, 0.35, vHeight);
    gl_FragColor = vec4(mix(horizonColor, topColor, k), 1.0);
    #include <colorspace_fragment>
  }
`;

function createStars(count, rand) {
  const R = 380;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 0.03 + 0.97 * rand();            // только над горизонтом
    const r = Math.sqrt(1 - y * y);
    const a = rand() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r * R;
    positions[i * 3 + 1] = y * R;
    positions[i * 3 + 2] = Math.sin(a) * r * R;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xFFF6E0,
    size: 2.4,
    sizeAttenuation: false,
    map: makeGlowTexture('soft'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  return stars;
}

function createSky() {
  const group = new THREE.Group();
  const R = 400;

  const uniforms = {
    topColor: { value: new THREE.Color(COLORS.skyTop) },
    horizonColor: { value: new THREE.Color(COLORS.skyHorizon) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  group.add(dome);

  // Две группы звёзд мерцают по очереди
  const rand = makeRandom(4242);
  const starsA = createStars(160, rand);
  const starsB = createStars(160, rand);
  group.add(starsA, starsB);

  // Солнце — мягкое тёплое пятно
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('sun'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  sunSprite.scale.set(70, 70, 1);
  sunSprite.renderOrder = -1;
  group.add(sunSprite);

  // Луна — бледный диск с лёгким ореолом
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('moon'),
    transparent: true,
    depthWrite: false,
    fog: false,
  }));
  moonSprite.scale.set(40, 40, 1);
  moonSprite.renderOrder = -1;
  group.add(moonSprite);

  const v = new THREE.Vector3();

  // cosA, sinA — где солнце на своём пути по небу
  function update(cosA, sinA, time) {
    uniforms.topColor.value.copy(cur.top);
    uniforms.horizonColor.value.copy(cur.horizon);

    v.set(cosA, sinA, 0.33).normalize().multiplyScalar(370);
    sunSprite.position.copy(v);
    sunSprite.material.color.copy(cur.sun);
    sunSprite.material.opacity = smoothstep(-0.12, 0.05, sinA) * 0.30;
    sunSprite.visible = sunSprite.material.opacity > 0.01;

    v.set(-cosA, -sinA, -0.2).normalize().multiplyScalar(370);
    moonSprite.position.copy(v);
    moonSprite.material.opacity = smoothstep(0.55, 0.95, cur.night) * smoothstep(-0.05, 0.12, -sinA);
    moonSprite.visible = moonSprite.material.opacity > 0.01;

    const starLevel = smoothstep(0.55, 1, cur.night) * 0.9;
    starsA.material.opacity = starLevel * (0.75 + 0.25 * Math.sin(time * 1.3));
    starsB.material.opacity = starLevel * (0.75 + 0.25 * Math.sin(time * 1.3 + 2.1));
    starsA.visible = starsB.visible = starLevel > 0.01;
  }

  return { group, update };
}

// ===== Остров: земля с холмами, песчаным берегом и каменистыми склонами =====
function createIsland() {
  const SIZE = 120;      // сторона квадрата земли (раньше было 100, остров стал больше)
  const SEGMENTS = 80;   // сетка: одна клетка около 1,5 единицы
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(COLORS.sand);
  const grass = new THREE.Color(COLORS.grass);
  const darkGrass = new THREE.Color(COLORS.darkGrass);
  const rock = new THREE.Color(COLORS.rock);
  const sea = new THREE.Color(COLORS.sea);
  const foam = new THREE.Color(COLORS.foam);
  const c = new THREE.Color();
  const e = 0.6; // шаг, которым меряем крутизну склона

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);

    if (h < SEA_LEVEL) {
      // под водой: песок постепенно переходит в цвет моря
      c.copy(sand).lerp(sea, smoothstep(0, SEABED, h));
    } else {
      // на суше: песок -> трава -> тёмная трава на холмах
      c.copy(sand)
        .lerp(grass, smoothstep(0.3, 0.55, h))
        .lerp(darkGrass, smoothstep(1.0, 2.6, h));

      // крутые склоны (скала маяка) становятся каменистыми
      const slope = Math.hypot(
        groundHeight(x + e, z) - groundHeight(x - e, z),
        groundHeight(x, z + e) - groundHeight(x, z - e)
      ) / (2 * e);
      c.lerp(rock, smoothstep(0.4, 0.75, slope) * smoothstep(0.8, 1.6, h) * 0.85);
    }

    // полоска пены у кромки воды
    const foamAmount = 1 - Math.min(1, Math.abs(h + 0.05) / 0.3);
    if (foamAmount > 0) c.lerp(foam, foamAmount * 0.85);

    // лёгкая «пятнистость», чтобы грани low-poly были заметнее
    c.multiplyScalar(0.96 + 0.04 * Math.sin(x * 2.1) * Math.cos(z * 1.7));

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });
  const island = new THREE.Mesh(geo, mat);
  island.castShadow = true;
  island.receiveShadow = true;
  return island;
}

// ===== Море: плоскость, вершины которой качаются волнами =====
function createSea() {
  const group = new THREE.Group();

  const waterGeo = new THREE.PlaneGeometry(360, 360, 100, 100);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: COLORS.sea,
    flatShading: true,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = SEA_LEVEL;
  group.add(water);

  // Большое дно того же цвета, чтобы вдали не было видно краёв острова
  const floorGeo = new THREE.PlaneGeometry(720, 720);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    floorGeo,
    new THREE.MeshStandardMaterial({ color: COLORS.sea, roughness: 1 })
  );
  floor.position.y = SEABED - 0.05;
  group.add(floor);

  // Запоминаем исходные x и z вершин воды
  const wPos = waterGeo.attributes.position;
  const baseXZ = new Float32Array(wPos.count * 2);
  for (let i = 0; i < wPos.count; i++) {
    baseXZ[i * 2] = wPos.getX(i);
    baseXZ[i * 2 + 1] = wPos.getZ(i);
  }

  function update(t) {
    for (let i = 0; i < wPos.count; i++) {
      wPos.setY(i, waveHeight(baseXZ[i * 2], baseXZ[i * 2 + 1], t));
    }
    wPos.needsUpdate = true;
  }

  return { group, update };
}

// ===== Свет: солнце, луна и мягкий свет неба =====
// Цвета и яркость света меняются в applyTimeOfDay(), здесь только создаём лампы
function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xFFD2A1, 1.6);
  sun.position.set(-50, 26, 20); // низко над горизонтом
  sun.castShadow = true;

  const smallScreen = window.matchMedia('(pointer: coarse)').matches;
  const mapSize = smallScreen ? 1024 : 2048;
  sun.shadow.mapSize.set(mapSize, mapSize);

  const cam = sun.shadow.camera;
  cam.left = -SHADOW_R;
  cam.right = SHADOW_R;
  cam.top = SHADOW_R;
  cam.bottom = -SHADOW_R;
  cam.near = 1;
  cam.far = 150;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  scene.add(sun.target); // цель света двигается вслед за героиней

  // Луна: синеватый свет без теней (так дешевле для телефона)
  const moon = new THREE.DirectionalLight(0xA9BBFF, 0);
  moon.position.set(-20, 50, -10);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xBFD9F2, 0xF3DDB0, 0.7);
  scene.add(hemi);

  return { sun, moon, hemi };
}

// ===== Светящиеся окна =====
// Ищем в доме окна: сначала по имени, а если имён нет — по виду
// (маленькая плоская деталь на стене на высоте окна).
// Вызывать сразу после createHouse(), пока дом стоит в нуле и не повёрнут.
function findWindowMeshes(house) {
  house.updateMatrixWorld(true);
  const total = new THREE.Box3().setFromObject(house);
  const houseHeight = total.max.y - total.min.y;
  const found = [];

  house.traverse((o) => {
    if (!o.isMesh) return;
    const name = `${o.name || ''} ${o.material && o.material.name ? o.material.name : ''}`.toLowerCase();
    if (/window|окн|glass|стекл/.test(name)) found.push(o);
  });
  if (found.length > 0) return found;

  // Дом «запечён» (bakeStatic): имён уже нет, но все стёкла склеены в одну деталь одного цвета
  house.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === GLASS_COLOR) found.push(o);
  });
  if (found.length > 0) return found;

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  house.traverse((o) => {
    if (!o.isMesh) return;
    box.setFromObject(o);
    box.getSize(size);
    box.getCenter(center);
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const isFlat = dims[0] < 0.15;
    const windowSized = dims[1] > 0.25 && dims[1] < 1.1 && dims[2] < 1.1;
    const height = center.y - total.min.y;
    if (isFlat && windowSized && height > 0.6 && height < houseHeight * 0.7) found.push(o);
  });
  return found;
}

// Делает материал окон «светящимся». Копии материалов нужны, чтобы не засветить стены.
function makeWindowGlow(meshes) {
  const cache = new Map();
  const items = [];
  const warm = new THREE.Color(WINDOW_GLOW);

  for (const mesh of meshes) {
    let mat = cache.get(mesh.material);
    if (!mat) {
      mat = mesh.material.clone();
      cache.set(mesh.material, mat);
      const hasEmissive = !!mat.emissive;
      if (hasEmissive) mat.emissive.copy(warm);
      items.push({ mat, base: mat.color.clone(), hasEmissive });
    }
    mesh.material = mat;
  }

  return {
    count: meshes.length,
    setLevel(level) {
      for (const item of items) {
        if (item.hasEmissive) {
          item.mat.emissiveIntensity = level * 1.2;
        } else {
          item.mat.color.copy(item.base).lerp(warm, level);
        }
      }
    },
  };
}

// ===== Свечение фонарей: ореол у лампы и светлое пятно на земле =====
function createLampGlow(placements, lampTop) {
  const group = new THREE.Group();
  const halos = [];
  const pools = [];

  const haloMat = new THREE.SpriteMaterial({
    map: makeGlowTexture('soft'),
    color: LAMP_GLOW,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: makeGlowTexture('soft'),
    color: LAMP_GLOW,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const poolGeo = new THREE.PlaneGeometry(4.4, 4.4);
  poolGeo.rotateX(-Math.PI / 2);

  for (const p of placements) {
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(1.8, 1.8, 1);
    halo.position.set(p.x, p.y + lampTop - LAMP_GLOW_DROP, p.z);
    group.add(halo);
    halos.push(halo);

    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(p.x, p.y + 0.09, p.z);
    group.add(pool);
    pools.push(pool);
  }

  group.visible = false;

  return {
    group,
    setLevel(level, time) {
      group.visible = level > 0.01;
      const flicker = 0.93 + 0.07 * Math.sin(time * 5.3);
      haloMat.opacity = level * flicker;
      poolMat.opacity = level * 0.5;
    },
  };
}

// ===== Светлячки: маленькие огоньки, которые летают над травой =====
function createFireflies(rand) {
  const spots = [
    // центр x, центр z, радиус, сколько штук, минимальный радиус от центра
    { x: zoneById('pines').x, z: zoneById('pines').z, r: 9, count: 22, minR: 0 },
    { x: zoneById('meadow').x, z: zoneById('meadow').z, r: 8, count: 16, minR: 0 },
    { x: 0, z: 0, r: 34, count: 30, minR: 7 },
  ];

  const base = [];
  for (const s of spots) {
    let placed = 0;
    for (let i = 0; i < 300 && placed < s.count; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = s.minR + Math.sqrt(rand()) * (s.r - s.minR);
      const x = s.x + Math.cos(ang) * rad;
      const z = s.z + Math.sin(ang) * rad;
      const g = groundHeight(x, z);
      if (g < 0.5) continue;
      base.push({ x, y: g + 0.5 + rand() * 1.3, z, phase: rand() * Math.PI * 2 });
      placed++;
    }
  }

  const count = base.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.45,
    map: makeGlowTexture('soft'),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  // level — насколько сейчас ночь (0..1), time — секунды
  function update(level, time) {
    points.visible = level > 0.01;
    if (!points.visible) return;
    for (let i = 0; i < count; i++) {
      const b = base[i];
      const ph = b.phase;
      positions[i * 3] = b.x + Math.sin(time * 0.6 + ph) * 1.2;
      positions[i * 3 + 1] = b.y + Math.sin(time * 0.9 + ph * 1.7) * 0.35;
      positions[i * 3 + 2] = b.z + Math.cos(time * 0.5 + ph * 1.3) * 1.2;

      // мигание: огонёк то разгорается, то гаснет
      let blink = 0.5 + 0.5 * Math.sin(time * 1.7 + ph * 3);
      blink = blink * blink * level;
      colors[i * 3] = 1.0 * blink;
      colors[i * 3 + 1] = 0.92 * blink;
      colors[i * 3 + 2] = 0.45 * blink;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { points, update };
}

// ===== Дорожка из плиток: добавляет плитки на отрезке от A до B =====
function addPath(tiles, ax, az, bx, bz, columns) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.5) return;
  const dx = (bx - ax) / len;
  const dz = (bz - az) / len;
  const rot = Math.atan2(dx, dz);
  const rows = Math.max(1, Math.floor(len / 0.9));
  for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) * (len / rows);
    for (let c = 0; c < columns; c++) {
      const off = (c - (columns - 1) / 2) * 0.9;
      tiles.push({
        x: ax + dx * t - dz * off,
        z: az + dz * t + dx * off,
        rot,
        shade: (i + c) % 2,
      });
    }
  }
}

// ===== Помощники для городка =====

// Попала ли точка (x, z) внутрь препятствия. pad — запас вокруг него.
function insideCollider(c, x, z, pad) {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
  const dx = x - c.x;
  const dz = z - c.z;
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
}

// Невидимая граница: маленькие круги по воде вдоль всего берега (бухту и канал гавани тоже).
// Героиня упирается в них, как в стену, и скользит вдоль берега. Место, где начинается пирс, оставляем свободным.
function addWaterWall(colliders) {
  const STEP = 1;
  const LIMIT = 62;
  const WALL_R = 0.9;
  const isLand = (x, z) => groundHeight(x, z) >= WALK_MIN;
  const onPierGap = (x, z) =>
    Math.abs(x - PIER.x) <= PIER.halfW + 0.05 && z >= PIER.z0 - 1.5 && z <= PIER.z0 + PIER.length + 1;

  let count = 0;
  for (let x = -LIMIT; x <= LIMIT; x += STEP) {
    for (let z = -LIMIT; z <= LIMIT; z += STEP) {
      if (isLand(x, z) || onPierGap(x, z)) continue;
      let touchesLand = false;
      for (let dx = -1; dx <= 1 && !touchesLand; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if ((dx || dz) && isLand(x + dx * STEP, z + dz * STEP)) { touchesLand = true; break; }
        }
      }
      if (touchesLand) {
        colliders.push({ kind: 'circle', x, z, r: WALL_R });
        count++;
      }
    }
  }
  return count;
}

// ===== Городок: площадь, дома, дорожки, пирс, роща и цветочный луг =====
function createTown(scene) {
  const town = new THREE.Group();
  scene.add(town);

  const colliders = [];          // круги и прямоугольники, через которые нельзя пройти
  const tiles = [];              // плитки дорожек
  const flowerSpots = [];        // места цветочных кустов
  const windowMeshes = [];       // окна домов (светятся ночью)
  const rand = makeRandom(20260);

  // У каждой зоны своя группа. Так далёкую зону можно целиком выключить, пока героиня к ней не подошла.
  const zoneGroups = new Map();
  for (const zone of ZONES) {
    const group = new THREE.Group();
    group.name = 'зона-' + zone.id;
    town.add(group);
    zoneGroups.set(zone.id, group);
  }

  // --- Площадь: три круглых плиты друг на друге ---
  const discs = [
    [PLAZA_R, COLORS.plazaOuter, 0.04],
    [3.5, COLORS.plazaMiddle, 0.045],
    [2.5, COLORS.plazaOuter, 0.05],
  ];
  for (const [r, color, top] of discs) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.08, 24),
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })
    );
    mesh.position.set(0, PLATEAU + top - 0.04, 0);
    mesh.receiveShadow = true;
    town.add(mesh);
  }

  // --- Фонтан в центре ---
  const fountain = createFountain();
  fountain.position.set(0, PLATEAU + 0.03, 0);
  town.add(fountain);
  colliders.push({ kind: 'circle', x: 0, z: 0, r: 1.95 });

  // --- Помощники: ближайшая зона и расстановка копий по зонам ---
  const zoneFor = (x, z) => {
    let best = zoneGroups.get('plaza');
    let bestD = Infinity;
    for (const zone of ZONES) {
      const d = Math.hypot(x - zone.x, z - zone.z) - zone.r;
      if (d < bestD) { bestD = d; best = zoneGroups.get(zone.id); }
    }
    return best;
  };
  // Ставит модель копиями (InstancedMesh). Копии делятся по зонам, чтобы дальнюю зону можно было выключить целиком.
  // lift — на сколько опустить модель в землю (отрицательное число = утопить), shadow: false — без тени (для мелочи)
  const addInstances = (model, list, { lift = -0.02, shadow = true } = {}) => {
    if (!list.length) return;
    const byGroup = new Map();
    for (const item of list) {
      const group = zoneFor(item.x, item.z);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push({
        x: item.x, y: groundHeight(item.x, item.z) + lift + (item.lift || 0), z: item.z,
        rotY: item.rotY, scale: item.scale, scaleY: item.scaleY,
      });
    }
    for (const [group, placements] of byGroup) {
      const inst = instanceModel(model, placements);
      if (!shadow) inst.traverse((o) => { o.castShadow = false; });
      group.add(inst);
    }
  };

  // --- Дома по кругу, двери смотрят на площадь ---
  // Каждый вариант дома собираем один раз, а потом ставим копиями: так на телефоне в разы меньше вызовов отрисовки
  const houseModels = [];
  const housePlacements = [[], [], []];
  const houseModel = (variant) => {
    const v = ((variant % 3) + 3) % 3;
    if (!houseModels[v]) {
      houseModels[v] = createHouse(v);
      windowMeshes.push(...findWindowMeshes(houseModels[v])); // пока дом не повёрнут
    }
    return houseModels[v];
  };
  for (const h of HOUSES) {
    const a = THREE.MathUtils.degToRad(h.angle);
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const hx = ux * h.radius;
    const hz = uz * h.radius;
    const rot = Math.atan2(-ux, -uz); // повернуть дверью к центру

    const house = houseModel(h.variant);
    housePlacements[h.variant % 3].push({ x: hx, y: groundHeight(hx, hz) - 0.05, z: hz, rotY: rot });

    const { w, d } = house.userData.footprint;
    colliders.push({ kind: 'rect', x: hx, z: hz, hw: w / 2 + 0.05, hd: d / 2 + 0.05, rot });

    // Дорожка от крыльца до площади
    const reach = house.userData.frontDistance + 0.15;
    addPath(tiles, hx - ux * reach, hz - uz * reach, ux * (PLAZA_R + 0.1), uz * (PLAZA_R + 0.1), 2);

    // Два цветника по бокам дома, ближе к крыльцу
    for (const side of [-1, 1]) {
      const lx = side * (w / 2 + 0.8);
      const lz = d / 2 - 0.2;
      flowerSpots.push({
        x: hx + lx * Math.cos(rot) + lz * Math.sin(rot),
        z: hz - lx * Math.sin(rot) + lz * Math.cos(rot),
        rotY: rand() * Math.PI * 2,
        scale: 1.1,
      });
    }
  }

  // --- Расстановка по зонам: числа считает zones.js (layoutZones), здесь только ставим модели ---
  const layout = layoutZones({
    groundHeight,
    rand,
    pier: PIER,
    // сюда ничего не ставим: площадь и дорога к пирсу
    blocked: (x, z) => Math.hypot(x, z) < PLAZA_R + 1.9 || (Math.abs(x) < 3 && z > 3 && z < PIER.z0 + 12),
    reserved: HOUSES.map((h) => {
      const a = THREE.MathUtils.degToRad(h.angle);
      return { x: Math.cos(a) * h.radius, z: Math.sin(a) * h.radius, r: 3.6 };
    }),
  });
  colliders.push(...layout.colliders);

  // Дома жилого квартала: те же три модели
  for (const h of layout.houses) {
    houseModel(h.variant);
    housePlacements[h.variant % 3].push({ x: h.x, y: groundHeight(h.x, h.z) - 0.05, z: h.z, rotY: h.rotY });
  }

  // Домик рыбака и маяк: по одному, у них тоже есть окна
  const hut = layout.hut ? createFisherHut() : null;
  if (hut) windowMeshes.push(...findWindowMeshes(hut));
  const lighthouse = createLighthouse();
  windowMeshes.push(...findWindowMeshes(lighthouse));

  // Окна готовы: делаем им «светящийся» материал. Это нужно сделать ДО того, как дома встанут копиями.
  const windowGlow = makeWindowGlow(windowMeshes);
  if (windowGlow.count > 0) {
    console.log(`[Тихий Берег] окон найдено: ${windowGlow.count} (они будут светиться ночью)`);
  } else {
    console.warn('[Тихий Берег] окна в домах не найдены — ночью они не засветятся. Пришли models.js, подгоню.');
  }
  houseModels.forEach((model, v) => {
    if (model && housePlacements[v].length) town.add(instanceModel(model, housePlacements[v]));
  });

  if (hut) {
    hut.position.set(layout.hut.x, groundHeight(layout.hut.x, layout.hut.z) - 0.02, layout.hut.z);
    hut.rotation.y = layout.hut.rotY;
    zoneGroups.get('harbor').add(hut);
  }
  lighthouse.position.set(layout.lighthouse.x, groundHeight(layout.lighthouse.x, layout.lighthouse.z) - 0.1, layout.lighthouse.z);
  lighthouse.rotation.y = layout.lighthouse.rotY;
  zoneGroups.get('lighthouse').add(lighthouse);

  // --- Дорога от площади к пирсу ---
  addPath(tiles, 0, PLAZA_R + 0.1, 0, PIER.z0 - 0.2, 3);

  // --- Скамейки и фонари (по одной модели, много мест) ---
  const toCenter = (angleDeg) => {
    const a = THREE.MathUtils.degToRad(angleDeg);
    return { cos: Math.cos(a), sin: Math.sin(a), rot: Math.atan2(-Math.cos(a), -Math.sin(a)) };
  };

  const benchPlacements = [];
  const addBench = (x, z, rotY) => {
    benchPlacements.push({ x, y: groundHeight(x, z), z, rotY });
    colliders.push({ kind: 'rect', x, z, hw: 0.85, hd: 0.35, rot: rotY });
  };
  // Четыре скамейки на площади между дорожками, лицом к фонтану
  for (const ang of [17.5, 115, 222, 330]) {
    const t = toCenter(ang);
    addBench(t.cos * 3.2, t.sin * 3.2, t.rot);
  }
  // Две скамейки у дороги к пирсу, лицом к дороге
  addBench(-2.4, 13, Math.PI / 2);
  addBench(2.4, 13, -Math.PI / 2);
  town.add(instanceModel(createBench(), benchPlacements));

  const lampPlacements = [];
  const addLamp = (x, z) => {
    lampPlacements.push({ x, y: groundHeight(x, z) - 0.02, z });
    colliders.push({ kind: 'circle', x, z, r: 0.22 });
  };
  // Фонари вокруг площади между дорожками и два у дороги
  for (const ang of [17.5, 65, 115, 167, 222, 277, 330]) {
    const t = toCenter(ang);
    addLamp(t.cos * 4.9, t.sin * 4.9);
  }
  addLamp(-1.9, 10.5);
  addLamp(1.9, 15.5);
  for (const l of layout.lamps) addLamp(l.x, l.z);   // фонари на торговой улице и в квартале
  town.add(instanceModel(createLamp(), lampPlacements));

  // Свечение фонарей: высоту фонаря узнаём по размеру его модели
  const lampTop = new THREE.Box3().setFromObject(createLamp()).max.y;
  const lampGlow = createLampGlow(lampPlacements, lampTop);
  town.add(lampGlow.group);

  // --- Пирс и лодка ---
  const dock = createDock({ length: PIER.length });
  dock.position.set(PIER.x, PIER.deckTop - dock.userData.deckTop, PIER.z0);
  town.add(dock);

  // Лодки: одна у пирса и три у берега бухты (копии одной модели). Качаются на волнах в update().
  const boatModel = createBoat();
  const boats = [];
  const addBoat = (x, z, rotY, group, model) => {
    model.position.set(x, 0, z);
    model.rotation.y = rotY;
    group.add(model);
    boats.push(model);
  };
  addBoat(PIER.x - 2.7, PIER.z0 + 6.5, 0.07, town, boatModel);
  for (const b of layout.boats) addBoat(b.x, b.z, b.rotY, zoneGroups.get('harbor'), boatModel.clone());

  // Невидимые перила: с пирса нельзя шагнуть в воду ни вбок, ни с конца
  const railX = PIER.halfW + 0.2;
  const railMid = PIER.z0 + PIER.length / 2;
  for (const side of [-1, 1]) {
    colliders.push({ kind: 'rect', x: PIER.x + side * railX, z: railMid, hw: 0.2, hd: PIER.length / 2 + 0.2, rot: 0 });
  }
  colliders.push({ kind: 'rect', x: PIER.x, z: PIER.z0 + PIER.length + 0.25, hw: PIER.halfW + 0.4, hd: 0.25, rot: 0 });

  // --- Деревья: каждый тип одной моделью-копиями, по зонам ---
  for (const type of ['pine', 'round', 'blossom']) {
    addInstances(createTree({ type }), layout.trees.filter((t) => t.type === type), { lift: -0.05 });
  }

  // --- Цветы: цветники у домов и цветочный луг ---
  const flowerModel = createFlowers();
  const toFlowerPlacement = (f) => ({ x: f.x, z: f.z, rotY: f.rotY, scale: f.scale });
  addInstances(flowerModel, flowerSpots.map(toFlowerPlacement), { shadow: false });
  addInstances(flowerModel, layout.flowers, { shadow: false });

  // --- Торговая улица, гавань, квартал, пляж, роща, маяк: остальные модели ---
  addInstances(createStall(), layout.stalls);
  addInstances(createCrate(), layout.crates, { shadow: false });
  addInstances(createBarrel(), layout.barrels, { shadow: false });
  addInstances(createNetRack(), layout.nets, { shadow: false });
  addInstances(createFence(), layout.fences, { shadow: false });
  addInstances(createMailbox(), layout.mailboxes, { shadow: false });
  addInstances(createMushrooms(), layout.mushrooms, { shadow: false });
  addInstances(createRock(), layout.rocks, { shadow: false });
  addInstances(createLounger(), layout.loungers, { shadow: false });
  addInstances(createUmbrella(), layout.umbrellas);
  addInstances(createBench(), layout.benches, { lift: -0.02, shadow: false });
  addInstances(createStep(), layout.steps, { lift: -0.4, shadow: false });   // ступени наполовину в склоне
  if (layout.swing) addInstances(createSwingTree(), [layout.swing], { lift: -0.05 });

  // --- Пчёлы над цветочным лугом: маленькие жёлтые точки, днём ---
  const bees = (() => {
    const flowers = layout.flowers;
    const count = Math.min(18, flowers.length);
    const base = [];
    for (let i = 0; i < count; i++) {
      const f = flowers[Math.floor((i / count) * flowers.length)];
      base.push({
        x: f.x, z: f.z, y: groundHeight(f.x, f.z) + 0.75 + rand() * 0.6,
        radius: 0.7 + rand() * 1.1, speed: 0.8 + rand() * 0.9, phase: rand() * Math.PI * 2,
      });
    }
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xF2C14E, size: 0.2, map: makeGlowTexture('soft'), transparent: true, depthWrite: false,
    }));
    points.frustumCulled = false;
    zoneGroups.get('meadow').add(points);
    function update(t) {
      for (let i = 0; i < count; i++) {
        const b = base[i];
        const a = t * b.speed + b.phase;
        positions[i * 3] = b.x + Math.cos(a) * b.radius;
        positions[i * 3 + 1] = b.y + Math.sin(a * 2.3) * 0.18;
        positions[i * 3 + 2] = b.z + Math.sin(a * 1.3) * b.radius;
      }
      geo.attributes.position.needsUpdate = true;
    }
    return { points, update };
  })();

  // --- Дорожки от площади к каждой зоне ---
  // Плитки не кладём в воду, под скамейки, деревья и дома и поверх уже лежащих плиток
  const slopeAt = (x, z) => Math.hypot(
    groundHeight(x + 0.5, z) - groundHeight(x - 0.5, z),
    groundHeight(x, z + 0.5) - groundHeight(x, z - 0.5));
  const segments = PATHS.map((path) => ({ id: path.id, columns: path.columns, lines: path.points.slice(0, -1).map((pt, i) => [pt, path.points[i + 1]]) }));
  // дорожки от крылец квартала к улице (две плитки в ширину)
  segments.push({ id: 'doors', columns: 2, lines: layout.doorPaths.map((d) => [[d.ax, d.az], [d.bx, d.bz]]) });
  for (const path of segments) {
    for (const [[ax, az], [bx, bz]] of path.lines) {
      const segment = [];
      addPath(segment, ax, az, bx, bz, path.columns);
      for (const t of segment) {
        if (groundHeight(t.x, t.z) < 0.3) continue;
        if (path.id === 'to-lighthouse' && slopeAt(t.x, t.z) >= 0.22) continue; // на крутом месте лежат ступени
        if (colliders.some((c) => insideCollider(c, t.x, t.z, 0.45))) continue;
        if (tiles.some((o) => Math.hypot(o.x - t.x, o.z - t.z) < 0.6)) continue;
        tiles.push(t);
      }
    }
  }

  // --- Плитки одним InstancedMesh. Каждая плитка ложится по наклону земли ---
  const validTiles = tiles.filter((t) => Math.hypot(t.x, t.z) > PLAZA_R - 0.2 && groundHeight(t.x, t.z) > 0.3);
  const tileMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.8, 0.06, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true, roughness: 1 }),
    validTiles.length
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const normal = new THREE.Vector3();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const colorA = new THREE.Color(COLORS.tileA);
  const colorB = new THREE.Color(COLORS.tileB);
  const e = 0.4;
  validTiles.forEach((t, i) => {
    normal.set(
      groundHeight(t.x - e, t.z) - groundHeight(t.x + e, t.z),
      2 * e,
      groundHeight(t.x, t.z - e) - groundHeight(t.x, t.z + e)
    ).normalize();
    qTilt.setFromUnitVectors(up, normal);
    qYaw.setFromAxisAngle(up, t.rot);
    q.copy(qTilt).multiply(qYaw);
    p.set(t.x, groundHeight(t.x, t.z) + 0.03, t.z);
    m.compose(p, q, one);
    tileMesh.setMatrixAt(i, m);
    tileMesh.setColorAt(i, t.shade ? colorA : colorB);
  });
  tileMesh.instanceMatrix.needsUpdate = true;
  if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
  tileMesh.receiveShadow = true;
  tileMesh.frustumCulled = false;
  town.add(tileMesh);

  // --- Невидимая граница вдоль воды (последней, чтобы плитки её не учитывали) ---
  const wallCount = addWaterWall(colliders);
  console.log(`[Тихий Берег] остров: зон ${ZONES.length}, домов ${HOUSES.length + layout.houses.length}, лавок ${layout.stalls.length}, деревьев ${layout.trees.length}, плиток ${validTiles.length}, препятствий ${colliders.length} (из них границы ${wallCount})`);

  // --- Анимация: фонтан и лодка ---
  function update(t) {
    const jet = fountain.userData.jet;
    jet.scale.y = 1 + 0.18 * Math.sin(t * 3.2);
    jet.scale.x = jet.scale.z = 1 + 0.08 * Math.sin(t * 4.1 + 1);

    // Лодки качаются вместе с волнами
    for (const boat of boats) {
      const bx = boat.position.x;
      const bz = boat.position.z;
      const slopeZ = (waveHeight(bx, bz + 0.8, t) - waveHeight(bx, bz - 0.8, t)) / 1.6;
      const slopeX = (waveHeight(bx + 0.6, bz, t) - waveHeight(bx - 0.6, bz, t)) / 1.2;
      boat.position.y = waveHeight(bx, bz, t) - 0.14;
      boat.rotation.x = -Math.atan(slopeZ) * 0.8;
      boat.rotation.z = Math.atan(slopeX) * 0.8;
    }
    if (bees.points.visible) bees.update(t);
  }

  // --- Ночное свечение: level от 0 (день) до 1 (ночь) ---
  function setNight(level, t) {
    windowGlow.setLevel(level);
    lampGlow.setLevel(level, t);
    bees.points.visible = level < 0.3;   // пчёлы летают только днём
  }

  // --- Дальние зоны не рисуем: смотрим на расстояние от героини до края зоны ---
  function cull(focus) {
    for (const zone of ZONES) {
      const dist = Math.hypot(focus.x - zone.x, focus.z - zone.z) - zone.r;
      zoneGroups.get(zone.id).visible = dist < CULL_DISTANCE;
    }
  }

  return { update, setNight, cull, colliders, zoneGroups };
}

// ===== Собираем весь мир =====
export function createWorld(scene) {
  scene.background = new THREE.Color(COLORS.skyHorizon);
  // Туман того же цвета, что горизонт. Над островом он редкий, а за берегом чуть гуще
  // (густоту меняет applyTimeOfDay), поэтому край моря не виден.
  scene.fog = new THREE.FogExp2(COLORS.skyHorizon, FOG_BASE);

  const sky = createSky();
  scene.add(sky.group);
  scene.add(createIsland());

  const sea = createSea();
  scene.add(sea.group);

  const lights = createLights(scene);

  const town = createTown(scene);

  const fireflies = createFireflies(makeRandom(777));
  scene.add(fireflies.points);

  const sunDir = new THREE.Vector3();
  const lightRight = new THREE.Vector3();
  const lightUp = new THREE.Vector3();
  const shadowCenter = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const info = { dayTime: 0, night: 0, glow: 0, sunHeight: 0 };
  const ORIGIN = { x: 0, z: 0 };

  // Тени следуют за героиней. Центр сдвигаем «шагами» в одну клетку карты теней,
  // иначе края теней дрожали бы при ходьбе.
  function placeSun(offset, focus) {
    const texel = (2 * SHADOW_R) / lights.sun.shadow.mapSize.x;
    lightRight.crossVectors(worldUp, offset).normalize();
    lightUp.crossVectors(offset, lightRight).normalize();
    shadowCenter.set(focus.x, 0, focus.z);
    const a = shadowCenter.dot(lightRight);
    const b = shadowCenter.dot(lightUp);
    shadowCenter
      .addScaledVector(lightRight, Math.round(a / texel) * texel - a)
      .addScaledVector(lightUp, Math.round(b / texel) * texel - b);
    lights.sun.target.position.copy(shadowCenter);
    lights.sun.position.copy(shadowCenter).add(offset);
  }

  // Один раз за кадр: узнаём время суток и подстраиваем всё под него
  function applyTimeOfDay(time, focus) {
    const dayTime = currentDayTime();
    sampleDay(dayTime);

    // Солнце идёт по дуге: восход на востоке (+x), закат на западе (-x)
    const angle = (dayTime - 0.25) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Свет солнца (тени есть только днём; ночью яркость солнца падает до нуля)
    const elevation = 0.18 + 0.82 * Math.pow(Math.max(0, sinA), 0.8);
    sunDir.set(cosA, elevation, 0.33).normalize().multiplyScalar(65);
    placeSun(sunDir, focus);
    lights.sun.color.copy(cur.sun);
    lights.sun.intensity = cur.sunI;

    // Свет луны — с противоположной стороны неба
    sunDir.set(-cosA, Math.max(0.4, -sinA), -0.2).normalize().multiplyScalar(60);
    lights.moon.position.copy(sunDir);
    lights.moon.intensity = cur.moonI;

    // Мягкий свет неба
    lights.hemi.color.copy(cur.hemiSky);
    lights.hemi.groundColor.copy(cur.hemiGround);
    lights.hemi.intensity = cur.hemiI;

    // Туман и фон. Чем ближе героиня к берегу и дальше от центра, тем гуще туман.
    scene.fog.color.copy(cur.fog);
    scene.fog.density = FOG_BASE + (FOG_SEA - FOG_BASE) * smoothstep(30, 50, Math.hypot(focus.x, focus.z));
    scene.background.copy(cur.horizon);

    // Небо, звёзды, солнце, луна
    sky.update(cosA, sinA, time);

    // Окна, фонари и светлячки включаются, когда темнеет
    const glow = smoothstep(0.15, 0.8, cur.night);
    town.setNight(glow, time);
    fireflies.update(smoothstep(0.5, 0.9, cur.night), time);

    info.dayTime = dayTime;
    info.night = cur.night;
    info.glow = glow;
    info.sunHeight = sinA;
  }
  applyTimeOfDay(0, ORIGIN); // правильные цвета уже в первом кадре

  return {
    sky: sky.group,
    colliders: town.colliders,         // что нельзя проходить насквозь (в том числе берег)
    surfaceHeight,                     // высота земли с учётом пирса
    groundHeight,                      // высота голой земли (без пирса): по ней видно, где вода
    canFish: (x, z) => { const g = groundHeight(x, z); const onPier = Math.abs(x - PIER.x) <= PIER.halfW + 0.7 && z >= PIER.z0 + 0.8 && z <= PIER.z0 + PIER.length; return onPier || (g >= 0.02 && g <= 0.42); },
    waterHeight: (x, z, t) => waveHeight(x, z, t),
    start: { x: 0, z: 7.2 },           // где появляется героиня
    // focus — где сейчас героиня: вокруг неё следуют тени, по ней считается туман и отсечение дальних зон
    update: (time, focus = ORIGIN) => {
      sea.update(time);
      town.update(time);
      town.cull(focus);
      applyTimeOfDay(time, focus);
    },
    // Для проверки и для звука: сколько сейчас времени суток (0..1) и насколько ночь (0..1)
    getDayInfo: () => info,
    skipTime: (fraction) => { timeShift += fraction; },
  };
}
