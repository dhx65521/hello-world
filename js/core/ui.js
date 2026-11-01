// 界面小工具：建元素、场景骨架、覆盖层、长按、随机。
import * as audio from './audio.js';

/** h('div', {class:'x', onclick: fn, style:{...}, dataset:{...}, html:'...'}, ...children) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    }
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

/** SVG 字符串转元素 */
export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

export const appRoot = () => document.getElementById('app');
export function clearApp(theme = '') {
  const root = appRoot();
  root.innerHTML = '';
  root.className = theme ? 'theme-' + theme : '';
  return root;
}

/** 场景骨架：顶栏（左按钮 / 标题 / 右侧区）+ 内容区 */
export function scene({ title = '', theme = '', left = null, right = [], scroll = false } = {}) {
  const root = clearApp(theme);
  const topbar = h('div', { class: 'topbar' },
    h('div', { class: 'top-left' }, left),
    h('div', { class: 'top-title' }, title),
    h('div', { class: 'top-right' }, ...[].concat(right)),
  );
  const body = h('div', { class: 'scene-body' + (scroll ? ' scrollable' : '') });
  root.append(topbar, body);
  return { root, body, topbar };
}

/** 按钮（带点击音效） */
export function button(label, onClick, cls = '') {
  const b = h('button', { class: 'btn ' + cls }, ...[].concat(label));
  b.addEventListener('click', (e) => { audio.sfx('tap'); onClick?.(e); });
  return b;
}
export const iconButton = (icon, onClick, cls = '', label = '') => button(icon, onClick, 'icon ' + cls);

/** 覆盖层 */
export function showOverlay(content, cls = '') {
  const root = document.getElementById('overlay-root');
  root.innerHTML = '';
  const ov = h('div', { class: 'overlay ' + cls }, content);
  root.append(ov);
  return ov;
}
export function hideOverlay() { document.getElementById('overlay-root').innerHTML = ''; }

/** 简单对话框：{ title, body, buttons: [{label, cls, onClick}] } */
export function dialog({ emoji = '', title = '', body = null, buttons = [] }) {
  const btns = buttons.map((b) => button(b.label, () => { hideOverlay(); b.onClick?.(); }, b.cls || ''));
  return showOverlay(h('div', { class: 'dialog' },
    emoji ? h('div', { class: 'big-emoji' }, emoji) : null,
    title ? h('div', { class: 'dialog-title' }, title) : null,
    body,
    h('div', { class: 'row' }, ...btns),
  ));
}

/** 小提示（自动消失） */
export function toast(text, ms = 1600) {
  const root = document.getElementById('fx-root');
  const t = h('div', { class: 'toast' }, text);
  root.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

/** 长按 */
export function longPress(el, ms, onDone, onProgress = null) {
  let timer = null, startAt = 0, raf = null, active = false;
  const reset = () => { active = false; clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = null; onProgress?.(0); };
  const tick = () => { if (!active) return; onProgress?.(Math.min(1, (performance.now() - startAt) / ms)); raf = requestAnimationFrame(tick); };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {}
    active = true; startAt = performance.now(); tick();
    timer = setTimeout(() => { if (active) { reset(); onDone(); } }, ms);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, reset));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (n) => Math.floor(Math.random() * n);
export const randInt = (lo, hi) => lo + rand(hi - lo + 1);
export const pick = (arr) => arr[rand(arr.length)];
export function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export async function loadJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('无法读取 ' + url); return r.json(); }
