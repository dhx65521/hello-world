// node tools/test-farmlogic.mjs —— 农场逻辑测试（新规则：缺水不再阻挡生长，未照料扣产量）
import { tick, water, newPlot, stageDuration, pullWeed, spray, fertilize, harvestYield, isRipe, remainingMs, assignCare } from '../js/core/farmlogic.js';
const seed = { id: 't', growHours: 48, yield: 3 };
const dur = stageDuration(seed);
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
// 窗口关闭时：不浇水也长，不产生事件，不扣产量
let p = newPlot('t', 0); let ev;
({ plot: p, events: ev } = tick(p, seed, dur, 1, {}, () => 0, false)); assert(p.stage === 1 && !p.needsWater && !p.bug && p.weeds === 0 && p.penalty === 0, '关闭期生长且无事件: ' + JSON.stringify(p));
// 窗口开放时：进入新阶段会口渴，可能长草长虫
let q = newPlot('t', 0); ({ plot: q } = tick(q, seed, dur, 1, {}, () => 0, true)); assert(q.needsWater && q.bug && q.weeds > 0, '开放期有照料事项');
// 没处理 → 下一阶段扣产量 3 项
({ plot: q } = tick(q, seed, dur * 2, 1, {}, () => 1, true)); assert(q.stage === 2 && q.penalty === 3, '未照料扣 3: ' + q.penalty); assert(harvestYield(q, seed) === 1, '最少留 1');
// 处理后不扣
let r = newPlot('t', 0); ({ plot: r } = tick(r, seed, dur, 1, {}, () => 0, true)); r = water(r); r = spray(r); r = pullWeed(r); r = pullWeed(r); r = pullWeed(r);
({ plot: r } = tick(r, seed, dur * 2, 1, {}, () => 1, true)); assert(r.penalty === 0, '照料后不扣');
// 倍速 + 全程成熟
let g = newPlot('t', 0); for (let i = 1; i <= 4; i++) ({ plot: g } = tick(g, seed, dur * i, 1, {}, () => 1, false)); assert(isRipe(g) && remainingMs(g, seed, dur * 4) === 0, '4 段成熟');
// 施肥
let f = newPlot('t', 0); f = fertilize(f, seed, 0); ({ plot: f } = tick(f, seed, 1, 1, {}, () => 1, false)); assert(f.stage === 1, '施肥立刻长完');
// 开窗时安排照料
let a = newPlot('t', 0); ({ plot: a } = tick(a, seed, dur, 1, {}, () => 1, false)); a = assignCare(a, {}, () => 0); assert(a.needsWater && a.bug && a.weeds > 0, 'assignCare');
console.log('farmlogic 测试全部通过');
