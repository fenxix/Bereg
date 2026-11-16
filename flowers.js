// flowers.js — цветы на лугу: их можно сорвать, а через пару минут они вырастают снова
import * as THREE from 'three';
import { sampleZonePoint } from './zones.js';
import { checkModel } from './models.js';

const FLOWER_COUNT = 16;      // сколько цветов на лугу
const SEPARATION = 1.8;       // минимальное расстояние между цветами
const PICKUP_R = 1.4;         // с какого расстояния можно сорвать
const REGROW_MS = 150000;     // через сколько цветок вырастет снова (2,5 минуты)
const GROW_SECONDS = 2;       // сколько он растёт

// Размеры модели (низ стебля стоит на y = 0)
const STEM_H = 0.42, STEM_R = 0.014;
const PETAL_R = 0.07, PETAL_COUNT = 5, PETAL_RING = 0.075;
const CENTER_R = 0.045;
const LEAF_Y = 0.15;
const PALETTE = [0xF4A6B8, 0xFFD87A, 0xFFF4E3, 0xC9A7E8, 0xE8836B];

function makeRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createFlowers({ scene, groundHeight, economy }) {
  const rand = makeRandom(77);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6FA05A, roughness: 0.85, flatShading: true });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xE8B04A, roughness: 0.7, flatShading: true });
  const petalMats = PALETTE.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true }));
  const stemGeo = new THREE.CylinderGeometry(STEM_R, STEM_R * 1.3, STEM_H, 5);
  const petalGeo = new THREE.SphereGeometry(PETAL_R, 6, 5);
  const centerGeo = new THREE.SphereGeometry(CENTER_R, 6, 5);
  const leafGeo = new THREE.SphereGeometry(0.06, 6, 4);

  function makeFlower(colorIndex) {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.name = 'стебель'; stem.position.y = STEM_H / 2;
    const leaf = new THREE.Mesh(leafGeo, stemMat);
    leaf.name = 'листик'; leaf.scale.set(1.8, 0.45, 0.9); leaf.position.set(0.06, LEAF_Y, 0);
    const head = new THREE.Group();
    head.name = 'головка'; head.position.y = STEM_H;
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.name = 'серединка'; center.position.y = 0.02;
    head.add(center);
    for (let i = 0; i < PETAL_COUNT; i++) {
      const a = (i / PETAL_COUNT) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMats[colorIndex]);
      petal.name = 'лепесток-' + i;
      petal.scale.set(1, 0.6, 1);
      petal.position.set(Math.cos(a) * PETAL_RING, 0.02, Math.sin(a) * PETAL_RING);
      head.add(petal);
    }
    group.add(stem, leaf, head);
    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    checkModel(group, 'цветок');
    return group;
  }

  // Расставляем цветы по лугу
  const spots = [];
  for (let i = 0; i < FLOWER_COUNT * 6 && spots.length < FLOWER_COUNT; i++) {
    const p = sampleZonePoint('meadow', rand, groundHeight, {
      margin: 1.5, minGround: 0.15, maxGround: 4,
      avoid: spots.map((s) => ({ x: s.x, z: s.z, distance: SEPARATION })),
    });
    if (p) spots.push(p);
  }
  const items = spots.map((s, i) => {
    const group = makeFlower(i % PALETTE.length);
    group.name = 'цветок-' + i;
    group.position.set(s.x, s.y, s.z);
    group.rotation.y = rand() * Math.PI * 2;
    scene.add(group);
    return { ...s, group, ready: true, grow: 1, phase: rand() * Math.PI * 2, regrowAt: 0 };
  });

  let nearby = null;

  // Каждый кадр: качаем цветы, растим выросшие заново и ищем ближайший к игроку.
  // Возвращает true, если рядом есть цветок, который можно сорвать.
  function update(dt, t, p) {
    const now = performance.now();
    nearby = null;
    let best = PICKUP_R;
    for (const item of items) {
      if (!item.ready) {
        if (now >= item.regrowAt) { item.ready = true; item.grow = 0.01; item.group.visible = true; }
        else continue;
      }
      if (item.grow < 1) { item.grow = Math.min(1, item.grow + dt / GROW_SECONDS); item.group.scale.setScalar(item.grow); }
      item.group.rotation.z = Math.sin(t * 1.6 + item.phase) * 0.07;
      const d = Math.hypot(p.x - item.x, p.z - item.z);
      if (item.grow >= 0.9 && d < best) { best = d; nearby = item; }
    }
    return nearby !== null;
  }

  function collect() {
    if (!nearby) return null;
    if (!economy.add('flower')) return { error: 'Сумка заполнена' };
    nearby.ready = false;
    nearby.group.visible = false;
    nearby.regrowAt = performance.now() + REGROW_MS;
    nearby = null;
    return { item: 'flower' };
  }

  return { update, collect };
}
