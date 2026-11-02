// 2.5D 菜地：用 iso.js 的投影把 2×4 地块画成立体土台，植物立在上面。
import { T, proj, poly, box, emojiAt } from './iso.js';
import { plantSvg } from './plants.js';

export const COLS = 4, ROWS = 2;
const SOIL_H = 10;
const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

function defs() {
  return `<defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9EBA2"/><stop offset="1" stop-color="#9ED87F"/></linearGradient>
    <pattern id="furrow-dry" patternUnits="userSpaceOnUse" width="10" height="5" patternTransform="rotate(26.6)"><rect width="10" height="5" fill="#B9794A"/><rect y="3.5" width="10" height="1.5" fill="#A86A3E"/></pattern>
    <pattern id="furrow-wet" patternUnits="userSpaceOnUse" width="10" height="5" patternTransform="rotate(26.6)"><rect width="10" height="5" fill="#8A5631"/><rect y="3.5" width="10" height="1.5" fill="#744624"/></pattern>
    <pattern id="furrow-empty" patternUnits="userSpaceOnUse" width="10" height="5" patternTransform="rotate(26.6)"><rect width="10" height="5" fill="#C98B5A"/><rect y="3.5" width="10" height="1.5" fill="#B9794A"/></pattern>
  </defs>`;
}

/**
 * plotsInfo: [{ p, seed, prog, ripe, blocked }]（p 为 null 表示空地）
 */
export function renderFarm(plotsInfo, { selected = null } = {}) {
  const m = 0.6; // 草地外边距（格）
  const corners = [proj(-m, -m), proj(COLS + m, -m), proj(COLS + m, ROWS + m), proj(-m, ROWS + m)];
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs) - 6, maxX = Math.max(...xs) + 6;
  const top = Math.min(...ys) - 56, bottom = Math.max(...ys) + 16;
  let s = `<svg viewBox="${minX} ${top} ${maxX - minX} ${bottom - top}" xmlns="http://www.w3.org/2000/svg" class="farm-svg">${defs()}`;
  // 草地
  s += poly(corners, 'url(#grass)', 'stroke="#8CC96F" stroke-width="2" stroke-linejoin="round"');
  s += poly([proj(-m, ROWS + m), proj(COLS + m, ROWS + m), proj(COLS + m, ROWS + m + 0.18), proj(-m, ROWS + m + 0.18)], '#7FBF63'); // 草地厚度
  // 后面两条围栏
  const fence = (pts) => pts.map(([x, y]) => box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 26, '#D9A066')).join('');
  const backPosts = []; for (let x = -m; x <= COLS + m + 0.01; x += 1.15) backPosts.push([x, -m]); for (let y = -m + 1.15; y <= ROWS + m + 0.01; y += 1.15) backPosts.push([-m, y]);
  s += box(-m, -m - 0.03, 14, COLS + 2 * m, 0.06, 4, '#E2B07A') + box(-m - 0.03, -m, 14, 0.06, ROWS + 2 * m, 4, '#E2B07A');
  s += fence(backPosts);
  // 点缀：小树、牌子、水桶
  s += emojiAt(proj(-m + 0.1, ROWS + m - 0.3, 30), '🌳', 44);
  s += emojiAt(proj(COLS + m - 0.2, -m + 0.3, 34), '🪧', 30);
  s += emojiAt(proj(-m + 0.15, ROWS + m - 0.05, 14), '🪣', 22);

  s += animalsLayer(true);
  // 地块（按深度从后往前）
  const order = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) order.push({ x, y, i: y * COLS + x });
  order.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const badges = [];
  for (const { x, y, i } of order) {
    const info = plotsInfo[i] || {}; const p = info.p;
    const fill = !p ? 'url(#furrow-empty)' : p.needsWater ? 'url(#furrow-dry)' : 'url(#furrow-wet)';
    const base = !p ? '#C98B5A' : p.needsWater ? '#B9794A' : '#8A5631';
    s += `<g class="plot-iso${selected === i ? ' selected' : ''}${info.ripe ? ' ripe' : ''}" data-i="${i}">`;
    s += box(x + 0.08, y + 0.08, 0, 0.84, 0.84, SOIL_H, base, { topFill: fill, stroke: 'rgba(0,0,0,.12)' });
    if (selected === i) s += poly([proj(x + 0.08, y + 0.08, SOIL_H + 0.5), proj(x + 0.92, y + 0.08, SOIL_H + 0.5), proj(x + 0.92, y + 0.92, SOIL_H + 0.5), proj(x + 0.08, y + 0.92, SOIL_H + 0.5)], 'rgba(255,217,61,.25)', 'stroke="#FFD93D" stroke-width="3" stroke-linejoin="round"');
    if (info.ripe) s += poly([proj(x + 0.08, y + 0.08, SOIL_H + 0.5), proj(x + 0.92, y + 0.08, SOIL_H + 0.5), proj(x + 0.92, y + 0.92, SOIL_H + 0.5), proj(x + 0.08, y + 0.92, SOIL_H + 0.5)], 'none', 'stroke="rgba(255,217,61,.9)" stroke-width="3" class="ripe-glow"');
    const [cx, cy] = proj(x + 0.5, y + 0.5, SOIL_H);
    if (!p) {
      s += emojiAt([cx, cy], '＋', 22, 'fill="rgba(255,255,255,.75)" font-weight="800"');
    } else {
      const PW = T * 1.3, PH = T * 1.3;
      s += `<svg x="${(cx - PW / 2).toFixed(1)}" y="${(cy - PH * 0.84).toFixed(1)}" width="${PW}" height="${PH}" viewBox="0 0 100 100" overflow="visible" class="plant-wrap">${plantSvg(info.seed, p.stage).replace('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="plant-svg">', '<g class="plant-svg">').replace('</svg>', '</g>')}</svg>`;
      if (p.weeds > 0) { const spots = [[0.12, 0.5], [0.9, 0.42], [0.5, 0.12]]; for (let k = 0; k < p.weeds; k++) s += emojiAt(proj(x + spots[k][0], y + spots[k][1], SOIL_H + 10), '🌿', 17, 'class="weed"'); }
      if (p.bug) s += emojiAt(proj(x + 0.25, y + 0.9, SOIL_H + 12), '🐛', 18, 'class="bug"');
    }
    s += `</g>`;
    // 徽章稍后统一画在最上层
    const [bx, by] = proj(x + 1.0, y + 0.0, SOIL_H + 30);
    if (p) badges.push({ i, bx, by, info, p });
  }
  s += animalsLayer(false);
  for (const { i, bx, by, info, p } of badges) {
    s += `<g class="badge-iso" data-badge="${i}">`;
    if (info.ripe) s += `<circle cx="${bx}" cy="${by}" r="10" fill="#FFF4CC" stroke="#FFD93D" stroke-width="1.5" class="pulse"/>` + emojiAt([bx, by], '✨', 11);
    else if (p.needsWater) s += `<circle cx="${bx}" cy="${by}" r="10" fill="#fff" stroke="#86BDFF" stroke-width="1.5" class="bob"/>` + emojiAt([bx, by], '💧', 11, 'class="bob"');
    else if (p.weeds > 0) s += `<circle cx="${bx}" cy="${by}" r="10" fill="#fff" stroke="#8FD694" stroke-width="1.5"/>` + emojiAt([bx, by], '🌿', 10);
    else {
      const r = 8.5, c = 2 * Math.PI * r;
      s += `<circle cx="${bx}" cy="${by}" r="10" fill="#fff"/><circle cx="${bx}" cy="${by}" r="${r}" fill="none" stroke="#E8EEF4" stroke-width="3"/>`
        + `<circle cx="${bx}" cy="${by}" r="${r}" fill="none" stroke="#6CC26B" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - (info.prog || 0))).toFixed(1)}" transform="rotate(-90 ${bx} ${by})" data-ring="${i}" data-c="${c.toFixed(1)}"/>`
        + emojiAt([bx, by], '⏳', 8);
    }
    s += `</g>`;
  }
  s += '</svg>';
  return s;
}

/** 在某块地里临时加一段 SVG（浇水、喷雾等特效），ms 后移除 */
export function fxInPlot(svgRoot, i, markup, ms = 900) {
  const g = svgRoot.querySelector(`.plot-iso[data-i="${i}"]`); if (!g) return;
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  tmp.innerHTML = markup; tmp.setAttribute('class', 'plot-fx');
  g.append(tmp);
  setTimeout(() => tmp.remove(), ms);
}
export function plotCenter(i) { const x = i % COLS, y = Math.floor(i / COLS); return proj(x + 0.5, y + 0.5, SOIL_H); }
export const waterFx = (i) => { const [cx, cy] = plotCenter(i); return emojiAt([cx + 18, cy - 54], '🚿', 26, 'class="fx-can"') + [0, 1, 2, 3, 4].map((k) => emojiAt([cx - 22 + k * 11, cy - 40], '💧', 12, `class="fx-drop" style="animation-delay:${k * 0.08}s"`)).join(''); };
export const sprayFx = (i) => { const [cx, cy] = plotCenter(i); return emojiAt([cx - 20, cy - 50], '🧴', 24, 'class="fx-can"') + emojiAt([cx, cy - 30], '💨', 20, 'class="fx-drop"'); };
export const seedFx = (i) => { const [cx, cy] = plotCenter(i); return emojiAt([cx, cy - 50], '🌰', 18, 'class="fx-seed"'); };

// ---------- 小动物：沿着田边来回走 ----------
const ANIMALS = [
  { id: 'chicken', e: '🐔', lane: 'front', speed: 0.28, size: 22, t: 0.1 },
  { id: 'dog', e: '🐕', lane: 'front', speed: 0.45, size: 24, t: 0.7 },
  { id: 'rabbit', e: '🐇', lane: 'left', speed: 0.38, size: 20, t: 0.3 },
  { id: 'pig', e: '🐖', lane: 'left', speed: 0.16, size: 24, t: 0.8 },
  { id: 'sheep', e: '🐑', lane: 'back', speed: 0.18, size: 24, t: 0.2 },
  { id: 'cat', e: '🐈', lane: 'back', speed: 0.32, size: 20, t: 0.65 },
  { id: 'duck', e: '🦆', lane: 'right', speed: 0.24, size: 20, t: 0.4 },
  { id: 'cow', e: '🐄', lane: 'right', speed: 0.12, size: 26, t: 0.9 },
];
const LANES = {
  front: { from: [-0.35, 2.32], to: [4.35, 2.32] },
  back: { from: [-0.35, -0.36], to: [4.35, -0.36] },
  left: { from: [-0.38, -0.25], to: [-0.38, 2.3] },
  right: { from: [4.38, -0.25], to: [4.38, 2.3] },
};
const state = {}; // 跨重绘保留位置
for (const a of ANIMALS) state[a.id] = { t: a.t, dir: 1, pauseUntil: 0 };
const lanePos = (lane, t) => { const l = LANES[lane]; return [l.from[0] + (l.to[0] - l.from[0]) * t, l.from[1] + (l.to[1] - l.from[1]) * t]; };

/** 动物图层：back=true 画在地块后面（后排、左侧），否则画在前面 */
export function animalsLayer(back) {
  let s = '';
  for (const a of ANIMALS) {
    const isBack = a.lane === 'back' || a.lane === 'left';
    if (isBack !== back) continue;
    const [x, y] = lanePos(a.lane, state[a.id].t); const [px, py] = proj(x, y, 0);
    s += `<g class="animal" data-animal="${a.id}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><ellipse cx="0" cy="2" rx="${a.size * 0.45}" ry="${a.size * 0.16}" fill="rgba(0,0,0,.12)"/><g class="walker"><text font-size="${a.size}" text-anchor="middle" dominant-baseline="auto" y="-2">${a.e}</text></g></g>`;
  }
  return s;
}
/** 启动走动动画；返回 stop() */
export function animateAnimals(getSvg) {
  let raf = 0, last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const svg = getSvg();
    for (const a of ANIMALS) {
      const st = state[a.id];
      if (now < st.pauseUntil) continue;
      const lane = LANES[a.lane]; const len = Math.hypot(lane.to[0] - lane.from[0], lane.to[1] - lane.from[1]);
      st.t += st.dir * a.speed * dt / len;
      if (st.t >= 1 || st.t <= 0) { st.t = Math.max(0, Math.min(1, st.t)); st.dir *= -1; st.pauseUntil = now + 800 + Math.random() * 2500; }
      else if (Math.random() < 0.002) st.pauseUntil = now + 500 + Math.random() * 1500; // 偶尔停下吃草
      if (!svg) continue;
      const g = svg.querySelector(`.animal[data-animal="${a.id}"]`); if (!g) continue;
      const [x, y] = lanePos(a.lane, st.t); const [px, py] = proj(x, y, 0);
      // 沿 x 走：向右(+x)时翻面；沿 y 走：向 -y（屏幕右上）时翻面
      const flip = a.lane === 'front' || a.lane === 'back' ? st.dir > 0 : st.dir < 0;
      g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
      g.querySelector('.walker').setAttribute('transform', flip ? 'scale(-1 1)' : '');
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
