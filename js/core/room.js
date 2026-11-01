// 房间逻辑：摆放、旋转、挪动、墙上挂件；并把整个房间画成 SVG。
import { T, WALL_H, proj, poly, box, wallRect, wallCenter, emojiAt, patternDefs, DRAWERS, drawRug, makeB } from './iso.js';

let decor = null;
export function setDecor(d) { decor = d; }
export const itemDef = (id) => decor?.items.find((i) => i.id === id);
export const COLS = () => decor?.floor?.cols || 4;
export const ROWS = () => decor?.floor?.rows || 4;
export const WALL_SLOTS = 3;

let uidCounter = 0;
const uid = () => 'f' + Date.now().toString(36) + (uidCounter++).toString(36);

export function initRoom() {
  return {
    placed: [{ uid: uid(), item: 'bed', x: 0, y: 0, rot: 0 }, { uid: uid(), item: 'desk', x: 2, y: 0, rot: 0 }],
    wall: [],      // [{ uid, item, side: 'left'|'right', slot: 0..2 }]
    sheet: 'plain',
  };
}
export function dims(def, rot) { return rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d }; }
export function cells(def, x, y, rot) {
  const { w, d } = dims(def, rot); const out = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push(`${x + i},${y + j}`);
  return out;
}
export function occupied(room, exceptUid = null) {
  const set = new Set();
  for (const p of room.placed) {
    if (p.uid === exceptUid) continue;
    const def = itemDef(p.item); if (!def || def.type === 'rug') continue;
    for (const c of cells(def, p.x, p.y, p.rot)) set.add(c);
  }
  return set;
}
export function canPlace(room, def, x, y, rot, exceptUid = null) {
  const { w, d } = dims(def, rot);
  if (x < 0 || y < 0 || x + w > COLS() || y + d > ROWS()) return false;
  if (def.type === 'rug') {
    // 地毯不能和地毯重叠
    const rugs = new Set(); for (const p of room.placed) { if (p.uid === exceptUid) continue; const dd = itemDef(p.item); if (dd?.type === 'rug') for (const c of cells(dd, p.x, p.y, p.rot)) rugs.add(c); }
    return !cells(def, x, y, rot).some((c) => rugs.has(c));
  }
  const occ = occupied(room, exceptUid);
  return !cells(def, x, y, rot).some((c) => occ.has(c));
}
export function findFree(room, def) {
  for (let rot = 0; rot < 2; rot++) for (let y = 0; y < ROWS(); y++) for (let x = 0; x < COLS(); x++) if (canPlace(room, def, x, y, rot)) return { x, y, rot };
  return null;
}
export function freeWallSlot(room, side) {
  for (let s = 0; s < WALL_SLOTS; s++) if (!room.wall.some((w) => w.side === side && w.slot === s)) return s;
  return -1;
}
export function placeItem(room, itemId, pos) { const p = { uid: uid(), item: itemId, ...pos }; room.placed.push(p); return p; }
export function hangItem(room, itemId, side, slot) { const w = { uid: uid(), item: itemId, side, slot }; room.wall.push(w); return w; }

// ---------- 绘制 ----------
export function renderRoom(room, { selected = null, moving = false } = {}) {
  const cols = COLS(), rows = ROWS();
  const [minX] = proj(0, rows, 0), [maxX] = proj(cols, 0, 0);
  const top = -WALL_H - 10, [, bottom] = proj(cols, rows, 0);
  const w = maxX - minX + 20, hgt = bottom - top + 20;
  let s = `<svg viewBox="${minX - 10} ${top} ${w} ${hgt}" xmlns="http://www.w3.org/2000/svg" class="room-svg">${patternDefs()}`;
  // 墙
  s += poly([proj(0, 0, WALL_H), proj(0, rows, WALL_H), proj(0, rows, 0), proj(0, 0, 0)], 'url(#wall-dots)', 'stroke="#D8D2F0" stroke-width="1"');
  s += poly([proj(0, 0, WALL_H), proj(cols, 0, WALL_H), proj(cols, 0, 0), proj(0, 0, 0)], '#EFEAFF', 'stroke="#D8D2F0" stroke-width="1"');
  // 踢脚线
  s += poly([proj(0, 0, 8), proj(0, rows, 8), proj(0, rows, 0), proj(0, 0, 0)], '#D9CDBE') + poly([proj(0, 0, 8), proj(cols, 0, 8), proj(cols, 0, 0), proj(0, 0, 0)], '#CDBFAE');
  // 窗户（右墙）
  s += wallRect('right', 1.2, 2.8, 50, 100, '#BDE8FF', 'stroke="#fff" stroke-width="4"') + wallRect('right', 1.95, 2.05, 50, 100, '#fff') + emojiAt(wallCenter('right', 1.2, 2.8, 75), '☀️', 18);
  // 墙上挂件
  for (const wItem of room.wall) {
    const def = itemDef(wItem.item); if (!def) continue;
    const span = (wItem.side === 'left' ? rows : cols) / WALL_SLOTS;
    const a = wItem.slot * span + span * 0.18, b = wItem.slot * span + span * 0.82;
    const sel = selected === wItem.uid;
    if (def.variant === 'clock') {
      const c = wallCenter(wItem.side, a, b, 78);
      s += `<g class="room-item wall" data-uid="${wItem.uid}">` + emojiAt(c, '🕒', 34) + (sel ? `<circle cx="${c[0]}" cy="${c[1]}" r="24" fill="none" stroke="#FFD93D" stroke-width="4"/>` : '') + `</g>`;
    } else {
      s += `<g class="room-item wall" data-uid="${wItem.uid}">` + wallRect(wItem.side, a, b, 40, 95, '#fff', `stroke="${sel ? '#FFD93D' : '#E0D8CC'}" stroke-width="${sel ? 4 : 2}"`) + wallRect(wItem.side, a + 0.08, b - 0.08, 46, 89, '#FFF6D6') + emojiAt(wallCenter(wItem.side, a, b, 68), def.emoji, 26) + `</g>`;
    }
  }
  // 地砖
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const pts = [proj(x, y), proj(x + 1, y), proj(x + 1, y + 1), proj(x, y + 1)];
    s += poly(pts, 'url(#floor-wood)', `class="tile${moving ? ' target' : ''}" data-tile="${x},${y}" stroke="#D9B98A" stroke-width="1.5"`);
  }
  // 地毯
  for (const p of room.placed) { const def = itemDef(p.item); if (def?.type === 'rug') s += `<g class="room-item" data-uid="${p.uid}">${drawRug(def.variant, p.x, p.y)}${selected === p.uid ? poly([proj(p.x, p.y), proj(p.x + 2, p.y), proj(p.x + 2, p.y + 2), proj(p.x, p.y + 2)], 'none', 'stroke="#FFD93D" stroke-width="4"') : ''}</g>`; }
  // 家具（按深度排序）
  const items = room.placed.filter((p) => itemDef(p.item)?.type === 'floor').map((p) => { const def = itemDef(p.item); const { w: pw, d: pd } = dims(def, p.rot); return { p, def, key: p.x + p.y + (pw + pd) / 2 }; });
  items.sort((a, b) => a.key - b.key);
  for (const { p, def } of items) {
    const draw = DRAWERS[def.variant]; if (!draw) continue;
    const B = makeB(p.x, p.y, p.rot, def.w, def.d);
    const { w: pw, d: pd } = dims(def, p.rot);
    const sel = selected === p.uid;
    s += `<g class="room-item${sel ? ' selected' : ''}" data-uid="${p.uid}">`;
    if (sel) s += poly([proj(p.x, p.y), proj(p.x + pw, p.y), proj(p.x + pw, p.y + pd), proj(p.x, p.y + pd)], 'rgba(255,217,61,.45)', 'stroke="#FFD93D" stroke-width="3"');
    s += draw(B, { sheet: room.sheet });
    s += `</g>`;
  }
  s += '</svg>';
  return s;
}
