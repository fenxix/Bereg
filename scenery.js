// scenery.js — мелкий декор для заполнения острова: кусты и пучки травы.
// Модели собраны по тем же правилам, что и в models.js: на y = 0, детали касаются, flatShading, checkModel, bakeStatic.
import * as THREE from 'three';
import { bakeStatic, checkModel } from './models.js';

const COLORS = {
  bush: 0x7FB069,
  bushLight: 0x95C47C,
  bushDark: 0x6A9A58,
  berryPink: 0xF4A6B8,
  berryGold: 0xF7D774,
  blade: 0x8DBA6F,
  bladeLight: 0xA8D08D,
};

// Один материал на цвет (общий кэш)
const materials = new Map();
function getMaterial(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0 }));
  }
  return materials.get(color);
}

function addPart(group, geometry, color, name, x, y, z) {
  const mesh = new THREE.Mesh(geometry, getMaterial(color));
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

// Куст: три пухлых комка. variant 1 — цветущий, с ягодами.
const BUSH_SQUASH = 0.78;     // насколько комки приплюснуты по высоте
const BERRY_R = 0.09;
export function createBush(variant = 0) {
  const group = new THREE.Group();
  group.name = 'куст-' + variant;
  const blob = (r, x, z, color, name) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    geo.scale(1, BUSH_SQUASH, 1);
    addPart(group, geo, color, name, x, r * BUSH_SQUASH, z);
  };
  blob(0.62, 0, 0, COLORS.bush, 'куст центр');
  blob(0.45, 0.5, 0.15, COLORS.bushLight, 'куст правый');
  blob(0.4, -0.46, -0.12, COLORS.bushDark, 'куст левый');
  if (variant === 1) {
    // ягоды сидят на поверхности центрального комка
    [[0.3, 0.8, 0.35, COLORS.berryPink], [-0.25, 0.8, 0.4, COLORS.berryGold],
     [0.1, 0.8, -0.45, COLORS.berryPink], [0.45, 0.8, -0.1, COLORS.berryGold]].forEach(([x, y, z, color], i) => {
      addPart(group, new THREE.IcosahedronGeometry(BERRY_R, 0), color, 'ягода-' + i, x, y, z);
    });
  }
  checkModel(group, 'Куст ' + variant);
  return bakeStatic(group);
}

// Пучок травы: пять тонких стебельков, слегка наклонённых
export function createGrassTuft() {
  const group = new THREE.Group();
  group.name = 'пучок травы';
  [[0, 0, 0.42, 0, 0, COLORS.blade], [0.1, 0.05, 0.34, 0.15, -0.1, COLORS.bladeLight],
   [-0.09, 0.04, 0.38, -0.12, 0.1, COLORS.blade], [0.04, -0.1, 0.3, 0.1, 0.2, COLORS.bladeLight],
   [-0.06, -0.08, 0.26, -0.2, -0.1, COLORS.blade]].forEach(([x, z, h, lean, lean2, color], i) => {
    const blade = addPart(group, new THREE.ConeGeometry(0.06, h, 4), color, 'стебель-' + i, x, h / 2, z);
    blade.rotation.z = lean;
    blade.rotation.x = lean2;
    blade.castShadow = false;
  });
  checkModel(group, 'Пучок травы');
  return bakeStatic(group);
}
