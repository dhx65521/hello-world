// 主界面：这个孩子的农场一角 + 入口按钮
import { h, svg, scene, button, longPress } from '../core/ui.js';
import { currentKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton, kidChip } from '../core/widgets.js';

export function homeScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  audio.music('home');
  const gear = h('button', { class: 'gear', 'aria-label': '家长区（长按 3 秒）' }, h('span', { class: 'ring' }), '⚙️');
  longPress(gear, 2500, () => go('parent'), (p) => gear.style.setProperty('--p', Math.round(p * 100)));
  const ui = scene({ title: '', theme: 'farm', left: kidChip(() => go('kids')), right: [coinChip(), muteButton(), gear] });

  // 农场预览（第二步会换成真正的农场）
  const plots = h('div', { class: 'farm-preview' });
  for (let i = 0; i < 8; i++) plots.append(h('div', { class: 'plot-mini' }, i === 0 ? '🌱' : ''));
  const preview = h('div', { class: 'farm-card' },
    h('div', { class: 'farm-sky' }, h('span', { class: 'sun' }, '☀️'), h('span', { class: 'cloud c1' }, '☁️'), h('span', { class: 'cloud c2' }, '☁️')),
    plots,
    h('div', { class: 'farm-label' }, '🌾 我的小农场（马上开放）'),
  );

  const menu = h('div', { class: 'home-menu' },
    button([h('span', { class: 'emoji' }, '🧮'), h('span', {}, '做数学 赚金币')], () => go('math'), 'home-btn primary'),
    button([h('span', { class: 'emoji' }, '🏪'), h('span', {}, '种子商店')], () => audio.sfx('wrong'), 'home-btn disabled'),
    button([h('span', { class: 'emoji' }, '🎒'), h('span', {}, '我的仓库')], () => go('bag'), 'home-btn'),
  );
  ui.body.append(h('div', { class: 'home-layout' }, preview, menu));
}
