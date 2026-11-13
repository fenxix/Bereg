// world.js — мир: небо, остров, море, свет и туман, городок, а также смена времени суток
import * as THREE from 'three';
import {
  createHouse, createTree, createLamp, createBoat, createDock,
  createBench, createFlowers, createFountain, instanceModel,
} from './models.js';

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
};

const SEA_LEVEL = 0;     // высота воды
const SEABED = -1.5;     // дно моря
const PLATEAU = 0.6;     // высота ровной земли острова

// Городок стоит в центре острова на ровной земле
const TOWN_FLAT_R = 13;   // до этого расстояния земля идеально ровная
const TOWN_BLEND_R = 18;  // дальше она плавно возвращается к холмам
const PLAZA_R = 4.4;      // радиус площади с фонтаном

// Холмы: центр (x, z), ширина r, высота h. Они на краю острова, вокруг городка.
const HILLS = [
  { x: -11, z: -9, r: 5, h: 2.6 },
  { x: 13, z: -9, r: 4.5, h: 2.0 },
  { x: -15, z: 5, r: 4, h: 1.5 },
  { x: 5, z: -17, r: 4.5, h: 1.8 },
];

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

// Радиус берега в зависимости от угла: делает остров неровным, не круглым
function shoreRadius(angle) {
  return 26 + 2.5 * Math.sin(3 * angle + 1) + 1.5 * Math.sin(5 * angle + 2);
}

// Высота земли в точке (x, z)
export function groundHeight(x, z) {
  const d = shoreRadius(Math.atan2(z, x)) - Math.hypot(x, z); // >0 — внутри острова
  const s = smoothstep(-4, 9, d);
  const base = SEABED + s * (PLATEAU - SEABED); // плавный пологий берег

  let hills = 0;
  for (const hill of HILLS) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    hills += hill.h * Math.exp(-(dx * dx + dz * dz) / (hill.r * hill.r));
  }
  const natural = base + hills * smoothstep(8, 16, d); // холмы только вдали от берега

  // В центре земля ровная, там стоит городок
  const flat = 1 - smoothstep(TOWN_FLAT_R, TOWN_BLEND_R, Math.hypot(x, z));
  return natural + (PLATEAU - natural) * flat;
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

// ===== Остров: земля с холмами и песчаным берегом =====
function createIsland() {
  const geo = new THREE.PlaneGeometry(100, 100, 64, 64);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(COLORS.sand);
  const grass = new THREE.Color(COLORS.grass);
  const darkGrass = new THREE.Color(COLORS.darkGrass);
  const sea = new THREE.Color(COLORS.sea);
  const foam = new THREE.Color(COLORS.foam);
  const c = new THREE.Color();

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
  cam.left = -45;
  cam.right = 45;
  cam.top = 45;
  cam.bottom = -45;
  cam.near = 1;
  cam.far = 150;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

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
    { x: -6, z: -17.5, r: 6, count: 22, minR: 0 },
    { x: 18, z: 3, r: 6, count: 16, minR: 0 },
    { x: 0, z: 0, r: 21, count: 22, minR: 7 },
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

// ===== Городок: площадь, дома, дорожки, пирс, роща и цветочный луг =====
function createTown(scene) {
  const town = new THREE.Group();
  scene.add(town);

  const colliders = [];          // круги и прямоугольники, через которые нельзя пройти
  const tiles = [];              // плитки дорожек
  const flowerSpots = [];        // места цветочных кустов
  const windowMeshes = [];       // окна домов (светятся ночью)
  const rand = makeRandom(20260);

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

  // --- Дома по кругу, двери смотрят на площадь ---
  for (const h of HOUSES) {
    const a = THREE.MathUtils.degToRad(h.angle);
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const hx = ux * h.radius;
    const hz = uz * h.radius;
    const rot = Math.atan2(-ux, -uz); // повернуть дверью к центру

    const house = createHouse(h.variant);
    windowMeshes.push(...findWindowMeshes(house)); // пока дом не повёрнут
    house.position.set(hx, groundHeight(hx, hz) - 0.05, hz);
    house.rotation.y = rot;
    town.add(house);

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

  // Окна готовы: делаем им «светящийся» материал
  const windowGlow = makeWindowGlow(windowMeshes);
  if (windowGlow.count > 0) {
    console.log(`[Тихий Берег] окон найдено: ${windowGlow.count} (они будут светиться ночью)`);
  } else {
    console.warn('[Тихий Берег] окна в домах не найдены — ночью они не засветятся. Пришли models.js, подгоню.');
  }

  // --- Дорога от площади к пирсу ---
  addPath(tiles, 0, PLAZA_R + 0.1, 0, PIER.z0 - 0.2, 3);

  // --- Плитки одним InstancedMesh ---
  const validTiles = tiles.filter((t) => Math.hypot(t.x, t.z) > PLAZA_R - 0.2 && groundHeight(t.x, t.z) > 0.3);
  const tileMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.8, 0.04, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true, roughness: 1 }),
    validTiles.length
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const colorA = new THREE.Color(COLORS.tileA);
  const colorB = new THREE.Color(COLORS.tileB);
  validTiles.forEach((t, i) => {
    e.set(0, t.rot, 0);
    q.setFromEuler(e);
    p.set(t.x, groundHeight(t.x, t.z) + 0.02, t.z);
    m.compose(p, q, one);
    tileMesh.setMatrixAt(i, m);
    tileMesh.setColorAt(i, t.shade ? colorA : colorB);
  });
  tileMesh.instanceMatrix.needsUpdate = true;
  if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
  tileMesh.receiveShadow = true;
  tileMesh.frustumCulled = false;
  town.add(tileMesh);

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
  town.add(instanceModel(createLamp(), lampPlacements));

  // Свечение фонарей: высоту фонаря узнаём по размеру его модели
  const lampTop = new THREE.Box3().setFromObject(createLamp()).max.y;
  const lampGlow = createLampGlow(lampPlacements, lampTop);
  town.add(lampGlow.group);

  // --- Пирс и лодка ---
  const dock = createDock({ length: PIER.length });
  dock.position.set(PIER.x, PIER.deckTop - dock.userData.deckTop, PIER.z0);
  town.add(dock);

  const boat = createBoat();
  boat.position.set(PIER.x - 2.7, 0, PIER.z0 + 6.5);
  boat.rotation.y = 0.07;
  town.add(boat);

  // --- Деревья: роща на севере и несколько деревьев по краям городка ---
  const treeLists = { round: [], pine: [], blossom: [] };
  const treeSpots = [];
  const tryTree = (x, z, type) => {
    if (groundHeight(x, z) < 0.5) return false;
    for (const t of treeSpots) {
      if (Math.hypot(t.x - x, t.z - z) < 2.3) return false;
    }
    const scale = 0.85 + rand() * 0.5;
    treeSpots.push({ x, z });
    treeLists[type].push({
      x, y: groundHeight(x, z) - 0.05, z,
      rotY: rand() * Math.PI * 2,
      scale,
      scaleY: scale * (0.9 + rand() * 0.3),
    });
    colliders.push({ kind: 'circle', x, z, r: 0.4 * scale });
    return true;
  };

  // Роща: север острова
  let placed = 0;
  for (let i = 0; i < 700 && placed < 26; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 6.5;
    const roll = rand();
    const type = roll < 0.5 ? 'round' : roll < 0.85 ? 'pine' : 'blossom';
    if (tryTree(-6 + Math.cos(ang) * rad, -17.5 + Math.sin(ang) * rad, type)) placed++;
  }

  // Отдельные деревья вокруг городка (не на дороге к пирсу и не на цветочном лугу)
  placed = 0;
  for (let i = 0; i < 500 && placed < 12; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 13.8 + rand() * 2.8;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (Math.abs(x) < 3.5 && z > 0) continue;
    if (Math.hypot(x - 18, z - 3) < 8) continue;
    if (tryTree(x, z, rand() < 0.6 ? 'blossom' : 'round')) placed++;
  }

  for (const type of ['round', 'pine', 'blossom']) {
    if (treeLists[type].length > 0) {
      town.add(instanceModel(createTree({ type }), treeLists[type]));
    }
  }

  // --- Цветочный луг на востоке и цветники у домов ---
  const meadow = [];
  for (let i = 0; i < 400 && meadow.length < 44; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * 5.5;
    const x = 18 + Math.cos(ang) * rad;
    const z = 3 + Math.sin(ang) * rad;
    if (groundHeight(x, z) < 0.5) continue;
    if (meadow.some((f) => Math.hypot(f.x - x, f.z - z) < 1.1)) continue;
    meadow.push({ x, z, rotY: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.5 });
  }
  const flowerPlacements = [...meadow, ...flowerSpots].map((f) => ({
    x: f.x, y: groundHeight(f.x, f.z) - 0.02, z: f.z, rotY: f.rotY, scale: f.scale,
  }));
  town.add(instanceModel(createFlowers(), flowerPlacements));

  // --- Анимация: фонтан и лодка ---
  function update(t) {
    const jet = fountain.userData.jet;
    jet.scale.y = 1 + 0.18 * Math.sin(t * 3.2);
    jet.scale.x = jet.scale.z = 1 + 0.08 * Math.sin(t * 4.1 + 1);

    // Лодка качается вместе с волнами
    const bx = boat.position.x;
    const bz = boat.position.z;
    const slopeZ = (waveHeight(bx, bz + 0.8, t) - waveHeight(bx, bz - 0.8, t)) / 1.6;
    const slopeX = (waveHeight(bx + 0.6, bz, t) - waveHeight(bx - 0.6, bz, t)) / 1.2;
    boat.position.y = waveHeight(bx, bz, t) - 0.14;
    boat.rotation.x = -Math.atan(slopeZ) * 0.8;
    boat.rotation.z = Math.atan(slopeX) * 0.8;
  }

  // --- Ночное свечение: level от 0 (день) до 1 (ночь) ---
  function setNight(level, t) {
    windowGlow.setLevel(level);
    lampGlow.setLevel(level, t);
  }

  return { update, setNight, colliders };
}

// ===== Собираем весь мир =====
export function createWorld(scene) {
  scene.background = new THREE.Color(COLORS.skyHorizon);
  // Туман того же цвета, что горизонт. Дальше 130 единиц всё тонет в дымке, краёв моря не видно.
  scene.fog = new THREE.FogExp2(COLORS.skyHorizon, 0.008);

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
  const info = { dayTime: 0, night: 0, glow: 0, sunHeight: 0 };

  // Один раз за кадр: узнаём время суток и подстраиваем всё под него
  function applyTimeOfDay(time) {
    const dayTime = currentDayTime();
    sampleDay(dayTime);

    // Солнце идёт по дуге: восход на востоке (+x), закат на западе (-x)
    const angle = (dayTime - 0.25) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Свет солнца (тени есть только днём; ночью яркость солнца падает до нуля)
    const elevation = 0.18 + 0.82 * Math.pow(Math.max(0, sinA), 0.8);
    sunDir.set(cosA, elevation, 0.33).normalize().multiplyScalar(65);
    lights.sun.position.copy(sunDir);
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

    // Туман и фон
    scene.fog.color.copy(cur.fog);
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
  applyTimeOfDay(0); // правильные цвета уже в первом кадре

  return {
    sky: sky.group,
    colliders: town.colliders,         // что нельзя проходить насквозь
    surfaceHeight,                     // высота земли с учётом пирса
    canFish: (x, z) => { const g = groundHeight(x, z); const onPier = Math.abs(x - PIER.x) <= PIER.halfW + 0.7 && z >= PIER.z0 + 0.8 && z <= PIER.z0 + PIER.length; return onPier || (g >= 0.02 && g <= 0.42); },
    waterHeight: (x, z, t) => waveHeight(x, z, t),
    start: { x: 0, z: 7.2 },           // где появляется героиня
    update: (time) => {
      sea.update(time);
      town.update(time);
      applyTimeOfDay(time);
    },
    // Для проверки и для звука: сколько сейчас времени суток (0..1) и насколько ночь (0..1)
    getDayInfo: () => info,
    skipTime: (fraction) => { timeShift += fraction; },
  };
}
