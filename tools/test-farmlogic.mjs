// node tools/test-farmlogic.mjs —— 农场逻辑的小测试
import { tick, water, newPlot, stageDuration, pullWeed, spray, fertilize, harvestYield, isRipe, remainingMs } from '../js/core/farmlogic.js';
const seed = { id: 't', growHours: 1, yield: 3 };
const dur = stageDuration(seed);
let now = 0, p = newPlot('t', now);
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
// 没浇水不长
({ plot: p } = tick(p, seed, now + dur * 2, 1, {}, () => 1));
assert(p.stage === 0 && p.needsWater, '没浇水不该长');
p = water(p, now);
({ plot: p } = tick(p, seed, now + dur - 1, 1, {}, () => 1)); assert(p.stage === 0, '时间未到不长');
let ev; ({ plot: p, events: ev } = tick(p, seed, now + dur, 1, {}, () => 1)); assert(p.stage === 1 && p.needsWater && ev.includes('grew'), '到点要长一段并要水');
// 倍速
let q = water(newPlot('t', 0), 0); ({ plot: q } = tick(q, seed, dur / 60, 60)); assert(q.stage === 1, '60 倍速');
// 草挡住
let w = water(newPlot('t', 0), 0); w.weeds = 2; ({ plot: w } = tick(w, seed, dur * 3)); assert(w.stage === 0, '有草不长');
w = pullWeed(w, dur * 3); w = pullWeed(w, dur * 3); assert(w.weeds === 0, '拔草'); ({ plot: w } = tick(w, seed, dur * 4)); assert(w.stage === 1, '拔草后继续');
// 虫子扣产量
let b = water(newPlot('t', 0), 0); b.bug = true; ({ plot: b } = tick(b, seed, dur)); assert(b.penalty === 1, '带虫长一段扣 1'); b = spray(b); assert(!b.bug, '杀虫');
assert(harvestYield(b, seed) === 2, '产量 3-1=2');
// 施肥
let f = newPlot('t', 0); f = fertilize(f, seed, 0); ({ plot: f } = tick(f, seed, 1)); assert(f.stage === 1, '施肥立刻长完');
// 全程到成熟
let g = newPlot('t', 0); let t = 0;
for (let i = 0; i < 4; i++) { g = water(g, t); t += dur; ({ plot: g } = tick(g, seed, t, 1, {}, () => 1)); }
assert(isRipe(g), '4 段后成熟'); assert(remainingMs(g, seed, t) === 0, '成熟剩余 0');
console.log('farmlogic 测试全部通过');
