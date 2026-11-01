// 语音：用系统自带的 Web Speech API（iPad / iPhone 上就是系统的朗读声音）。
// 自动挑选当前语言下最自然的声音：优先 Premium / Enhanced（增强版），其次非 compact 的；家长区也可以手动指定。
import { setting, setSetting } from './store.js';
import { lang } from './i18n.js';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voices = [];
const keepAlive = [];
function refresh() { if (supported) voices = speechSynthesis.getVoices() || []; }
if (supported) { refresh(); speechSynthesis.addEventListener?.('voiceschanged', refresh); }

const LANG = { zh: 'zh-CN', en: 'en-US' };
const PREFER = {
  zh: ['Tingting', 'Ting-Ting', 'Lili', 'Yu-shu', 'Meijia', 'Sinji', 'Siri'],
  en: ['Samantha', 'Ava', 'Allison', 'Zoe', 'Nicky', 'Joelle', 'Siri', 'Karen', 'Daniel'],
};
const norm = (l) => (l || '').replace('_', '-').toLowerCase();

/** 当前语言可用的声音列表（排好序：越自然越靠前） */
export function voicesFor(l = lang()) {
  refresh();
  const code = LANG[l] || LANG.zh;
  const exact = voices.filter((v) => norm(v.lang) === code.toLowerCase());
  const family = voices.filter((v) => norm(v.lang).startsWith(code.split('-')[0]));
  const pool = (exact.length ? exact : family).slice();
  const score = (v) => {
    const u = (v.voiceURI + ' ' + v.name).toLowerCase();
    let s = 0;
    if (u.includes('premium')) s += 40; else if (u.includes('enhanced')) s += 30;
    if (u.includes('compact')) s -= 20;
    if (u.includes('eloquence')) s -= 30;
    const i = PREFER[l].findIndex((n) => v.name.includes(n)); if (i >= 0) s += 20 - i;
    if (v.localService) s += 2;
    return s;
  };
  pool.sort((a, b) => score(b) - score(a));
  return pool;
}
export function currentVoice(l = lang()) {
  const pool = voicesFor(l);
  const want = setting(l === 'en' ? 'voiceEn' : 'voiceZh');
  return pool.find((v) => v.voiceURI === want) || pool[0] || null;
}
export function setVoice(l, voiceURI) { setSetting(l === 'en' ? 'voiceEn' : 'voiceZh', voiceURI); }

let currentResolve = null;
export function stop() { if (!supported) return; speechSynthesis.cancel(); if (currentResolve) { currentResolve(); currentResolve = null; } }

/** 朗读。返回 Promise。遵循静音开关。 */
export function say(text, { l = lang(), rate = null, interrupt = true } = {}) {
  if (!supported || !text || setting('muted')) return Promise.resolve();
  if (interrupt) stop();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG[l] || LANG.zh;
    u.rate = rate ?? (Number(setting('speechRate')) || 0.9);
    u.pitch = 1.0; u.volume = 1;
    const v = currentVoice(l); if (v) u.voice = v;
    let done = false;
    const finish = () => { if (done) return; done = true; const i = keepAlive.indexOf(u); if (i >= 0) keepAlive.splice(i, 1); if (currentResolve === finish) currentResolve = null; resolve(); };
    u.onend = finish; u.onerror = finish; currentResolve = finish; keepAlive.push(u);
    setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { finish(); } setTimeout(finish, 1500 + text.length * 400); }, 30);
  });
}
export const isSupported = supported;
