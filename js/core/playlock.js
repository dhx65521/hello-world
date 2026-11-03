// 游戏开放窗口：攒够 N 次学习（完整一局）→ 开放 24 小时的农场 / 商店 / 加工厂 / 房间。
import { currentKid, updateKid, setting } from './store.js';

export const WINDOW_MS = 24 * 3600 * 1000;
export const enabled = () => setting('playLock') !== false;
export const threshold = () => Number(setting('playThreshold')) || 10;
export const stateOf = (kid) => kid?.play || { progress: 0, openUntil: 0 };
export function isOpen(kid = currentKid()) {
  if (!enabled()) return true;
  return (stateOf(kid).openUntil || 0) > Date.now();
}
export const remainingMs = (kid = currentKid()) => Math.max(0, (stateOf(kid).openUntil || 0) - Date.now());
export const progress = (kid = currentKid()) => stateOf(kid).progress || 0;
export const needed = (kid = currentKid()) => Math.max(0, threshold() - progress(kid));

/** 完成一局学习后调用；攒够就开放窗口。返回 true 表示这次刚好开放 */
export function addProgress(n = 1) {
  let opened = false;
  updateKid((k) => {
    const p = (k.play = k.play || { progress: 0, openUntil: 0 });
    p.progress = (p.progress || 0) + n;
    if (p.openUntil <= Date.now() && p.progress >= threshold()) { p.progress -= threshold(); p.openUntil = Date.now() + WINDOW_MS; opened = true; }
  });
  return opened;
}
/** 打开页面时检查：窗口已过期但进度够了 → 直接开放 */
export function settle() {
  let opened = false;
  updateKid((k) => {
    const p = (k.play = k.play || { progress: 0, openUntil: 0 });
    if (p.openUntil <= Date.now() && p.progress >= threshold()) { p.progress -= threshold(); p.openUntil = Date.now() + WINDOW_MS; opened = true; }
  });
  return opened;
}
/** 家长手动开放 */
export function openNow(hours = 24, kidId = null) {
  updateKid((k) => { const p = (k.play = k.play || { progress: 0, openUntil: 0 }); p.openUntil = Date.now() + hours * 3600 * 1000; });
}
export function closeNow() { updateKid((k) => { const p = (k.play = k.play || { progress: 0, openUntil: 0 }); p.openUntil = 0; }); }
