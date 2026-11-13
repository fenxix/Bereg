// world.js — мир: небо, остров, море, свет и туман, а также городок
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

// ===== Небо: большая сфера с градиентом =====
function createSky() {
  const R = 400;
  const geo = new THREE.SphereGeometry(R, 32, 48);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const horizon = new THREE.Color(COLORS.skyHorizon);
  const top = new THREE.Color(COLORS.skyTop);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const k = smoothstep(0, 0.35, pos.getY(i) / R);
    c.copy(horizon).lerp(top, k);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
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

// ===== Свет: тёплое низкое солнце и мягкий свет неба =====
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

  scene.add(new THREE.HemisphereLight(0xBFD9F2, 0xF3DDB0, 0.7));
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

  return { update, colliders };
}

// ===== Собираем весь мир =====
export function createWorld(scene) {
  scene.background = new THREE.Color(COLORS.skyHorizon);
  // Туман того же цвета, что горизонт. Дальше 130 единиц всё тонет в дымке, краёв моря не видно.
  scene.fog = new THREE.Fog(COLORS.skyHorizon, 30, 130);

  const sky = createSky();
  scene.add(sky);
  scene.add(createIsland());

  const sea = createSea();
  scene.add(sea.group);

  createLights(scene);

  const town = createTown(scene);

  return {
    sky,
    colliders: town.colliders,         // что нельзя проходить насквозь
    surfaceHeight,                     // высота земли с учётом пирса
    start: { x: 0, z: 7.2 },           // где появляется героиня
    update: (time) => {
      sea.update(time);
      town.update(time);
    },
  };
}
