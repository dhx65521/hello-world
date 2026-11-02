// 主界面 = 农场 + 儿童房：2×4 地块、2.5D 房间、入口按钮、操作面板
import { h, svg, scene, button, longPress, dialog, showOverlay, hideOverlay, toast, sleep, loadJSON } from '../core/ui.js';
import { currentKid, updateKid, setting } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton, kidChip, requirePin } from '../core/widgets.js';
import { burst, flyCoins, pop, shake } from '../core/fx.js';
import { plantSvg } from '../core/plants.js';
import * as F from '../core/farmlogic.js';
import * as R from '../core/room.js';
import * as FI from '../core/farmiso.js';
import { t, name as nm } from '../core/i18n.js';
import * as limits from '../core/limits.js';
import { loadFactoryData, readyCount } from './factory.js';

let farmData = null, decorData = null;
export async function loadFarmData() {
  if (!farmData) farmData = await loadJSON(new URL('../../data/farm.json', import.meta.url));
  return farmData;
}
export async function loadDecorData() {
  if (!decorData) { decorData = await loadJSON(new URL('../../data/decor.json', import.meta.url)); R.setDecor(decorData); }
  return decorData;
}
export const seedById = (id) => farmData?.seeds.find((s) => s.id === id);
export const itemById = (id) => farmData?.items.find((s) => s.id === id);
export const decorById = (id) => decorData?.items.find((s) => s.id === id);
export const stageName = (i) => (document.documentElement.lang === 'en' ? farmData.stageNamesEn : farmData.stageNames)[i];

export async function homeScene() {
  const kid0 = currentKid();
  if (!kid0) return go('kids');
  await Promise.all([loadFarmData(), loadDecorData(), loadFactoryData()]);
  if (!kid0.room) updateKid((k) => { k.room = R.initRoom(); });
  audio.music('farm');
  const cfg = farmData.events;
  const scale = () => Number(setting('timeScale')) || 1;

  const gear = h('button', { class: 'gear', 'aria-label': t('parentArea') }, h('span', { class: 'ring' }), '⚙️');
  longPress(gear, 2500, () => { stop(); go('parent'); }, (p) => gear.style.setProperty('--p', Math.round(p * 100)));
  const ui = scene({ title: '', theme: 'farm', left: kidChip(() => { stop(); go('kids'); }), right: [coinChip(), muteButton(), gear] });

  // ---------- 农场板 ----------
  const field = h('div', { class: 'farm-field' });
  field.addEventListener('click', (e) => { const g = e.target.closest('.plot-iso'); if (g) onPlotTap(Number(g.dataset.i)); });
  const board = h('div', { class: 'farm-board iso' },
    h('div', { class: 'farm-sky' }, h('span', { class: 'sun' }, '☀️'), h('span', { class: 'cloud c1' }, '☁️'), h('span', { class: 'cloud c2' }, '☁️'), h('span', { class: 'bird' }, '🐦')),
    field,
  );
  const plotEl = (i) => field.querySelector(`.plot-iso[data-i="${i}"]`) || field;
  const svgRoot = () => field.querySelector('svg');

  // ---------- 右侧 ----------
  const bagBtn = button([h('span', { class: 'emoji' }, '🎒'), h('span', {}, t('bag'))], () => { stop(); go('bag'); }, 'home-btn');
  const ready = readyCount(currentKid());
  const factoryBtn = button([h('span', { class: 'emoji' }, '🏭'), h('span', {}, t('factory')), ready ? h('span', { class: 'dot' }, String(ready)) : null], () => { stop(); go('factory'); }, 'home-btn');
  const menu = h('div', { class: 'home-menu' },
    button([h('span', { class: 'emoji' }, '🎓'), h('span', {}, t('learn'))], () => { stop(); go('train'); }, 'home-btn primary'),
    button([h('span', { class: 'emoji' }, '🏪'), h('span', {}, t('shopName'))], () => { stop(); go('shop'); }, 'home-btn'),
    factoryBtn,
    bagBtn,
    button([h('span', { class: 'emoji' }, '🛏️'), h('span', {}, t('room'))], () => { stop(); go('room'); }, 'home-btn'),
  );
  const panel = h('div', { class: 'plot-panel' });
    ui.body.append(h('div', { class: 'home-layout stack' }, h('div', { class: 'home-left' }, board), h('div', { class: 'bottom-bar' }, menu, panel)));

  // ---------- 状态 ----------
  let selected = null;          // 选中的地块序号
  const plots = () => currentKid().farm.plots;
  const inv = () => currentKid().inventory;

  function renderFarm() {
    const now = Date.now();
    const info = plots().map((p) => {
      if (!p) return { p: null };
      const seed = seedById(p.seed);
      return { p, seed, prog: F.stageProgress(p, seed, now, scale()), ripe: F.isRipe(p), blocked: F.isBlocked(p) };
    });
    field.innerHTML = FI.renderFarm(info, { selected });
  }
  const renderAll = () => { renderFarm(); renderPanel(); };

  function renderPanel() {
    panel.innerHTML = '';
    if (selected == null) {
      const need = plots().filter((p) => p && (p.needsWater || p.weeds > 0 || p.bug || F.isRipe(p))).length;
      panel.append(h('div', { class: 'panel-hint' }, need ? t('needCare', { n: need }) : t('tapToPlant')));
      return;
    }
    const i = selected, p = plots()[i];
    if (!p) { panel.append(h('div', { class: 'panel-hint' }, t('emptyPlot')), button(t('plantSomething'), () => openSeedPicker(i), 'primary')); return; }
    const seed = seedById(p.seed);
    const now = Date.now();
    const prog = F.stageProgress(p, seed, now, scale());
    const status = F.isRipe(p) ? t('ripeNow') : p.weeds > 0 ? t('weedy') : p.needsWater ? t('thirsty') : p.bug ? t('hasBug') : t('growing', { time: F.fmtRemaining(F.remainingMs(p, seed, now, scale())) });
    const btns = [];
    if (F.isRipe(p)) btns.push(button(t('harvest'), () => harvest(i), 'primary'));
    if (p.needsWater) btns.push(button(t('water'), () => water(i), 'primary'));
    if (p.weeds > 0) btns.push(button(t('pullWeed', { n: p.weeds }), () => pullWeed(i)));
    if (p.bug) btns.push(button(t('spray', { n: inv().items.pesticide || 0 }), () => spray(i), inv().items.pesticide ? '' : 'disabled'));
    if (!F.isRipe(p) && !p.needsWater && p.weeds === 0) btns.push(button(t('fertilize', { n: inv().items.fertilizer || 0 }), () => fertilize(i), inv().items.fertilizer ? '' : 'disabled'));
    btns.push(button('🗑️', () => dialog({ emoji: '🗑️', title: t('removePlant', { seed: nm(seed) }), body: h('div', { class: 'hint' }, t('seedNotReturned')), buttons: [{ label: t('remove'), cls: 'danger', onClick: () => { audio.sfx('dig'); updateKid((k) => { k.farm.plots[i] = null; }); renderAll(); } }, { label: t('no'), cls: 'soft' }] }), 'icon small'));
    panel.append(
      h('div', { class: 'panel-head' }, h('span', { class: 'em' }, seed.emoji), h('span', {}, h('b', {}, nm(seed)), h('div', { class: 'hint' }, t('yieldInfo', { stage: stageName(p.stage), n: F.harvestYield(p, seed) })))),
      h('div', { class: 'stage-bar' }, ...Array.from({ length: 4 }, (_, k) => h('span', { class: k < p.stage ? 'done' : k === p.stage ? 'cur' : '' }, k === p.stage && !F.isRipe(p) ? h('i', { style: { width: Math.round(prog * 100) + '%' } }) : null))),
      h('div', { class: 'panel-status' }, status),
      h('div', { class: 'row left' }, ...btns),
    );
  }

  // ---------- 农场操作 ----------
  function onPlotTap(i) {
    const p = plots()[i];
    selected = i;
    if (!p) { renderAll(); audio.sfx('tap'); return openSeedPicker(i); }
    if (F.isRipe(p)) return harvest(i);
    if (p.weeds > 0) return pullWeed(i);
    if (p.needsWater) return water(i);
    if (p.bug && inv().items.pesticide) return spray(i);
    if (p.bug) { audio.sfx('bug'); toast(t('bugNeedSpray')); }
    else audio.sfx('tap');
    renderAll();
  }
  function openSeedPicker(i) {
    const seeds = Object.entries(inv().seeds).filter(([, n]) => n > 0);
    const list = h('div', { class: 'seed-pick' });
    for (const [id, n] of seeds) {
      const s = seedById(id); if (!s) continue;
      list.append(button([h('span', { class: 'em' }, s.emoji), h('span', {}, nm(s)), h('span', { class: 'cnt' }, `×${n}`)], () => { hideOverlay(); plant(i, id); }, 'seed-btn'));
    }
    showOverlay(h('div', { class: 'dialog' },
      h('div', { class: 'dialog-title' }, seeds.length ? t('whatToPlant') : t('noSeeds')),
      seeds.length ? list : h('div', { class: 'hint' }, t('goBuySeeds')),
      h('div', { class: 'row' }, button(t('goShop'), () => { hideOverlay(); stop(); go('shop'); }, seeds.length ? 'soft' : 'primary'), button(t('cancel'), () => hideOverlay(), 'soft')),
    ));
  }
  async function plant(i, seedId) {
    const seed = seedById(seedId);
    updateKid((k) => { k.inventory.seeds[seedId] -= 1; k.farm.plots[i] = F.newPlot(seedId, Date.now()); });
    audio.sfx('dig');
    renderAll();
    FI.fxInPlot(svgRoot(), i, FI.seedFx(i), 600);
    await sleep(500); audio.sfx('plant');
    toast(t('planted', { seed: nm(seed) }));
  }
  async function water(i) {
    updateKid((k) => { k.farm.plots[i] = F.water(k.farm.plots[i], Date.now()); });
    audio.sfx('water');
    renderAll();
    FI.fxInPlot(svgRoot(), i, FI.waterFx(i), 1000);
    await sleep(900);
  }
  function pullWeed(i) {
    const el = plotEl(i);
    updateKid((k) => { k.farm.plots[i] = F.pullWeed(k.farm.plots[i], Date.now()); });
    audio.sfx('whoosh');
    const w = el.querySelector('.weed'); if (w) { w.classList.add('pulled'); setTimeout(() => renderAll(), 350); } else renderAll();
    if (plots()[i].weeds === 0) { audio.sfx('sparkle'); burst(el, ['🌿', '✨'], 6); }
  }
  function spray(i) {
    if (!inv().items.pesticide) return;
    const el = plotEl(i);
    updateKid((k) => { k.inventory.items.pesticide -= 1; k.farm.plots[i] = F.spray(k.farm.plots[i]); });
    audio.sfx('spray');
    const bug = el.querySelector('.bug'); if (bug) bug.classList.add('flee');
    FI.fxInPlot(svgRoot(), i, FI.sprayFx(i), 700);
    setTimeout(() => { renderAll(); burst(plotEl(i), ['✨'], 5); }, 700);
  }
  function fertilize(i) {
    if (!inv().items.fertilizer) return;
    const el = plotEl(i); const seed = seedById(plots()[i].seed);
    updateKid((k) => { k.inventory.items.fertilizer -= 1; k.farm.plots[i] = F.fertilize(k.farm.plots[i], seed, Date.now()); });
    audio.sfx('sparkle'); burst(el, ['✨', '💛', '🌟'], 12);
    setTimeout(() => { tickAll(true); }, 400);
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
    const el = plotEl(i);
    burst(el, [seed.emoji, '✨'], 10);
    await flyCoins(el, bagBtn, n, seed.emoji);
    pop(bagBtn);
    selected = null; renderAll();
    toast(t('harvested', { n, seed: nm(seed) }));
    for (const s of unlockedNow) { await sleep(600); audio.sfx('fanfare'); dialog({ emoji: s.emoji, title: t('unlockedSeed', { seed: nm(s) }), body: h('div', { class: 'hint' }, t('checkShop')), buttons: [{ label: t('great'), cls: 'primary' }] }); }
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
    const rc = readyCount(currentKid());
    const dot = factoryBtn.querySelector('.dot');
    if (rc && !dot) factoryBtn.append(h('span', { class: 'dot' }, String(rc))); else if (dot && !rc) dot.remove(); else if (dot) dot.textContent = String(rc);
    if (changed) {
      if (evs.includes('ripe')) audio.sfx('sparkle'); else if (evs.includes('grew')) audio.sfx('pop');
      if (evs.includes('bug')) audio.sfx('bug');
      renderAll();
    } else if (!force) {
      plots().forEach((p, i) => { if (p && !F.isBlocked(p) && !F.isRipe(p)) { const ring = field.querySelector(`[data-ring="${i}"]`); if (ring) { const c = Number(ring.dataset.c); ring.setAttribute('stroke-dashoffset', (c * (1 - F.stageProgress(p, seedById(p.seed), now, scale()))).toFixed(1)); } } });
      if (selected != null) renderPanel();
    }
  }
  let timer = setInterval(() => { if (!document.hidden) tickAll(); }, 1000);
  const stop = () => { clearInterval(timer); timer = null; };
  tickAll(true);
  renderAll();
}
