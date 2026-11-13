// main.js — запуск игры: сцена, рендерер, героиня и игровой цикл
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createHeroine } from './models.js';
import { createPlayer } from './player.js';

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
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

// Мир (с городком), героиня и игрок (управление + камера)
const world = createWorld(scene);
const heroine = createHeroine();
scene.add(heroine);
const player = createPlayer({
  model: heroine,
  camera,
  domElement: renderer.domElement,
  groundHeight: world.surfaceHeight, // земля плюс настил пирса
  colliders: world.colliders,        // дома, деревья, фонари, скамейки, фонтан
  start: world.start,                // место, где появляется героиня
});

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// Игровой цикл: каждый кадр обновляем игрока и мир, потом рисуем сцену
let frames = 0;
let lastFpsTime = performance.now();
let prevTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);

  const dt = (now - prevTime) / 1000;
  prevTime = now;

  player.update(dt);
  world.sky.position.copy(camera.position); // небо всегда вокруг камеры
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
