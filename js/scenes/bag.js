// 仓库：金币、种子、道具、果实，以及做题记录
import { h, scene, button } from '../core/ui.js';
import { currentKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton } from '../core/widgets.js';
import { loadFarmData, seedById, itemById } from './home.js';

export async function bagScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  await loadFarmData();
  audio.music('shop');
  const ui = scene({ title: '🎒 我的仓库', theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });
  const inv = kid.inventory;
  const section = (title, entries, lookup, empty, extra = null) => {
    const grid = h('div', { class: 'bag-grid' });
    const list = Object.entries(entries).filter(([, n]) => n > 0);
    if (!list.length) grid.append(h('div', { class: 'hint' }, empty));
    for (const [id, n] of list) { const d = lookup(id); grid.append(h('div', { class: 'bag-slot' }, h('span', { class: 'em' }, d?.emoji || '❓'), h('span', { class: 'nm' }, d?.name || id), h('span', { class: 'cnt' }, `×${n}`))); }
    return h('div', { class: 'card' }, h('div', { class: 'h2' }, title), grid, extra);
  };
  const s = kid.stats;
  const cropsCount = Object.values(inv.crops).reduce((a, b) => a + b, 0);
  ui.body.append(
    h('div', { class: 'card coins-card' }, h('div', { class: 'big-emoji' }, '🪙'), h('div', { class: 'h1' }, `${kid.coins} 枚金币`), h('div', { class: 'hint' }, `收获过 ${kid.farm.harvests || 0} 次`)),
    section('🌱 种子', inv.seeds, seedById, '还没有种子，去商店买一些吧。', h('div', { class: 'row left', style: { marginTop: '10px' } }, button('🏪 去商店', () => go('shop'), 'soft'))),
    section('🧰 道具', inv.items, itemById, '还没有道具。'),
    section('🧺 果实', inv.crops, seedById, '还没有收获的果实。', cropsCount ? h('div', { class: 'row left', style: { marginTop: '10px' } }, button('💰 去卖果实', () => go('shop', { tab: 'sell' }), 'primary')) : null),
    h('div', { class: 'card' }, h('div', { class: 'h2' }, '🧮 做题记录'),
      h('div', { class: 'stat-row' }, h('span', {}, '玩过的局数'), h('b', {}, s.rounds)),
      h('div', { class: 'stat-row' }, h('span', {}, '答对 / 答题'), h('b', {}, `${s.correct} / ${s.answered}`)),
      h('div', { class: 'stat-row' }, h('span', {}, '一局最多赚到'), h('b', {}, `🪙 ${s.best}`)),
      h('div', { class: 'stat-row' }, h('span', {}, '累计赚到'), h('b', {}, `🪙 ${s.coinsEarned}`)),
    ),
  );
}
