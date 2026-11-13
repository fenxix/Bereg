// models.js — генераторы моделей (героиня) и проверка checkModel
import * as THREE from 'three';

// ===== Палитра: один материал на цвет, создаём один раз =====
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

// Добавляет деталь в родителя (с тенью и именем для проверки)
function addPart(parent, geometry, color, name, x = 0, y = 0, z = 0, doubleSided = false) {
  const mesh = new THREE.Mesh(geometry, getMaterial(color, doubleSided));
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Сустав: пустая группа в точке сустава, деталь висит на ней и вращается вокруг неё
function addJoint(parent, name, x, y, z) {
  const joint = new THREE.Group();
  joint.name = name;
  joint.position.set(x, y, z);
  parent.add(joint);
  return joint;
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
