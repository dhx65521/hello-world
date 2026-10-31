// 使用时长：到时间后温和提示休息；家长长按 3 秒可以继续。
import { getSetting } from './storage.js';
import { h, showOverlay, hideOverlay, longPress } from './ui.js';
import * as sound from './sound.js';
import { sayZh } from './speech.js';

let remaining = 0;     // 秒
let interval = null;
let resting = false;

export function restart() {
  const minutes = Number(getSetting('sessionMinutes')) || 0;
  remaining = minutes * 60;
  if (interval) clearInterval(interval);
  interval = null;
  if (minutes <= 0) return;
  interval = setInterval(tick, 1000);
}

function tick() {
  if (document.visibilityState !== 'visible' || resting) return;
  remaining -= 1;
  if (remaining <= 0) {
    clearInterval(interval);
    interval = null;
    showRest();
  }
}

export function remainingSeconds() {
  return remaining;
}

function showRest() {
  resting = true;
  sound.chime();
  const hold = h('button', { class: 'btn soft', style: { marginTop: '24px', position: 'relative', overflow: 'hidden' } },
    h('span', { class: 'fill', style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0%', background: 'rgba(143,214,148,.5)', transition: 'width .1s linear' } }),
    h('span', { style: { position: 'relative' } }, '家长：长按 3 秒继续'),
  );
  const fill = hold.querySelector('.fill');
  longPress(hold, 3000, () => {
    hideOverlay();
    resting = false;
    restart();
  }, (p) => { fill.style.width = Math.round(p * 100) + '%'; });

  showOverlay(h('div', { class: 'summary' },
    h('div', { class: 'big-emoji' }, '🌙'),
    h('div', { class: 'text' }, '今天玩得真棒！'),
    h('div', { class: 'sub' }, '现在休息一下，眼睛看看远处，喝点水吧～'),
    hold,
  ));
  sayZh('今天玩得真棒！现在休息一下吧，眼睛看看远处，喝点水。');
}
