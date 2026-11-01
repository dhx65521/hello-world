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

  // ---------- 房间 ----------
  const roomEl = h('div', { class: 'room-board' });
  roomEl.addEventListener('click', onRoomTap);
  const roomTitle = h('div', { class: 'room-title' }, `🛏️ ${t('room')}`);
  const roomSky = h('div', { class: 'farm-sky room-sky' }, h('span', { class: 'sun' }, '☀️'), h('span', { class: 'cloud c1' }, '☁️'), h('span', { class: 'cloud c2' }, '☁️'), h('span', { class: 'bird' }, '🐦'), h('span', { class: 'butterfly' }, '🦋'));
  const roomWrap = h('div', { class: 'room-wrap' }, roomSky, roomTitle, roomEl);

  // ---------- 右侧 ----------
  const bagBtn = button([h('span', { class: 'emoji' }, '🎒'), h('span', {}, t('bag'))], () => { stop(); go('bag'); }, 'home-btn');
  const left = limits.remaining('math');
  const mathSub = left === Infinity ? null : h('small', { class: 'sub' }, left > 0 ? t('leftToday', { n: left }) : t('noneLeftToday'));
  const ready = readyCount(currentKid());
  const factoryBtn = button([h('span', { class: 'emoji' }, '🏭'), h('span', {}, t('factory')), ready ? h('span', { class: 'dot' }, String(ready)) : null], () => { stop(); go('factory'); }, 'home-btn');
  const menu = h('div', { class: 'home-menu' },
    button([h('span', { class: 'emoji' }, '🧮'), h('span', { class: 'lbl' }, h('span', {}, t('doMath')), mathSub)], () => startMath(), 'home-btn primary' + (left === 0 ? ' dim' : '')),
    button([h('span', { class: 'emoji' }, '🏪'), h('span', {}, t('shopName'))], () => { stop(); go('shop'); }, 'home-btn'),
    factoryBtn,
    bagBtn,
  );
  function startMath() {
    if (limits.remaining('math') > 0) { stop(); return go('math'); }
    audio.sfx('wrong');
    dialog({ emoji: '🌙', title: t('dailyUsedUp'), body: h('div', { class: 'hint' }, t('dailyUsedUpHint', { n: limits.dailyLimit() })), buttons: [
      { label: t('parentUnlock'), cls: 'soft', onClick: () => requirePin(() => { limits.grantBonus(1); toast(t('unlockedRound')); stop(); go('math'); }, t('unlockOnce')) },
      { label: t('tomorrow'), cls: 'primary' }] });
  }
  const panel = h('div', { class: 'plot-panel' });
  ui.body.classList.add('scrollable');
  ui.body.append(h('div', { class: 'home-layout farm-layout' }, h('div', { class: 'home-left' }, board, roomWrap), h('div', { class: 'home-side' }, menu, panel)));

  // ---------- 状态 ----------
  let selected = null;          // 选中的地块序号
  let selFurn = null;           // 选中的家具 uid
  let moving = false;           // 等待点地砖挪动
  const plots = () => currentKid().farm.plots;
  const inv = () => currentKid().inventory;
  const room = () => currentKid().room;

  function renderFarm() {
    const now = Date.now();
    const info = plots().map((p) => {
      if (!p) return { p: null };
      const seed = seedById(p.seed);
      return { p, seed, prog: F.stageProgress(p, seed, now, scale()), ripe: F.isRipe(p), blocked: F.isBlocked(p) };
    });
    field.innerHTML = FI.renderFarm(info, { selected });
  }
  const renderRoom = () => { roomEl.innerHTML = R.renderRoom(room(), { selected: selFurn, moving }); };
  const renderAll = () => { renderFarm(); renderRoom(); renderPanel(); };

  function renderPanel() {
    panel.innerHTML = '';
    if (selFurn) return renderFurnPanel();
    if (selected == null) {
      const need = plots().filter((p) => p && (p.needsWater || p.weeds > 0 || p.bug || F.isRipe(p))).length;
      panel.append(h('div', { class: 'panel-hint' }, need ? t('needCare', { n: need }) : t('tapToPlant')));
      panel.append(h('div', { class: 'row left' }, button(t('place'), () => openPlacePicker(), 'soft')));
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
    selected = i; selFurn = null; moving = false;
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

  // ---------- 房间操作 ----------
  function onRoomTap(e) {
    const itemEl = e.target.closest('.room-item');
    const tileEl = e.target.closest('.tile');
    if (itemEl) {
      const uid = itemEl.dataset.uid;
      if (moving && selFurn && uid !== selFurn) { /* 点到别的家具：当作点地砖忽略 */ }
      selFurn = uid; selected = null; moving = false; audio.sfx('tap'); renderAll(); return;
    }
    if (tileEl) {
      const [x, y] = tileEl.dataset.tile.split(',').map(Number);
      if (moving && selFurn) return moveTo(x, y);
      // 点空地砖：取消选中
      if (selFurn) { selFurn = null; moving = false; audio.sfx('tap'); renderAll(); }
      return;
    }
  }
  function placedOf(uid) { return room().placed.find((p) => p.uid === uid); }
  function wallOf(uid) { return room().wall.find((p) => p.uid === uid); }
  function renderFurnPanel() {
    const p = placedOf(selFurn), wv = wallOf(selFurn);
    const def = R.itemDef((p || wv)?.item);
    if (!def) { selFurn = null; return renderPanel(); }
    const btns = [];
    if (p) {
      if (def.type === 'floor') btns.push(button(t('rotate'), () => rotateSel(), ''));
      btns.push(button(t('move'), () => { moving = !moving; renderRoom(); renderPanel(); }, moving ? 'on' : ''));
      if (def.id === 'bed') btns.push(button(t('changeSheet'), () => openSheetPicker(), 'soft'));
      if (!def.starter) btns.push(button(t('putAway'), () => putAway(), 'soft'));
    } else if (wv) {
      btns.push(button(wv.side === 'left' ? t('rightWall') : t('leftWall'), () => switchWall(), ''));
      btns.push(button(t('putAway'), () => putAway(), 'soft'));
    }
    panel.append(
      h('div', { class: 'panel-head' }, h('span', { class: 'em' }, def.emoji), h('span', {}, h('b', {}, nm(def)), h('div', { class: 'hint' }, moving ? t('move') : t('roomHint')))),
      h('div', { class: 'row left' }, ...btns, button('✕', () => { selFurn = null; moving = false; renderAll(); }, 'icon small')),
    );
  }
  function rotateSel() {
    const p = placedOf(selFurn); if (!p) return; const def = R.itemDef(p.item);
    let rot = (p.rot + 1) % 4;
    // 转不下就试着往回挪一点
    for (let tries = 0; tries < 4; tries++) {
      if (R.canPlace(room(), def, p.x, p.y, rot, p.uid)) { updateKid((k) => { const q = k.room.placed.find((z) => z.uid === p.uid); q.rot = rot; }); audio.sfx('whoosh'); renderAll(); return; }
      const { w, d } = R.dims(def, rot);
      const nx = Math.min(p.x, R.COLS() - w), ny = Math.min(p.y, R.ROWS() - d);
      if (R.canPlace(room(), def, nx, ny, rot, p.uid)) { updateKid((k) => { const q = k.room.placed.find((z) => z.uid === p.uid); q.rot = rot; q.x = nx; q.y = ny; }); audio.sfx('whoosh'); renderAll(); return; }
      rot = (rot + 1) % 4;
    }
    audio.sfx('wrong'); toast(t('noSpace'));
  }
  function moveTo(x, y) {
    const p = placedOf(selFurn); if (!p) return; const def = R.itemDef(p.item);
    const { w, d } = R.dims(def, p.rot);
    const nx = Math.min(x, R.COLS() - w), ny = Math.min(y, R.ROWS() - d);
    if (!R.canPlace(room(), def, nx, ny, p.rot, p.uid)) { audio.sfx('wrong'); shake(roomEl); toast(t('noSpace')); return; }
    updateKid((k) => { const q = k.room.placed.find((z) => z.uid === p.uid); q.x = nx; q.y = ny; });
    moving = false; audio.sfx('pop'); renderAll(); burst(roomEl, ['✨'], 5);
  }
  function switchWall() {
    const wv = wallOf(selFurn); if (!wv) return;
    const side = wv.side === 'left' ? 'right' : 'left';
    const slot = R.freeWallSlot(room(), side);
    if (slot < 0) { audio.sfx('wrong'); toast(t('wallFull')); return; }
    updateKid((k) => { const q = k.room.wall.find((z) => z.uid === wv.uid); q.side = side; q.slot = slot; });
    audio.sfx('whoosh'); renderAll();
  }
  function putAway() {
    const p = placedOf(selFurn), wv = wallOf(selFurn); const item = (p || wv).item;
    updateKid((k) => { k.room.placed = k.room.placed.filter((z) => z.uid !== selFurn); k.room.wall = k.room.wall.filter((z) => z.uid !== selFurn); k.inventory.decor[item] = (k.inventory.decor[item] || 0) + 1; });
    selFurn = null; moving = false; audio.sfx('whoosh'); renderAll(); toast(t('putAwayToast'));
  }
  function openPlacePicker() {
    const owned = Object.entries(inv().decor || {}).filter(([id, n]) => n > 0 && R.itemDef(id) && R.itemDef(id).type !== 'sheet');
    const list = h('div', { class: 'seed-pick' });
    for (const [id, n] of owned) {
      const def = R.itemDef(id);
      list.append(button([h('span', { class: 'em' }, def.emoji), h('span', {}, nm(def)), h('span', { class: 'cnt' }, `×${n}`)], () => { hideOverlay(); placeNew(def); }, 'seed-btn'));
    }
    showOverlay(h('div', { class: 'dialog' },
      h('div', { class: 'dialog-title' }, owned.length ? t('place') : t('nothingToPlace')),
      owned.length ? list : h('div', { class: 'hint' }, t('checkShop')),
      h('div', { class: 'row' }, button(t('goShop'), () => { hideOverlay(); stop(); go('shop', { tab: 'decor' }); }, owned.length ? 'soft' : 'primary'), button(t('cancel'), () => hideOverlay(), 'soft')),
    ));
  }
  function placeNew(def) {
    if (def.type === 'wall') {
      const pick = (side) => {
        const slot = R.freeWallSlot(room(), side);
        if (slot < 0) { audio.sfx('wrong'); toast(t('wallFull')); return; }
        let placed; updateKid((k) => { k.inventory.decor[def.id] -= 1; placed = R.hangItem(k.room, def.id, side, slot); });
        selFurn = placed.uid; audio.sfx('pop'); renderAll(); burst(roomEl, ['✨'], 6); toast(t('placedToast'));
      };
      dialog({ emoji: def.emoji, title: t('hangWhere'), buttons: [{ label: t('leftWall'), cls: 'primary', onClick: () => pick('left') }, { label: t('rightWall'), cls: 'primary', onClick: () => pick('right') }, { label: t('cancel'), cls: 'soft' }] });
      return;
    }
    const pos = R.findFree(room(), def);
    if (!pos) { audio.sfx('wrong'); toast(t('noSpace')); return; }
    let placed; updateKid((k) => { k.inventory.decor[def.id] -= 1; placed = R.placeItem(k.room, def.id, pos); });
    selFurn = placed.uid; moving = false; audio.sfx('pop'); renderAll(); burst(roomEl, ['✨', '🎉'], 8); toast(t('placedToast'));
  }
  function openSheetPicker() {
    const sheets = decorData.items.filter((d) => d.type === 'sheet' && (inv().decor[d.id] || 0) > 0 || (d.type === 'sheet' && room().sheet === d.pattern));
    const list = h('div', { class: 'seed-pick' },
      button([h('span', { class: 'em' }, '⬜'), h('span', {}, t('plainSheet'))], () => { hideOverlay(); setSheet('plain'); }, 'seed-btn' + (room().sheet === 'plain' ? ' on' : '')),
      ...sheets.map((d) => button([h('span', { class: 'em' }, d.emoji), h('span', {}, nm(d))], () => { hideOverlay(); setSheet(d.pattern); }, 'seed-btn' + (room().sheet === d.pattern ? ' on' : ''))));
    showOverlay(h('div', { class: 'dialog' }, h('div', { class: 'dialog-title' }, t('pickSheet')), list,
      h('div', { class: 'row' }, button(t('goShop'), () => { hideOverlay(); stop(); go('shop', { tab: 'decor' }); }, 'soft'), button(t('cancel'), () => hideOverlay(), 'soft'))));
  }
  function setSheet(pattern) { updateKid((k) => { k.room.sheet = pattern; }); audio.sfx('sparkle'); renderAll(); burst(roomEl, ['✨'], 6); }

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
