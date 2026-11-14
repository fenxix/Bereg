// models.js — генераторы моделей (героиня, дом, дерево, фонарь, лодка, пирс, скамейка, цветы, фонтан)
// и модели для зон острова (лавка, ящик, бочка, сеть, домик рыбака, маяк, заборчик, почтовый ящик,
// грибы, камень, ступень, шезлонг, зонтик, дерево с качелями) и проверка checkModel
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
    // Копии за кадром не рисуем (ни самих, ни их тени): для этого считаем габарит всех копий сразу.
    // Если в этой версии Three.js так нельзя, оставляем как раньше — рисуем всегда.
    if (typeof inst.computeBoundingSphere === 'function') {
      inst.computeBoundingSphere();
      inst.frustumCulled = true;
    } else {
      inst.frustumCulled = false;
    }
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

// =====================================================================
//                       МОДЕЛИ ДЛЯ ЗОН ОСТРОВА
// Все модели «лицом» смотрят в +z, стоят на y = 0, детали касаются друг друга.
// =====================================================================

// ===== Ящик: createCrate() =====
export function createCrate() {
  const S = 0.62;
  const group = new THREE.Group();
  group.name = 'ящик';
  addBox(group, S, S, S, P.wood, 'ящик', 0, S / 2, 0);
  addBox(group, S + 0.04, 0.1, S + 0.04, P.darkWood, 'обвязка низ', 0, 0.12, 0);
  addBox(group, S + 0.04, 0.1, S + 0.04, P.darkWood, 'обвязка верх', 0, S - 0.12, 0);
  addBox(group, S + 0.04, 0.05, S + 0.04, P.woodLight, 'крышка', 0, S + 0.005, 0);
  checkModel(group, 'Ящик');
  return bakeStatic(group);
}

// ===== Бочка: createBarrel() =====
export function createBarrel() {
  const HALF = 0.34;
  const group = new THREE.Group();
  group.name = 'бочка';
  addPart(group, new THREE.CylinderGeometry(0.38, 0.3, HALF, 10), P.wood, 'низ бочки', 0, HALF / 2, 0);
  addPart(group, new THREE.CylinderGeometry(0.3, 0.38, HALF, 10), P.wood, 'верх бочки', 0, HALF * 1.5, 0);
  addPart(group, new THREE.CylinderGeometry(0.29, 0.29, 0.05, 10), P.woodLight, 'крышка', 0, HALF * 2 + 0.01, 0);
  addPart(group, new THREE.CylinderGeometry(0.395, 0.395, 0.05, 10), P.darkWood, 'обруч середина', 0, HALF, 0);
  addPart(group, new THREE.CylinderGeometry(0.335, 0.335, 0.05, 10), P.darkWood, 'обруч низ', 0, 0.1, 0);
  addPart(group, new THREE.CylinderGeometry(0.335, 0.335, 0.05, 10), P.darkWood, 'обруч верх', 0, HALF * 2 - 0.1, 0);
  checkModel(group, 'Бочка');
  return bakeStatic(group);
}

// ===== Лавка с навесом: createStall(). Продавец за прилавком, покупатель со стороны +z =====
// Центр модели — центр лавки, размер примерно 2,6 × 1,9
export function createStall() {
  const Z0 = 0.35;                       // сдвиг: центр лавки в нуле
  const zz = (z) => z - Z0;
  const POST = 0.1;
  const BACK_H = 2.3, FRONT_H = 1.9;
  const group = new THREE.Group();
  group.name = 'лавка';

  // Прилавок: тумба, столешница и яркая «юбка» спереди
  addBox(group, 2.2, 0.9, 0.8, P.wood, 'прилавок', 0, 0.45, zz(0.35));
  addBox(group, 2.4, 0.08, 1.0, P.woodLight, 'столешница', 0, 0.94, zz(0.35));
  addBox(group, 2.0, 0.5, 0.04, P.accent, 'ткань на прилавке', 0, 0.5, zz(0.77));

  // Стойки и задняя стенка с полкой
  for (const sx of [-1, 1]) {
    addBox(group, POST, BACK_H, POST, P.darkWood, 'стойка задняя', sx * 1.1, BACK_H / 2, zz(-0.55));
    addBox(group, POST, FRONT_H, POST, P.darkWood, 'стойка передняя', sx * 1.1, FRONT_H / 2, zz(0.8));
  }
  addBox(group, 2.2, 1.5, 0.07, P.woodLight, 'задняя стенка', 0, 0.75 + 0.1, zz(-0.55));
  addBox(group, 2.1, 0.06, 0.4, P.wood, 'полка', 0, 1.45, zz(-0.38));

  // Товар на полке: коробочки
  const jars = [P.accent, P.yellow, P.lilac, P.orange];
  jars.forEach((color, i) => {
    addBox(group, 0.3, 0.24, 0.26, color, 'банка', -0.75 + i * 0.5, 1.48 + 0.12, zz(-0.38));
  });

  // Товар на прилавке: ящик с фруктами и ящик с капустой
  addBox(group, 0.6, 0.18, 0.42, P.woodLight, 'ящик с фруктами', -0.65, 0.98 + 0.09, zz(0.4));
  [[-0.82, 0.32, P.roofCoral], [-0.65, 0.4, P.orange], [-0.48, 0.32, P.yellow], [-0.74, 0.5, P.roofCoral], [-0.56, 0.5, P.orange]]
    .forEach(([x, z, color]) => {
      addPart(group, new THREE.SphereGeometry(0.09, 6, 5), color, 'фрукт', x, 1.16 + 0.07, zz(z - 0.0));
    });
  addBox(group, 0.6, 0.18, 0.42, P.woodLight, 'ящик с зеленью', 0.65, 0.98 + 0.09, zz(0.4));
  [[0.5, 0.35], [0.8, 0.35], [0.65, 0.5]].forEach(([x, z]) => {
    addPart(group, new THREE.SphereGeometry(0.13, 6, 5), P.leaf, 'кочан', x, 1.16 + 0.1, zz(z));
  });

  // Навес: полосатая плита лежит на верхушках стоек (спереди ниже, чем сзади)
  const dy = BACK_H - FRONT_H;
  const dz = 1.35;
  const tilt = Math.atan2(dy, dz);
  const slabLen = Math.hypot(dy, dz) + 0.5;
  const ux = 0;
  const midY = (BACK_H + FRONT_H) / 2;
  const midZ = zz(-0.55 + dz / 2);
  const ucz = Math.cos(tilt);
  const ucy = -Math.sin(tilt);
  const cy = midY + ucy * 0.25 + 0.05;
  const cz = midZ + ucz * 0.25;
  const STRIPES = 6;
  const stripeW = 2.6 / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    const color = i % 2 ? P.wallLight : P.roofCoral;
    const x = -1.3 + stripeW * (i + 0.5);
    const slab = addBox(group, stripeW, 0.07, slabLen, color, 'полоса навеса', x + ux, cy, cz);
    slab.rotation.x = tilt;
    // бахрома по переднему краю
    const fy = cy + ucy * (slabLen / 2) - 0.1;
    const fz = cz + ucz * (slabLen / 2);
    addBox(group, stripeW, 0.14, 0.03, color, 'бахрома', x, fy, fz);
  }

  group.userData.footprint = { w: 2.6, d: 1.9 };
  checkModel(group, 'Лавка');
  return bakeStatic(group);
}

// ===== Сушилка для сетей: createNetRack(). Перекладина вдоль оси x =====
export function createNetRack() {
  const group = new THREE.Group();
  group.name = 'сети';
  for (const sx of [-1, 1]) {
    addBox(group, 0.12, 2.0, 0.12, P.darkWood, 'стойка', sx * 1.2, 1.0, 0);
    addBox(group, 0.3, 0.1, 0.3, P.darkWood, 'подпорка', sx * 1.2, 0.05, 0);
  }
  addBox(group, 2.6, 0.1, 0.1, P.darkWood, 'перекладина', 0, 1.95, 0);
  addBox(group, 2.2, 1.1, 0.03, P.rope, 'сеть', 0, 1.42, 0);
  // нити сети потемнее, чтобы было похоже на ячейки
  for (let i = 0; i < 5; i++) {
    addBox(group, 0.03, 1.1, 0.045, P.woodLight, 'нить', -0.88 + i * 0.44, 1.42, 0);
  }
  for (let i = 0; i < 2; i++) {
    addBox(group, 2.2, 0.03, 0.045, P.woodLight, 'нить поперёк', 0, 1.1 + i * 0.5, 0);
  }
  // поплавки по нижнему краю
  for (let i = 0; i < 5; i++) {
    addPart(group, new THREE.SphereGeometry(0.1, 6, 5), P.roofCoral, 'поплавок',
      -0.88 + i * 0.44, 0.88, 0);
  }
  checkModel(group, 'Сеть');
  return bakeStatic(group);
}

// ===== Домик рыбака: createFisherHut(). Дверь на +z, размер около 3,4 × 3,0 =====
export function createFisherHut() {
  const W = 3.2, D = 2.8, WALL_H = 1.9, FOUND_H = 0.25, RH = 1.15;
  const hw = W / 2, hd = D / 2;
  const group = new THREE.Group();
  group.name = 'домик рыбака';

  addBox(group, W + 0.16, FOUND_H, D + 0.16, P.stone, 'основание', 0, FOUND_H / 2, 0);
  addBox(group, W, WALL_H, D, P.woodLight, 'стены', 0, FOUND_H + WALL_H / 2 - 0.02, 0);
  const wallTop = FOUND_H + WALL_H - 0.02;

  // Дверь с наличником и ручкой, ступенька
  addBox(group, 1.0, 1.55, 0.05, P.darkWood, 'наличник двери', 0.5, FOUND_H + 0.775, hd + 0.01);
  addBox(group, 0.8, 1.45, 0.08, P.wood, 'дверь', 0.5, FOUND_H + 0.725, hd + 0.02);
  addPart(group, new THREE.SphereGeometry(0.045, 6, 5), P.gold, 'ручка двери', 0.72, FOUND_H + 0.75, hd + 0.08);
  addBox(group, 1.3, 0.14, 0.4, P.stoneDark, 'ступенька', 0.5, 0.07, hd + 0.3);

  // Окна: спереди слева и по бокам
  addWindow(group, -0.85, FOUND_H + 1.05, hd, 0, true);
  addWindow(group, hw, FOUND_H + 1.05, 0, Math.PI / 2);
  addWindow(group, -hw, FOUND_H + 1.05, 0, -Math.PI / 2);

  addGableRoof(group, hw, D, wallTop, RH, P.roofBlue, P.woodLight, 0);

  // Труба
  addBox(group, 0.4, 1.3, 0.4, P.brick, 'труба', 0.9, wallTop + 0.2, -0.5);
  addBox(group, 0.54, 0.08, 0.54, P.stone, 'шапка трубы', 0.9, wallTop + 0.88, -0.5);

  // Два буйка у стены и якорь-«скамейка»: бочонок и поплавок
  addPart(group, new THREE.SphereGeometry(0.2, 7, 6), P.roofCoral, 'буй', hw + 0.28, 0.2, hd - 0.4);
  addPart(group, new THREE.SphereGeometry(0.16, 7, 6), P.wallLight, 'буй малый', hw + 0.26, 0.16, hd - 0.72);

  group.userData.footprint = { w: W + 0.16, d: D + 0.16 };
  checkModel(group, 'Домик рыбака');
  return bakeStatic(group);
}

// ===== Маяк: createLighthouse(). Дверь на +z. Высота около 11 =====
export function createLighthouse() {
  const group = new THREE.Group();
  group.name = 'маяк';
  const OVERLAP = 0.03;

  // Каменное основание
  const BASE_H = 0.35;
  addPart(group, new THREE.CylinderGeometry(1.9, 2.0, BASE_H, 12), P.stone, 'основание', 0, BASE_H / 2, 0);

  // Башня: четыре полосатых яруса, каждый чуть уже предыдущего
  const SEGMENTS = [
    { rb: 1.55, rt: 1.35, h: 2.2, color: P.wallLight },
    { rb: 1.35, rt: 1.2, h: 2.0, color: P.roofCoral },
    { rb: 1.2, rt: 1.05, h: 2.0, color: P.wallLight },
    { rb: 1.05, rt: 0.95, h: 1.6, color: P.roofCoral },
  ];
  const ranges = [];
  let y = BASE_H - OVERLAP;
  for (const seg of SEGMENTS) {
    addPart(group, new THREE.CylinderGeometry(seg.rt, seg.rb, seg.h, 12), seg.color, 'ярус башни', 0, y + seg.h / 2, 0);
    ranges.push({ y0: y, y1: y + seg.h, rb: seg.rb, rt: seg.rt });
    y += seg.h - OVERLAP;
  }
  const towerTop = y + OVERLAP;
  const radiusAt = (yy) => {
    const r = ranges.find((q) => yy >= q.y0 && yy <= q.y1) || ranges[ranges.length - 1];
    return r.rb + (r.rt - r.rb) * ((yy - r.y0) / (r.y1 - r.y0));
  };

  // Дверь с наличником
  addBox(group, 1.0, 1.7, 0.08, P.darkWood, 'наличник двери', 0, BASE_H + 0.8, radiusAt(BASE_H + 0.8) - 0.02);
  addBox(group, 0.85, 1.6, 0.1, P.wood, 'дверь', 0, BASE_H + 0.75, radiusAt(BASE_H + 0.75));
  addPart(group, new THREE.SphereGeometry(0.05, 6, 5), P.gold, 'ручка двери', 0.25, BASE_H + 0.8, radiusAt(BASE_H + 0.8) + 0.07);
  addBox(group, 1.6, 0.14, 0.5, P.stoneDark, 'ступенька', 0, BASE_H - 0.18, radiusAt(BASE_H) + 0.42);

  // Окошки на разных сторонах башни
  [[3.1, 0.95], [4.9, -1.25], [6.5, 2.3], [2.4, -2.2]].forEach(([wy, phi]) => {
    const r = radiusAt(wy);
    const sx = Math.sin(phi);
    const cz = Math.cos(phi);
    const frame = addBox(group, 0.44, 0.7, 0.1, P.darkWood, 'рама окна', sx * (r - 0.03), wy, cz * (r - 0.03));
    frame.rotation.y = phi;
    const glass = addBox(group, 0.3, 0.55, 0.1, P.glass, 'стекло', sx * (r + 0.01), wy, cz * (r + 0.01));
    glass.rotation.y = phi;
  });

  // Галерея с перилами
  const GALLERY_H = 0.22;
  const galleryY = towerTop - 0.06;
  addPart(group, new THREE.CylinderGeometry(1.5, 1.35, GALLERY_H, 12), P.stoneDark, 'галерея', 0, galleryY + GALLERY_H / 2, 0);
  const floorY = galleryY + GALLERY_H;
  const RAIL_R = 1.4, RAIL_H = 0.55;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addBox(group, 0.07, RAIL_H, 0.07, P.darkWood, 'столбик перил', Math.cos(a) * RAIL_R, floorY + RAIL_H / 2 - 0.02, Math.sin(a) * RAIL_R);
  }
  const rail = addPart(group, new THREE.TorusGeometry(RAIL_R, 0.035, 5, 20), P.wood, 'поручень', 0, floorY + RAIL_H - 0.04, 0);
  rail.rotation.x = Math.PI / 2;

  // Фонарная комната: светящееся стекло и тёмные стойки
  const LANTERN_H = 1.05;
  addMeshWithMaterial(group, new THREE.CylinderGeometry(0.62, 0.62, LANTERN_H, 8), getGlowMaterial(P.lantern),
    'фонарь маяка', 0, floorY + LANTERN_H / 2 - 0.02, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    addBox(group, 0.07, LANTERN_H + 0.04, 0.07, P.darkWood, 'стойка фонаря', Math.cos(a) * 0.63, floorY + LANTERN_H / 2 - 0.02, Math.sin(a) * 0.63);
  }
  const lanternTop = floorY + LANTERN_H - 0.02;
  addPart(group, new THREE.CylinderGeometry(0.85, 0.85, 0.12, 8), P.darkWood, 'карниз фонаря', 0, lanternTop + 0.04, 0);
  const roofH = 0.8;
  addPart(group, new THREE.ConeGeometry(0.95, roofH, 8), P.roofCoral, 'крыша маяка', 0, lanternTop + 0.1 + roofH / 2 - 0.04, 0);
  addPart(group, new THREE.SphereGeometry(0.1, 6, 5), P.gold, 'шарик', 0, lanternTop + 0.06 + roofH, 0);

  group.userData.footprint = { w: 4, d: 4 };
  checkModel(group, 'Маяк');
  return bakeStatic(group);
}

// ===== Заборчик (одна секция 1,6 в длину вдоль x): createFence() =====
export function createFence() {
  const group = new THREE.Group();
  group.name = 'заборчик';
  for (const sx of [-1, 1]) {
    addBox(group, 0.1, 0.85, 0.1, P.woodLight, 'столбик', sx * 0.75, 0.425, 0);
  }
  for (const ry of [0.28, 0.6]) {
    addBox(group, 1.6, 0.07, 0.05, P.woodLight, 'перекладина', 0, ry, 0);
  }
  for (let i = 0; i < 6; i++) {
    addBox(group, 0.11, 0.62, 0.04, P.wallLight, 'штакетина', -0.55 + i * 0.22, 0.4, 0.045);
  }
  checkModel(group, 'Заборчик');
  return bakeStatic(group);
}

// ===== Почтовый ящик на столбике: createMailbox(). Дверца на +z =====
export function createMailbox() {
  const group = new THREE.Group();
  group.name = 'почтовый ящик';
  addBox(group, 0.08, 0.85, 0.08, P.darkWood, 'столбик', 0, 0.425, 0);
  addBox(group, 0.4, 0.06, 0.4, P.wood, 'подставка', 0, 0.86, 0);
  addBox(group, 0.36, 0.26, 0.5, P.roofBlue, 'ящик', 0, 1.0, 0);
  addBox(group, 0.3, 0.05, 0.44, P.roofCoral, 'крышка', 0, 1.15, 0);
  addBox(group, 0.2, 0.03, 0.04, P.darkWood, 'щель', 0, 1.02, 0.26);
  addBox(group, 0.03, 0.2, 0.03, P.darkWood, 'флажок', 0.2, 1.1, -0.05);
  addBox(group, 0.12, 0.08, 0.03, P.accent, 'флажок-полотнище', 0.25, 1.18, -0.05);
  checkModel(group, 'Почтовый ящик');
  return bakeStatic(group);
}

// ===== Грибы: createMushrooms() — один большой и два маленьких =====
export function createMushrooms() {
  const group = new THREE.Group();
  group.name = 'грибы';
  const spec = [
    { x: 0, z: 0, stem: 0.24, r: 0.2, color: P.roofCoral },
    { x: 0.3, z: 0.1, stem: 0.15, r: 0.13, color: P.accent },
    { x: -0.2, z: 0.22, stem: 0.12, r: 0.1, color: P.roofCoral },
  ];
  for (const m of spec) {
    addPart(group, new THREE.CylinderGeometry(m.r * 0.38, m.r * 0.45, m.stem, 6), P.wallLight, 'ножка', m.x, m.stem / 2, m.z);
    const cap = addPart(group, new THREE.SphereGeometry(m.r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), m.color, 'шляпка',
      m.x, m.stem - 0.02, m.z);
    cap.scale.y = 0.75;
    [[0.35, 0.3], [-0.4, 0.15], [0.05, -0.45]].forEach(([dx, dz]) => {
      const px = dx * m.r;
      const pz = dz * m.r;
      const h = Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz)) * m.r * 0.75;
      addPart(group, new THREE.SphereGeometry(m.r * 0.16, 5, 4), P.white, 'пятнышко', m.x + px, m.stem - 0.02 + h, m.z + pz);
    });
  }
  checkModel(group, 'Грибы');
  return bakeStatic(group);
}

// ===== Камень: createRock() — большой валун и маленький рядом =====
export function createRock() {
  const group = new THREE.Group();
  group.name = 'камень';
  addPart(group, new THREE.CylinderGeometry(0.42, 0.55, 0.4, 6), P.stoneDark, 'валун низ', 0, 0.2, 0);
  addPart(group, new THREE.CylinderGeometry(0.2, 0.36, 0.3, 6), P.stone, 'валун верх', 0.04, 0.52, -0.02);
  addPart(group, new THREE.CylinderGeometry(0.2, 0.27, 0.24, 5), P.stoneDark, 'камешек', 0.65, 0.12, 0.1);
  checkModel(group, 'Камень');
  return bakeStatic(group);
}

// ===== Ступень лестницы: createStep(). Длинная сторона по x (поперёк дорожки) =====
// Нижняя часть закопана в склон, поэтому в воздухе она не повисает
export function createStep() {
  const group = new THREE.Group();
  group.name = 'ступень';
  addBox(group, 1.9, 0.5, 0.6, P.stoneDark, 'ступень', 0, 0.25, 0);
  addBox(group, 1.96, 0.08, 0.64, P.stone, 'верх ступени', 0, 0.46, 0);
  checkModel(group, 'Ступень');
  return bakeStatic(group);
}

// ===== Шезлонг: createLounger(). Спинка сзади (в -z), лицом смотрит в +z =====
export function createLounger() {
  const group = new THREE.Group();
  group.name = 'шезлонг';
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(group, 0.06, 0.28, 0.06, P.darkWood, 'ножка', sx * 0.3, 0.14, sz * 0.45);
    }
  }
  // Сиденье: три полосы
  const stripe = 1.0 / 3;
  for (let i = 0; i < 3; i++) {
    addBox(group, 0.7, 0.07, stripe, i % 2 ? P.wallLight : P.roofCoral, 'сиденье', 0, 0.31, -0.5 + stripe * (i + 0.5));
  }
  // Спинка на «шарнире» у заднего края сиденья
  const seatTop = 0.31 + 0.035;
  const back = addJoint(group, 'спинка', 0, seatTop, -0.5);
  back.rotation.x = 0.95;
  const SL = 0.27;
  for (let i = 0; i < 3; i++) {
    addBox(back, 0.7, 0.07, SL, i % 2 ? P.wallLight : P.roofCoral, 'спинка-полоса', 0, 0.035, -(i + 0.5) * SL);
  }
  checkModel(group, 'Шезлонг');
  return bakeStatic(group);
}

// ===== Пляжный зонтик: createUmbrella() =====
export function createUmbrella() {
  const POLE_H = 2.3;
  const group = new THREE.Group();
  group.name = 'зонтик';
  addPart(group, new THREE.CylinderGeometry(0.3, 0.34, 0.1, 8), P.stoneDark, 'подставка', 0, 0.05, 0);
  addPart(group, new THREE.CylinderGeometry(0.035, 0.035, POLE_H, 6), P.darkWood, 'шест', 0, POLE_H / 2, 0);
  // Купол из четырёх долек: две коралловые и две белые
  const CONE_H = 0.55;
  for (let k = 0; k < 4; k++) {
    const wedge = new THREE.ConeGeometry(1.35, CONE_H, 2, 1, false, (k * Math.PI) / 2, Math.PI / 2);
    addPart(group, wedge, k % 2 ? P.wallLight : P.roofCoral, 'долька купола', 0, POLE_H - 0.1 + CONE_H / 2, 0, true);
  }
  addPart(group, new THREE.SphereGeometry(0.07, 6, 5), P.gold, 'навершие', 0, POLE_H - 0.1 + CONE_H, 0);
  checkModel(group, 'Зонтик');
  return bakeStatic(group);
}

// ===== Дерево с качелями: createSwingTree(). Ветка с качелями уходит в +x =====
export function createSwingTree() {
  const group = new THREE.Group();
  group.name = 'дерево с качелями';
  const TRUNK_H = 2.7;
  addPart(group, new THREE.CylinderGeometry(0.2, 0.3, TRUNK_H, 7), P.darkWood, 'ствол', 0, TRUNK_H / 2, 0);
  addPart(group, new THREE.IcosahedronGeometry(1.6, 1), P.blossom, 'крона', 0, TRUNK_H + 0.8, 0);
  addPart(group, new THREE.IcosahedronGeometry(1.1, 1), P.blossomLight, 'крона малая', -1.0, TRUNK_H + 0.2, -0.3);

  // Толстая ветка в сторону
  const BRANCH_LEN = 2.4, BRANCH_Y = 2.35;
  const branch = addPart(group, new THREE.CylinderGeometry(0.09, 0.14, BRANCH_LEN, 6), P.darkWood, 'ветка',
    BRANCH_LEN / 2, BRANCH_Y, 0);
  branch.rotation.z = Math.PI / 2;

  // Две верёвки и доска-сиденье
  const ROPE_X = 2.0, ROPE_LEN = 1.7;
  const ropeTop = BRANCH_Y - 0.06;
  for (const sz of [-1, 1]) {
    addPart(group, new THREE.CylinderGeometry(0.02, 0.02, ROPE_LEN, 5), P.rope, 'верёвка',
      ROPE_X, ropeTop - ROPE_LEN / 2, sz * 0.3);
  }
  addBox(group, 0.3, 0.06, 0.75, P.woodLight, 'сиденье качелей', ROPE_X, ropeTop - ROPE_LEN + 0.0, 0);

  checkModel(group, 'Дерево с качелями');
  return bakeStatic(group);
}
