// 数学模块：认数字、数数、比大小、认形状、加减法。
import { h, screen, bigButton, pick, shuffle, randInt, choicesAround, rand } from '../../js/ui.js';
import { runQuiz } from '../../js/quiz.js';
import { sayZh, stop as stopSpeech } from '../../js/speech.js';
import * as sound from '../../js/sound.js';
import { starBurstAt } from '../../js/rewards.js';

const MODULE_ID = 'math';
let data = null;

async function loadData() {
  if (data) return data;
  const res = await fetch(new URL('./data.json', import.meta.url));
  data = await res.json();
  return data;
}

const zh = (n) => data.numberWords[n] ?? String(n);

/** 形状 SVG 元素 */
function shapeSvg(shape, size = null) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  svg.innerHTML = shape.svg;
  for (const el of svg.children) { el.setAttribute('fill', shape.color); }
  return svg;
}

/** 一排物品（可点数） */
function itemsRow(emoji, n, { countable = false, gone = 0, small = false } = {}) {
  const wrap = h('div', { class: 'items' + (small ? ' small' : '') });
  let counted = 0;
  for (let i = 0; i < n; i++) {
    const el = h('button', { class: 'item' + (i >= n - gone ? ' gone' : ''), tabindex: -1 }, emoji);
    if (countable) {
      el.addEventListener('click', () => {
        if (el.classList.contains('counted')) return;
        counted += 1;
        el.classList.add('counted');
        el.append(h('span', { class: 'badge' }, String(counted)));
        sound.pop();
        sayZh(zh(counted));
      });
    }
    wrap.append(el);
  }
  return wrap;
}

// ---------------- 活动 1：认数字（点读，不计分） ----------------
function activityNumbers({ back }) {
  const ui = screen({ title: '🖐️ 认数字', onBack: back });
  const grid = h('div', { class: 'numgrid' });
  let lit = null;
  for (let n = 1; n <= 10; n++) {
    const card = h('button', { class: 'numcard' }, h('span', {}, String(n)), h('span', { class: 'dots' }, Array.from({ length: n }, () => h('i'))));
    card.addEventListener('click', () => {
      lit?.classList.remove('lit');
      lit = card;
      card.classList.add('lit');
      sound.pop();
      starBurstAt(card, 6);
      sayZh(`${zh(n)}`);
    });
    grid.append(card);
  }
  ui.body.append(h('div', { class: 'prompt' }, '点一点数字，听一听'), grid);
  sayZh('点一点数字，听一听它怎么读。');
}

// ---------------- 活动 2：数数 ----------------
function makeCountingQuestion() {
  const item = pick(data.items);
  const n = randInt(1, data.countMax);
  return {
    speak: `数一数，有几${item.measure}${item.name}？可以用手指点一点。`,
    promptText: `有几${item.measure}${item.name}？`,
    render(area) { area.append(itemsRow(item.emoji, n, { countable: true })); },
    choices: choicesAround(n, 1, data.countMax, 3).map((v) => ({ label: String(v), value: v })),
    answer: n,
    wrongHint: () => '再数一数',
  };
}

// ---------------- 活动 3：比大小 ----------------
function makeCompareQuestion() {
  const [a, b] = shuffle(data.items).slice(0, 2);
  let na = randInt(1, data.countMax), nb = randInt(1, data.countMax);
  while (nb === na) nb = randInt(1, data.countMax);
  const askMore = Math.random() < 0.6;
  const answer = askMore ? (na > nb ? 'L' : 'R') : (na < nb ? 'L' : 'R');
  const word = askMore ? '多' : '少';
  return {
    speak: `哪一边的东西比较${word}？点一点。`,
    promptText: `哪边${word}？`,
    answer,
    render(area, ctx) {
      const card = (side, it, n) => {
        const c = h('button', { class: 'card' }, itemsRow(it.emoji, n, { small: true }), h('span', {}, `${n} ${it.measure}${it.name}`));
        c.addEventListener('click', () => ctx.answer(side, c));
        return c;
      };
      area.append(card('L', a, na), h('div', { class: 'op', style: { fontSize: '48px', color: '#8A7B6E' } }, '🆚'), card('R', b, nb));
    },
    wrongHint: () => `这边比较${askMore ? '少' : '多'}`,
  };
}

// ---------------- 活动 4：认形状 ----------------
function makeShapeQuestion() {
  const options = shuffle(data.shapes).slice(0, 3);
  const target = pick(options);
  return {
    speak: `找一找，哪个是${target.name}？`,
    promptText: `哪个是${target.name}？`,
    answer: target.id,
    choiceClass: 'choice shape-choice',
    choices: options.map((s) => ({ value: s.id, html: shapeSvg(s) })),
    wrongHint: (id) => `这个是${data.shapes.find((s) => s.id === id)?.name ?? ''}`,
  };
}

// ---------------- 活动 5：10 以内加减 ----------------
function makeArithQuestion() {
  const item = pick(data.items);
  const isAdd = Math.random() < 0.6;
  let a, b, answer;
  if (isAdd) {
    a = randInt(1, 9); b = randInt(1, 10 - a); answer = a + b;
  } else {
    a = randInt(2, 10); b = randInt(1, a - 1); answer = a - b;
  }
  const speak = isAdd
    ? `${zh(a)}${item.measure}${item.name}，再加上${zh(b)}${item.measure}，一共有几${item.measure}？`
    : `${zh(a)}${item.measure}${item.name}，拿走了${zh(b)}${item.measure}，还剩几${item.measure}？`;
  return {
    speak,
    promptText: isAdd ? `${a} + ${b} = ?` : `${a} − ${b} = ?`,
    answer,
    render(area) {
      const group = (n, opts = {}) => h('div', { class: 'group' }, itemsRow(item.emoji, n, { small: true, ...opts }), h('span', { class: 'num' }, String(n)));
      if (isAdd) {
        area.append(h('div', { class: 'equation' }, group(a), h('span', { class: 'op' }, '+'), group(b), h('span', { class: 'op' }, '='), h('span', { class: 'q' }, '?')));
      } else {
        area.append(h('div', { class: 'equation' }, group(a, { gone: b }), h('span', { class: 'op' }, '−'), h('span', { class: 'num', style: { fontSize: '56px', fontWeight: 800 } }, String(b)), h('span', { class: 'op' }, '='), h('span', { class: 'q' }, '?')));
      }
    },
    choices: choicesAround(answer, 0, 10, 3).map((v) => ({ label: String(v), value: v })),
    wrongHint: () => (isAdd ? '再数一数一共有几个' : '数一数没有变灰的还有几个'),
  };
}

// ---------------- 模块定义 ----------------
const ACTIVITIES = [
  { id: 'numbers', name: '认数字', icon: '🖐️', run: activityNumbers },
  { id: 'counting', name: '数数', icon: '🍎', quiz: makeCountingQuestion },
  { id: 'compare', name: '比大小', icon: '⚖️', quiz: makeCompareQuestion },
  { id: 'shapes', name: '认形状', icon: '🔺', quiz: makeShapeQuestion },
  { id: 'arith', name: '加减法', icon: '➕', quiz: makeArithQuestion },
];

const mathModule = {
  id: MODULE_ID,
  name: '数学',
  icon: '🔢',
  color: 'var(--c-math)',
  activities: ACTIVITIES,

  async mount({ goHome }) {
    await loadData();
    const showMenu = () => {
      stopSpeech();
      const ui = screen({ title: `${mathModule.icon} ${mathModule.name}`, onBack: goHome });
      const menu = h('div', { class: 'menu' });
      for (const act of ACTIVITIES) {
        menu.append(bigButton([h('span', { class: 'emoji' }, act.icon), act.name], () => start(act)));
      }
      ui.body.append(menu);
      sayZh('我们来玩数学吧！选一个游戏。');
    };
    const start = (act) => {
      if (act.run) return act.run({ back: showMenu });
      runQuiz({
        title: `${act.icon} ${act.name}`,
        moduleId: MODULE_ID,
        activityId: act.id,
        count: data.roundLength,
        makeQuestion: act.quiz,
        onExit: showMenu,
      });
    };
    showMenu();
  },
};

export default mathModule;
