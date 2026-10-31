// 中文模块：拼音点读、识字卡、听音找字、笔顺描红（hanzi-writer，数据本地打包）。
import { h, screen, bigButton, pick, shuffle, loadScript, loadJSON, speakerButton, sleep } from '../../js/ui.js';
import { runQuiz } from '../../js/quiz.js';
import { sayZh, saySequence, stop as stopSpeech } from '../../js/speech.js';
import * as sound from '../../js/sound.js';
import { starBurstAt, recordAnswer, recordRound, encouragement } from '../../js/rewards.js';
import { getState, updateState } from '../../js/storage.js';

const MODULE_ID = 'chinese';
let data = null;
const HW_BASE = new URL('../../vendor/hanzi-writer/', import.meta.url);

async function loadData() {
  if (!data) data = await loadJSON(new URL('./data.json', import.meta.url));
  return data;
}

// ---------------- 拼音点读 ----------------
function activityPinyin({ back }) {
  const ui = screen({ title: '🔤 拼音', onBack: back });
  let tab = 'initials';
  const tabs = h('div', { class: 'seg center' });
  const banner = h('div', { class: 'banner' }, h('span', { class: 'emoji' }, '👆'), h('span', {}, '点一点，听一听'));
  const grid = h('div', { class: 'pygrid' });
  let lit = null;

  const render = () => {
    tabs.innerHTML = '';
    for (const [id, label] of [['initials', '声母'], ['finals', '韵母']]) {
      tabs.append(h('button', { class: 'btn' + (tab === id ? ' on' : ''), onclick: () => { sound.tap(); tab = id; render(); sayZh(id === 'initials' ? '这些是声母' : '这些是韵母'); } }, label));
    }
    grid.innerHTML = '';
    for (const p of data[tab]) {
      const card = h('button', { class: 'pycard' }, p.l);
      card.addEventListener('click', () => {
        lit?.classList.remove('lit');
        lit = card; card.classList.add('lit');
        sound.pop(); starBurstAt(card, 5);
        banner.innerHTML = '';
        banner.append(h('span', { class: 'emoji' }, p.emoji), h('span', {}, `${p.l}  ${p.word}`));
        saySequence([{ text: p.say }, { text: p.say }, { text: p.word }], 250);
      });
      grid.append(card);
    }
  };
  render();
  ui.body.classList.add('scrollable');
  ui.body.append(tabs, banner, grid);
  sayZh('我们来学拼音。点一点字母，听一听它怎么读。');
}

// ---------------- 识字卡 ----------------
function activityCards({ back, onWrite }) {
  let i = Number(getState().extra.chineseCardIndex) || 0;
  const ui = screen({ title: '🀄 识字卡', onBack: back, rightButton: speakerButton(() => speakCard()) });
  const charEl = h('div', { class: 'hz-char' });
  const pyEl = h('div', { class: 'hz-py' });
  const emojiEl = h('div', { class: 'hz-emoji' });
  const wordEl = h('div', { class: 'hz-word' });
  const counter = h('div', { class: 'hz-counter' });
  const card = h('div', { class: 'hz-card' }, h('div', { class: 'hz-left' }, pyEl, charEl), h('div', { class: 'hz-right' }, emojiEl, wordEl));
  card.addEventListener('click', () => { sound.tap(); speakCard(); starBurstAt(charEl, 6); });

  const cur = () => data.chars[i];
  const speakCard = () => saySequence([{ text: cur().c }, { text: cur().word }], 300);
  const show = () => {
    const c = cur();
    charEl.textContent = c.c; pyEl.textContent = c.py; emojiEl.textContent = c.emoji; wordEl.textContent = c.word;
    counter.textContent = `${i + 1} / ${data.chars.length}`;
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    updateState((s) => { s.extra.chineseCardIndex = i; });
    speakCard();
  };
  const prev = h('button', { class: 'btn icon huge-nav', onclick: () => { sound.tap(); i = (i - 1 + data.chars.length) % data.chars.length; show(); } }, '◀');
  const next = h('button', { class: 'btn icon huge-nav', onclick: () => { sound.tap(); i = (i + 1) % data.chars.length; show(); } }, '▶');
  ui.body.append(
    h('div', { class: 'hz-row' }, prev, card, next),
    h('div', { class: 'row' }, counter, bigButton('✍️ 写一写', () => onWrite(cur().c), 'soft')),
  );
  show();
}

// ---------------- 听音找字 ----------------
function makeFindQuestion() {
  const options = shuffle(data.chars).slice(0, 3);
  const target = pick(options);
  return {
    speak: `找一找，哪个字是，${target.word}的，${target.c}？`,
    promptText: `${target.emoji} 哪个是「${target.c}」？`,
    answer: target.c,
    choiceClass: 'choice hz-choice',
    choices: options.map((c) => ({ value: c.c, label: c.c })),
    wrongHint: (v) => { const o = data.chars.find((x) => x.c === v); return o ? `这个是${o.word}的${o.c}` : ''; },
  };
}

// ---------------- 笔顺描红 ----------------
async function ensureHanziWriter() {
  if (!window.HanziWriter) await loadScript(new URL('hanzi-writer.min.js', HW_BASE).href);
  return window.HanziWriter;
}

function activityWritePicker({ back, onPick }) {
  const ui = screen({ title: '✍️ 描红：选一个字', onBack: back, scroll: true });
  const grid = h('div', { class: 'hz-pick' });
  for (const c of data.chars) {
    grid.append(h('button', { class: 'btn hz-pick-btn', onclick: () => { sound.tap(); onPick(c.c); } }, h('span', { class: 'big' }, c.c), h('span', { class: 'small' }, c.emoji)));
  }
  ui.body.append(grid);
  sayZh('选一个字，我们来写一写。');
}

async function activityWrite(char, { back }) {
  const info = data.chars.find((c) => c.c === char) || { c: char, word: char, emoji: '' };
  const ui = screen({ title: `✍️ 写「${char}」`, onBack: back, rightButton: speakerButton(() => saySequence([{ text: char }, { text: info.word }], 300)) });
  const box = h('div', { class: 'hw-box' });
  const tip = h('div', { class: 'prompt' }, `${info.emoji} 用手指或笔，照着写「${char}」`);
  const btnDemo = bigButton('👀 看一遍', () => demo(), 'soft');
  const btnRetry = bigButton('🔁 重写', () => startQuiz(), 'soft');
  const btnNext = bigButton('➡️ 换一个字', back, 'soft');
  ui.body.append(tip, box, h('div', { class: 'row' }, btnDemo, btnRetry, btnNext));

  let HW;
  try { HW = await ensureHanziWriter(); } catch (e) {
    box.append(h('div', { class: 'text' }, '笔顺功能加载失败，请联网后重试'));
    return;
  }
  const size = Math.floor(Math.min(box.clientWidth, box.clientHeight) || 300);
  const writer = HW.create(box, char, {
    width: size, height: size, padding: Math.round(size * 0.06),
    showOutline: true, showCharacter: false,
    strokeColor: '#FF7F9F', outlineColor: '#E8DFD0', highlightColor: '#8FD694',
    drawingColor: '#4A3F35', drawingWidth: Math.max(14, size * 0.07),
    strokeAnimationSpeed: 1, delayBetweenStrokes: 250,
    leniency: 1.6, showHintAfterMisses: 1, highlightOnComplete: true,
    charDataLoader: (c, onLoad, onError) => fetch(new URL(`data/${c}.json`, HW_BASE)).then((r) => r.json()).then(onLoad).catch(onError),
  });
  // 画田字格
  const svg = box.querySelector('svg');
  if (svg) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="none" stroke="#E8DFD0" stroke-width="2" rx="12"/>
      <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" stroke="#E8DFD0" stroke-width="2" stroke-dasharray="8 8"/>
      <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="#E8DFD0" stroke-width="2" stroke-dasharray="8 8"/>`;
    svg.insertBefore(g, svg.firstChild);
  }

  let busy = false;
  const demo = async () => {
    if (busy) return; busy = true;
    stopSpeech(); sayZh('看，是这样写的。');
    await writer.animateCharacter();
    busy = false;
    startQuiz(false);
  };
  const startQuiz = (speak = true) => {
    busy = false;
    if (speak) sayZh(`来，写一写「${char}」。`);
    writer.quiz({
      onMistake: () => { sound.gentle(); },
      onCorrectStroke: () => { sound.tap(); },
      onComplete: async () => {
        sound.correct(); starBurstAt(box, 16);
        recordAnswer(MODULE_ID, 'write', true); recordRound(MODULE_ID, 'write');
        await saySequence([{ text: encouragement() }, { text: `${char}，${info.word}` }], 200);
      },
    });
  };
  sayZh(`${char}，${info.word}。先看我写一遍。`).then(() => demo());
}

// ---------------- 模块定义 ----------------
const ACTIVITIES = [
  { id: 'pinyin', name: '拼音', icon: '🔤' },
  { id: 'cards', name: '识字卡', icon: '🀄' },
  { id: 'find', name: '听音找字', icon: '👂' },
  { id: 'write', name: '笔顺描红', icon: '✍️' },
];

const chineseModule = {
  id: MODULE_ID, name: '中文', icon: '🀄', color: 'var(--c-chinese)', activities: ACTIVITIES,
  async mount({ goHome }) {
    await loadData();
    const showMenu = () => {
      stopSpeech();
      const ui = screen({ title: '🀄 中文', onBack: goHome });
      const menu = h('div', { class: 'menu' });
      for (const act of ACTIVITIES) menu.append(bigButton([h('span', { class: 'emoji' }, act.icon), act.name], () => start(act.id)));
      ui.body.append(menu);
      sayZh('我们来学中文吧！选一个游戏。');
    };
    const start = (id) => {
      if (id === 'pinyin') return activityPinyin({ back: showMenu });
      if (id === 'cards') return activityCards({ back: showMenu, onWrite: (c) => activityWrite(c, { back: () => start('cards') }) });
      if (id === 'find') return runQuiz({ title: '👂 听音找字', moduleId: MODULE_ID, activityId: 'find', count: 5, makeQuestion: makeFindQuestion, onExit: showMenu });
      if (id === 'write') return activityWritePicker({ back: showMenu, onPick: (c) => activityWrite(c, { back: () => start('write') }) });
    };
    showMenu();
  },
};
export default chineseModule;
