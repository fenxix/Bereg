// zones.js — зоны острова и дорожки между ними.
// Здесь только данные и пара простых функций: Three.js не нужен.
// Координаты: x — на восток, z — на юг. Центр острова (0, 0) — площадь с фонтаном.

// Зона: имя, центр (x, z), радиус и цвет метки (метка понадобится для мини-карты).
export const ZONES = [
  { id: 'plaza',      name: 'Площадь',         x: 0,   z: 0,   r: 6,  color: 0xE6C79C },
  { id: 'harbor',     name: 'Рыбацкая гавань', x: 0,   z: 26,  r: 15, color: 0x6EC1D6 },
  { id: 'market',     name: 'Торговая улица',  x: 27,  z: -3,  r: 10, color: 0xF2B880 },
  { id: 'quarter',    name: 'Жилой квартал',   x: -26, z: 8,   r: 12, color: 0xF4A6B8 },
  { id: 'meadow',     name: 'Цветочный луг',   x: 21,  z: -23, r: 10, color: 0xF7D774 },
  { id: 'pines',      name: 'Сосновая роща',   x: -6,  z: -31, r: 12, color: 0x7FB069 },
  { id: 'lighthouse', name: 'Маяк на скале',   x: -27, z: -18, r: 10, color: 0xB7A6E0 },
  { id: 'cove',       name: 'Тихая бухта',     x: 24,  z: 20,  r: 10, color: 0xF3DDB0 },
];

export function zoneById(id) {
  return ZONES.find((zone) => zone.id === id) || null;
}

// В какой зоне стоит точка (x, z). Если точка в нескольких, берём ту, к центру которой она ближе всего.
// Вне всех зон вернёт null.
export function zoneAt(x, z) {
  let best = null;
  let bestK = Infinity;
  for (const zone of ZONES) {
    const k = Math.hypot(x - zone.x, z - zone.z) / zone.r;
    if (k < 1 && k < bestK) { best = zone; bestK = k; }
  }
  return best;
}

// Дорожки: ломаные линии от площади к каждой зоне (и тропинка-петля в роще).
// columns — сколько плиток в ширину. Первая точка у края площади.
// Дорога к пирсу (прямая на юг) строится в world.js отдельно, потому что её конец зависит от берега.
export const PATHS = [
  { id: 'to-market',     to: 'market',     columns: 2, points: [[4.3, 1.4], [9.1, 2.9], [15, 2.5], [21, -1], [33, -3]] },
  { id: 'to-quarter',    to: 'quarter',    columns: 2, points: [[-4.3, 0.95], [-9.3, 2.0], [-17, 4], [-24, 7], [-33, 8]] },
  { id: 'to-meadow',     to: 'meadow',     columns: 2, points: [[3.8, -2.2], [8.2, -4.75], [14, -11], [19, -18], [21, -23]] },
  { id: 'to-pines',      to: 'pines',      columns: 2, points: [[0.6, -4.4], [1.2, -9.4], [-1, -17], [-4, -25], [-6, -31]] },
  { id: 'to-lighthouse', to: 'lighthouse', columns: 2, points: [[-3.2, -3.0], [-7, -6.4], [-14, -12], [-21, -14], [-26, -17]] },
  { id: 'to-cove',       to: 'cove',       columns: 2, points: [[0, 16.5], [8, 17.5], [16, 18.5], [24, 20]] },
  // Узкая тропинка петлёй через сосновую рощу (одна плитка в ширину)
  { id: 'pines-trail',   to: 'pines',      columns: 1, points: [[-4, -25], [2, -28], [5, -33], [1, -38], [-7, -38], [-13, -34], [-11, -29], [-6, -31]] },
];

// Расстояние от точки до ближайшей дорожки (нужно, чтобы не ставить деревья на плитки)
export function distToPaths(x, z) {
  let best = Infinity;
  for (const path of PATHS) {
    const p = path.points;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

// ===========================================================================
//  РАССТАНОВКА ОБЪЕКТОВ ПО ЗОНАМ
//  Здесь только числа: где что стоит. Моделей и Three.js нет, поэтому это можно проверить в обычном node.
//  Всё считается формулами и «семечком» (rand), так что у всех игроков остров одинаковый.
//  Углы rotY: модель смотрит «лицом» в +z, а rotY = atan2(вперёд.x, вперёд.z).
// ===========================================================================

// Точка на дорожке: s — сколько единиц пройти от её начала. Возвращает точку и направление (tx, tz).
function pathFrame(path, s) {
  const p = path.points;
  let left = Math.max(0, s);
  for (let i = 0; i < p.length - 1; i++) {
    const dx = p[i + 1][0] - p[i][0];
    const dz = p[i + 1][1] - p[i][1];
    const len = Math.hypot(dx, dz);
    if (left <= len || i === p.length - 2) {
      const k = left / len;
      return { x: p[i][0] + dx * k, z: p[i][1] + dz * k, tx: dx / len, tz: dz / len };
    }
    left -= len;
  }
  return null;
}

function pathLength(path) {
  let sum = 0;
  for (let i = 0; i < path.points.length - 1; i++) {
    sum += Math.hypot(path.points[i + 1][0] - path.points[i][0], path.points[i + 1][1] - path.points[i][1]);
  }
  return sum;
}

const facing = (fx, fz) => Math.atan2(fx, fz);

// env: groundHeight, rand, pier, blocked(x, z) — «сюда нельзя» (площадь, дорога к пирсу),
//      reserved — уже занятые круги { x, z, r } (дома вокруг площади)
export function layoutZones(env) {
  const { groundHeight, rand, pier, blocked, reserved = [] } = env;
  const taken = reserved.map((c) => ({ ...c }));

  const out = {
    houses: [],        // { x, z, rotY, variant }
    hut: null,         // { x, z, rotY }
    stalls: [], nets: [], barrels: [], crates: [], boats: [],
    fences: [], mailboxes: [], lamps: [],
    trees: [],         // { x, z, type, scale, scaleY, rotY }
    mushrooms: [], rocks: [], flowers: [], steps: [],
    loungers: [], umbrellas: [], benches: [],
    swing: null, lighthouse: null,
    colliders: [],     // { kind: 'circle' | 'rect', ... }
    doorPaths: [],     // короткие дорожки от крыльца к улице: { ax, az, bx, bz }
  };

  // ---- Помощники ----
  const land = (x, z, min = 0.45) => groundHeight(x, z) >= min;
  const free = (x, z, r) => !blocked(x, z) && !taken.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r);
  const take = (x, z, r) => taken.push({ x, z, r });
  // Ровное ли место: высота в нескольких точках вокруг почти одинаковая
  const level = (x, z, rad, tol = 0.35, minH = 0.3) => {
    const h = groundHeight(x, z);
    for (let a = 0; a < 6.28; a += 1.05) {
      const hh = groundHeight(x + Math.cos(a) * rad, z + Math.sin(a) * rad);
      if (Math.abs(hh - h) > tol || hh < minH) return false;
    }
    return true;
  };
  const circle = (x, z, r) => out.colliders.push({ kind: 'circle', x, z, r });
  const rect = (x, z, hw, hd, rot) => out.colliders.push({ kind: 'rect', x, z, hw, hd, rot });
  const zone = (id) => ZONES.find((q) => q.id === id);

  // ---------------------------------------------------------------------
  // ЖИЛОЙ КВАРТАЛ: дома по обе стороны дорожки, заборчики, почтовые ящики
  // ---------------------------------------------------------------------
  {
    const path = PATHS.find((q) => q.id === 'to-quarter');
    const SIDE = 6.8;                   // от оси дорожки до центра дома
    const FENCE_OFF = 2.1;              // от оси дорожки до заборчика
    const GATE = 1.35;                  // половина ширины калитки
    const SIZE = [{ w: 4.6, d: 3.8 }, { w: 4.2, d: 4.2 }, { w: 3.6, d: 3.6 }];
    const doors = [];
    const total = pathLength(path);
    // Идём вдоль дорожки и ставим дом, как только находится свободное ровное место
    for (const side of [1, -1]) {
      let n = side === 1 ? 0 : 1;                       // чтобы варианты домов чередовались
      for (let s = 9.5; s <= total - 1; s += 0.5) {
        const f = pathFrame(path, s);
        const nx = -f.tz * side;
        const nz = f.tx * side;
        const x = f.x + nx * SIDE;
        const z = f.z + nz * SIDE;
        if (!land(x, z, 0.5) || !level(x, z, 2.6, 0.3) || !free(x, z, 2.7)) continue;
        const variant = n++ % 3;
        const rotY = facing(-nx, -nz);                  // дверь смотрит на дорожку
        out.houses.push({ x, z, rotY, variant });
        take(x, z, 2.7);
        const size = SIZE[variant];
        rect(x, z, size.w / 2 + 0.05, size.d / 2 + 0.05, rotY);
        // крыльцо → дорожка
        const reach = size.d / 2 + 0.08 + 0.84 + 0.15;
        out.doorPaths.push({ ax: x - nx * reach, az: z - nz * reach, bx: f.x + nx * 0.9, bz: f.z + nz * 0.9 });
        doors.push({ s, side });
      }
    }
    // заборчики вдоль дорожки по обеим сторонам, с калитками напротив дверей
    for (const side of [1, -1]) {
      for (let s = 9; s <= total - 3; s += 1.5) {
        if (doors.some((d) => d.side === side && Math.abs(d.s - s) < GATE + 0.05)) continue;
        const f = pathFrame(path, s);
        const x = f.x - f.tz * side * FENCE_OFF;
        const z = f.z + f.tx * side * FENCE_OFF;
        if (!land(x, z, 0.5) || !free(x, z, 0.1)) continue;
        const rotY = Math.atan2(f.tx, f.tz) + Math.PI / 2;  // длинной стороной вдоль дорожки
        out.fences.push({ x, z, rotY });
        rect(x, z, 0.8, 0.12, rotY);
      }
    }
    // почтовые ящики у калиток (со стороны улицы)
    for (const d of doors) {
      const f = pathFrame(path, d.s + GATE + 0.45);
      const x = f.x - f.tz * d.side * (FENCE_OFF - 0.55);
      const z = f.z + f.tx * d.side * (FENCE_OFF - 0.55);
      if (!land(x, z, 0.5)) continue;
      out.mailboxes.push({ x, z, rotY: facing(f.tz * d.side, -f.tx * d.side) });
      circle(x, z, 0.2);
    }
    // три фонаря вдоль улицы
    for (const s of [13.5, 19.5, 25.5]) {
      const f = pathFrame(path, s);
      const x = f.x - f.tz * 1.6;
      const z = f.z + f.tx * 1.6;
      if (land(x, z, 0.5)) { out.lamps.push({ x, z }); take(x, z, 0.5); }
    }
  }

  // ---------------------------------------------------------------------
  // ТОРГОВАЯ УЛИЦА: четыре лавки лицом к улице, ящики и бочки
  // ---------------------------------------------------------------------
  {
    const path = PATHS.find((q) => q.id === 'to-market');
    const OFF = 3.7;
    for (const side of [1, -1]) {
      for (const s of [21.5, 27.5]) {
        const f = pathFrame(path, s);
        const nx = -f.tz * side;
        const nz = f.tx * side;
        const x = f.x + nx * OFF;
        const z = f.z + nz * OFF;
        if (!land(x, z, 0.5) || !free(x, z, 1.7)) continue;
        const rotY = facing(-nx, -nz);
        out.stalls.push({ x, z, rotY });
        take(x, z, 1.7);
        rect(x, z, 1.25, 0.85, rotY);
        // ящики и бочка сбоку от лавки (вдоль дорожки)
        const sx = f.tx * 2.0;
        const sz = f.tz * 2.0;
        out.crates.push({ x: x + sx, z: z + sz, rotY: rotY + 0.2, lift: 0 });
        out.crates.push({ x: x + sx + 0.05, z: z + sz, rotY: rotY - 0.3, lift: 0.6, scale: 0.9 });
        circle(x + sx, z + sz, 0.5);
        out.barrels.push({ x: x - sx * 0.95, z: z - sz * 0.95, scale: 1 });
        circle(x - sx * 0.95, z - sz * 0.95, 0.4);
        take(x + sx, z + sz, 0.6);
        take(x - sx * 0.95, z - sz * 0.95, 0.5);
      }
    }
    for (const s of [19.5, 29.5]) {
      const f = pathFrame(path, s);
      const x = f.x - f.tz * 1.7;
      const z = f.z + f.tx * 1.7;
      if (land(x, z, 0.5)) { out.lamps.push({ x, z }); take(x, z, 0.5); }
    }
  }

  // ---------------------------------------------------------------------
  // РЫБАЦКАЯ ГАВАНЬ: домик рыбака, сети, бочки, ящики и лодки у берега
  // ---------------------------------------------------------------------
  {
    const spotOk = (x, z, r) => land(x, z, 0.2) && level(x, z, r, 0.3, 0.05) && free(x, z, r);
    // домик на западном берегу бухты, дверью к воде
    for (const [x, z] of [[-17, 24], [-17.5, 27], [-16.5, 21.5], [-18, 29]]) {
      if (!land(x, z, 0.5) || !level(x, z, 2.2, 0.3) || !free(x, z, 2.2)) continue;
      out.hut = { x, z, rotY: Math.PI / 2 };
      take(x, z, 2.8);
      rect(x, z, 1.75, 1.55, Math.PI / 2);
      break;
    }
    // сети сушатся вдоль берега: каждая стойка вытянута вдоль воды
    for (const [x, z] of [[-12.6, 31], [-12.6, 35.5], [12.6, 27.5], [13, 32.5]]) {
      if (!spotOk(x, z, 1.4)) continue;
      out.nets.push({ x, z, rotY: Math.PI / 2 });
      take(x, z, 1.5);
      rect(x, z, 0.35, 1.25, 0);     // перекладина вытянута вдоль z
    }
    // бочки и ящики у домика, у сетей и у начала пирса
    const clusters = [
      [-13.4, 26.5, 3], [-13.4, 33.3, 2], [13.2, 30, 3], [3.6, 19.8, 3], [-3.8, 19.4, 2],
    ];
    for (const [cx, cz, n] of clusters) {
      for (let i = 0; i < n; i++) {
        const x = cx + Math.cos(i * 2.2 + cx) * 0.75;
        const z = cz + Math.sin(i * 2.2 + cx) * 0.75;
        if (!spotOk(x, z, 0.4)) continue;
        take(x, z, 0.45);
        circle(x, z, 0.4);
        if (i === n - 1 && n > 2) {
          out.crates.push({ x, z, rotY: rand() * 3, lift: 0 });
          out.crates.push({ x, z, rotY: rand() * 3, lift: 0.6, scale: 0.9 });
        } else {
          out.barrels.push({ x, z, scale: 0.9 + rand() * 0.2 });
        }
      }
    }
    // три лодки у берега бухты: нос по оси z, чуть повёрнуты. Должна быть вода глубже полуметра.
    for (const [x, z, rotY] of [[-7.6, 29.5, 0.12], [7.7, 33.5, -0.15], [-7.4, 36, 0.3]]) {
      let deep = true;
      for (const [dx, dz] of [[0, 1.8], [0, -1.8], [0.8, 0], [-0.8, 0]]) {
        if (groundHeight(x + dx, z + dz) > -0.5) deep = false;
      }
      if (deep) out.boats.push({ x, z, rotY });
    }
  }

  // ---------------------------------------------------------------------
  // ЦВЕТОЧНЫЙ ЛУГ: качели на дереве на холме и много цветов
  // ---------------------------------------------------------------------
  {
    const m = zone('meadow');
    for (const [dx, dz] of [[-2.5, -3.2], [2.8, -3.0], [-3.5, 1.5], [3.5, 3.5]]) {
      const x = m.x + dx;
      const z = m.z + dz;
      if (!land(x, z, 0.8) || distToPaths(x, z) < 3.2 || !free(x, z, 3.0)) continue;
      out.swing = { x, z, rotY: facing(m.x - x, m.z - z) };
      take(x, z, 3.2);
      circle(x, z, 0.4);
      break;
    }
    let tries = 0;
    while (out.flowers.length < 110 && tries++ < 1800) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * 9.5;
      const x = m.x + Math.cos(ang) * rad;
      const z = m.z + Math.sin(ang) * rad;
      if (!land(x, z, 0.5) || distToPaths(x, z) < 1.3 || blocked(x, z)) continue;
      if (out.swing && Math.hypot(x - out.swing.x, z - out.swing.z) < 1.2) continue;
      if (out.flowers.some((f) => Math.hypot(f.x - x, f.z - z) < 0.95)) continue;
      out.flowers.push({ x, z, rotY: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.6 });
    }
  }

  // ---------------------------------------------------------------------
  // МАЯК НА СКАЛЕ: маяк на вершине, каменные ступени по дорожке, скамейки с видом
  // ---------------------------------------------------------------------
  {
    const path = PATHS.find((q) => q.id === 'to-lighthouse');
    const L = { x: -27.6, z: -19, r: 2.05 };
    const end = path.points[path.points.length - 1];
    out.lighthouse = { x: L.x, z: L.z, rotY: facing(end[0] - L.x, end[1] - L.z) };
    take(L.x, L.z, 3);
    circle(L.x, L.z, L.r);
    // ступени там, где дорожка круто идёт вверх
    const slope = (x, z) => Math.hypot(
      groundHeight(x + 0.5, z) - groundHeight(x - 0.5, z),
      groundHeight(x, z + 0.5) - groundHeight(x, z - 0.5)) / 1.0;
    const total = pathLength(path);
    for (let s = 3; s < total - 1; s += 0.9) {
      const f = pathFrame(path, s);
      if (slope(f.x, f.z) < 0.22) continue;
      out.steps.push({ x: f.x, z: f.z, rotY: Math.atan2(f.tx, f.tz) });
    }
    // две скамейки на вершине лицом к морю (на запад и на север) и фонарь у лестницы
    for (const [x, z, rotY] of [[-31.6, -16.2, -Math.PI / 2], [-24.2, -23.6, Math.PI]]) {
      if (groundHeight(x, z) < 4.5) continue;
      out.benches.push({ x, z, rotY });
      circle(x, z, 0.8);
      take(x, z, 1.0);
    }
  }

  // ---------------------------------------------------------------------
  // ТИХАЯ БУХТА: шезлонги и зонтики на песке, камни у воды
  // ---------------------------------------------------------------------
  {
    [17, 21.5, 26, 30.5].forEach((z, i) => {
      // идём на восток до воды и отступаем на песок
      let edge = 20;
      while (edge < 44 && groundHeight(edge, z) > 0.1) edge += 0.25;
      const x = edge - 2.8;
      const h = groundHeight(x, z);
      if (h < 0.1 || h > 0.5 || !free(x, z, 1.4)) return;
      out.loungers.push({ x, z: z + 0.95, rotY: Math.PI / 2 });
      out.loungers.push({ x, z: z - 0.95, rotY: Math.PI / 2 });
      out.umbrellas.push({ x: x - 0.1, z, rotY: i * 0.8 });
      take(x, z, 1.8);
      circle(x, z + 0.95, 0.55);
      circle(x, z - 0.95, 0.55);
      circle(x - 0.1, z, 0.25);
    });
  }

  // ---------------------------------------------------------------------
  // СОСНОВАЯ РОЩА: много деревьев, грибы и камни
  // ---------------------------------------------------------------------
  const addTree = (x, z, type) => {
    if (groundHeight(x, z) < 0.5 || distToPaths(x, z) < 2.1 || !free(x, z, 1.15)) return false;
    const scale = 0.85 + rand() * 0.5;
    out.trees.push({ x, z, type, scale, scaleY: scale * (0.9 + rand() * 0.3), rotY: rand() * Math.PI * 2 });
    take(x, z, 1.15);
    circle(x, z, 0.4 * scale);
    return true;
  };
  {
    const p = zone('pines');
    let placed = 0;
    for (let i = 0; i < 1500 && placed < 78; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * (p.r + 1.5);
      const roll = rand();
      const type = roll < 0.72 ? 'pine' : roll < 0.9 ? 'round' : 'blossom';
      if (addTree(p.x + Math.cos(ang) * rad, p.z + Math.sin(ang) * rad, type)) placed++;
    }
    // грибы кучками у деревьев рощи
    const grove = out.trees.filter((t) => Math.hypot(t.x - p.x, t.z - p.z) < p.r + 2);
    for (let i = 0; i < 70 && out.mushrooms.length < 36 && grove.length; i++) {
      const t = grove[Math.floor(rand() * grove.length)];
      const ang = rand() * Math.PI * 2;
      const x = t.x + Math.cos(ang) * (1.0 + rand() * 0.7);
      const z = t.z + Math.sin(ang) * (1.0 + rand() * 0.7);
      if (groundHeight(x, z) < 0.5 || distToPaths(x, z) < 1.1 || blocked(x, z)) continue;
      if (taken.some((c) => Math.hypot(c.x - x, c.z - z) < 0.5)) continue;
      out.mushrooms.push({ x, z, rotY: rand() * 6.28, scale: 0.8 + rand() * 0.6 });
    }
  }

  // ---------------------------------------------------------------------
  // ОСТАЛЬНОЙ ОСТРОВ: отдельные деревья и камни, чтобы он не был пустым
  // ---------------------------------------------------------------------
  {
    let placed = 0;
    for (let i = 0; i < 2500 && placed < 58; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 14 + rand() * 33;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const h = groundHeight(x, z);
      if (h < 0.55 || h > 3.2) continue;
      if (Math.hypot(x - zone('lighthouse').x, z - zone('lighthouse').z) < 12) continue;   // скала маяка без деревьев
      if (Math.hypot(x - zone('cove').x, z - zone('cove').z) < 11) continue;               // пляж без деревьев
      if (Math.abs(x) < 4 && z > 0 && z < 30) continue;                                     // дорога к пирсу
      const roll = rand();
      if (addTree(x, z, roll < 0.5 ? 'round' : roll < 0.8 ? 'blossom' : 'pine')) placed++;
    }
    // камни: кучки по острову и у берега
    let rocks = 0;
    for (let i = 0; i < 1500 && rocks < 26; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 12 + rand() * 38;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const h = groundHeight(x, z);
      if (h < 0.15 || h > 3.5 || distToPaths(x, z) < 1.8 || !free(x, z, 0.9)) continue;
      out.rocks.push({ x, z, rotY: rand() * 6.28, scale: 0.7 + rand() * 0.9 });
      take(x, z, 0.9);
      circle(x, z, 0.45 * (0.7 + rand() * 0.2));
      rocks++;
    }
  }

  return out;
}
