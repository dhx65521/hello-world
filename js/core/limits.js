// 每日挑战次数：每个孩子每天最多开始 N 局；家长可用密码临时多解锁一次。
import { currentKid, updateKid, setting } from './store.js';

export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function dailyState(kid) {
  const d = kid?.daily;
  if (!d || d.date !== todayKey()) return { date: todayKey(), math: 0, bonus: 0 };
  return d;
}
export const dailyLimit = () => { const v = setting('dailyLimit'); return v == null ? 2 : Number(v); };
export function remaining(activity = 'math', kid = currentKid()) {
  const limit = dailyLimit();
  if (!limit) return Infinity;
  const d = dailyState(kid);
  return Math.max(0, limit + (d.bonus || 0) - (d[activity] || 0));
}
export const usedToday = (activity = 'math', kid = currentKid()) => dailyState(kid)[activity] || 0;
export function consume(activity = 'math') {
  updateKid((k) => { const d = { ...dailyState(k) }; d[activity] = (d[activity] || 0) + 1; k.daily = d; });
}
export function grantBonus(n = 1) {
  updateKid((k) => { const d = { ...dailyState(k) }; d.bonus = (d.bonus || 0) + n; k.daily = d; });
}
