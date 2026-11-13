// ui.js — экран: режим «боком» на телефоне и полноэкранный режим
const touchQuery = window.matchMedia('(pointer: coarse)');
let rotated = false;

// Размер игры в пикселях (в повёрнутом режиме ширина и высота меняются местами)
export function getViewSize() {
  return rotated
    ? { width: window.innerHeight, height: window.innerWidth }
    : { width: window.innerWidth, height: window.innerHeight };
}

// Переводит сдвиг пальца на экране в сдвиг внутри повёрнутой игры
export function toViewDelta(dx, dy) {
  return rotated ? { x: dy, y: -dx } : { x: dx, y: dy };
}

export function initScreen(onChange) {
  const rootStyle = document.documentElement.style;

  function update() {
    rootStyle.setProperty('--sw', window.innerWidth + 'px');
    rootStyle.setProperty('--sh', window.innerHeight + 'px');
    // Телефон держат вертикально — поворачиваем всю игру «боком»
    rotated = touchQuery.matches && window.innerHeight > window.innerWidth;
    document.body.classList.toggle('rotated', rotated);
    onChange();
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();

  // Кнопка «во весь экран» (на Android заодно просит горизонтальный режим)
  const button = document.getElementById('fs');
  if (!document.documentElement.requestFullscreen) {
    button.style.display = 'none';
    return;
  }
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      }
    } catch (error) {
      // не все устройства это разрешают — ничего страшного
    }
  });
}
