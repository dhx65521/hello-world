// 音效 + 背景音乐：全部用 Web Audio 实时合成，无音频文件。右上角开关一键静音。
import { setting, setSetting } from './store.js';

let ctx = null, master = null, musicGain = null, sfxGain = null;
function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.10; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.4; sfxGain.connect(master);
    applyMute();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function applyMute() { if (master) master.gain.value = setting('muted') ? 0 : 1; }
export const isMuted = () => !!setting('muted');
export function toggleMute() { setSetting('muted', !setting('muted')); applyMute(); return isMuted(); }

/** 用户第一次触摸时解锁 */
export function unlock() {
  const c = ensure(); if (!c) return;
  const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
  if (pendingSong) { const s2 = pendingSong; pendingSong = null; music(s2); }
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function tone({ freq, type = 'sine', start = 0, dur = 0.15, vol = 0.5, slideTo = null, dest = null, attack = 0.01 }) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ start = 0, dur = 0.2, vol = 0.3, freq = 1200 }) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + start;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(sfxGain); s.start(t0);
}

// ---------- 音效 ----------
const SFX = {
  tap: () => tone({ freq: 700, dur: 0.07, vol: 0.25 }),
  pop: () => tone({ freq: 500, dur: 0.1, vol: 0.3, slideTo: 950 }),
  correct: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.08, dur: 0.22, vol: 0.4 })),
  wrong: () => tone({ freq: 300, dur: 0.22, vol: 0.3, slideTo: 220 }),
  coin: () => { tone({ freq: 1318.5, type: 'square', dur: 0.08, vol: 0.12 }); tone({ freq: 1760, type: 'square', start: 0.08, dur: 0.25, vol: 0.12 }); },
  coins: () => [0, 0.07, 0.14, 0.21].forEach((t, i) => { tone({ freq: 1318.5 + i * 120, type: 'square', start: t, dur: 0.08, vol: 0.1 }); tone({ freq: 1760 + i * 120, type: 'square', start: t + 0.06, dur: 0.18, vol: 0.1 }); }),
  lose: () => [392, 349.23, 311.13].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.12, dur: 0.25, vol: 0.3 })),
  tick: () => tone({ freq: 1000, type: 'square', dur: 0.04, vol: 0.12 }),
  fanfare: () => { const seq = [523.25, 523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5], dur = [0.12, 0.12, 0.14, 0.14, 0.3, 0.14, 0.5]; let t = 0; seq.forEach((f, i) => { tone({ freq: f, type: 'triangle', start: t, dur: dur[i], vol: 0.4 }); t += dur[i] * 0.9; }); },
  water: () => { noise({ dur: 0.5, vol: 0.25, freq: 2500 }); [0.05, 0.18, 0.3].forEach((t) => tone({ freq: 1500, start: t, dur: 0.08, vol: 0.12, slideTo: 2200 })); },
  dig: () => { noise({ dur: 0.18, vol: 0.4, freq: 400 }); tone({ freq: 150, dur: 0.15, vol: 0.3, slideTo: 90 }); },
  plant: () => { tone({ freq: 600, dur: 0.1, vol: 0.25, slideTo: 900 }); tone({ freq: 900, start: 0.1, dur: 0.15, vol: 0.2, slideTo: 1300 }); },
  harvest: () => { tone({ freq: 880, type: 'triangle', dur: 0.1, vol: 0.3 }); tone({ freq: 1174.7, type: 'triangle', start: 0.1, dur: 0.1, vol: 0.3 }); tone({ freq: 1568, type: 'triangle', start: 0.2, dur: 0.3, vol: 0.3 }); },
  bug: () => [0, 0.1, 0.2].forEach((t) => tone({ freq: 2400, type: 'square', start: t, dur: 0.05, vol: 0.06, slideTo: 1800 })),
  spray: () => noise({ dur: 0.4, vol: 0.3, freq: 4000 }),
  sparkle: () => [1760, 2093, 2637, 3136].forEach((f, i) => tone({ freq: f, start: i * 0.06, dur: 0.2, vol: 0.12 })),
  buy: () => { tone({ freq: 880, dur: 0.08, vol: 0.25 }); tone({ freq: 1320, start: 0.08, dur: 0.15, vol: 0.25 }); },
  erase: () => noise({ dur: 0.25, vol: 0.2, freq: 1500 }),
  whoosh: () => noise({ dur: 0.3, vol: 0.2, freq: 800 }),
  open: () => tone({ freq: 440, type: 'triangle', dur: 0.2, vol: 0.25, slideTo: 880 }),
};
export function sfx(name) { try { SFX[name]?.(); } catch (e) { /* ignore */ } }

// ---------- 背景音乐（简单循环旋律） ----------
// 每首曲子：bpm + 旋律 [音高(midi 或 0=休止), 拍数] + 低音
const SONGS = {
  home: { bpm: 96, lead: 'triangle', bass: 'sine',
    melody: [[72, 1], [74, 1], [76, 1], [79, 1], [76, 2], [74, 2], [72, 1], [74, 1], [76, 1], [74, 1], [72, 4], [69, 1], [72, 1], [74, 1], [76, 1], [74, 2], [72, 2], [69, 1], [67, 1], [69, 1], [72, 1], [72, 4]],
    bass: [[48, 4], [53, 4], [55, 4], [48, 4], [45, 4], [53, 4], [55, 4], [48, 4]] },
  math: { bpm: 120, lead: 'square', bass: 'triangle',
    melody: [[76, 0.5], [76, 0.5], [0, 0.5], [76, 0.5], [0, 0.5], [72, 0.5], [76, 1], [79, 1], [0, 1], [67, 1], [0, 1], [72, 1], [0, 0.5], [67, 1], [0, 0.5], [64, 1], [0, 0.5], [69, 1], [71, 1], [70, 0.5], [69, 1], [67, 0.67], [76, 0.67], [79, 0.67], [81, 1], [77, 0.5], [79, 0.5], [0, 0.5], [76, 1], [72, 0.5], [74, 0.5], [71, 1], [0, 1]],
    bass: [[48, 2], [48, 2], [43, 2], [43, 2], [45, 2], [45, 2], [43, 2], [43, 2], [48, 2], [48, 2], [43, 2], [43, 2], [41, 2], [43, 2], [48, 4]] },
  shop: { bpm: 110, lead: 'triangle', bass: 'sine',
    melody: [[67, 0.5], [71, 0.5], [74, 1], [71, 0.5], [67, 0.5], [69, 1], [67, 0.5], [71, 0.5], [74, 1], [76, 2], [74, 0.5], [71, 0.5], [69, 1], [67, 0.5], [64, 0.5], [67, 1], [69, 0.5], [71, 0.5], [67, 1], [62, 2]],
    bass: [[43, 4], [41, 4], [43, 4], [38, 4]] },
  farm: { bpm: 88, lead: 'sine', bass: 'triangle',
    melody: [[64, 1.5], [67, 0.5], [69, 1], [67, 1], [64, 2], [62, 2], [60, 1.5], [62, 0.5], [64, 1], [67, 1], [69, 4], [72, 1.5], [69, 0.5], [67, 1], [64, 1], [62, 2], [64, 2], [60, 4], [0, 4]],
    bass: [[48, 4], [45, 4], [41, 4], [43, 4], [48, 4], [45, 4], [41, 4], [43, 4]] },
};
let current = null, timer = null, pendingSong = null;
let startTime = 0, songLen = 0, nextLoop = 0;

function scheduleSong(name, at) {
  const s = SONGS[name]; const beat = 60 / s.bpm;
  let t = 0;
  for (const [n, d] of s.melody) {
    if (n) tone({ freq: midi(n), type: s.lead, start: at + t - ctx.currentTime, dur: d * beat * 0.9, vol: 0.35, dest: musicGain, attack: 0.02 });
    t += d * beat;
  }
  let tb = 0;
  for (const [n, d] of s.bass) {
    if (n) tone({ freq: midi(n), type: s.bass, start: at + tb - ctx.currentTime, dur: d * beat * 0.95, vol: 0.3, dest: musicGain, attack: 0.03 });
    tb += d * beat;
  }
  return Math.max(t, tb);
}

/** 切换背景音乐；相同曲子不重启 */
export function music(name) {
  if (!name) return stopMusic();
  if (!ctx) { pendingSong = name; return; }
  if (current === name) return;
  stopMusic();
  current = name;
  ensure();
  nextLoop = ctx.currentTime + 0.1;
  const loop = () => {
    while (nextLoop < ctx.currentTime + 1.5) nextLoop += scheduleSong(name, nextLoop);
  };
  loop();
  timer = setInterval(loop, 500);
}
export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null; current = null;
  // 让已排好的音符自然停：直接静音一下再恢复
  if (musicGain && ctx) {
    const g = musicGain.gain; const v = g.value;
    g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0, ctx.currentTime); g.setValueAtTime(v, ctx.currentTime + 2.5);
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { const c = current; stopMusic(); pendingSong = c; } else if (pendingSong && ctx) { const c = pendingSong; pendingSong = null; music(c); } });
