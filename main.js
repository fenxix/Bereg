// main.js — запуск игры: сцена, рендерер, камера и игровой цикл
import * as THREE from 'three';
import { createWorld } from './world.js';

const container = document.getElementById('game');
const fpsLabel = document.getElementById('fps');

// Рендерер — он рисует картинку на экран. Здесь же включаем мягкие тени.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Сцена и камера
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);

// Мир: небо, остров, море, свет, туман (всё в world.js)
const world = createWorld(scene);

// Камера пока статичная: смотрит на остров сверху сбоку.
const CAMERA_TILT = THREE.MathUtils.degToRad(25); // угол подъёма камеры
const ISLAND_HALF_WIDTH = 34; // остров с запасом должен влезать по ширине

function fitCamera() {
  // На узком телефонном экране камера отъезжает дальше, чтобы остров влез
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanHalfH = tanHalfV * camera.aspect;
  const distance = Math.max(68, ISLAND_HALF_WIDTH / tanHalfH);

  camera.position.set(0, distance * Math.sin(CAMERA_TILT), distance * Math.cos(CAMERA_TILT));
  // Смотрим чуть дальше острова — так вверху экрана виден горизонт и небо
  camera.lookAt(0, 0, -distance * 0.6);

  world.sky.position.copy(camera.position);
  scene.fog.near = distance * 0.9;
  scene.fog.far = distance + 150;
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitCamera();
}
window.addEventListener('resize', onResize);
onResize();

// Игровой цикл: каждый кадр обновляем мир и рисуем сцену
let frames = 0;
let lastFpsTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);

  world.update(now / 1000);
  renderer.render(scene, camera);

  frames++;
  if (now - lastFpsTime >= 500) {
    fpsLabel.textContent = 'FPS: ' + Math.round((frames * 1000) / (now - lastFpsTime));
    frames = 0;
    lastFpsTime = now;
  }
}
requestAnimationFrame(loop);
