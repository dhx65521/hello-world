// 仓库：金币、种子、道具、果实，以及做题记录
import { h, scene, button } from '../core/ui.js';
import { currentKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton } from '../core/widgets.js';
import { loadFarmData, seedById, itemById } from './home.js';
import { t, name } from '../core/i18n.js';

export async function bagScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  await loadFarmData();
  audio.music('shop');
  const ui = scene({ title: t('bagTitle'), theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });
  const inv = kid.inventory;
  const section = (title, entries, lookup, empty, extra = null) => {
    const grid = h('div', { class: 'bag-grid' });
    const list = Object.entries(entries).filter(([, n]) => n > 0);
    if (!list.length) grid.append(h('div', { class: 'hint' }, empty));
    for (const [id, n] of list) { const d = lookup(id); grid.append(h('div', { class: 'bag-slot' }, h('span', { class: 'em' }, d?.emoji || '❓'), h('span', { class: 'nm' }, name(d) || id), h('span', { class: 'cnt' }, `×${n}`))); }
    return h('div', { class: 'card' }, h('div', { class: 'h2' }, title), grid, extra);
  };
  const s = kid.stats;
  const cropsCount = Object.values(inv.crops).reduce((a, b) => a + b, 0);
  ui.body.append(
    h('div', { class: 'card coins-card' }, h('div', { class: 'big-emoji' }, '🪙'), h('div', { class: 'h1' }, t('coinsCount', { n: kid.coins })), h('div', { class: 'hint' }, t('harvestedTimes', { n: kid.farm.harvests || 0 }))),
    section(t('seeds'), inv.seeds, seedById, t('noSeedsBag'), h('div', { class: 'row left', style: { marginTop: '10px' } }, button(t('goShop'), () => go('shop'), 'soft'))),
    section(t('items'), inv.items, itemById, t('noItems')),
    section(t('crops'), inv.crops, seedById, t('noCropsBag'), cropsCount ? h('div', { class: 'row left', style: { marginTop: '10px' } }, button(t('goSell'), () => go('shop', { tab: 'sell' }), 'primary')) : null),
    h('div', { class: 'card' }, h('div', { class: 'h2' }, t('mathRecord')),
      h('div', { class: 'stat-row' }, h('span', {}, t('rounds')), h('b', {}, s.rounds)),
      h('div', { class: 'stat-row' }, h('span', {}, t('rightOverAnswered')), h('b', {}, `${s.correct} / ${s.answered}`)),
      h('div', { class: 'stat-row' }, h('span', {}, t('bestRound')), h('b', {}, `🪙 ${s.best}`)),
      h('div', { class: 'stat-row' }, h('span', {}, t('totalEarned')), h('b', {}, `🪙 ${s.coinsEarned}`)),
    ),
  );
}
