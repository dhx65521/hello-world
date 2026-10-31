// 界面小工具：建元素、页面骨架、覆盖层、长按。
import * as sound from './sound.js';

/** h('div', {class:'x', onclick: fn}, child1, child2...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const appRoot = () => document.getElementById('app');

/** 清空并返回 #app */
export function clearApp() {
  const root = appRoot();
  root.innerHTML = '';
  return root;
}

/**
 * 标准页面：顶栏（返回按钮 + 标题 + 右侧按钮）+ 内容区
 * 返回 { root, body, setTitle, right }
 */
export function screen({ title = '', onBack = null, rightButton = null, scroll = false, color = null } = {}) {
  const root = clearApp();
  if (color) root.style.setProperty('--accent', color);
  const back = onBack
    ? h('button', { class: 'btn icon', 'aria-label': '返回', onclick: () => { sound.tap(); onBack(); } }, '⬅️')
    : h('div', { class: 'spacer' });
  const titleEl = h('div', { class: 'title' }, title);
  const right = rightButton || h('div', { class: 'spacer' });
  const topbar = h('div', { class: 'topbar' }, back, titleEl, right);
  const body = h('div', { class: 'screen-body' + (scroll ? ' scrollable' : '') });
  root.append(topbar, body);
  return { root, body, topbar, setTitle: (t) => { titleEl.textContent = t; }, right };
}

/** 朗读按钮（小喇叭） */
export function speakerButton(onClick) {
  return h('button', { class: 'btn icon round', 'aria-label': '再听一次', onclick: () => { sound.tap(); onClick(); } }, '🔊');
}

/** 大按钮 */
export function bigButton(label, onClick, cls = '') {
  return h('button', { class: 'btn big ' + cls, onclick: (e) => { sound.tap(); onClick(e); } }, label);
}

/** 覆盖层（休息提醒、总结等） */
export function showOverlay(content) {
  const root = document.getElementById('overlay-root');
  root.innerHTML = '';
  const ov = h('div', { class: 'overlay' }, content);
  root.append(ov);
  return ov;
}
export function hideOverlay() {
  document.getElementById('overlay-root').innerHTML = '';
}

/**
 * 长按：按住 ms 毫秒后触发 onDone；onProgress(0~1) 用来画进度。
 * 手指移开 / 滑走就取消。
 */
export function longPress(el, ms, onDone, onProgress = null) {
  let timer = null, startAt = 0, raf = null, active = false;
  const reset = () => {
    active = false;
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = raf = null;
    onProgress?.(0);
  };
  const tick = () => {
    if (!active) return;
    onProgress?.(Math.min(1, (performance.now() - startAt) / ms));
    raf = requestAnimationFrame(tick);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    active = true;
    startAt = performance.now();
    tick();
    timer = setTimeout(() => { if (active) { reset(); onDone(); } }, ms);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, reset));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 随机工具 */
export const rand = (n) => Math.floor(Math.random() * n);
export const randInt = (lo, hi) => lo + rand(hi - lo + 1);
export const pick = (arr) => arr[rand(arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** 从 1..n 中选 k 个不重复、包含 must 的数字，打乱 */
export function choicesAround(answer, lo, hi, count = 3) {
  const set = new Set([answer]);
  let guard = 0;
  while (set.size < Math.min(count, hi - lo + 1) && guard++ < 200) {
    const spread = Math.max(2, Math.ceil(count));
    const v = randInt(Math.max(lo, answer - spread), Math.min(hi, answer + spread));
    set.add(v);
  }
  while (set.size < Math.min(count, hi - lo + 1)) set.add(randInt(lo, hi));
  return shuffle([...set]);
}
