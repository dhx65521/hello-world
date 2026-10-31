// 圣经模块：故事绘本（大图 + 语音朗读）和背金句小游戏（按顺序点出经文）。
import { h, screen, bigButton, shuffle, loadJSON, speakerButton, sleep, showOverlay, hideOverlay } from '../../js/ui.js';
import { sayZh, sayEn, saySequence, stop as stopSpeech } from '../../js/speech.js';
import * as sound from '../../js/sound.js';
import { starBurst, starBurstAt, recordAnswer, recordRound, encouragement, totalStars } from '../../js/rewards.js';
import { getState, updateState } from '../../js/storage.js';

const MODULE_ID = 'bible';
let stories = null, verses = null;
async function loadData() {
  if (!stories) [stories, verses] = await Promise.all([
    loadJSON(new URL('./stories.json', import.meta.url)).then((d) => d.stories),
    loadJSON(new URL('./verses.json', import.meta.url)).then((d) => d.verses),
  ]);
}

/** 把一串 emoji 拆成单个（兼容组合 emoji） */
function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(str), (s) => s.segment);
  }
  return [...str];
}

// ---------------- 故事列表 ----------------
function storyList({ back, onPick }) {
  const ui = screen({ title: '📖 圣经故事', onBack: back, scroll: true });
  const read = new Set(getState().extra.bibleRead || []);
  const menu = h('div', { class: 'menu' });
  for (const s of stories) {
    menu.append(bigButton([h('span', { class: 'emoji' }, s.emoji), s.title, read.has(s.id) ? h('span', { class: 'mini' }, '⭐ 读过') : null], () => onPick(s)));
  }
  ui.body.append(menu);
  sayZh('选一个故事，我讲给你听。');
}

// ---------------- 绘本阅读 ----------------
function readStory(story, { back }) {
  let i = 0;
  const ui = screen({ title: `${story.emoji} ${story.title}`, onBack: back, rightButton: speakerButton(() => speakPage()) });
  const scene = h('div', { class: 'scene' });
  const text = h('div', { class: 'story-text' });
  const dots = h('div', { class: 'progress' });
  const prev = h('button', { class: 'btn icon huge-nav', onclick: () => { if (i > 0) { sound.tap(); i--; show(); } } }, '◀');
  const next = h('button', { class: 'btn icon huge-nav' }, '▶'); // 点击行为在 show() 里按页设置
  const page = h('div', { class: 'story-page' }, scene, text);
  page.addEventListener('click', () => { sound.tap(); speakPage(); });
  ui.body.append(h('div', { class: 'hz-row story-row' }, prev, page, next), dots);

  const total = story.pages.length + 1; // 最后一页是经文
  const speakPage = () => {
    if (i < story.pages.length) sayZh(story.pages[i].text);
    else saySequence([{ text: story.verse.zh }, { text: story.verse.ref }, { text: story.verse.en, lang: 'en-US' }], 400);
  };
  const show = () => {
    dots.innerHTML = '';
    for (let k = 0; k < total; k++) dots.append(h('span', { class: k <= i ? 'done' : '' }, k < story.pages.length ? '📄' : '📜'));
    prev.style.visibility = i === 0 ? 'hidden' : 'visible';
    page.className = 'story-page';
    if (i < story.pages.length) {
      const p = story.pages[i];
      page.classList.add('bg-' + (p.bg || 'sky'));
      scene.innerHTML = '';
      for (const ch of graphemes(p.scene)) {
        if (ch.trim()) scene.append(h('span', { class: 'scene-item' }, ch));
      }
      text.textContent = p.text;
      next.textContent = '▶';
      next.onclick = () => { sound.tap(); i++; show(); };
    } else {
      page.classList.add('bg-verse');
      scene.innerHTML = '';
      scene.append(h('span', { class: 'scene-item' }, '📜'));
      text.innerHTML = '';
      text.append(
        h('div', { class: 'verse-zh' }, story.verse.zh),
        h('div', { class: 'verse-ref' }, story.verse.ref),
        h('div', { class: 'verse-en' }, story.verse.en),
        h('div', { class: 'verse-ref' }, story.verse.refEn),
      );
      next.textContent = '✅';
      next.onclick = () => finish();
    }
    page.classList.remove('pop'); void page.offsetWidth; page.classList.add('pop');
    speakPage();
  };
  const finish = () => {
    sound.fanfare();
    recordAnswer(MODULE_ID, 'story', true); recordRound(MODULE_ID, 'story');
    updateState((s) => { s.extra.bibleRead = [...new Set([...(s.extra.bibleRead || []), story.id])]; });
    showOverlay(h('div', { class: 'summary' },
      h('div', { class: 'big-emoji' }, story.emoji),
      h('div', { class: 'text' }, '故事讲完啦！'),
      h('div', { class: 'stars-row' }, '⭐'),
      h('div', { class: 'row' }, bigButton('📖 换一个故事', () => { hideOverlay(); back(); }), bigButton('🔁 再听一遍', () => { hideOverlay(); i = 0; show(); }, 'soft')),
    ));
    setTimeout(() => starBurst(window.innerWidth / 2, window.innerHeight / 3, 14), 150);
    sayZh('故事讲完啦，你得到一颗星星！');
  };
  show();
}

// ---------------- 背金句 ----------------
function verseList({ back, onPick }) {
  const ui = screen({ title: '✨ 背金句', onBack: back, scroll: true });
  const grid = h('div', { class: 'verse-list' });
  const done = new Set(getState().extra.bibleVerses || []);
  for (const v of verses) {
    grid.append(h('button', { class: 'btn verse-btn', onclick: () => { sound.tap(); onPick(v); } },
      h('span', { class: 'em' }, v.emoji), h('span', { class: 'zh' }, v.zh), h('span', { class: 'ref' }, v.ref + (done.has(v.ref) ? ' ⭐' : ''))));
  }
  ui.body.append(grid);
  sayZh('选一句金句，我们一起来背。');
}

function playVerse(v, { back }) {
  const ui = screen({ title: `✨ ${v.ref}`, onBack: back, rightButton: speakerButton(() => sayZh(v.zh)) });
  const target = h('div', { class: 'verse-slots' });
  const pool = h('div', { class: 'verse-pool' });
  const enBtn = bigButton('🔊 English', () => saySequence([{ text: v.en, lang: 'en-US' }, { text: v.refEn, lang: 'en-US' }], 300), 'soft');
  ui.body.append(h('div', { class: 'prompt' }, `${v.emoji} 按顺序点一点，拼出金句`), target, pool, h('div', { class: 'row' }, enBtn));

  let nextIdx = 0;
  const slots = v.chunks.map(() => h('div', { class: 'vslot' }, '　'));
  target.append(...slots);
  const tiles = shuffle(v.chunks.map((c, idx) => ({ c, idx })));
  let busy = false;
  for (const t of tiles) {
    const b = h('button', { class: 'btn vtile' }, t.c);
    b.addEventListener('click', async () => {
      if (busy || b.classList.contains('used')) return;
      busy = true;
      if (t.idx === nextIdx) {
        sound.pop(); b.classList.add('used');
        slots[nextIdx].textContent = t.c; slots[nextIdx].classList.add('filled');
        starBurstAt(slots[nextIdx], 5);
        nextIdx++;
        await sayZh(t.c);
        if (nextIdx === v.chunks.length) await complete();
      } else {
        b.classList.add('shake'); sound.gentle();
        await saySequence([{ text: t.c }, { text: `先找「${v.chunks[nextIdx]}」` }], 200);
        b.classList.remove('shake');
      }
      busy = false;
    });
    pool.append(b);
  }
  async function complete() {
    sound.correct();
    recordAnswer(MODULE_ID, 'verse', true); recordRound(MODULE_ID, 'verse');
    updateState((s) => { s.extra.bibleVerses = [...new Set([...(s.extra.bibleVerses || []), v.ref])]; });
    await saySequence([{ text: encouragement() }, { text: v.zh }, { text: v.ref }], 300);
    showOverlay(h('div', { class: 'summary' },
      h('div', { class: 'big-emoji' }, v.emoji),
      h('div', { class: 'text' }, v.zh),
      h('div', { class: 'sub' }, `${v.ref} · ${v.en}`),
      h('div', { class: 'stars-row' }, '⭐'),
      h('div', { class: 'row' }, bigButton('✨ 换一句', () => { hideOverlay(); back(); }), bigButton('🔁 再拼一次', () => { hideOverlay(); playVerse(v, { back }); }, 'soft')),
    ));
    sound.fanfare();
    setTimeout(() => starBurst(window.innerWidth / 2, window.innerHeight / 3, 14), 150);
  }
  saySequence([{ text: '我们一起念：' + v.zh }, { text: '现在按顺序点一点。先找「' + v.chunks[0] + '」' }], 400);
}

// ---------------- 模块定义 ----------------
const ACTIVITIES = [
  { id: 'story', name: '听故事', icon: '📖' },
  { id: 'verse', name: '背金句', icon: '✨' },
];
const bibleModule = {
  id: MODULE_ID, name: '圣经', icon: '📖', color: 'var(--c-bible)', activities: ACTIVITIES,
  async mount({ goHome }) {
    await loadData();
    const showMenu = () => {
      stopSpeech();
      const ui = screen({ title: '📖 圣经', onBack: goHome });
      const menu = h('div', { class: 'menu' });
      for (const act of ACTIVITIES) menu.append(bigButton([h('span', { class: 'emoji' }, act.icon), act.name], () => start(act.id)));
      ui.body.append(menu);
      sayZh('想听故事，还是背金句？');
    };
    const start = (id) => {
      if (id === 'story') { const list = () => storyList({ back: showMenu, onPick: (s) => readStory(s, { back: list }) }); return list(); }
      if (id === 'verse') { const list = () => verseList({ back: showMenu, onPick: (v) => playVerse(v, { back: list }) }); return list(); }
    };
    showMenu();
  },
};
export default bibleModule;
