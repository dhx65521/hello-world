// 主界面 = 农场：2×4 地块 + 数学 / 商店 / 仓库入口 + 地块操作面板
import { h, svg, scene, button, longPress, dialog, showOverlay, hideOverlay, toast, sleep, loadJSON } from '../core/ui.js';
import { currentKid, updateKid, setting } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton, kidChip } from '../core/widgets.js';
import { burst, flyCoins, pop, shake } from '../core/fx.js';
import { plantSvg } from '../core/plants.js';
import * as F from '../core/farmlogic.js';

let farmData = null;
export async function loadFarmData() {
  if (!farmData) farmData = await loadJSON(new URL('../../data/farm.json', import.meta.url));
  return farmData;
}
export const seedById = (id) => farmData?.seeds.find((s) => s.id === id);
export const itemById = (id) => farmData?.items.find((s) => s.id === id);

export async function homeScene() {
  const kid0 = currentKid();
  if (!kid0) return go('kids');
  await loadFarmData();
  audio.music('farm');
  const cfg = farmData.events;
  const scale = () => Number(setting('timeScale')) || 1;

  const gear = h('button', { class: 'gear', 'aria-label': '家长区（长按）' }, h('span', { class: 'ring' }), '⚙️');
  longPress(gear, 2500, () => { stop(); go('parent'); }, (p) => gear.style.setProperty('--p', Math.round(p * 100)));
  const ui = scene({ title: '', theme: 'farm', left: kidChip(() => { stop(); go('kids'); }), right: [coinChip(), muteButton(), gear] });

  // ---------- 农场板 ----------
  const grid = h('div', { class: 'farm-grid' });
  const plotEls = [];
  for (let i = 0; i < 8; i++) {
    const el = h('div', { class: 'plot', dataset: { i } });
    el.addEventListener('click', () => onPlotTap(i));
    plotEls.push(el); grid.append(el);
  }
  const board = h('div', { class: 'farm-board' },
    h('div', { class: 'farm-sky' }, h('span', { class: 'sun' }, '☀️'), h('span', { class: 'cloud c1' }, '☁️'), h('span', { class: 'cloud c2' }, '☁️'), h('span', { class: 'bird' }, '🐦')),
    grid,
    h('div', { class: 'fence' }),
  );

  // ---------- 右侧 ----------
  const bagBtn = button([h('span', { class: 'emoji' }, '🎒'), h('span', {}, '仓库')], () => { stop(); go('bag'); }, 'home-btn');
  const menu = h('div', { class: 'home-menu' },
    button([h('span', { class: 'emoji' }, '🧮'), h('span', {}, '做数学 赚金币')], () => { stop(); go('math'); }, 'home-btn primary'),
    button([h('span', { class: 'emoji' }, '🏪'), h('span', {}, '种子商店')], () => { stop(); go('shop'); }, 'home-btn'),
    bagBtn,
  );
  const panel = h('div', { class: 'plot-panel' });
  ui.body.append(h('div', { class: 'home-layout farm-layout' }, board, h('div', { class: 'home-side' }, menu, panel)));

  // ---------- 状态 ----------
  let selected = null;
  const plots = () => currentKid().farm.plots;
  const inv = () => currentKid().inventory;

  function renderPlot(i) {
    const el = plotEls[i]; const p = plots()[i];
    el.innerHTML = '';
    el.className = 'plot' + (selected === i ? ' selected' : '');
    const soil = h('div', { class: 'soil' + (p && !p.needsWater ? ' wet' : '') });
    el.append(soil);
    if (!p) { el.append(h('div', { class: 'plot-hint' }, '＋')); return; }
    const seed = seedById(p.seed);
    el.append(h('div', { class: 'plant', html: plantSvg(seed, p.stage) }));
    if (p.weeds > 0) el.append(h('div', { class: 'weeds' }, ...Array.from({ length: p.weeds }, (_, k) => h('span', { class: 'weed w' + k }, '🌿'))));
    if (p.bug) el.append(h('span', { class: 'bug' }, '🐛'));
    if (F.isRipe(p)) { el.classList.add('ripe'); el.append(h('span', { class: 'badge ripe-badge' }, '✨')); }
    else if (p.needsWater) el.append(h('span', { class: 'badge water-badge' }, '💧'));
    else if (p.weeds > 0) el.append(h('span', { class: 'badge' }, '🌿'));
    else el.append(h('span', { class: 'badge ring', style: { '--p': Math.round(F.stageProgress(p, seed, Date.now(), scale()) * 100) } }, '⏳'));
  }
  const renderAll = () => { for (let i = 0; i < 8; i++) renderPlot(i); renderPanel(); };

  function renderPanel() {
    panel.innerHTML = '';
    if (selected == null) {
      const need = plots().filter((p) => p && (p.needsWater || p.weeds > 0 || p.bug || F.isRipe(p))).length;
      panel.append(h('div', { class: 'panel-hint' }, need ? `有 ${need} 块地需要照顾 👀` : '点一块地开始种东西吧 🌱'));
      return;
    }
    const i = selected, p = plots()[i];
    if (!p) { panel.append(h('div', { class: 'panel-hint' }, '这块地空着，点一下可以种种子'), button('🌱 种点什么', () => openSeedPicker(i), 'primary')); return; }
    const seed = seedById(p.seed);
    const now = Date.now();
    const prog = F.stageProgress(p, seed, now, scale());
    const status = F.isRipe(p) ? '成熟啦，快收获！' : p.weeds > 0 ? '长草了，点几下拔掉' : p.needsWater ? '口渴了，要浇水' : p.bug ? '有虫子！' : `正在长大… 还要 ${F.fmtRemaining(F.remainingMs(p, seed, now, scale()))}`;
    const btns = [];
    if (F.isRipe(p)) btns.push(button('✨ 收获', () => harvest(i), 'primary'));
    if (p.needsWater) btns.push(button('💧 浇水', () => water(i), 'primary'));
    if (p.weeds > 0) btns.push(button(`🌿 拔草 (${p.weeds})`, () => pullWeed(i)));
    if (p.bug) btns.push(button(`🧴 杀虫 (${inv().items.pesticide || 0})`, () => spray(i), inv().items.pesticide ? '' : 'disabled'));
    if (!F.isRipe(p) && !p.needsWater && p.weeds === 0) btns.push(button(`💩 施肥 (${inv().items.fertilizer || 0})`, () => fertilize(i), inv().items.fertilizer ? '' : 'disabled'));
    btns.push(button('🗑️', () => dialog({ emoji: '🗑️', title: `把${seed.name}铲掉？`, body: h('div', { class: 'hint' }, '种子不会退回。'), buttons: [{ label: '铲掉', cls: 'danger', onClick: () => { audio.sfx('dig'); updateKid((k) => { k.farm.plots[i] = null; }); renderAll(); } }, { label: '不要', cls: 'soft' }] }), 'icon small'));
    panel.append(
      h('div', { class: 'panel-head' }, h('span', { class: 'em' }, seed.emoji), h('span', {}, h('b', {}, seed.name), h('div', { class: 'hint' }, `${farmData.stageNames[p.stage]} · 产量 ${F.harvestYield(p, seed)} 个`))),
      h('div', { class: 'stage-bar' }, ...Array.from({ length: 4 }, (_, k) => h('span', { class: k < p.stage ? 'done' : k === p.stage ? 'cur' : '' }, k === p.stage && !F.isRipe(p) ? h('i', { style: { width: Math.round(prog * 100) + '%' } }) : null))),
      h('div', { class: 'panel-status' }, status),
      h('div', { class: 'row left' }, ...btns),
    );
  }

  // ---------- 操作 ----------
  function onPlotTap(i) {
    const p = plots()[i];
    selected = i;
    if (!p) { renderAll(); audio.sfx('tap'); return openSeedPicker(i); }
    if (F.isRipe(p)) return harvest(i);
    if (p.weeds > 0) return pullWeed(i);
    if (p.needsWater) return water(i);
    if (p.bug && inv().items.pesticide) return spray(i);
    if (p.bug) { audio.sfx('bug'); toast('有虫子！需要杀虫剂，去商店买一瓶吧'); }
    else audio.sfx('tap');
    renderAll();
  }

  function openSeedPicker(i) {
    const seeds = Object.entries(inv().seeds).filter(([, n]) => n > 0);
    const list = h('div', { class: 'seed-pick' });
    for (const [id, n] of seeds) {
      const s = seedById(id); if (!s) continue;
      list.append(button([h('span', { class: 'em' }, s.emoji), h('span', {}, s.name), h('span', { class: 'cnt' }, `×${n}`)], () => { hideOverlay(); plant(i, id); }, 'seed-btn'));
    }
    showOverlay(h('div', { class: 'dialog' },
      h('div', { class: 'dialog-title' }, seeds.length ? '种什么？' : '还没有种子'),
      seeds.length ? list : h('div', { class: 'hint' }, '去商店买一些种子吧。做数学题可以赚金币。'),
      h('div', { class: 'row' }, button('🏪 去商店', () => { hideOverlay(); stop(); go('shop'); }, seeds.length ? 'soft' : 'primary'), button('取消', () => hideOverlay(), 'soft')),
    ));
  }

  async function plant(i, seedId) {
    const seed = seedById(seedId);
    updateKid((k) => { k.inventory.seeds[seedId] -= 1; k.farm.plots[i] = F.newPlot(seedId, Date.now()); });
    audio.sfx('dig');
    const el = plotEls[i]; renderAll();
    const drop = h('span', { class: 'seed-drop' }, '🌰'); el.append(drop);
    await sleep(500); drop.remove(); audio.sfx('plant'); pop(el);
    toast(`种下了${seed.name}，记得浇水 💧`);
  }

  async function water(i) {
    const el = plotEls[i];
    updateKid((k) => { k.farm.plots[i] = F.water(k.farm.plots[i], Date.now()); });
    audio.sfx('water');
    const can = h('span', { class: 'can' }, '🚿'); const drops = h('div', { class: 'drops' }, ...Array.from({ length: 6 }, (_, k) => h('span', { style: { '--k': k } }, '💧')));
    el.append(can, drops);
    await sleep(900); can.remove(); drops.remove();
    renderAll();
  }

  function pullWeed(i) {
    const el = plotEls[i];
    updateKid((k) => { k.farm.plots[i] = F.pullWeed(k.farm.plots[i], Date.now()); });
    audio.sfx('whoosh');
    const w = el.querySelector('.weed'); if (w) { w.classList.add('pulled'); setTimeout(() => renderAll(), 350); } else renderAll();
    if (plots()[i].weeds === 0) { audio.sfx('sparkle'); burst(el, ['🌿', '✨'], 6); }
  }

  function spray(i) {
    if (!inv().items.pesticide) return;
    const el = plotEls[i];
    updateKid((k) => { k.inventory.items.pesticide -= 1; k.farm.plots[i] = F.spray(k.farm.plots[i]); });
    audio.sfx('spray');
    const bug = el.querySelector('.bug'); if (bug) bug.classList.add('flee');
    const mist = h('span', { class: 'mist' }, '🧴'); el.append(mist);
    setTimeout(() => { mist.remove(); renderAll(); burst(el, ['✨'], 5); }, 700);
  }

  function fertilize(i) {
    if (!inv().items.fertilizer) return;
    const el = plotEls[i]; const seed = seedById(plots()[i].seed);
    updateKid((k) => { k.inventory.items.fertilizer -= 1; k.farm.plots[i] = F.fertilize(k.farm.plots[i], seed, Date.now()); });
    audio.sfx('sparkle'); burst(el, ['✨', '💛', '🌟'], 12);
    setTimeout(() => { tickAll(true); pop(el); }, 400);
  }

  async function harvest(i) {
    const p = plots()[i]; const seed = seedById(p.seed);
    const n = F.harvestYield(p, seed);
    let unlockedNow = [];
    updateKid((k) => {
      k.inventory.crops[seed.id] = (k.inventory.crops[seed.id] || 0) + n;
      k.farm.harvests = (k.farm.harvests || 0) + 1;
      k.farm.plots[i] = null;
      for (const s of farmData.seeds) if (s.unlock > 0 && s.unlock === k.farm.harvests) unlockedNow.push(s);
    });
    audio.sfx('harvest');
    const el = plotEls[i];
    burst(el, [seed.emoji, '✨'], 10);
    await flyCoins(el, bagBtn, n, seed.emoji);
    pop(bagBtn);
    selected = null; renderAll();
    toast(`收获了 ${n} 个${seed.name}，放进仓库了 🎒`);
    for (const s of unlockedNow) { await sleep(600); audio.sfx('fanfare'); dialog({ emoji: s.emoji, title: `解锁了新种子：${s.name}！`, body: h('div', { class: 'hint' }, '去商店看看吧。'), buttons: [{ label: '太好了', cls: 'primary' }] }); }
  }

  // ---------- 时间推进 ----------
  function tickAll(force = false) {
    const now = Date.now(); let changed = false; const evs = [];
    updateKid((k) => {
      k.farm.plots = k.farm.plots.map((p) => {
        if (!p) return p;
        const seed = seedById(p.seed); if (!seed) return null;
        const r = F.tick(p, seed, now, scale(), cfg);
        if (r.events.length) { changed = true; evs.push(...r.events); }
        return r.plot;
      });
    });
    if (changed) {
      if (evs.includes('ripe')) { audio.sfx('sparkle'); }
      else if (evs.includes('grew')) audio.sfx('pop');
      if (evs.includes('bug')) audio.sfx('bug');
      renderAll();
    } else if (!force) {
      // 只刷新进度环与面板文字
      plots().forEach((p, i) => { if (p && !F.isBlocked(p) && !F.isRipe(p)) { const b = plotEls[i].querySelector('.badge.ring'); if (b) b.style.setProperty('--p', Math.round(F.stageProgress(p, seedById(p.seed), now, scale()) * 100)); } });
      if (selected != null) renderPanel();
    }
  }
  let timer = setInterval(() => { if (!document.hidden) tickAll(); }, 1000);
  const stop = () => { clearInterval(timer); timer = null; };
  tickAll(true);
  renderAll();
}
