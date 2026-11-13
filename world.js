// world.js — мир: небо, остров, море, свет и туман
import * as THREE from 'three';

// ===== Настройки (удобно менять здесь) =====
const COLORS = {
  skyHorizon: 0xFFD9B8,
  skyTop: 0xBFD9F2,
  sea: 0x6EC1D6,
  foam: 0xF5FBFF,
  sand: 0xF3DDB0,
  grass: 0xA8D08D,
  darkGrass: 0x7FB069,
};

const SEA_LEVEL = 0;     // высота воды
const SEABED = -1.5;     // дно моря
const PLATEAU = 0.6;     // высота ровной земли острова

// Холмы: центр (x, z), ширина r, высота h
const HILLS = [
  { x: -8, z: -5, r: 8, h: 3.0 },
  { x: 9, z: 4, r: 6.5, h: 2.0 },
  { x: 3, z: -13, r: 5.5, h: 1.6 },
  { x: -10, z: 10, r: 5, h: 1.2 },
];

// ===== Помощники =====
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Радиус берега в зависимости от угла: делает остров неровным, не круглым
function shoreRadius(angle) {
  return 26 + 2.5 * Math.sin(3 * angle + 1) + 1.5 * Math.sin(5 * angle + 2);
}

// Высота земли в точке (x, z). Пригодится позже, чтобы героиня ходила по земле.
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
  return base + hills * smoothstep(8, 16, d); // холмы только вдали от берега
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
      const x = baseXZ[i * 2];
      const z = baseXZ[i * 2 + 1];
      const y =
        0.10 * Math.sin(x * 0.35 + t * 1.1) +
        0.08 * Math.sin(z * 0.28 + t * 0.9) +
        0.05 * Math.sin((x + z) * 0.5 + t * 1.6);
      wPos.setY(i, y);
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

  return {
    sky,
    update: (time) => sea.update(time),
  };
}
