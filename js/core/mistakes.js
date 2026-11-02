// 错题本：记录每个孩子在各科目答错的题，之后反复出现，直到连续答对 3 次。
import { currentKid, updateKid } from './store.js';

export const MASTER_STREAK = 3;

/** 记录一次作答。subject: arith / digits / letters / spelling；key: 题目标识；label: 显示用 */
export function record(subject, key, correct, label = key) {
  updateKid((k) => {
    k.mistakes = k.mistakes || {};
    const m = (k.mistakes[subject] = k.mistakes[subject] || {});
    const e = (m[key] = m[key] || { w: 0, r: 0, streak: 0, last: 0, label });
    if (correct) { e.r += 1; e.streak += 1; } else { e.w += 1; e.streak = 0; }
    e.last = Date.now(); e.label = label;
    // 从未错过的题不必保留，省空间
    if (e.w === 0) delete m[key];
  });
}
/** 还没掌握（错过且连续答对不足 3 次）的题 */
export function due(subject, kid = currentKid()) {
  const m = kid?.mistakes?.[subject] || {};
  return Object.entries(m).filter(([, e]) => e.w > 0 && e.streak < MASTER_STREAK).map(([key, e]) => ({ key, ...e }));
}
/** 以一定概率抽一道待复习的题（错得越多越容易被抽到） */
export function pickReview(subject, prob = 0.4, exceptKey = null) {
  const list = due(subject).filter((e) => e.key !== exceptKey);
  if (!list.length || Math.random() > prob) return null;
  const total = list.reduce((a, e) => a + (e.w - e.streak + 1), 0);
  let r = Math.random() * total;
  for (const e of list) { r -= (e.w - e.streak + 1); if (r <= 0) return e; }
  return list[list.length - 1];
}
/** 家长分析用：按错误次数排序 */
export function report(kid, subject, limit = 10) {
  const m = kid?.mistakes?.[subject] || {};
  const all = Object.entries(m).map(([key, e]) => ({ key, ...e }));
  all.sort((a, b) => (b.w - a.w) || (a.streak - b.streak));
  return { top: all.slice(0, limit), total: all.length, mastered: all.filter((e) => e.streak >= MASTER_STREAK).length, due: all.filter((e) => e.streak < MASTER_STREAK).length };
}
