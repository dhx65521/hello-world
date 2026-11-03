import { t } from './i18n.js';
// 农场生长逻辑（纯函数，不碰界面）。
// 一块地：null 或 { seed, plantedAt, stage(0..4), stageStartedAt, needsWater, bug, weeds, penalty }
// 生长分 4 段（stage 0→1→2→3→4），每段开始时需要浇水，没浇水 / 有草时不长。
export const STAGES = 5;

export function stageDuration(seed) {
  return (seed.growHours * 3600 * 1000) / (STAGES - 1);
}

export function newPlot(seedId, now) {
  return { seed: seedId, plantedAt: now, stage: 0, stageStartedAt: now, needsWater: true, bug: false, weeds: 0, penalty: 0 };
}

export const isBlocked = (plot) => false; // 现在不再因缺水 / 长草停止生长（窗口期之外孩子无法照料）
export const needsCare = (plot) => !!(plot && (plot.needsWater || plot.weeds > 0 || plot.bug));
export const isRipe = (plot) => plot.stage >= STAGES - 1;

/** 当前这一段已经长了多少（0..1） */
export function stageProgress(plot, seed, now, scale = 1) {
  if (isRipe(plot)) return 1;
  const dur = stageDuration(seed);
  return Math.min(1, ((plot.progress || 0) * dur + (now - plot.stageStartedAt) * scale) / dur);
}

/** 当前这一段还剩多少毫秒（真实时间，已考虑倍速） */
export function remainingMs(plot, seed, now, scale = 1) {
  if (isRipe(plot)) return 0;
  const dur = stageDuration(seed);
  const done = stageProgress(plot, seed, now, scale) * dur;
  return Math.max(0, (dur - done) / scale);
}

/**
 * 推进时间。返回 { plot, events: ['grew','ripe','bug','weeds'] }
 * rng 可注入以便测试。
 */
export function tick(plot, seed, now, scale = 1, cfg = {}, rng = Math.random, open = true) {
  if (!plot || isRipe(plot)) return { plot, events: [] };
  const events = [];
  let p = { ...plot };
  const dur = stageDuration(seed);
  const elapsed = (p.progress || 0) * dur + (now - p.stageStartedAt) * scale;
  if (elapsed < dur) return { plot: p, events };
  // 这一段长完了 → 进入下一段；没照料的事项各扣 1 产量（最少留 1）
  const pen = cfg.carePenalty ?? 1;
  let penalty = 0; if (p.bug) penalty += pen; if (p.weeds > 0) penalty += pen; if (p.needsWater && p.stage > 0) penalty += pen;
  p.penalty = (p.penalty || 0) + penalty;
  p.stage += 1; p.progress = 0; p.stageStartedAt = now; p.bug = false; p.weeds = 0; p.needsWater = false;
  events.push('grew');
  if (isRipe(p)) { events.push('ripe'); return { plot: p, events }; }
  // 只有在开放窗口里才出现需要照料的事（孩子能处理时才有意义）
  if (open) {
    p.needsWater = true;
    if (rng() < (cfg.bugChance ?? 0.3)) { p.bug = true; events.push('bug'); }
    if (rng() < (cfg.weedChance ?? 0.35)) { p.weeds = cfg.weedTaps ?? 3; events.push('weeds'); }
  }
  return { plot: p, events };
}
/** 开放窗口开始时：给正在生长的植物安排照料事项（口渴 / 可能的草和虫） */
export function assignCare(plot, cfg = {}, rng = Math.random) {
  if (!plot || isRipe(plot)) return plot;
  const p = { ...plot, needsWater: true };
  if (!p.bug && rng() < (cfg.bugChance ?? 0.3) * 0.7) p.bug = true;
  if (p.weeds === 0 && rng() < (cfg.weedChance ?? 0.35) * 0.7) p.weeds = cfg.weedTaps ?? 3;
  return p;
}

export function water(plot, now) {
  if (!plot || !plot.needsWater) return plot;
  return { ...plot, needsWater: false };
}
export function pullWeed(plot, now) {
  if (!plot || plot.weeds <= 0) return plot;
  return { ...plot, weeds: plot.weeds - 1 };
}
export function spray(plot) { return plot ? { ...plot, bug: false } : plot; }
/** 施肥：当前这一段立刻长完（相当于把进度补满），下一次 tick 会推进 */
export function fertilize(plot, seed, now) {
  if (!plot || isRipe(plot)) return plot;
  return { ...plot, needsWater: false, weeds: 0, progress: 1, stageStartedAt: now };
}
export function harvestYield(plot, seed) {
  return Math.max(1, seed.yield - (plot.penalty || 0));
}
/** 格式化剩余时间 */
export function fmtRemaining(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return t('sec', { n: s });
  const m = Math.ceil(s / 60);
  if (m < 60) return t('min', { n: m });
  const hh = Math.floor(m / 60), mm = m % 60;
  if (hh < 24) return mm ? t('hourMin', { h: hh, m: mm }) : t('hour', { n: hh });
  const d = Math.floor(hh / 24);
  return t('dayHour', { d, h: hh % 24 });
}
