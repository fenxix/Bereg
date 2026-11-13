// player.js — управление героиней и камера от третьего лица
import * as THREE from 'three';
import { animateCharacter } from './models.js';

// groundHeight здесь — функция высоты поверхности из мира (земля плюс настил пирса).
// colliders — список препятствий: круги { kind: 'circle', x, z, r }
// и повёрнутые прямоугольники { kind: 'rect', x, z, hw, hd, rot }.
export function createPlayer({ model, camera, domElement, groundHeight, colliders = [], start = { x: 0, z: 10 } }) {
  const WALK_SPEED = 3.5;
  const RUN_SPEED = 6;
  const PLAYER_R = 0.35; // «толщина» героини для столкновений

  const pos = new THREE.Vector3(start.x, 0, start.z); // где стоит героиня
  pos.y = groundHeight(pos.x, pos.z);
  let yaw = 0;        // камера вокруг героини
  let pitch = 0.4;    // наклон камеры
  let distance = 8;   // расстояние до героини
  let walkPhase = 0;
  let moveBlend = 0;  // плавный переход «стоит» <-> «идёт»
  const desiredCamera = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  let cameraReady = false;
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

  // В море не заходим: стоять можно, пока поверхность не ниже уровня воды
  const canStand = (x, z) => groundHeight(x, z) > -0.05;

  // Выталкиваем героиню из домов, деревьев, фонарей, скамеек и фонтана.
  // Если подошла вплотную — она не застревает, а скользит вдоль препятствия.
  function resolveCollisions() {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        if (c.kind === 'circle') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const dist = Math.hypot(dx, dz);
          const min = c.r + PLAYER_R;
          if (dist < min) {
            if (dist > 0.0001) {
              pos.x = c.x + (dx / dist) * min;
              pos.z = c.z + (dz / dist) * min;
            } else {
              pos.x = c.x + min;
            }
          }
        } else {
          // Прямоугольник повёрнут: переводим точку в его собственные координаты
          const cos = Math.cos(c.rot);
          const sin = Math.sin(c.rot);
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const lx = dx * cos - dz * sin;
          const lz = dx * sin + dz * cos;
          const nx = Math.max(-c.hw, Math.min(c.hw, lx)); // ближайшая точка прямоугольника
          const nz = Math.max(-c.hd, Math.min(c.hd, lz));
          const ox = lx - nx;
          const oz = lz - nz;
          const dist = Math.hypot(ox, oz);
          if (dist >= PLAYER_R) continue;

          let pushX = 0;
          let pushZ = 0;
          if (dist > 0.0001) {
            const k = (PLAYER_R - dist) / dist;
            pushX = ox * k;
            pushZ = oz * k;
          } else {
            // Центр героини оказался внутри — выталкиваем через ближайшую сторону
            const px = c.hw - Math.abs(lx);
            const pz = c.hd - Math.abs(lz);
            if (px < pz) pushX = (lx >= 0 ? 1 : -1) * (px + PLAYER_R);
            else pushZ = (lz >= 0 ? 1 : -1) * (pz + PLAYER_R);
          }
          // Переводим выталкивание обратно в мировые координаты
          pos.x += pushX * cos + pushZ * sin;
          pos.z += -pushX * sin + pushZ * cos;
        }
      }
    }
  }

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

    // 3. Шаг (если упёрлись в воду — скользим вдоль берега, а в дома и деревья — упираемся)
    if (amount > 0) {
      const oldX = pos.x;
      const oldZ = pos.z;
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const step = (running ? RUN_SPEED : WALK_SPEED) * dt;
      const nx = pos.x + dx * step;
      const nz = pos.z + dz * step;
      if (canStand(nx, nz)) { pos.x = nx; pos.z = nz; }
      else if (canStand(nx, pos.z)) pos.x = nx;
      else if (canStand(pos.x, nz)) pos.z = nz;

      resolveCollisions();
      // Если выталкивание привело в воду — возвращаемся на прошлое место
      if (!canStand(pos.x, pos.z)) { pos.x = oldX; pos.z = oldZ; }

      // Поворачиваем героиню лицом по ходу движения (по кратчайшему пути)
      let diff = Math.atan2(dx, dz) - model.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      model.rotation.y += diff * Math.min(1, dt * 12);
    }

    // Высота плавно меняется: при выходе на пирс и на крыльцо нет «рывка»
    const targetY = groundHeight(pos.x, pos.z);
    pos.y += (targetY - pos.y) * Math.min(1, dt * 14);
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
    desiredCamera.set(cx, Math.max(cy, groundHeight(cx, cz) + 0.6, 0.6), cz);
    // Плавное следование не телепортирует камеру при повороте или движении.
    if (!cameraReady) {
      camera.position.copy(desiredCamera);
      smoothLook.copy(target);
      cameraReady = true;
    } else {
      camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5.5));
      smoothLook.lerp(target, 1 - Math.exp(-dt * 7.5));
    }
    const breathing = Math.sin(walkPhase * 0.5) * 0.018 * (1 - moveBlend);
    smoothLook.y += breathing;
    camera.lookAt(smoothLook);
    camera.rotateZ(Math.sin(walkPhase) * 0.004 * moveBlend);
  }

  return { update };
}
