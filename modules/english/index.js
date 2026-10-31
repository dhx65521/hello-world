// 英文模块：字母点读、自然拼读（字母音 + CVC 拼读）、单词配图卡 + 听音选图。
import { h, screen, bigButton, pick, shuffle, loadJSON, speakerButton, sleep } from '../../js/ui.js';
import { runQuiz } from '../../js/quiz.js';
import { sayZh, sayEn, saySequence, stop as stopSpeech } from '../../js/speech.js';
import * as sound from '../../js/sound.js';
import { starBurstAt } from '../../js/rewards.js';

const MODULE_ID = 'english';
let data = null;
async function loadData() {
  if (!data) data = await loadJSON(new URL('./data.json', import.meta.url));
  return data;
}
const en = (text) => ({ text, lang: 'en-US' });
const zh = (text) => ({ text, lang: 'zh-CN' });

// ---------------- 字母点读 ----------------
function activityLetters({ back, phonics = false }) {
  const ui = screen({ title: phonics ? '🔈 字母发音' : '🔤 字母', onBack: back, scroll: true });
  const banner = h('div', { class: 'banner' }, h('span', { class: 'emoji' }, '👆'), h('span', {}, phonics ? '点一点，听字母的发音' : '点一点，听一听'));
  const grid = h('div', { class: 'abcgrid' });
  let lit = null;
  for (const L of data.letters) {
    const card = h('button', { class: 'abccard' }, h('span', { class: 'up' }, L.l), h('span', { class: 'low' }, L.l.toLowerCase()), h('span', { class: 'em' }, L.emoji));
    card.addEventListener('click', () => {
      lit?.classList.remove('lit'); lit = card; card.classList.add('lit');
      sound.pop(); starBurstAt(card, 5);
      banner.innerHTML = '';
      banner.append(h('span', { class: 'emoji' }, L.emoji), h('span', {}, `${L.l} ${L.l.toLowerCase()}  ${L.word}  ${L.zh}`));
      if (phonics) saySequence([en(`${L.l} says ${L.sound}.`), en(`${L.sound}, ${L.sound}, ${L.word}.`)], 200);
      else saySequence([en(`${L.l}.`), en(`${L.l} is for ${L.word}.`), zh(L.zh)], 250);
    });
    grid.append(card);
  }
  ui.body.append(banner, grid);
  if (phonics) saySequence([zh('每个字母都有自己的声音，点一点听一听。')]);
  else saySequence([zh('我们来认字母。点一点字母，听一听。')]);
}

// ---------------- CVC 拼读 ----------------
function activityBlend({ back }) {
  let order = shuffle(data.cvc);
  let i = 0;
  const ui = screen({ title: '🧩 拼读', onBack: back });
  const tiles = h('div', { class: 'blend' });
  const pic = h('div', { class: 'blend-pic' }, '❓');
  const meaning = h('div', { class: 'blend-zh' });
  const blendBtn = bigButton('🔊 连起来读', () => blend());
  const nextBtn = bigButton('➡️ 下一个', () => { i = (i + 1) % order.length; show(); }, 'soft');
  ui.body.append(h('div', { class: 'prompt' }, '点每个字母，再连起来读'), tiles, pic, meaning, h('div', { class: 'row' }, blendBtn, nextBtn));

  const soundOf = (ch) => (data.letters.find((L) => L.l === ch.toUpperCase())?.sound) || ch;
  const cur = () => order[i];
  let revealed = false;
  const show = () => {
    revealed = false;
    tiles.innerHTML = ''; pic.textContent = '❓'; meaning.textContent = '';
    for (const ch of cur().w) {
      const t = h('button', { class: 'btn blend-tile' }, ch);
      t.addEventListener('click', () => { sound.tap(); t.classList.add('lit'); setTimeout(() => t.classList.remove('lit'), 500); sayEn(soundOf(ch)); });
      tiles.append(t);
    }
    saySequence([zh('点一点每个字母，听听它的声音，再连起来读。')]);
  };
  const blend = async () => {
    const w = cur();
    const ts = [...tiles.children];
    stopSpeech();
    for (let k = 0; k < ts.length; k++) {
      ts[k].classList.add('lit');
      await sayEn(soundOf(w.w[k]), { interrupt: false, rate: 0.7 });
      await sleep(120);
    }
    await sayEn(w.w, { interrupt: false, rate: 0.6 });
    await sayEn(w.w, { interrupt: false });
    ts.forEach((t) => t.classList.remove('lit'));
    if (!revealed) { revealed = true; pic.textContent = w.emoji; meaning.textContent = `${w.w}  ${w.zh}`; sound.correct(); starBurstAt(pic, 10); }
    await sayZh(w.zh, { interrupt: false });
  };
  show();
}

// ---------------- 单词卡 ----------------
function activityWords({ back, onQuiz }) {
  const ui = screen({ title: '🖼️ 单词卡', onBack: back, scroll: true });
  const cats = h('div', { class: 'menu' });
  for (const cat of data.categories) {
    cats.append(bigButton([h('span', { class: 'emoji' }, cat.emoji), cat.name], () => showCat(cat)));
  }
  ui.body.append(cats);
  sayZh('选一类单词。');

  function showCat(cat) {
    const u = screen({ title: `${cat.emoji} ${cat.name}`, onBack: () => activityWords({ back, onQuiz }), scroll: true });
    const grid = h('div', { class: 'wordgrid' });
    let lit = null;
    for (const w of cat.words) {
      const card = h('button', { class: 'wordcard' }, h('span', { class: 'em' }, w.emoji), h('span', { class: 'en' }, w.en), h('span', { class: 'zh' }, w.zh));
      card.addEventListener('click', () => {
        lit?.classList.remove('lit'); lit = card; card.classList.add('lit');
        sound.pop(); starBurstAt(card, 5);
        saySequence([en(w.en), en(w.en), zh(w.zh)], 250);
      });
      grid.append(card);
    }
    u.body.append(grid, bigButton('🎯 来玩听音选图', () => onQuiz(cat), 'primary'));
    saySequence([zh('点一点图片，听一听英文。')]);
  }
}

function makeWordQuestion(cat) {
  return () => {
    const pool = cat ? cat.words : data.categories.flatMap((c) => c.words);
    const options = shuffle(pool).slice(0, 3);
    const target = pick(options);
    return {
      speak: [en(`Where is the ${target.en}?`), en(target.en)],
      promptText: `Where is the ${target.en}?`,
      answer: target.en,
      choiceClass: 'choice word-choice',
      choices: options.map((w) => ({ value: w.en, label: w.emoji })),
      wrongHint: (v) => en(`That is a ${v}.`),
    };
  };
}

// ---------------- 模块定义 ----------------
const ACTIVITIES = [
  { id: 'letters', name: '字母', icon: '🔤' },
  { id: 'phonics', name: '字母发音', icon: '🔈' },
  { id: 'blend', name: '拼读', icon: '🧩' },
  { id: 'words', name: '单词卡', icon: '🖼️' },
  { id: 'listen', name: '听音选图', icon: '🎯' },
];

const englishModule = {
  id: MODULE_ID, name: '英文', icon: '🔤', color: 'var(--c-english)', activities: ACTIVITIES,
  async mount({ goHome }) {
    await loadData();
    const showMenu = () => {
      stopSpeech();
      const ui = screen({ title: '🔤 英文', onBack: goHome });
      const menu = h('div', { class: 'menu' });
      for (const act of ACTIVITIES) menu.append(bigButton([h('span', { class: 'emoji' }, act.icon), act.name], () => start(act.id)));
      ui.body.append(menu);
      saySequence([zh('我们来学英文吧！选一个游戏。'), en("Let's learn English!")]);
    };
    const quiz = (cat) => runQuiz({ title: '🎯 听音选图', moduleId: MODULE_ID, activityId: 'listen', count: 5, makeQuestion: makeWordQuestion(cat), onExit: showMenu });
    const start = (id) => {
      if (id === 'letters') return activityLetters({ back: showMenu });
      if (id === 'phonics') return activityLetters({ back: showMenu, phonics: true });
      if (id === 'blend') return activityBlend({ back: showMenu });
      if (id === 'words') return activityWords({ back: showMenu, onQuiz: quiz });
      if (id === 'listen') return quiz(null);
    };
    showMenu();
  },
};
export default englishModule;
