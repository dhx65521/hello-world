// 奖励系统：星星、鼓励语、星星飞出的特效、一轮结束的总结页。
import { getState, updateState } from './storage.js';
import { h, pick, showOverlay, hideOverlay, bigButton } from './ui.js';
import * as sound from './sound.js';
import { sayZh } from './speech.js';

const ENCOURAGE = ['太棒了！', '答对了！', '你真厉害！', '好聪明！', '就是这样！', '真不错！', '耶，对啦！', '好极了！'];
const TRY_AGAIN = ['再试一次吧！', '没关系，再想一想。', '差一点点，再试试！', '嗯，再找找看。'];

export const encouragement = () => pick(ENCOURAGE);
export const tryAgainText = () => pick(TRY_AGAIN);

export function totalStars() {
  return getState().stars || 0;
}

/** 记录一次答题结果，并加星星 */
export function recordAnswer(moduleId, activityId, correct) {
  updateState((s) => {
    const m = (s.modules[moduleId] ||= {});
    const a = (m[activityId] ||= { rounds: 0, correct: 0, total: 0, stars: 0 });
    a.total += 1;
    if (correct) { a.correct += 1; a.stars += 1; s.stars += 1; }
  });
}

export function recordRound(moduleId, activityId) {
  updateState((s) => {
    const m = (s.modules[moduleId] ||= {});
    const a = (m[activityId] ||= { rounds: 0, correct: 0, total: 0, stars: 0 });
    a.rounds += 1;
    a.lastPlayed = Date.now();
  });
}

/** 星星从 (x, y) 飞出来 */
export function starBurst(x, y, count = 10) {
  const root = document.getElementById('fx-root');
  if (!root) return;
  const emojis = ['⭐', '🌟', '✨', '⭐', '💫'];
  for (let i = 0; i < count; i++) {
    const s = h('span', { class: 'fx-star' }, pick(emojis));
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 90 + Math.random() * 110;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 40 + 'px');
    s.style.setProperty('--rot', (Math.random() * 240 - 120) + 'deg');
    root.append(s);
    setTimeout(() => s.remove(), 1000);
  }
}

/** 以某个元素为中心放星星 */
export function starBurstAt(el, count = 10) {
  const r = el.getBoundingClientRect();
  starBurst(r.left + r.width / 2, r.top + r.height / 2, count);
}

/**
 * 一轮结束的总结页
 * @param {{earned:number, total:number, onAgain:Function, onBack:Function}} p
 */
export function showRoundSummary({ earned, total, onAgain, onBack }) {
  sound.fanfare();
  const starsRow = h('div', { class: 'stars-row' }, '⭐'.repeat(Math.max(1, earned)));
  const text = earned >= total
    ? '全部答对，太棒了！'
    : `你得到了 ${earned} 颗星星！`;
  const content = h('div', { class: 'summary' },
    h('div', { class: 'big-emoji' }, earned >= total ? '🏆' : '🎉'),
    h('div', { class: 'text' }, text),
    starsRow,
    h('div', { class: 'sub', style: { color: '#8A7B6E', fontSize: '26px' } }, `现在一共有 ${totalStars()} 颗星星`),
    h('div', { class: 'row' },
      bigButton('🔁 再玩一次', () => { hideOverlay(); onAgain(); }),
      bigButton('🏠 回去', () => { hideOverlay(); onBack(); }),
    ),
  );
  showOverlay(content);
  setTimeout(() => starBurst(window.innerWidth / 2, window.innerHeight / 3, 16), 150);
  sayZh(text + (earned >= total ? '' : '继续加油！'));
}
