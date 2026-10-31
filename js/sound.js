// 音效：全部用 Web Audio 实时合成，不需要任何音频文件，离线也能用。
let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 用户第一次触摸时调用，解锁 iOS 的音频 */
export function unlock() {
  const c = getCtx();
  if (!c) return;
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

function tone({ freq = 440, type = 'sine', start = 0, dur = 0.15, vol = 0.25, slideTo = null }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 轻点 */
export function tap() {
  tone({ freq: 660, type: 'sine', dur: 0.08, vol: 0.12 });
}

/** 答对：欢快的上行琶音 */
export function correct() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.09, dur: 0.22, vol: 0.22 }));
}

/** 答错：很温和的"咚"，不刺耳 */
export function gentle() {
  tone({ freq: 330, type: 'sine', dur: 0.18, vol: 0.14, slideTo: 260 });
}

/** 一轮结束：小小的号角 */
export function fanfare() {
  const seq = [523.25, 523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const dur = [0.12, 0.12, 0.14, 0.14, 0.3, 0.14, 0.45];
  let t = 0;
  seq.forEach((f, i) => { tone({ freq: f, type: 'triangle', start: t, dur: dur[i], vol: 0.22 }); t += dur[i] * 0.9; });
}

/** 泡泡"啵" */
export function pop() {
  tone({ freq: 500, type: 'sine', dur: 0.1, vol: 0.15, slideTo: 900 });
}

/** 休息提醒：柔和三音 */
export function chime() {
  [659.25, 523.25, 392].forEach((f, i) => tone({ freq: f, type: 'sine', start: i * 0.35, dur: 0.6, vol: 0.18 }));
}
