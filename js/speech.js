// 语音：使用浏览器自带的 Web Speech API（iPad Safari 自带中英文声音，不需要联网）。
import { getSetting } from './storage.js';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voices = [];
const keepAlive = []; // iOS 上如果 utterance 被回收，会导致语音中断，所以保留引用

function refreshVoices() {
  if (!supported) return;
  voices = speechSynthesis.getVoices() || [];
}
if (supported) {
  refreshVoices();
  speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

// 优先选择的声音名字（iOS / macOS 自带），其余按语言匹配
const PREFERRED = {
  'zh-CN': ['Tingting', 'Ting-Ting', 'Lili', 'Yu-shu', 'Meijia', 'Siri'],
  'en-US': ['Samantha', 'Ava', 'Allison', 'Nicky', 'Siri', 'Karen', 'Daniel'],
};

const voiceCache = {};
function pickVoice(lang) {
  if (!voices.length) refreshVoices();
  if (voiceCache[lang] && voices.includes(voiceCache[lang])) return voiceCache[lang];
  const norm = (l) => (l || '').replace('_', '-').toLowerCase();
  const exact = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
  const family = voices.filter((v) => norm(v.lang).startsWith(lang.split('-')[0].toLowerCase()));
  const pool = exact.length ? exact : family;
  if (!pool.length) return null;
  const prefs = PREFERRED[lang] || [];
  let best = null;
  for (const name of prefs) {
    best = pool.find((v) => v.name.includes(name));
    if (best) break;
  }
  if (!best) best = pool.find((v) => v.default) || pool[0];
  voiceCache[lang] = best;
  return best;
}

let currentResolve = null;

/** 停止当前朗读 */
export function stop() {
  if (!supported) return;
  speechSynthesis.cancel();
  if (currentResolve) { currentResolve(); currentResolve = null; }
}

/**
 * 朗读一句话。返回 Promise，朗读结束时 resolve。
 * @param {string} text
 * @param {{lang?: 'zh-CN'|'en-US', rate?: number, pitch?: number, interrupt?: boolean}} opts
 */
export function say(text, opts = {}) {
  if (!supported || !text) return Promise.resolve();
  const lang = opts.lang || 'zh-CN';
  const rate = opts.rate ?? getSetting('speechRate') ?? 0.85;
  if (opts.interrupt !== false) stop();

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = opts.pitch ?? 1.05;
    u.volume = 1;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const i = keepAlive.indexOf(u);
      if (i >= 0) keepAlive.splice(i, 1);
      if (currentResolve === finish) currentResolve = null;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    currentResolve = finish;
    keepAlive.push(u);
    // iOS 上 cancel() 之后立刻 speak() 偶尔会被吞掉，稍等一下更稳
    setTimeout(() => {
      try { speechSynthesis.speak(u); } catch (e) { finish(); }
      // 兜底：某些情况下 onend 不触发
      setTimeout(finish, 1500 + text.length * 450);
    }, 40);
  });
}

/** 中文 */
export const sayZh = (text, opts = {}) => say(text, { ...opts, lang: 'zh-CN' });
/** 英文（给孩子听，稍慢一点） */
export const sayEn = (text, opts = {}) => say(text, { ...opts, lang: 'en-US', rate: opts.rate ?? Math.min(0.85, getSetting('speechRate') ?? 0.85) });

/** 按顺序朗读多句：[{ text, lang }] */
export async function saySequence(parts, gapMs = 150) {
  stop();
  for (let i = 0; i < parts.length; i++) {
    const p = typeof parts[i] === 'string' ? { text: parts[i] } : parts[i];
    await say(p.text, { ...p, interrupt: false });
    if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
  }
}

/** iOS 需要在用户第一次点击后"预热"一次语音，之后才能自动播报。 */
let primed = false;
export function prime() {
  if (!supported || primed) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

export const isSupported = supported;
