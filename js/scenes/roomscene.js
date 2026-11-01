// 我的房间：2.5D 房间 + 杂货店 / 背包 / 摆家具入口
import { h, scene, button, longPress, dialog, showOverlay, hideOverlay, toast } from '../core/ui.js';
import { currentKid, updateKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton, kidChip } from '../core/widgets.js';
import { burst, shake } from '../core/fx.js';
import * as R from '../core/room.js';
import { t, name as nm } from '../core/i18n.js';
import { loadDecorData } from './home.js';

export async function roomScene() {
  const kid0 = currentKid();
  if (!kid0) return go('kids');
  const decorData = await loadDecorData();
  if (!kid0.room) updateKid((k) => { k.room = R.initRoom(); });
  audio.music('home');
  const gear = h('button', { class: 'gear', 'aria-label': t('parentArea') }, h('span', { class: 'ring' }), '⚙️');
  longPress(gear, 2500, () => go('parent'), (p) => gear.style.setProperty('--p', Math.round(p * 100)));
  const ui = scene({ title: '', theme: 'farm', left: kidChip(() => go('kids')), right: [coinChip(), muteButton(), gear] });
  const stop = () => {};

  const roomEl = h('div', { class: 'room-board' });
  roomEl.addEventListener('click', onRoomTap);
  const roomTitle = h('div', { class: 'room-title' }, `🛏️ ${t('room')}`);
  const roomSky = h('div', { class: 'farm-sky room-sky' }, h('span', { class: 'sun' }, '☀️'), h('span', { class: 'cloud c1' }, '☁️'), h('span', { class: 'cloud c2' }, '☁️'), h('span', { class: 'bird' }, '🐦'), h('span', { class: 'butterfly' }, '🦋'));
  const roomWrap = h('div', { class: 'room-wrap' }, roomSky, roomTitle, roomEl);

  const menu = h('div', { class: 'home-menu' },
    button([h('span', { class: 'emoji' }, '🌾'), h('span', {}, t('farmPage'))], () => go('home'), 'home-btn primary'),
    button([h('span', { class: 'emoji' }, '🏪'), h('span', {}, t('shopName'))], () => go('shop', { tab: 'decor', from: 'room' }), 'home-btn'),
    button([h('span', { class: 'emoji' }, '🎒'), h('span', {}, t('bag'))], () => go('bag', { from: 'room' }), 'home-btn'),
    button([h('span', { class: 'emoji' }, '🪑'), h('span', {}, t('placeShort'))], () => openPlacePicker(), 'home-btn'),
  );
  const panel = h('div', { class: 'plot-panel' });
  ui.body.classList.add('scrollable');
  ui.body.append(h('div', { class: 'home-layout farm-layout' }, h('div', { class: 'home-left' }, roomWrap), h('div', { class: 'home-side' }, menu, panel)));

  let selFurn = null, moving = false, selected = null;
  const inv = () => currentKid().inventory;
  const room = () => currentKid().room;
  const renderRoom = () => { roomEl.innerHTML = R.renderRoom(room(), { selected: selFurn, moving }); };
  const renderAll = () => { renderRoom(); renderPanel(); };
  function renderPanel() {
    panel.innerHTML = '';
    if (selFurn) return renderFurnPanel();
    const owned = Object.values(inv().decor || {}).reduce((a, b) => a + b, 0);
    panel.append(h('div', { class: 'panel-hint' }, owned ? t('haveToPlace', { n: owned }) : t('roomHint')));
    if (owned) panel.append(h('div', { class: 'row left' }, button(t('place'), () => openPlacePicker(), 'primary')));
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
      h('div', { class: 'row' }, button(t('goShop'), () => { hideOverlay(); go('shop', { tab: 'decor', from: 'room' }); }, owned.length ? 'soft' : 'primary'), button(t('cancel'), () => hideOverlay(), 'soft')),
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
      h('div', { class: 'row' }, button(t('goShop'), () => { hideOverlay(); go('shop', { tab: 'decor', from: 'room' }); }, 'soft'), button(t('cancel'), () => hideOverlay(), 'soft'))));
  }
  function setSheet(pattern) { updateKid((k) => { k.room.sheet = pattern; }); audio.sfx('sparkle'); renderAll(); burst(roomEl, ['✨'], 6); }

  renderAll();
}
