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

export const isBlocked = (plot) => plot.needsWater || plot.weeds > 0;
export const isRipe = (plot) => plot.stage >= STAGES - 1;

/** 当前这一段已经长了多少（0..1） */
export function stageProgress(plot, seed, now, scale = 1) {
  if (isRipe(plot)) return 1;
  if (isBlocked(plot)) return plot.progress || 0;
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
export function tick(plot, seed, now, scale = 1, cfg = {}, rng = Math.random) {
  if (!plot || isRipe(plot)) return { plot, events: [] };
  const events = [];
  let p = { ...plot };
  if (isBlocked(p)) return { plot: p, events };
  const dur = stageDuration(seed);
  const elapsed = (p.progress || 0) * dur + (now - p.stageStartedAt) * scale;
  if (elapsed < dur) return { plot: p, events };
  // 这一段长完了 → 进入下一段
  p.stage += 1; p.progress = 0; p.stageStartedAt = now;
  events.push('grew');
  if (p.bug) { p.penalty = (p.penalty || 0) + (cfg.bugPenalty ?? 1); }
  if (isRipe(p)) { p.needsWater = false; events.push('ripe'); return { plot: p, events }; }
  p.needsWater = true;
  if (!p.bug && rng() < (cfg.bugChance ?? 0.3)) { p.bug = true; events.push('bug'); }
  if (p.weeds === 0 && rng() < (cfg.weedChance ?? 0.35)) { p.weeds = cfg.weedTaps ?? 3; events.push('weeds'); }
  return { plot: p, events };
}

export function water(plot, now) {
  if (!plot || !plot.needsWater) return plot;
  return { ...plot, needsWater: false, stageStartedAt: now, progress: plot.progress || 0 };
}
export function pullWeed(plot, now) {
  if (!plot || plot.weeds <= 0) return plot;
  const p = { ...plot, weeds: plot.weeds - 1 };
  if (p.weeds === 0 && !p.needsWater) p.stageStartedAt = now; // 重新开始计时
  return p;
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
  if (s < 60) return `${s} 秒`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} 分钟`;
  const hh = Math.floor(m / 60), mm = m % 60;
  if (hh < 24) return mm ? `${hh} 小时 ${mm} 分` : `${hh} 小时`;
  const d = Math.floor(hh / 24);
  return `${d} 天 ${hh % 24} 小时`;
}
