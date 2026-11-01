// 2.5D（等轴）房间绘制：地砖、两面墙、用小方块拼成的家具，全部输出 SVG 字符串。
export const T = 64;            // 一块地砖的屏幕宽度
export const WALL_H = 120;      // 墙高

export const proj = (x, y, z = 0) => [((x - y) * T) / 2, ((x + y) * T) / 4 - z];
const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
export const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** 一个长方体：位置 (x,y,z)，尺寸 (w,d,h)，颜色 c（顶面原色，两侧自动变暗）；topFill 可用 pattern */
export function box(x, y, z, w, d, h, c, { topFill = null, stroke = 'rgba(0,0,0,.08)' } = {}) {
  const sw = `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`;
  const top = [proj(x, y, z + h), proj(x + w, y, z + h), proj(x + w, y + d, z + h), proj(x, y + d, z + h)];
  const left = [proj(x, y + d, z), proj(x + w, y + d, z), proj(x + w, y + d, z + h), proj(x, y + d, z + h)];
  const right = [proj(x + w, y, z), proj(x + w, y + d, z), proj(x + w, y + d, z + h), proj(x + w, y, z + h)];
  return poly(left, shade(c, 0.78), sw) + poly(right, shade(c, 0.62), sw) + poly(top, topFill || c, sw);
}

/** 墙上的平面矩形（side: 'left' 在 x=0 的墙上，沿 y；'right' 在 y=0 的墙上，沿 x） */
export function wallRect(side, a, b, z1, z2, fill, extra = '') {
  const pts = side === 'left'
    ? [proj(0, a, z1), proj(0, b, z1), proj(0, b, z2), proj(0, a, z2)]
    : [proj(a, 0, z1), proj(b, 0, z1), proj(b, 0, z2), proj(a, 0, z2)];
  return poly(pts, fill, extra);
}
export function wallCenter(side, a, b, z) { const [x1, y1] = side === 'left' ? proj(0, a, z) : proj(a, 0, z); const [x2, y2] = side === 'left' ? proj(0, b, z) : proj(b, 0, z); return [(x1 + x2) / 2, (y1 + y2) / 2]; }

export const emojiAt = ([x, y], e, size = 22, extra = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${extra}>${e}</text>`;

// ---------- 床单花纹 ----------
export const SHEET_PATTERNS = {
  plain: null,
  stars: { bg: '#CFE6FF', svg: `<text x="6" y="14" font-size="10">⭐</text><text x="22" y="30" font-size="8">✨</text>` },
  rainbow: { bg: '#FFF6D6', svg: `<rect x="0" y="0" width="36" height="6" fill="#FF9BAE"/><rect x="0" y="6" width="36" height="6" fill="#FFD56B"/><rect x="0" y="12" width="36" height="6" fill="#8FD694"/><rect x="0" y="18" width="36" height="6" fill="#86BDFF"/><rect x="0" y="24" width="36" height="6" fill="#C9A7FF"/><rect x="0" y="30" width="36" height="6" fill="#FFF6D6"/>` },
  dino: { bg: '#DFF3D8', svg: `<text x="4" y="16" font-size="12">🦕</text><text x="20" y="32" font-size="10">🌿</text>` },
  flowers: { bg: '#FFE3EA', svg: `<text x="4" y="16" font-size="12">🌸</text><text x="20" y="32" font-size="10">🌼</text>` },
  ocean: { bg: '#CFEFFF', svg: `<text x="4" y="16" font-size="12">🐳</text><text x="20" y="32" font-size="10">🐠</text>` },
};
export function patternDefs() {
  let s = '';
  for (const [id, p] of Object.entries(SHEET_PATTERNS)) {
    if (!p) continue;
    s += `<pattern id="sheet-${id}" patternUnits="userSpaceOnUse" width="36" height="36"><rect width="36" height="36" fill="${p.bg}"/>${p.svg}</pattern>`;
  }
  s += `<pattern id="floor-wood" patternUnits="userSpaceOnUse" width="16" height="8" patternTransform="rotate(-26.6)"><rect width="16" height="8" fill="#E9CDA3"/><rect y="7" width="16" height="1" fill="#D9B98A"/></pattern>`;
  s += `<pattern id="wall-dots" patternUnits="userSpaceOnUse" width="22" height="22"><rect width="22" height="22" fill="#F4F1FF"/><circle cx="6" cy="6" r="2" fill="#E3DCFF"/><circle cx="17" cy="17" r="2" fill="#E3DCFF"/></pattern>`;
  return `<defs>${s}</defs>`;
}

// ---------- 家具画法 ----------
// 每个画法在“本地坐标”里拼方块，B(u, v, z, su, sv, h, color) 会按 rot 旋转到世界坐标。
const WOOD = '#C9935A', WOOD_L = '#E2B07A', WOOD_D = '#9C6B3C', WHITE = '#FFFFFF', METAL = '#B9C4D0';

export const DRAWERS = {
  bed(B, o) {
    const fill = o.sheet && o.sheet !== 'plain' ? `url(#sheet-${o.sheet})` : '#FFE9EE';
    return B(0, 0, 0, 1, 2, 9, WOOD) + B(0, 0, 9, 1, 0.08, 34, WOOD_L) + B(0.04, 0.04, 9, 0.92, 1.92, 9, WHITE)
      + B(0.04, 0.62, 18, 0.92, 1.34, 5, '#FFD1DC', { topFill: fill }) + B(0.18, 0.14, 18, 0.64, 0.4, 7, '#FFFFFF');
  },
  desk(B) {
    return B(0.04, 0.04, 0, 0.08, 0.08, 34, WOOD_D) + B(1.88, 0.04, 0, 0.08, 0.08, 34, WOOD_D) + B(0.04, 0.88, 0, 0.08, 0.08, 34, WOOD_D) + B(1.88, 0.88, 0, 0.08, 0.08, 34, WOOD_D)
      + B(0, 0, 34, 2, 1, 4, WOOD_L) + B(0.3, 0.3, 38, 0.4, 0.3, 3, '#5AA9E6') + B(1.45, 0.25, 38, 0.18, 0.18, 10, '#FF9F68');
  },
  desk_big(B) {
    return B(0, 0, 0, 2, 1, 34, WOOD_L) + B(0.05, 0.1, 0, 0.9, 0.8, 34, WOOD) + B(0, 0, 34, 2, 1, 4, '#F2DEC2')
      + B(0.75, 0.15, 38, 0.6, 0.06, 28, '#2F3B52') + B(0.95, 0.4, 38, 0.2, 0.2, 2, METAL)
      + B(0.2, 0.3, 38, 0.35, 0.25, 3, '#8FD694') + B(1.6, 0.25, 38, 0.18, 0.18, 10, '#C9A7FF');
  },
  chair(B) {
    return B(0.15, 0.15, 0, 0.08, 0.08, 18, WOOD_D) + B(0.77, 0.15, 0, 0.08, 0.08, 18, WOOD_D) + B(0.15, 0.77, 0, 0.08, 0.08, 18, WOOD_D) + B(0.77, 0.77, 0, 0.08, 0.08, 18, WOOD_D)
      + B(0.12, 0.12, 18, 0.76, 0.76, 4, '#FF9BAE') + B(0.12, 0.12, 22, 0.76, 0.1, 26, WOOD_L);
  },
  bookshelf(B) {
    let s = B(0.1, 0.1, 0, 0.8, 0.08, 72, WOOD) + B(0.1, 0.1, 0, 0.08, 0.5, 72, WOOD) + B(0.82, 0.1, 0, 0.08, 0.5, 72, WOOD);
    for (const z of [0, 24, 48]) s += B(0.1, 0.1, z, 0.8, 0.5, 3, WOOD_L);
    const colors = ['#FF6B6B', '#5AA9E6', '#FFD93D', '#8FD694', '#C9A7FF', '#FF9F68'];
    let i = 0;
    for (const z of [3, 27, 51]) for (let k = 0; k < 4; k++) s += B(0.2 + k * 0.15, 0.2, z, 0.12, 0.32, 16 + (k % 2) * 3, colors[(i++) % colors.length]);
    s += B(0.1, 0.1, 72, 0.8, 0.5, 3, WOOD);
    return s;
  },
  lamp(B) { return B(0.3, 0.3, 0, 0.4, 0.4, 3, METAL) + B(0.47, 0.47, 3, 0.06, 0.06, 30, METAL) + B(0.2, 0.2, 33, 0.6, 0.6, 16, '#FFD56B'); },
  plant(B) { return B(0.3, 0.3, 0, 0.4, 0.4, 14, '#D9825E') + B(0.22, 0.35, 14, 0.28, 0.28, 18, '#6CC26B') + B(0.5, 0.3, 14, 0.28, 0.28, 24, '#4FA64F') + B(0.36, 0.52, 14, 0.28, 0.28, 20, '#8FD694'); },
  toybox(B) { return B(0.1, 0.1, 0, 0.8, 0.8, 24, '#FF6B6B') + B(0.08, 0.08, 24, 0.84, 0.84, 5, '#E25555') + B(0.3, 0.3, 29, 0.4, 0.4, 10, '#FFD93D'); },
  teddy(B) { return B(0.3, 0.3, 0, 0.4, 0.4, 16, '#B5835A') + B(0.2, 0.35, 2, 0.12, 0.3, 10, '#B5835A') + B(0.68, 0.35, 2, 0.12, 0.3, 10, '#B5835A') + B(0.32, 0.32, 16, 0.36, 0.36, 14, '#C9935A') + B(0.28, 0.3, 28, 0.12, 0.12, 6, '#C9935A') + B(0.6, 0.3, 28, 0.12, 0.12, 6, '#C9935A') + B(0.42, 0.26, 20, 0.16, 0.1, 6, '#F2DEC2'); },
  wardrobe(B) { return B(0.05, 0.05, 0, 0.9, 0.5, 86, WOOD) + B(0.05, 0.05, 86, 0.9, 0.5, 3, WOOD_D) + B(0.48, 0.52, 10, 0.04, 0.04, 70, WOOD_D) + B(0.38, 0.54, 40, 0.06, 0.04, 6, '#FFD93D') + B(0.56, 0.54, 40, 0.06, 0.04, 6, '#FFD93D'); },
};

// ---------- 地毯（平铺在地面，不占格） ----------
export function drawRug(variant, x, y) {
  if (variant === 'rug_round') {
    const [cx, cy] = proj(x + 1, y + 1, 0);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${T * 0.92}" ry="${T * 0.46}" fill="#FFB86B" stroke="#F08A4B" stroke-width="3"/><ellipse cx="${cx}" cy="${cy}" rx="${T * 0.55}" ry="${T * 0.27}" fill="#FFD1A1"/>`;
  }
  const pts = [proj(x + 0.1, y + 0.1), proj(x + 1.9, y + 0.1), proj(x + 1.9, y + 1.9), proj(x + 0.1, y + 1.9)];
  const [cx, cy] = proj(x + 1, y + 1, 0);
  return poly(pts, '#86BDFF', 'stroke="#5AA9E6" stroke-width="3" stroke-linejoin="round"') + emojiAt([cx, cy], '⭐', 30) + emojiAt([cx - 40, cy - 14], '✨', 16) + emojiAt([cx + 40, cy + 10], '✨', 16);
}

/** 把本地坐标系（rot=0 时占 w0×d0）按 rot 旋转后放到 (x,y) */
export function makeB(x, y, rot, w0, d0) {
  return (u, v, z, su, sv, h, c, opts) => {
    let X, Y, W, D;
    if (rot === 0) { X = x + u; Y = y + v; W = su; D = sv; }
    else if (rot === 1) { X = x + (d0 - v - sv); Y = y + u; W = sv; D = su; }
    else if (rot === 2) { X = x + (w0 - u - su); Y = y + (d0 - v - sv); W = su; D = sv; }
    else { X = x + v; Y = y + (w0 - u - su); W = sv; D = su; }
    return box(X, Y, z, W, D, h, c, opts);
  };
}
