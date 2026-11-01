// 顶栏常用小部件：金币计数、静音开关、孩子头像标签
import { h, svg, button, showOverlay, hideOverlay, toast } from './ui.js';
import { t } from './i18n.js';
import { getState } from './store.js';
import * as audio from './audio.js';
import { currentKid } from './store.js';
import { avatarSvg } from './avatars.js';
import { pop } from './fx.js';

export function coinChip() {
  const kid = currentKid();
  const num = h('span', { class: 'num' }, String(kid?.coins ?? 0));
  const chip = h('div', { class: 'chip coin-chip', id: 'coin-chip' }, h('span', { class: 'ic' }, '🪙'), num);
  chip.refresh = () => { const k = currentKid(); num.textContent = String(k?.coins ?? 0); pop(chip); };
  return chip;
}
export const refreshCoins = () => document.getElementById('coin-chip')?.refresh?.();

export function muteButton() {
  const b = button(audio.isMuted() ? '🔇' : '🔊', () => { const m = audio.toggleMute(); b.textContent = m ? '🔇' : '🔊'; }, 'icon round small');
  b.setAttribute('aria-label', 'sound');
  return b;
}

export function kidChip(onClick) {
  const kid = currentKid();
  if (!kid) return h('div');
  const chip = h('button', { class: 'chip kid-chip' }, h('span', { class: 'av' }, svg(avatarSvg(kid.avatar))), h('span', {}, kid.name));
  if (onClick) chip.addEventListener('click', () => { audio.sfx('tap'); onClick(); });
  return chip;
}

/** 四位 PIN 键盘：onDone(pin) */
export function pinPad({ title = t('enterPin'), onDone, onCancel = null }) {
  let pin = '';
  const dots = h('div', { class: 'pin-dots' });
  const render = () => { dots.innerHTML = ''; for (let i = 0; i < 4; i++) dots.append(h('span', { class: i < pin.length ? 'on' : '' })); };
  render();
  const keys = h('div', { class: 'keypad' });
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']) {
    keys.append(button(k, () => {
      if (k === '⌫') pin = pin.slice(0, -1);
      else if (k === '✓') { if (pin.length === 4) onDone(pin); }
      else if (pin.length < 4) pin += k;
      render();
      if (pin.length === 4 && k !== '✓') setTimeout(() => { if (pin.length === 4) { onDone(pin); } }, 150);
    }, 'key' + (k === '✓' ? ' primary' : '')));
  }
  const wrap = h('div', { class: 'pinpad' }, h('div', { class: 'pin-title' }, title), dots, keys);
  if (onCancel) wrap.append(button(t('cancel'), onCancel, 'soft'));
  wrap.reset = () => { pin = ''; render(); };
  return wrap;
}

/** 弹出密码框，正确后执行 onOk（没有设置密码则直接执行） */
export function requirePin(onOk, title = t('enterParentPin')) {
  const st = getState();
  if (!st.account?.pin) return onOk();
  const pad = pinPad({ title, onDone: (p) => {
    if (p === st.account.pin) { hideOverlay(); audio.sfx('open'); onOk(); }
    else { audio.sfx('wrong'); toast(t('wrongPin')); pad.reset(); }
  }, onCancel: hideOverlay });
  showOverlay(h('div', { class: 'dialog' }, pad));
}
