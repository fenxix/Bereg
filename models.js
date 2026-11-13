// models.js — генераторы моделей (героиня, дом, дерево, фонарь, лодка, пирс, скамейка, цветы, фонтан)
// и проверка checkModel
import * as THREE from 'three';

// ===== Палитра цветов =====
const P = {
  wallLight: 0xFFF4E3,
  wallWarm: 0xF7E1C3,
  roofCoral: 0xE8836B,
  roofBlue: 0x6B9AC4,
  roofLilac: 0xC98BB9,
  wood: 0xB98A62,
  woodLight: 0xCDA67E,
  darkWood: 0x8A6240,
  accent: 0xF4A6B8,
  stone: 0xDDD0B8,
  stoneDark: 0xBFB29B,
  brick: 0xC9A58B,
  leaf: 0x7FB069,
  leafLight: 0x95C47C,
  blossom: 0xF4B8C8,
  blossomLight: 0xF9CFD9,
  glass: 0xBFD9F2,
  gold: 0xE8C27A,
  water: 0x6EC1D6,
  foam: 0xF5FBFF,
  lantern: 0xFFE2A8,
  rope: 0xEBDDBF,
  yellow: 0xF7D774,
  lilac: 0xC9B1E0,
  orange: 0xF5B57A,
  white: 0xFFFFFF,
};

// ===== Материалы: один материал на цвет, создаём один раз =====
const materialCache = new Map();
function getMaterial(color, doubleSided = false) {
  const key = color + (doubleSided ? '-d' : '');
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.9,
      metalness: 0,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }
  return materialCache.get(key);
}

// Светящийся материал (окошко фонаря)
function getGlowMaterial(color) {
  const key = 'glow-' + color;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      flatShading: true,
      roughness: 0.6,
      metalness: 0,
    }));
  }
  return materialCache.get(key);
}

// ===== Маленькие помощники для сборки моделей =====

// Добавляет деталь с готовым материалом (с тенью и именем для проверки)
function addMeshWithMaterial(parent, geometry, material, name, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Добавляет деталь заданного цвета
function addPart(parent, geometry, color, name, x = 0, y = 0, z = 0, doubleSided = false) {
  return addMeshWithMaterial(parent, geometry, getMaterial(color, doubleSided), name, x, y, z);
}

// Коробка: ширина, высота, глубина
function addBox(parent, w, h, d, color, name, x = 0, y = 0, z = 0) {
  return addPart(parent, new THREE.BoxGeometry(w, h, d), color, name, x, y, z);
}

// Сустав: пустая группа в точке сустава, деталь висит на ней и вращается вокруг неё
function addJoint(parent, name, x, y, z) {
  const joint = new THREE.Group();
  joint.name = name;
  joint.position.set(x, y, z);
  parent.add(joint);
  return joint;
}

// Призма из контура вида сверху: points — список [x, z], низ на y = 0, вверх на height
function prismGeometry(points, height) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Призма из боковой стороны (например, треугольник фронтона): points — список [x, y], толщина depth по z
function profilePrism(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Склеивает несколько геометрий в одну (меньше деталей — быстрее рисуется)
function mergeGeos(geos) {
  let total = 0;
  const prepared = geos.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    total += flat.attributes.position.count;
    return flat;
  });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let offset = 0;
  for (const g of prepared) {
    pos.set(g.attributes.position.array, offset * 3);
    nor.set(g.attributes.normal.array, offset * 3);
    offset += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// Склеивает много коробок в одну деталь. boxes: [ширина, высота, глубина, x, y, z]
function mergeBoxes(boxes) {
  return mergeGeos(boxes.map(([w, h, d, x, y, z]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  }));
}

// ===== Запекание: для неподвижных моделей склеиваем все детали одного цвета в одну =====
// Вызывать ПОСЛЕ checkModel. Модель выглядит так же, но рисуется в разы быстрее.
export function bakeStatic(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const byMaterial = new Map();
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });

  for (const mesh of meshes) {
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(geo);
  }

  group.clear();
  let i = 0;
  for (const [material, geos] of byMaterial) {
    const merged = new THREE.Mesh(mergeGeos(geos), material);
    merged.name = 'static-' + i++;
    merged.castShadow = true;
    merged.receiveShadow = true;
    group.add(merged);
  }
  return group;
}

// ===== Копии через InstancedMesh: одна модель, много мест =====
// placements: список { x, y, z, rotY, scale, scaleY }. Модель должна быть «запечена» (bakeStatic).
export function instanceModel(model, placements) {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const result = new THREE.Group();
  const rel = new THREE.Matrix4();
  const place = new THREE.Matrix4();
  const full = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    rel.multiplyMatrices(inverse, mesh.matrixWorld);
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach((pl, i) => {
      euler.set(0, pl.rotY || 0, 0);
      quat.setFromEuler(euler);
      position.set(pl.x, pl.y, pl.z);
      const s = pl.scale === undefined ? 1 : pl.scale;
      scale.set(s, pl.scaleY === undefined ? s : pl.scaleY, s);
      place.compose(position, quat, scale);
      full.multiplyMatrices(place, rel);
      inst.setMatrixAt(i, full);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    result.add(inst);
  });
  return result;
}

// ===== Проверка модели =====
// 1) нижняя точка около 0; 2) каждая деталь касается соседней (допуск 0.05)
export function checkModel(group, name = 'модель') {
  const TOLERANCE = 0.05;
  group.updateMatrixWorld(true);

  const parts = [];
  group.traverse((obj) => { if (obj.isMesh) parts.push(obj); });
  const boxes = parts.map((p) => new THREE.Box3().setFromObject(p));
  let ok = true;

  const whole = new THREE.Box3().setFromObject(group);
  if (Math.abs(whole.min.y) > TOLERANCE) {
    console.warn(`[checkModel] ${name}: нижняя точка y = ${whole.min.y.toFixed(3)}, а должна быть около 0`);
    ok = false;
  }

  boxes.forEach((box, i) => {
    const grown = box.clone().expandByScalar(TOLERANCE);
    const touches = boxes.some((other, j) => j !== i && grown.intersectsBox(other));
    if (!touches) {
      console.warn(`[checkModel] ${name}: деталь "${parts[i].name}" ни с чем не соединена`);
      ok = false;
    }
  });

  if (ok) console.log(`[checkModel] ${name}: всё в порядке`);
  return ok;
}

// ===== Героиня (пропорции чиби: голова = треть роста) =====
export function createHeroine(options = {}) {
  const {
    height = 1.6,
    dressColor = 0xE8836B,
    hairColor = 0x8A6240,
    skinColor = 0xF7D9BF,
    hairStyle = 'braids', // 'braids' (косички) или 'ponytail' (хвост)
  } = options;

  // --- Размеры (всё остальное считается от них) ---
  const H = 1.6;
  const HEAD_R = H / 6;
  const HAIR_R = HEAD_R * 1.1;
  const HAIR_TILT = 0.5;              // шапка волос чуть откинута назад, лоб открыт
  const HAIR_CUT = Math.PI * 0.58;    // какую часть сферы волос оставляем
  const LEG_LEN = 0.45, LEG_R = 0.05, HIP_X = 0.09;
  const SHOE_R = 0.065, SHOE_SQUASH = 0.6;
  const ARM_LEN = 0.4, ARM_R = 0.04, HAND_R = 0.055, ARM_TILT = 0.35;
  const DRESS_R_TOP = 0.18, DRESS_R_BOTTOM = 0.3;
  const OVERLAP = 0.04;               // детали чуть заходят друг в друга

  // --- Позиции деталей ---
  const headY = H - HAIR_R;
  const dressTop = headY - HEAD_R + OVERLAP;
  const dressBottom = LEG_LEN - OVERLAP;
  const dressH = dressTop - dressBottom;
  const shoulderY = dressTop - 0.1;
  const shoulderX = DRESS_R_TOP + 0.01;

  const group = new THREE.Group();
  group.name = 'heroine';
  const rig = new THREE.Group(); // внутри неё всё, что можно слегка подпрыгивать при ходьбе
  group.add(rig);

  // Платье и голова
  addPart(rig, new THREE.CylinderGeometry(DRESS_R_TOP, DRESS_R_BOTTOM, dressH, 10), dressColor,
    'платье', 0, dressBottom + dressH / 2, 0);
  addPart(rig, new THREE.SphereGeometry(HEAD_R, 12, 10), skinColor, 'голова', 0, headY, 0);

  // Ноги на суставах-бёдрах, на ногах туфельки
  const legs = {};
  for (const side of [-1, 1]) {
    const hip = addJoint(rig, side > 0 ? 'бедро-правое' : 'бедро-левое', side * HIP_X, LEG_LEN, 0);
    addPart(hip, new THREE.CylinderGeometry(LEG_R, LEG_R, LEG_LEN, 8), skinColor, 'нога', 0, -LEG_LEN / 2, 0);
    const shoe = addPart(hip, new THREE.SphereGeometry(SHOE_R, 8, 6), 0x8A6240, 'туфелька',
      0, -LEG_LEN + SHOE_R * SHOE_SQUASH, 0.03);
    shoe.scale.set(1, SHOE_SQUASH, 1.5);
    legs[side > 0 ? 'right' : 'left'] = hip;
  }

  // Руки на суставах-плечах, слегка отведены в стороны
  const arms = {};
  for (const side of [-1, 1]) {
    const shoulder = addJoint(rig, side > 0 ? 'плечо-правое' : 'плечо-левое', side * shoulderX, shoulderY, 0);
    shoulder.rotation.z = side * ARM_TILT;
    addPart(shoulder, new THREE.CylinderGeometry(ARM_R, ARM_R, ARM_LEN, 8), skinColor, 'рука', 0, -ARM_LEN / 2, 0);
    addPart(shoulder, new THREE.SphereGeometry(HAND_R, 8, 6), skinColor, 'ладонь', 0, -ARM_LEN, 0);
    arms[side > 0 ? 'right' : 'left'] = shoulder;
  }

  // Волосы: шапка-сфера со срезом
  const cap = addPart(rig, new THREE.SphereGeometry(HAIR_R, 12, 10, 0, Math.PI * 2, 0, HAIR_CUT),
    hairColor, 'волосы', 0, headY, 0, true);
  cap.rotation.x = -HAIR_TILT;

  if (hairStyle === 'ponytail') {
    const tail = addJoint(rig, 'хвост-крепление', 0, headY, -HAIR_R * 0.75);
    tail.rotation.x = 0.4; // откидываем назад
    addPart(tail, new THREE.CylinderGeometry(0.06, 0.02, 0.35, 8), hairColor, 'хвост', 0, -0.17, 0);
  } else {
    const BRAID_LEN = 0.3, BRAID_R = 0.035;
    const braidTop = headY - 0.02;
    for (const side of [-1, 1]) {
      addPart(rig, new THREE.CylinderGeometry(BRAID_R, BRAID_R, BRAID_LEN, 8), hairColor, 'косичка',
        side * 0.2, braidTop - BRAID_LEN / 2, -0.12);
      addPart(rig, new THREE.SphereGeometry(0.045, 8, 6), 0xF4A6B8, 'бантик',
        side * 0.2, braidTop - BRAID_LEN, -0.12);
    }
  }

  // Лицо: глаза и румянец — маленькие плоские формы, прижатые к голове
  const onHead = (x, dy, geometry, color, name, squashZ, sink) => {
    const y = headY + dy;
    const z = Math.sqrt(HEAD_R ** 2 - x ** 2 - dy ** 2) - sink;
    const mesh = addPart(rig, geometry, color, name, x, y, z);
    mesh.scale.z = squashZ;
    mesh.rotation.y = Math.atan2(x, z); // поворот по поверхности головы
  };
  for (const side of [-1, 1]) {
    onHead(side * 0.09, -0.02, new THREE.SphereGeometry(0.03, 8, 6), 0x3A2A2A, 'глаз', 0.4, 0.005);
    onHead(side * 0.15, -0.075, new THREE.SphereGeometry(0.035, 8, 6), 0xF4A6B8, 'румянец', 0.25, 0.003);
  }

  group.userData.rig = rig;
  group.userData.legs = legs;
  group.userData.arms = arms;

  group.scale.setScalar(height / H);
  checkModel(group, 'Героиня');
  return group;
}

// ===== Анимация ходьбы: phase — «шаг», amount от 0 (стоит) до 1 (идёт) =====
export function animateCharacter(group, phase, amount) {
  const { rig, legs, arms } = group.userData;
  const swing = Math.sin(phase) * 0.7 * amount;
  legs.left.rotation.x = swing;
  legs.right.rotation.x = -swing;
  arms.left.rotation.x = -swing * 0.8;
  arms.right.rotation.x = swing * 0.8;
  rig.position.y = Math.abs(Math.sin(phase)) * 0.04 * amount;
}

// =====================================================================
//                              ГОРОДОК
// =====================================================================

// ===== Окно: рама, стекло, перекладины, подоконник. Ставится на стену, «наружу» — это +z группы =====
function addWindow(parent, x, y, z, rotY, withBox = false) {
  const W = 0.7, H = 0.8;
  const win = new THREE.Group();
  win.name = 'окно';
  win.position.set(x, y, z);
  win.rotation.y = rotY;
  parent.add(win);

  addBox(win, W, H, 0.06, P.wood, 'рама окна', 0, 0, 0.02);
  addBox(win, W - 0.16, H - 0.16, 0.05, P.glass, 'стекло', 0, 0, 0.045);
  addBox(win, 0.05, H - 0.1, 0.07, P.wood, 'перекладина вертикальная', 0, 0, 0.065);
  addBox(win, W - 0.1, 0.05, 0.07, P.wood, 'перекладина горизонтальная', 0, 0, 0.065);
  addBox(win, W + 0.14, 0.06, 0.16, P.stone, 'подоконник', 0, -H / 2 - 0.03, 0.08);

  if (withBox) {
    // ящик с цветами под окном
    addBox(win, W + 0.1, 0.16, 0.2, P.wood, 'ящик для цветов', 0, -H / 2 - 0.12, 0.12);
    for (let i = 0; i < 4; i++) {
      const bx = -W * 0.4 + i * (W * 0.8 / 3);
      addPart(win, new THREE.SphereGeometry(0.09, 6, 5), i % 2 ? P.accent : P.leaf, 'цветок в ящике',
        bx, -H / 2 - 0.04, 0.12);
    }
  }
  return win;
}

// ===== Двускатная крыша: два ската, треугольник фронтона и конёк =====
// hw — половина ширины пролёта, len — длина вдоль конька, baseY — высота верха стен, rh — высота крыши
function addGableRoof(parent, hw, len, baseY, rh, color, wallColor, rotY) {
  const T = 0.14;        // толщина ската
  const OVER_E = 0.35;   // свес над стеной сбоку
  const OVER_L = 0.3;    // свес спереди и сзади
  const roof = new THREE.Group();
  roof.name = 'крыша';
  roof.rotation.y = rotY;
  parent.add(roof);

  // Треугольник стены под крышей
  addPart(roof, profilePrism([[-hw, 0], [hw, 0], [0, rh]], len - 0.02), wallColor, 'фронтон', 0, baseY, 0);

  // Два ската: плита лежит ровно на ребре треугольника
  const a = Math.atan2(rh, hw);
  const slopeLen = (hw + OVER_E) / Math.cos(a);
  for (const s of [-1, 1]) {
    const dx = s * Math.cos(a);
    const dy = -Math.sin(a);       // вниз по скату
    const nx = s * Math.sin(a);
    const ny = Math.cos(a);        // вверх от ската
    const cx = dx * (slopeLen / 2) + nx * (T / 2);
    const cy = baseY + rh + dy * (slopeLen / 2) + ny * (T / 2);
    const slab = addPart(roof, new THREE.BoxGeometry(slopeLen, T, len + 2 * OVER_L), color, 'скат', cx, cy, 0);
    slab.rotation.z = -s * a;
  }

  // Конёк закрывает стык скатов
  const ridge = addBox(roof, 0.2, 0.2, len + 2 * OVER_L, P.wood, 'конёк', 0, baseY + rh + T * 0.55, 0);
  ridge.rotation.z = Math.PI / 4;
}

// ===== Шатровая крыша: четырёхгранная пирамида =====
function addHipRoof(parent, hw, hd, baseY, rh, color) {
  const OVER = 0.35;
  const SINK = 0.12; // нижняя часть пирамиды уходит ниже верха стен, так что щелей нет
  const geo = new THREE.ConeGeometry(1, rh + SINK, 4, 1);
  geo.rotateY(Math.PI / 4); // углы пирамиды в углах дома
  const cone = addPart(parent, geo, color, 'крыша', 0, baseY - SINK + (rh + SINK) / 2, 0);
  cone.scale.set((hw + OVER) / Math.SQRT1_2, 1, (hd + OVER) / Math.SQRT1_2);
}

// ===== Дом: createHouse(variant) — три варианта =====
const HOUSE_VARIANTS = [
  {
    // Вариант 0: невысокий дом с двускатной крышей
    W: 4.4, D: 3.6, wallH: 2.3, rh: 1.55,
    wall: P.wallLight, roof: P.roofCoral, door: P.darkWood, roofType: 'gable',
    front: [[-1.4, 1.3], [1.4, 1.3]], side: [[0, 1.3]], back: [[-1.0, 1.3], [1.0, 1.3]],
    chimney: [0.5, -0.3], flowerBoxes: false, ledge: false,
  },
  {
    // Вариант 1: квадратный дом с шатровой крышей и ящиками с цветами
    W: 4.0, D: 4.0, wallH: 2.2, rh: 1.45,
    wall: P.wallWarm, roof: P.roofBlue, door: P.wood, roofType: 'hip',
    front: [[-1.3, 1.25], [1.3, 1.25]], side: [[-0.8, 1.25], [0.8, 1.25]], back: [[0, 1.25]],
    chimney: [0.9, -0.9], flowerBoxes: true, ledge: false,
  },
  {
    // Вариант 2: узкий двухэтажный дом, конёк идёт поперёк
    W: 3.4, D: 3.4, wallH: 4.0, rh: 1.5,
    wall: P.wallLight, roof: P.roofLilac, door: P.darkWood, roofType: 'gable-x',
    front: [[-1.1, 1.2], [1.1, 1.2], [-0.8, 3.0], [0.8, 3.0]], side: [[0, 1.2], [0, 3.0]], back: [[0, 1.2], [0, 3.0]],
    chimney: [0.85, 0.6], flowerBoxes: false, ledge: true,
  },
];

export function createHouse(variant = 0) {
  const V = HOUSE_VARIANTS[((variant % 3) + 3) % 3];
  const { W, D, wallH, rh } = V;

  // --- Размеры (всё считается от них) ---
  const FOUND_H = 0.35;      // высота каменного основания
  const FOUND_PAD = 0.08;    // насколько основание шире стен
  const OVERLAP = 0.04;      // детали чуть заходят друг в друга
  const DOOR_W = 0.95;
  const DOOR_H = 1.75;
  const hw = W / 2;
  const hd = D / 2;
  const wallBottom = FOUND_H - OVERLAP;
  const wallTop = FOUND_H + wallH;
  const zFront = hd + FOUND_PAD; // передний край основания

  const group = new THREE.Group();
  group.name = 'дом-' + variant;

  // Основание и стены
  addBox(group, W + 2 * FOUND_PAD, FOUND_H, D + 2 * FOUND_PAD, P.stone, 'основание', 0, FOUND_H / 2, 0);
  addBox(group, W, wallTop - wallBottom, D, V.wall, 'стены', 0, (wallBottom + wallTop) / 2, 0);

  // Дверь: наличник, полотно, ручка, две ступеньки
  const frameColor = V.door === P.darkWood ? P.wood : P.darkWood;
  addBox(group, DOOR_W + 0.2, DOOR_H + 0.1, 0.05, frameColor, 'наличник двери',
    0, FOUND_H + (DOOR_H + 0.1) / 2, hd + 0.01);
  addBox(group, DOOR_W, DOOR_H, 0.08, V.door, 'дверь', 0, FOUND_H + DOOR_H / 2, hd + 0.02);
  addPart(group, new THREE.SphereGeometry(0.05, 6, 5), P.gold, 'ручка двери',
    0.3, FOUND_H + 0.9, hd + 0.08);
  addBox(group, 1.5, FOUND_H, 0.45, P.stone, 'верхняя ступенька', 0, FOUND_H / 2, zFront + 0.45 / 2 - 0.03);
  addBox(group, 1.8, FOUND_H * 0.5, 0.45, P.stoneDark, 'нижняя ступенька',
    0, FOUND_H * 0.25, zFront + 0.45 + 0.45 / 2 - 0.06);

  // Окна: впереди, по бокам и сзади
  V.front.forEach(([x, y]) => addWindow(group, x, FOUND_H + y, hd, 0, V.flowerBoxes));
  V.side.forEach(([z, y]) => {
    addWindow(group, hw, FOUND_H + y, z, Math.PI / 2);
    addWindow(group, -hw, FOUND_H + y, z, -Math.PI / 2);
  });
  V.back.forEach(([x, y]) => addWindow(group, x, FOUND_H + y, -hd, Math.PI));

  // Поясок между этажами
  if (V.ledge) {
    addBox(group, W + 0.12, 0.1, D + 0.12, P.wood, 'поясок', 0, FOUND_H + 2.0, 0);
  }

  // Крыша
  if (V.roofType === 'hip') {
    addHipRoof(group, hw, hd, wallTop, rh, V.roof);
  } else if (V.roofType === 'gable') {
    addGableRoof(group, hw, D, wallTop, rh, V.roof, V.wall, 0);
  } else {
    addGableRoof(group, hd, W, wallTop, rh, V.roof, V.wall, Math.PI / 2);
  }

  // Труба: начинается внутри стены, выходит выше крыши
  const [cx, cz] = V.chimney;
  const CH_W = 0.45;
  const chimneyBottom = wallTop - 0.1;
  const chimneyTop = wallTop + rh + 0.45;
  addBox(group, CH_W, chimneyTop - chimneyBottom, CH_W, P.brick, 'труба',
    cx, (chimneyBottom + chimneyTop) / 2, cz);
  addBox(group, CH_W + 0.14, 0.1, CH_W + 0.14, P.stone, 'шапка трубы', cx, chimneyTop + 0.03, cz);

  // Данные для мира: размер для столкновений и где кончаются ступеньки
  group.userData.footprint = { w: W + 2 * FOUND_PAD, d: D + 2 * FOUND_PAD };
  group.userData.frontDistance = zFront + 0.84;

  checkModel(group, 'Дом ' + variant);
  return bakeStatic(group);
}

// ===== Дерево: createTree({ type: 'round' | 'pine' | 'blossom' }) =====
export function createTree(options = {}) {
  const { type = 'round' } = options;
  const TRUNK_R = 0.16;
  const TRUNK_TOP_R = 0.12;

  const group = new THREE.Group();
  group.name = 'дерево-' + type;

  if (type === 'pine') {
    const TRUNK_H = 0.9;
    addPart(group, new THREE.CylinderGeometry(TRUNK_TOP_R, TRUNK_R, TRUNK_H, 7), P.darkWood,
      'ствол', 0, TRUNK_H / 2, 0);
    // Три яруса хвои: каждый следующий начинается ниже верха предыдущего
    const layers = [{ r: 1.25, h: 1.3 }, { r: 1.0, h: 1.25 }, { r: 0.72, h: 1.15 }];
    let y = TRUNK_H * 0.55;
    layers.forEach((L, i) => {
      addPart(group, new THREE.ConeGeometry(L.r, L.h, 8), i % 2 ? P.leafLight : P.leaf,
        'хвоя-' + i, 0, y + L.h / 2, 0);
      y += L.h * 0.62;
    });
  } else {
    const TRUNK_H = 1.1;
    const BLOB_R = 1.1;
    const main = type === 'blossom' ? P.blossom : P.leaf;
    const second = type === 'blossom' ? P.blossomLight : P.leafLight;
    addPart(group, new THREE.CylinderGeometry(TRUNK_TOP_R, TRUNK_R, TRUNK_H, 7), P.darkWood,
      'ствол', 0, TRUNK_H / 2, 0);
    addPart(group, new THREE.IcosahedronGeometry(BLOB_R, 1), main,
      'крона', 0, TRUNK_H + BLOB_R * 0.55, 0);
    addPart(group, new THREE.IcosahedronGeometry(BLOB_R * 0.7, 1), second,
      'крона малая', BLOB_R * 0.55, TRUNK_H + BLOB_R * 0.2, BLOB_R * 0.2);
  }

  checkModel(group, 'Дерево ' + type);
  return bakeStatic(group);
}

// ===== Фонарь: createLamp() =====
export function createLamp() {
  const BASE_R = 0.2, BASE_H = 0.25;
  const POLE_R = 0.055, POLE_H = 2.0;
  const LANTERN_W = 0.34, LANTERN_H = 0.42;
  const CAP_R = 0.3, CAP_H = 0.25;
  const OVERLAP = 0.04;

  const poleBottom = BASE_H - OVERLAP;
  const poleTop = poleBottom + POLE_H;
  const lanternBottom = poleTop - OVERLAP;
  const lanternTop = lanternBottom + LANTERN_H;
  const capBottom = lanternTop - OVERLAP;

  const group = new THREE.Group();
  group.name = 'фонарь';
  addPart(group, new THREE.CylinderGeometry(BASE_R * 0.8, BASE_R, BASE_H, 8), P.stoneDark,
    'основание', 0, BASE_H / 2, 0);
  addPart(group, new THREE.CylinderGeometry(POLE_R, POLE_R, POLE_H, 8), P.darkWood,
    'столб', 0, poleBottom + POLE_H / 2, 0);
  addMeshWithMaterial(group, new THREE.BoxGeometry(LANTERN_W, LANTERN_H, LANTERN_W), getGlowMaterial(P.lantern),
    'плафон', 0, lanternBottom + LANTERN_H / 2, 0);
  const cap = addPart(group, new THREE.ConeGeometry(CAP_R, CAP_H, 4), P.darkWood,
    'крышка', 0, capBottom + CAP_H / 2, 0);
  cap.rotation.y = Math.PI / 4;
  addPart(group, new THREE.SphereGeometry(0.05, 6, 5), P.gold, 'шарик', 0, capBottom + CAP_H, 0);

  checkModel(group, 'Фонарь');
  return bakeStatic(group);
}

// ===== Скамейка: createBench(). Лицом к +z =====
export function createBench() {
  const SEAT_W = 1.5, SEAT_D = 0.5, SEAT_T = 0.07, SEAT_H = 0.45;
  const SIDE_T = 0.07;
  const BACK_POST_H = 0.6;
  const OVERLAP = 0.03;

  const group = new THREE.Group();
  group.name = 'скамейка';

  // Сиденье из двух досок
  const plankD = SEAT_D / 2 - 0.015;
  for (const s of [-1, 1]) {
    addBox(group, SEAT_W, SEAT_T, plankD, P.wood, 'доска сиденья', 0, SEAT_H - SEAT_T / 2, s * (SEAT_D / 4));
  }
  // Боковины-ножки
  for (const s of [-1, 1]) {
    addBox(group, SIDE_T, SEAT_H - SEAT_T + OVERLAP, SEAT_D * 0.85, P.darkWood, 'боковина',
      s * (SEAT_W / 2 - 0.12), (SEAT_H - SEAT_T + OVERLAP) / 2, 0);
  }
  // Спинка: две стойки и две доски
  const backZ = -SEAT_D / 2 + 0.05;
  for (const s of [-1, 1]) {
    addBox(group, 0.07, BACK_POST_H, 0.07, P.darkWood, 'стойка спинки',
      s * (SEAT_W / 2 - 0.12), SEAT_H - SEAT_T + BACK_POST_H / 2, backZ);
  }
  for (const dy of [0.22, 0.4]) {
    addBox(group, SEAT_W - 0.1, 0.12, 0.04, P.wood, 'доска спинки', 0, SEAT_H + dy, backZ + 0.045);
  }

  checkModel(group, 'Скамейка');
  return bakeStatic(group);
}

// ===== Цветы: createFlowers() — маленький цветочный куст из пяти цветков =====
export function createFlowers(options = {}) {
  const { colors = [P.accent, P.white, P.yellow, P.lilac, P.orange] } = options;
  const MOUND_R = 0.3, MOUND_SQUASH = 0.45;
  const STEM_R = 0.015;
  const HEAD_R = 0.07;
  // x, z, высота цветка
  const SPOTS = [[0, 0, 0.45], [0.16, 0.1, 0.35], [-0.15, 0.08, 0.4], [0.05, -0.17, 0.3], [-0.08, -0.1, 0.38]];

  const group = new THREE.Group();
  group.name = 'цветы';

  // Зелёный холмик: полусфера, низ ровно на y = 0
  const mound = addPart(group, new THREE.SphereGeometry(MOUND_R, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    P.leaf, 'холмик', 0, 0, 0);
  mound.scale.y = MOUND_SQUASH;

  SPOTS.forEach(([x, z, h], i) => {
    addPart(group, new THREE.CylinderGeometry(STEM_R, STEM_R, h, 5), P.leafLight, 'стебель', x, h / 2, z);
    const head = addPart(group, new THREE.SphereGeometry(HEAD_R, 6, 5), colors[i % colors.length],
      'лепестки', x, h, z);
    head.scale.y = 0.6;
    addPart(group, new THREE.SphereGeometry(HEAD_R * 0.45, 5, 4), P.yellow, 'серединка', x, h + HEAD_R * 0.5, z);
  });

  checkModel(group, 'Цветы');
  return bakeStatic(group);
}

// ===== Фонтан: createFountain(). Струя анимируется в мире, поэтому не склеиваем детали =====
export function createFountain() {
  const BASIN_R = 1.8, BASIN_H = 0.5, WALL_T = 0.22, FLOOR_H = 0.15;
  const PILLAR_H = 1.0;
  const OVERLAP = 0.03;

  const group = new THREE.Group();
  group.name = 'фонтан';

  // Чаша: профиль вращается вокруг оси (внутри пустая)
  const profile = [
    [0, 0], [BASIN_R, 0], [BASIN_R, BASIN_H], [BASIN_R - WALL_T, BASIN_H],
    [BASIN_R - WALL_T, FLOOR_H], [0, FLOOR_H],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  addPart(group, new THREE.LatheGeometry(profile, 12), P.stone, 'чаша', 0, 0, 0, true);

  // Вода в чаше чуть ниже края
  addPart(group, new THREE.CylinderGeometry(BASIN_R - WALL_T + 0.02, BASIN_R - WALL_T + 0.02, 0.04, 12),
    P.water, 'вода', 0, BASIN_H - 0.12, 0);

  // Столб, верхняя чаша и струя
  const pillarBottom = FLOOR_H - OVERLAP;
  addPart(group, new THREE.CylinderGeometry(0.2, 0.28, PILLAR_H, 8), P.stone,
    'столб', 0, pillarBottom + PILLAR_H / 2, 0);
  const bowlBottom = pillarBottom + PILLAR_H - 0.04;
  const BOWL_H = 0.28;
  addPart(group, new THREE.CylinderGeometry(0.75, 0.4, BOWL_H, 12), P.stone,
    'верхняя чаша', 0, bowlBottom + BOWL_H / 2, 0);
  const bowlTop = bowlBottom + BOWL_H;
  addPart(group, new THREE.CylinderGeometry(0.62, 0.62, 0.04, 12), P.water,
    'вода в верхней чаше', 0, bowlTop - 0.06, 0);

  const JET_H = 0.7;
  const jetGeo = new THREE.ConeGeometry(0.14, JET_H, 8);
  jetGeo.translate(0, JET_H / 2, 0); // основание струи на y = 0 детали, так что она тянется вверх
  const jet = addPart(group, jetGeo, P.foam, 'струя', 0, bowlTop - 0.1, 0);
  group.userData.jet = jet;

  checkModel(group, 'Фонтан');
  return group;
}

// ===== Пирс: createDock({ length }). Начало (z = 0) на берегу, конец в море =====
// Низ свай на y = 0, верх настила на y = userData.deckTop. В мире группу опускают так, чтобы настил был над водой.
export function createDock(options = {}) {
  const { length = 10.5 } = options;
  const WIDTH = 2.4;
  const PLANK_W = 0.42, PLANK_GAP = 0.03, PLANK_T = 0.08;
  const DECK_TOP = 2.0;
  const POST_R = 0.1, POST_STEP = 2.1, RAIL_H = 0.45;
  const BEAM = 0.14;

  const group = new THREE.Group();
  group.name = 'пирс';

  // Настил: доски поперёк, склеены в две детали (светлые и тёмные через одну)
  const pitch = PLANK_W + PLANK_GAP;
  const count = Math.floor(length / pitch);
  const light = [];
  const dark = [];
  for (let i = 0; i < count; i++) {
    const box = [WIDTH, PLANK_T, PLANK_W, 0, DECK_TOP - PLANK_T / 2, PLANK_W / 2 + i * pitch];
    (i % 2 ? dark : light).push(box);
  }
  addMeshWithMaterial(group, mergeBoxes(light), getMaterial(P.wood), 'настил-светлый');
  addMeshWithMaterial(group, mergeBoxes(dark), getMaterial(P.darkWood), 'настил-тёмный');

  // Три продольные балки под настилом
  const beamY = DECK_TOP - PLANK_T - BEAM / 2 + 0.02;
  for (const x of [-0.8, 0, 0.8]) {
    addBox(group, BEAM, BEAM, count * pitch, P.darkWood, 'балка', x, beamY, (count * pitch) / 2);
  }

  // Сваи с обеих сторон, поднимаются над настилом как столбики перил
  const postH = DECK_TOP + RAIL_H;
  const postX = WIDTH / 2 + 0.02;
  for (let z = 0.3; z <= count * pitch - 0.2; z += POST_STEP) {
    for (const s of [-1, 1]) {
      addPart(group, new THREE.CylinderGeometry(POST_R, POST_R, postH, 8), P.darkWood,
        'свая', s * postX, postH / 2, z);
    }
  }

  // Верёвка между столбиками
  for (const s of [-1, 1]) {
    addBox(group, 0.04, 0.04, count * pitch, P.rope, 'верёвка', s * postX, DECK_TOP + RAIL_H - 0.12, (count * pitch) / 2);
  }

  group.userData.deckTop = DECK_TOP;
  group.userData.width = WIDTH;
  group.userData.length = count * pitch;

  checkModel(group, 'Пирс');
  return bakeStatic(group);
}

// ===== Лодка: createBoat(). Нос смотрит в +z, низ корпуса на y = 0 =====
export function createBoat() {
  const L = 3.2, W = 1.3;
  const LOW_H = 0.22, HULL_H = 0.36;
  const OVERLAP = 0.03;
  const MAST_H = 2.3;

  // Контур вида сверху: прямая корма и острый нос. k — масштаб контура
  const outline = (k) => [
    [-W / 2 * k, -L / 2 * k], [W / 2 * k, -L / 2 * k], [W / 2 * k, L * 0.12 * k],
    [0, L / 2 * k], [-W / 2 * k, L * 0.12 * k],
  ];

  const group = new THREE.Group();
  group.name = 'лодка';

  addPart(group, prismGeometry(outline(0.72), LOW_H), P.darkWood, 'киль', 0, 0, 0);
  addPart(group, prismGeometry(outline(1), HULL_H), P.wood, 'корпус', 0, LOW_H - OVERLAP, 0);
  const hullTop = LOW_H - OVERLAP + HULL_H;
  addPart(group, prismGeometry(outline(0.84), 0.03), P.woodLight, 'дно лодки', 0, hullTop - 0.01, 0);
  const floorTop = hullTop + 0.02;

  // Две лавки
  addBox(group, W * 0.82, 0.1, 0.3, P.wood, 'лавка', 0, floorTop + 0.04, -0.55);
  addBox(group, W * 0.82, 0.1, 0.3, P.wood, 'лавка', 0, floorTop + 0.04, 0.3);

  // Мачта, гик (нижняя перекладина), парус и вымпел
  const mastZ = L * 0.2;
  addPart(group, new THREE.CylinderGeometry(0.035, 0.045, MAST_H, 6), P.darkWood,
    'мачта', 0, hullTop + MAST_H / 2 - 0.02, mastZ);
  const BOOM_LEN = 1.5;
  const boomY = floorTop + 0.7;
  const boomGeo = new THREE.CylinderGeometry(0.025, 0.025, BOOM_LEN, 6);
  boomGeo.rotateX(Math.PI / 2); // вдоль лодки
  addPart(group, boomGeo, P.darkWood, 'гик', 0, boomY, mastZ - BOOM_LEN / 2 + 0.02);

  // Парус — плоский треугольник в плоскости «вверх-вдоль лодки»
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0.03);
  sailShape.lineTo(-1.4, 0.03);
  sailShape.lineTo(0, 1.45);
  sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  sailGeo.rotateY(-Math.PI / 2);
  addPart(group, sailGeo, P.wallLight, 'парус', 0, boomY, mastZ, true);

  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, 0);
  pennantShape.lineTo(-0.45, -0.07);
  pennantShape.lineTo(0, -0.14);
  pennantShape.closePath();
  const pennantGeo = new THREE.ShapeGeometry(pennantShape);
  pennantGeo.rotateY(-Math.PI / 2);
  addPart(group, pennantGeo, P.accent, 'вымпел', 0, hullTop + MAST_H - 0.05, mastZ, true);

  group.userData.length = L;
  group.userData.width = W;

  checkModel(group, 'Лодка');
  return bakeStatic(group);
}
