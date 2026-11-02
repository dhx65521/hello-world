// 每日挑战次数：每个孩子每天最多开始 N 局；家长可用密码临时多解锁一次。
import { currentKid, updateKid, setting } from './store.js';

export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function dailyState(kid) {
  const d = kid?.daily;
  if (!d || d.date !== todayKey()) return { date: todayKey(), math: 0, bonus: {} };
  return d;
}
export const dailyLimit = () => { const v = setting('dailyLimit'); return v == null ? 2 : Number(v); };
export function remaining(activity = 'math', kid = currentKid()) {
  const limit = dailyLimit();
  if (!limit) return Infinity;
  const d = dailyState(kid);
  const bonus = typeof d.bonus === 'object' ? (d.bonus?.[activity] || 0) : (activity === 'math' ? (d.bonus || 0) : 0);
  return Math.max(0, limit + bonus - (d[activity] || 0));
}
export const usedToday = (activity = 'math', kid = currentKid()) => dailyState(kid)[activity] || 0;
export function consume(activity = 'math') {
  updateKid((k) => { const d = { ...dailyState(k) }; d[activity] = (d[activity] || 0) + 1; k.daily = d; });
}
export function grantBonus(n = 1, activity = 'math') {
  updateKid((k) => { const d = { ...dailyState(k) }; const b = typeof d.bonus === 'object' ? { ...d.bonus } : { math: d.bonus || 0 }; b[activity] = (b[activity] || 0) + n; d.bonus = b; k.daily = d; });
}
