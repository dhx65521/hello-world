// 种子商店：买种子、买道具、卖果实
import { h, scene, button, toast, pick } from '../core/ui.js';
import { currentKid, updateKid, addCoins } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, refreshCoins, muteButton } from '../core/widgets.js';
import { flyCoins, pop, shake, burst } from '../core/fx.js';
import { loadFarmData } from './home.js';
import { fmtRemaining } from '../core/farmlogic.js';

const LINES = {
  welcome: ['欢迎光临！今天想种点什么？', '新鲜的种子，快来看看！', '做数学题赚的金币，可以在这里花哦。'],
  buy: ['谢谢惠顾！', '好眼光！', '记得浇水哦～', '拿好啦！'],
  poor: ['金币不够啦，去做几道数学题吧！', '再攒一攒金币～'],
  sell: ['真新鲜！这些我收了。', '长得真好，谢谢！', '叮当～金币到账！'],
  locked: ['这个要多收获几次才能买哦。'],
};

export async function shopScene({ tab = 'seeds' } = {}) {
  const kid = currentKid();
  if (!kid) return go('kids');
  const data = await loadFarmData();
  audio.music('shop');
  const ui = scene({ title: '🏪 种子商店', theme: 'shop', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });

  const bubble = h('div', { class: 'bubble' }, pick(LINES.welcome));
  const keeper = h('div', { class: 'keeper' }, h('span', { class: 'face' }, '🧑‍🌾'), bubble);
  const say = (kind) => { bubble.textContent = pick(LINES[kind]); pop(bubble); };

  const tabs = h('div', { class: 'seg center shop-tabs' });
  const content = h('div', { class: 'shop-content' });
  let cur = tab;
  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const [id, label] of [['seeds', '🌱 种子'], ['items', '🧰 道具'], ['sell', '🧺 卖果实']]) tabs.append(button(label, () => { cur = id; renderTabs(); render(); }, cur === id ? 'on' : ''));
  };
  const coinEl = () => document.getElementById('coin-chip');

  function seedCard(s) {
    const k = currentKid();
    const locked = (k.farm.harvests || 0) < s.unlock;
    const can = k.coins >= s.price;
    const card = h('div', { class: 'shop-card' + (locked ? ' locked' : '') },
      h('div', { class: 'em' }, locked ? '🔒' : s.emoji),
      h('div', { class: 'name' }, s.name),
      h('div', { class: 'meta' }, locked ? `收获 ${s.unlock} 次解锁（已 ${k.farm.harvests || 0} 次）` : `⏱ ${fmtRemaining(s.growHours * 3600 * 1000)} · 产 ${s.yield} 个 · 卖 ${s.sell}/个`),
      h('div', { class: 'own' }, `已有 ×${k.inventory.seeds[s.id] || 0}`),
      button(locked ? '🔒' : `🪙 ${s.price} 买`, async () => {
        if (locked) { say('locked'); shake(card); return; }
        if (currentKid().coins < s.price) { say('poor'); audio.sfx('wrong'); shake(card); return; }
        addCoins(-s.price); updateKid((kk) => { kk.inventory.seeds[s.id] = (kk.inventory.seeds[s.id] || 0) + 1; });
        audio.sfx('buy'); say('buy'); refreshCoins();
        await flyCoins(coinEl(), card, 1); pop(card); render();
      }, locked ? 'soft' : can ? 'primary' : 'soft'),
    );
    return card;
  }
  function itemCard(it) {
    const k = currentKid(); const can = k.coins >= it.price;
    const card = h('div', { class: 'shop-card' },
      h('div', { class: 'em' }, it.emoji), h('div', { class: 'name' }, it.name), h('div', { class: 'meta' }, it.desc),
      h('div', { class: 'own' }, `已有 ×${k.inventory.items[it.id] || 0}`),
      button(`🪙 ${it.price} 买`, async () => {
        if (currentKid().coins < it.price) { say('poor'); audio.sfx('wrong'); shake(card); return; }
        addCoins(-it.price); updateKid((kk) => { kk.inventory.items[it.id] = (kk.inventory.items[it.id] || 0) + 1; });
        audio.sfx('buy'); say('buy'); refreshCoins();
        await flyCoins(coinEl(), card, 1); pop(card); render();
      }, can ? 'primary' : 'soft'),
    );
    return card;
  }
  function sellCard(s, n) {
    const card = h('div', { class: 'shop-card' },
      h('div', { class: 'em' }, s.emoji), h('div', { class: 'name' }, s.name), h('div', { class: 'meta' }, `每个 🪙 ${s.sell}`),
      h('div', { class: 'own' }, `有 ×${n}`),
      h('div', { class: 'row' },
        button('卖 1 个', () => sell(s, 1, card), 'soft'),
        button(`全部卖 🪙 ${s.sell * n}`, () => sell(s, n, card), 'primary'),
      ),
    );
    return card;
  }
  async function sell(s, n, card) {
    const have = currentKid().inventory.crops[s.id] || 0; n = Math.min(n, have); if (!n) return;
    updateKid((k) => { k.inventory.crops[s.id] -= n; });
    addCoins(s.sell * n);
    audio.sfx('coins'); say('sell'); burst(card, ['🪙', '✨'], 8);
    await flyCoins(card, coinEl(), Math.min(n, 6)); refreshCoins(); render();
  }

  function render() {
    content.innerHTML = '';
    const grid = h('div', { class: 'shop-grid' });
    if (cur === 'seeds') for (const s of data.seeds) grid.append(seedCard(s));
    else if (cur === 'items') for (const it of data.items) grid.append(itemCard(it));
    else {
      const crops = Object.entries(currentKid().inventory.crops).filter(([, n]) => n > 0);
      if (!crops.length) grid.append(h('div', { class: 'hint center', style: { width: '100%' } }, '仓库里还没有果实。种点东西，收获后拿来卖吧！'));
      for (const [id, n] of crops) { const s = data.seeds.find((x) => x.id === id); if (s) grid.append(sellCard(s, n)); }
    }
    content.append(grid);
  }
  renderTabs(); render();
  ui.body.append(keeper, tabs, content);
}
