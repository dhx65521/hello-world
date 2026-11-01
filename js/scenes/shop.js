// 种子商店：买种子、买道具、卖果实
import { h, scene, button, toast } from '../core/ui.js';
import { currentKid, updateKid, addCoins } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, refreshCoins, muteButton } from '../core/widgets.js';
import { flyCoins, pop, shake, burst } from '../core/fx.js';
import { loadFarmData, loadDecorData, decorById } from './home.js';
import { loadFactoryData, recipeById } from './factory.js';
import { fmtRemaining } from '../core/farmlogic.js';
import { t, name as nm, desc, pickLine } from '../core/i18n.js';



export async function shopScene({ tab = 'seeds' } = {}) {
  const kid = currentKid();
  if (!kid) return go('kids');
  const data = await loadFarmData(); await loadFactoryData(); const decor = await loadDecorData();
  audio.music('shop');
  const ui = scene({ title: '🏪 ' + t('shopName'), theme: 'shop', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });

  const bubble = h('div', { class: 'bubble' }, pickLine('shopWelcome'));
  const keeper = h('div', { class: 'keeper' }, h('span', { class: 'face' }, '🧑‍🌾'), bubble);
  const say = (kind) => { bubble.textContent = pickLine(kind); pop(bubble); };

  const tabs = h('div', { class: 'seg center shop-tabs' });
  const content = h('div', { class: 'shop-content' });
  let cur = tab;
  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const [id, label] of [['seeds', t('tabSeeds')], ['items', t('tabItems')], ['decor', t('tabDecor')], ['sell', t('tabSellAll')]]) tabs.append(button(label, () => { cur = id; renderTabs(); render(); }, cur === id ? 'on' : ''));
  };
  const coinEl = () => document.getElementById('coin-chip');

  function seedCard(s) {
    const k = currentKid();
    const locked = (k.farm.harvests || 0) < s.unlock;
    const can = k.coins >= s.price;
    const card = h('div', { class: 'shop-card' + (locked ? ' locked' : '') },
      h('div', { class: 'em' }, locked ? '🔒' : s.emoji),
      h('div', { class: 'name' }, nm(s)),
      h('div', { class: 'meta' }, locked ? t('unlockAt', { n: s.unlock, x: k.farm.harvests || 0 }) : t('seedMeta', { time: fmtRemaining(s.growHours * 3600 * 1000), y: s.yield, s: s.sell })),
      h('div', { class: 'own' }, t('own', { n: k.inventory.seeds[s.id] || 0 })),
      button(locked ? '🔒' : t('buy', { n: s.price }), async () => {
        if (locked) { say('shopLocked'); shake(card); return; }
        if (currentKid().coins < s.price) { say('shopPoor'); audio.sfx('wrong'); shake(card); return; }
        addCoins(-s.price); updateKid((kk) => { kk.inventory.seeds[s.id] = (kk.inventory.seeds[s.id] || 0) + 1; });
        audio.sfx('buy'); say('shopBuy'); refreshCoins();
        await flyCoins(coinEl(), card, 1); pop(card); render();
      }, locked ? 'soft' : can ? 'primary' : 'soft'),
    );
    return card;
  }
  function itemCard(it) {
    const k = currentKid(); const can = k.coins >= it.price;
    const card = h('div', { class: 'shop-card' },
      h('div', { class: 'em' }, it.emoji), h('div', { class: 'name' }, nm(it)), h('div', { class: 'meta' }, desc(it)),
      h('div', { class: 'own' }, t('own', { n: k.inventory.items[it.id] || 0 })),
      button(t('buy', { n: it.price }), async () => {
        if (currentKid().coins < it.price) { say('shopPoor'); audio.sfx('wrong'); shake(card); return; }
        addCoins(-it.price); updateKid((kk) => { kk.inventory.items[it.id] = (kk.inventory.items[it.id] || 0) + 1; });
        audio.sfx('buy'); say('shopBuy'); refreshCoins();
        await flyCoins(coinEl(), card, 1); pop(card); render();
      }, can ? 'primary' : 'soft'),
    );
    return card;
  }
  function decorCard(it) {
    const k = currentKid(); const owned = k.inventory.decor[it.id] || 0;
    const unique = it.type === 'sheet' || it.type === 'wall';
    const inRoom = (k.room?.placed || []).filter((p) => p.item === it.id).length + (k.room?.wall || []).filter((p) => p.item === it.id).length;
    const soldOut = unique && (owned + inRoom) > 0;
    const can = k.coins >= it.price && !soldOut;
    const card = h('div', { class: 'shop-card' + (soldOut ? ' locked' : '') },
      h('div', { class: 'em' }, it.emoji), h('div', { class: 'name' }, nm(it)),
      h('div', { class: 'meta' }, it.type === 'sheet' ? t('changeSheet') : it.type === 'wall' ? t('hangWhere') : `${it.w}×${it.d}`),
      h('div', { class: 'own' }, soldOut ? t('decorOwned') : t('own', { n: owned + inRoom })),
      button(soldOut ? '✓' : t('buy', { n: it.price }), async () => {
        if (soldOut) return;
        if (currentKid().coins < it.price) { say('shopPoor'); audio.sfx('wrong'); shake(card); return; }
        addCoins(-it.price); updateKid((kk) => { kk.inventory.decor[it.id] = (kk.inventory.decor[it.id] || 0) + 1; });
        audio.sfx('buy'); say('shopBuy'); refreshCoins(); toast(it.type === 'sheet' ? t('sheetBought') : t('decorBought'));
        await flyCoins(coinEl(), card, 1); pop(card); render();
      }, can ? 'primary' : 'soft'),
    );
    return card;
  }
  function sellCard(s, n, kind) {
    const card = h('div', { class: 'shop-card' },
      h('div', { class: 'em' }, s.emoji), h('div', { class: 'name' }, nm(s)), h('div', { class: 'meta' }, t('each', { n: s.sell })),
      h('div', { class: 'own' }, t('have', { n })),
      h('div', { class: 'row' },
        button(t('sellOne'), () => sell(s, 1, card, kind), 'soft'),
        button(t('sellAll', { n: s.sell * n }), () => sell(s, n, card, kind), 'primary'),
      ),
    );
    return card;
  }
  async function sell(s, n, card, kind = 'crops') {
    const have = currentKid().inventory[kind][s.id] || 0; n = Math.min(n, have); if (!n) return;
    updateKid((k) => { k.inventory[kind][s.id] -= n; });
    addCoins(s.sell * n);
    audio.sfx('coins'); say('shopSell'); burst(card, ['🪙', '✨'], 8);
    await flyCoins(card, coinEl(), Math.min(n, 6)); refreshCoins(); render();
  }

  function render() {
    content.innerHTML = '';
    const grid = h('div', { class: 'shop-grid' });
    if (cur === 'seeds') for (const s of data.seeds) grid.append(seedCard(s));
    else if (cur === 'items') for (const it of data.items) grid.append(itemCard(it));
    else if (cur === 'decor') for (const it of decor.items.filter((d) => !d.starter)) grid.append(decorCard(it));
    else {
      const inv = currentKid().inventory;
      const products = Object.entries(inv.products || {}).filter(([, n]) => n > 0);
      const crops = Object.entries(inv.crops).filter(([, n]) => n > 0);
      if (!crops.length && !products.length) grid.append(h('div', { class: 'hint center', style: { width: '100%' } }, t('noCrops')));
      for (const [id, n] of products) { const r = recipeById(id); if (r) grid.append(sellCard(r, n, 'products')); }
      for (const [id, n] of crops) { const s = data.seeds.find((x) => x.id === id); if (s) grid.append(sellCard(s, n, 'crops')); }
    }
    content.append(grid);
  }
  renderTabs(); render();
  ui.body.append(keeper, tabs, content);
}
