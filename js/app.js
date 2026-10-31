// 入口：路由、首页、PWA 注册、首次触摸解锁音频。
import { h, screen, clearApp, longPress } from './ui.js';
import * as sound from './sound.js';
import * as speech from './speech.js';
import * as timer from './timer.js';
import { totalStars } from './rewards.js';
import { MODULES, findModule } from './registry.js';
import { mountParent } from './parent.js';

// ---------- 首次触摸：解锁 iOS 音频 + 语音 ----------
let unlocked = false;
function unlockOnce() {
  if (unlocked) return;
  unlocked = true;
  sound.unlock();
  speech.prime();
}
['pointerdown', 'touchstart', 'click'].forEach((ev) => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));

// ---------- 路由 ----------
function go(path) {
  if (location.hash === '#' + path) render(); else location.hash = path;
}
const goHome = () => go('/');

function currentRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  return { id: parts[0] || '', rest: parts.slice(1) };
}

function render() {
  speech.stop();
  const { id } = currentRoute();
  if (!id) return renderHome();
  if (id === 'parent') return mountParent({ goHome });
  const mod = findModule(id);
  if (!mod) return goHome();
  mod.mount({ goHome, go });
}

// ---------- 首页 ----------
function renderHome() {
  const root = clearApp();
  const gear = h('button', { class: 'gear', 'aria-label': '家长区（长按 3 秒）' }, h('span', { class: 'ring' }), '⚙️');
  longPress(gear, 3000, () => go('/parent'), (p) => gear.style.setProperty('--p', Math.round(p * 100)));

  const stars = h('div', { class: 'home-stars' }, '⭐', String(totalStars()));
  const topbar = h('div', { class: 'topbar' },
    stars,
    h('h1', { class: 'home-title title' }, '🌈 学习乐园'),
    gear,
  );
  const tiles = h('div', { class: 'tiles' });
  for (const mod of MODULES) {
    tiles.append(h('button', {
      class: 'tile',
      style: { background: mod.color },
      onclick: () => { sound.pop(); go('/' + mod.id); },
    }, h('span', { class: 'emoji' }, mod.icon), h('span', {}, mod.name)));
  }
  const body = h('div', { class: 'screen-body' }, tiles);
  root.append(topbar, body);
  speech.sayZh('你好！今天想学什么呢？点一个图标吧。');
}

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- 启动 ----------
window.addEventListener('hashchange', render);
timer.restart();
render();
