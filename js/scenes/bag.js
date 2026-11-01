// 仓库：金币、种子、道具、果实，以及做题记录
import { h, scene, button } from '../core/ui.js';
import { currentKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton } from '../core/widgets.js';

export function bagScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  audio.music('shop');
  const ui = scene({ title: '🎒 我的仓库', theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });
  const inv = kid.inventory || { seeds: {}, items: {}, crops: {} };
  const section = (title, entries, empty) => {
    const grid = h('div', { class: 'bag-grid' });
    const list = Object.entries(entries).filter(([, n]) => n > 0);
    if (!list.length) grid.append(h('div', { class: 'hint' }, empty));
    for (const [id, n] of list) grid.append(h('div', { class: 'bag-slot' }, h('span', { class: 'em' }, id), h('span', { class: 'cnt' }, `×${n}`)));
    return h('div', { class: 'card' }, h('div', { class: 'h2' }, title), grid);
  };
  const s = kid.stats;
  ui.body.append(
    h('div', { class: 'card coins-card' }, h('div', { class: 'big-emoji' }, '🪙'), h('div', { class: 'h1' }, `${kid.coins} 枚金币`), h('div', { class: 'hint' }, '做数学题可以赚金币，以后能在商店买种子。')),
    section('🌱 种子', inv.seeds, '还没有种子，商店开放后可以买。'),
    section('🧰 道具', inv.items, '还没有道具。'),
    section('🧺 果实', inv.crops, '还没有收获的果实。'),
    h('div', { class: 'card' }, h('div', { class: 'h2' }, '🧮 做题记录'),
      h('div', { class: 'stat-row' }, h('span', {}, '玩过的局数'), h('b', {}, s.rounds)),
      h('div', { class: 'stat-row' }, h('span', {}, '答对 / 答题'), h('b', {}, `${s.correct} / ${s.answered}`)),
      h('div', { class: 'stat-row' }, h('span', {}, '一局最多赚到'), h('b', {}, `🪙 ${s.best}`)),
      h('div', { class: 'stat-row' }, h('span', {}, '累计赚到'), h('b', {}, `🪙 ${s.coinsEarned}`)),
    ),
  );
}
