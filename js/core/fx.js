// 小特效：飞金币、星星四溅、抖动。
import { h } from './ui.js';

const fxRoot = () => document.getElementById('fx-root');

/** 星星从元素中心四溅 */
export function burst(el, emojis = ['⭐', '✨', '🌟'], count = 10) {
  const r = el.getBoundingClientRect();
  burstAt(r.left + r.width / 2, r.top + r.height / 2, emojis, count);
}
export function burstAt(x, y, emojis = ['⭐', '✨', '🌟'], count = 10) {
  const root = fxRoot(); if (!root) return;
  for (let i = 0; i < count; i++) {
    const s = h('span', { class: 'fx-star' }, emojis[i % emojis.length]);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5, dist = 70 + Math.random() * 90;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 40 + 'px');
    s.style.setProperty('--rot', (Math.random() * 240 - 120) + 'deg');
    root.append(s); setTimeout(() => s.remove(), 1000);
  }
}

/** 金币从 from 飞到 to（元素），n 枚；返回 Promise，全部到达后 resolve */
export function flyCoins(from, to, n = 1, emoji = '🪙') {
  const root = fxRoot(); if (!root || !from || !to) return Promise.resolve();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
  const count = Math.min(n, 8);
  return new Promise((resolve) => {
    for (let i = 0; i < count; i++) {
      const c = h('span', { class: 'fx-coin' }, emoji);
      c.style.left = sx + 'px'; c.style.top = sy + 'px';
      c.style.setProperty('--ex', (ex - sx) + 'px'); c.style.setProperty('--ey', (ey - sy) + 'px');
      c.style.setProperty('--mx', (ex - sx) / 2 + (Math.random() * 120 - 60) + 'px');
      c.style.animationDelay = (i * 0.07) + 's';
      root.append(c);
      setTimeout(() => { c.remove(); if (i === count - 1) resolve(); }, 700 + i * 70);
    }
  });
}

export function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); }
export function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
