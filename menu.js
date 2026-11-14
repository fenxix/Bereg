// menu.js — главное меню: экраны, настройки и запуск игры
// Меню само ничего не знает про Three.js. Оно только говорит main.js: «игрок нажал Играть» или «меню открыли снова».

const STORAGE_KEY = 'tihiy-bereg-settings';
const DEFAULTS = { sound: true, fps: true, quality: 'high' };
const touchQuery = window.matchMedia('(pointer: coarse)');

let current = { ...DEFAULTS };

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (error) {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // в приватном режиме браузер может не разрешить — не страшно
  }
}

// Когда в игре появится звук, он должен спрашивать у меню: можно ли играть
export function isSoundOn() {
  return current.sound;
}

// На телефоне просим полный экран и горизонтальный режим (на iPhone этого нет, там работает подсказка «поверни телефон»)
async function enterFullscreenLandscape() {
  if (!touchQuery.matches) return;
  try {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch (error) {
    // не все телефоны это разрешают
  }
}

export function createMenu({ onPlay, onPause, onSettingsChange }) {
  const body = document.body;
  const screens = {
    home: document.getElementById('menu-home'),
    help: document.getElementById('menu-help'),
    settings: document.getElementById('menu-settings'),
  };
  const playButton = document.getElementById('menu-play');
  const playLabel = playButton.querySelector('.menu-label');
  let ready = false;
  let started = false;
  let currentScreen = 'home';

  current = loadSettings();

  function showScreen(name) {
    currentScreen = name;
    for (const key of Object.keys(screens)) screens[key].hidden = key !== name;
  }

  function refreshPlayLabel() {
    playLabel.textContent = !ready ? 'Загрузка…' : started ? 'Продолжить' : 'Играть';
  }

  function refreshSettingsUi() {
    for (const button of document.querySelectorAll('[data-toggle]')) {
      const on = current[button.dataset.toggle];
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? 'Вкл' : 'Выкл';
    }
    for (const button of document.querySelectorAll('[data-quality]')) {
      button.setAttribute('aria-pressed', String(current.quality === button.dataset.quality));
    }
    body.classList.toggle('hide-fps', !current.fps);
  }

  function changeSetting(key, value) {
    current = { ...current, [key]: value };
    saveSettings(current);
    refreshSettingsUi();
    onSettingsChange(current);
  }

  function open() {
    showScreen('home');
    body.classList.add('in-menu');
    refreshPlayLabel();
    if (started) onPause();
  }

  function play() {
    if (!ready) return;
    enterFullscreenLandscape();   // должно вызываться прямо из нажатия, поэтому раньше всего остального
    body.classList.remove('in-menu');
    started = true;
    onPlay();
  }

  playButton.addEventListener('click', play);
  document.getElementById('menu-help-open').addEventListener('click', () => showScreen('help'));
  document.getElementById('menu-settings-open').addEventListener('click', () => showScreen('settings'));
  document.getElementById('menu-open').addEventListener('click', open);
  for (const button of document.querySelectorAll('[data-back]')) {
    button.addEventListener('click', () => showScreen('home'));
  }
  for (const button of document.querySelectorAll('[data-toggle]')) {
    button.addEventListener('click', () => changeSetting(button.dataset.toggle, !current[button.dataset.toggle]));
  }
  for (const button of document.querySelectorAll('[data-quality]')) {
    button.addEventListener('click', () => changeSetting('quality', button.dataset.quality));
  }

  // Esc: открыть меню, вернуться назад или продолжить игру
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape' || event.repeat) return;
    if (!body.classList.contains('in-menu')) open();
    else if (currentScreen !== 'home') showScreen('home');
    else if (started) play();
  });

  refreshSettingsUi();
  onSettingsChange(current);
  refreshPlayLabel();

  return {
    // main.js зовёт это, когда мир построен и можно играть
    setReady() {
      ready = true;
      playButton.disabled = false;
      refreshPlayLabel();
    },
  };
}
