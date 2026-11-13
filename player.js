// player.js — управление героиней и камера от третьего лица
import * as THREE from 'three';
import { animateCharacter } from './models.js';

export function createPlayer({ model, camera, domElement, groundHeight }) {
  const WALK_SPEED = 3.5;
  const RUN_SPEED = 6;

  const pos = new THREE.Vector3(0, 0, 10); // где стоит героиня
  let yaw = 0;        // камера вокруг героини
  let pitch = 0.4;    // наклон камеры
  let distance = 8;   // расстояние до героини
  let walkPhase = 0;
  let moveBlend = 0;  // плавный переход «стоит» <-> «идёт»
  model.rotation.y = Math.PI;

  // --- Клавиатура ---
  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // --- Джойстик (на телефоне) ---
  const joy = document.getElementById('joystick');
  const knob = document.getElementById('stick');
  const JOY_R = 50;
  const joyVec = { x: 0, y: 0 };
  let joyId = null;

  function moveJoy(e) {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyVec.x = dx / JOY_R;
    joyVec.y = -dy / JOY_R;
  }
  function endJoy(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joyVec.x = 0;
    joyVec.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  }
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    moveJoy(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  // --- Камера: тянем пальцем или мышью, колесо — приближение ---
  let dragId = null;
  let lastX = 0;
  let lastY = 0;
  domElement.addEventListener('pointerdown', (e) => {
    if (dragId !== null) return;
    dragId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    domElement.setPointerCapture(e.pointerId);
  });
  domElement.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    yaw -= (e.clientX - lastX) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * 0.005, 0.1, 1.2);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = (e) => { if (e.pointerId === dragId) dragId = null; };
  domElement.addEventListener('pointerup', endDrag);
  domElement.addEventListener('pointercancel', endDrag);
  domElement.addEventListener('wheel', (e) => {
    distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.01, 4, 14);
  }, { passive: true });

  // В море не заходим: стоять можно, пока земля не ниже уровня воды
  const canStand = (x, z) => groundHeight(x, z) > -0.05;

  function update(dt) {
    dt = Math.min(dt, 0.05);

    // 1. Что нажато
    let ix = joyVec.x;
    let iy = joyVec.y;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const amount = len > 0.1 ? Math.min(1, len) : 0;

    // 2. Направление относительно камеры: «вперёд» — от камеры к героине
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const dx = -sinY * iy + cosY * ix;
    const dz = -cosY * iy - sinY * ix;

    // 3. Шаг (если упёрлись в воду — скользим вдоль берега)
    if (amount > 0) {
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const step = (running ? RUN_SPEED : WALK_SPEED) * dt;
      const nx = pos.x + dx * step;
      const nz = pos.z + dz * step;
      if (canStand(nx, nz)) { pos.x = nx; pos.z = nz; }
      else if (canStand(nx, pos.z)) pos.x = nx;
      else if (canStand(pos.x, nz)) pos.z = nz;

      // Поворачиваем героиню лицом по ходу движения (по кратчайшему пути)
      let diff = Math.atan2(dx, dz) - model.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      model.rotation.y += diff * Math.min(1, dt * 12);
    }
    pos.y = groundHeight(pos.x, pos.z);
    model.position.copy(pos);

    // 4. Анимация ходьбы
    moveBlend += (amount - moveBlend) * Math.min(1, dt * 10);
    walkPhase += dt * 10 * (0.5 + moveBlend);
    animateCharacter(model, walkPhase, moveBlend);

    // 5. Камера за спиной, не уходит под землю
    const target = new THREE.Vector3(pos.x, pos.y + 1.2, pos.z);
    const cosP = Math.cos(pitch);
    const cx = pos.x + sinY * cosP * distance;
    const cz = pos.z + cosY * cosP * distance;
    const cy = target.y + Math.sin(pitch) * distance;
    camera.position.set(cx, Math.max(cy, groundHeight(cx, cz) + 0.6, 0.6), cz);
    camera.lookAt(target);
  }

  return { update };
}
