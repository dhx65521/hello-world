// 单词拼写：看图 + 听音，三选一或一格写一个字母。
import { randInt, shuffle, loadJSON } from '../core/ui.js';

let data = null;
// 孩子常写混的形近字母组：整词大体正确时，这些替换可以接受
const CONFUSE = ['aqodg', 'iljtf', 'uvyw', 'nhmr', 'ceo', 'bdp', 'kx', 'sz', 'gyq', 'mw', 'ft'];
const confusable = (a, b) => a !== b && CONFUSE.some((g) => g.includes(a) && g.includes(b));
export async function setup(ctx) {
  const { h, button, t, rules, st, speech } = ctx;
  data = data || await loadJSON(new URL('../../data/spelling.json', import.meta.url));
  const words = data.words;
  const byWord = (w) => words.find((x) => x.w === w);
  let q = null, attempts = 0, lastType = 'write', boxes = [];
  const prompt = h('div', { class: 'q-text little-prompt' });
  const feedback = h('div', { class: 'q-feedback' });
  const listenBtn = button(t('listen'), () => speakPrompt(), 'soft listen-btn');
  const qPanel = h('div', { class: 'q-panel' }, ctx.timerEl, h('div', { class: 'q-main' }, prompt, feedback), ctx.score);
  const area = h('div', { class: 'little-area spell' });
  ctx.body.append(h('div', { class: 'math-layout' }, qPanel, listenBtn, area));

  const speakWord = async (w) => { await speech.say(w.w, { l: 'en' }); };
  const speakPrompt = () => { if (q) speakWord(q.word); };
  function makeQuestion() {
    const type = lastType === 'pick' ? 'write' : 'pick';
    lastType = type;
    const rev = ctx.pickReview(q?.word.w ?? null);
    let word = rev ? byWord(rev.key) : null;
    const pool = type === 'write' ? words.filter((w) => w.w.length <= (data.maxLen || 5)) : words;
    if (!word) { word = pool[randInt(0, pool.length - 1)]; if (q && word.w === q.word.w) word = pool[(pool.indexOf(word) + 1) % pool.length]; }
    const opts = new Set([word.w]);
    while (opts.size < 3) { const c = words[randInt(0, words.length - 1)].w; if (c.length <= word.w.length + 2 && c[0] !== undefined) opts.add(c); }
    return { type, word, options: shuffle([...opts]) };
  }
  async function wrong(els, msgKey) {
    attempts += 1; for (const el of els) ctx.shake(el);
    if (attempts === 1) {
      ctx.onWrong(false);
      feedback.textContent = t(msgKey); feedback.className = 'q-feedback bad';
      await speech.say(t('tryAgainSpoken')); await ctx.sleep(300);
      st.busy = false;
    } else {
      ctx.onWrong(true); ctx.record(q.word.w, false, `${q.word.emoji} ${q.word.w}`);
      feedback.textContent = t('spellAnswer', { w: q.word.w }); feedback.className = 'q-feedback bad';
      if (q.type === 'pick') area.querySelector(`.word-opt[data-w="${q.word.w}"]`)?.classList.add('reveal');
      else boxes.forEach((b, i) => { b.hint.textContent = q.word.w[i]; b.hint.classList.add('show'); });
      await speech.say(q.word.w, { l: 'en' }); await ctx.sleep(rules.wrongShowAnswerMs || 1800);
      st.busy = false; if (st.running) next();
    }
  }
  async function right(el) {
    ctx.record(q.word.w, attempts === 0, `${q.word.emoji} ${q.word.w}`);
    await ctx.onCorrect(el, feedback); await speech.say(q.word.w, { l: 'en' }); await ctx.sleep(200);
    st.busy = false; if (st.running) next();
  }
  const picture = () => { const p = h('button', { class: 'spell-pic' }, q.word.emoji); p.addEventListener('click', () => { ctx.audio.sfx('tap'); speakPrompt(); }); return p; };
  function renderPick() {
    prompt.textContent = t('spellPrompt');
    const opts = h('div', { class: 'word-opts' });
    for (const w of q.options) {
      const b = h('button', { class: 'btn word-opt', dataset: { w } }, w);
      b.addEventListener('click', async () => {
        if (st.busy || !st.running) return; st.busy = true; ctx.audio.sfx('tap');
        if (w === q.word.w) { b.classList.add('correct'); await right(b); }
        else { b.classList.add('tried'); await speech.say(w, { l: 'en' }); await wrong([b], 'tryAgainPick'); }
      });
      opts.append(b);
    }
    area.append(h('div', { class: 'spell-row pick' }, picture(), opts));
  }
  function renderWrite() {
    prompt.textContent = t('spellWriteHint', { n: q.word.w.length });
    boxes = [];
    const row = h('div', { class: 'letter-boxes' });
    for (let i = 0; i < q.word.w.length; i++) {
      const recog = h('div', { class: 'recog small' }, '　');
      const hint = h('div', { class: 'letter-hint' }, '');
      const b = ctx.makeBox(() => evaluate(), { letter: true });
      b.recog = recog; b.hint = hint;
      row.append(h('div', { class: 'letter-cell' }, recog, b.el, hint));
      boxes.push(b);
    }
    const clearBtn = button('🧹', () => { boxes.forEach((b) => { b.clear(); b.recog.textContent = '　'; }); ctx.audio.sfx('erase'); }, 'icon round clear-btn');
    area.append(h('div', { class: 'spell-row write', style: { '--n': q.word.w.length } }, picture(), h('div', { class: 'spell-write' }, row, clearBtn)));
    requestAnimationFrame(() => boxes.forEach((b) => b.resize()));
  }
  async function evaluate() {
    if (!st.running || st.busy || q.type !== 'write') return;
    const reads = boxes.map((b) => ctx.readBox(b, 'letters'));
    reads.forEach((r, i) => { boxes[i].recog.textContent = r ? r.label.toLowerCase() : '　'; boxes[i].recog.classList.toggle('warn', !!(r && r.lowConf)); });
    if (reads.some((r) => !r)) return; // 还没写完
    // 整词判定：孩子不会写出 bqll 这种词。先看每个字母“明显对”还是“勉强像”，
    // 只要大部分字母明显对、其余字母也在识别候选的前几名里，就算整词正确。
    const w = q.word.w, n = w.length;
    const strict = reads.map((r, i) => r.label.toLowerCase() === w[i]);
    const soft = reads.map((r, i) => strict[i] || r.probOf(w[i]) >= (rules.letterSoft ?? 0.06) || r.rankOf(w[i]) <= (rules.letterRank ?? 3) || confusable(w[i], r.label.toLowerCase()));
    // “基本对”的字母：识别为期望字母，或期望字母概率不低（如 l 被认成 I 但 L 有 0.4）
    const near = reads.map((r, i) => strict[i] || r.probOf(w[i]) >= (rules.letterNear ?? 0.3));
    const nearCount = near.filter(Boolean).length;
    const wordOk = soft.every(Boolean) && nearCount >= Math.ceil(n / 2);
    const accept = (r, ch, i) => wordOk || strict[i] || r.probOf(ch) >= (rules.letterTolerance ?? 0.25);
    const unclear = reads.map((r, i) => (r.lowConf && !accept(r, w[i], i)) ? i : -1).filter((i) => i >= 0);
    if (unclear.length) { ctx.audio.sfx('pop'); feedback.textContent = t('unclearLetters'); feedback.className = 'q-feedback bad'; unclear.forEach((i) => { ctx.shake(boxes[i].el); boxes[i].clear(); boxes[i].recog.textContent = '　'; }); return; }
    st.busy = true;
    if (wordOk) reads.forEach((r, i) => { boxes[i].recog.textContent = w[i]; });
    const wrongIdx = reads.map((r, i) => accept(r, w[i], i) ? -1 : i).filter((i) => i >= 0);
    if (!wrongIdx.length) return right(area.querySelector('.spell-write'));
    const els = wrongIdx.map((i) => boxes[i].el);
    await wrong(els, 'spellTryAgain');
    if (attempts === 1) wrongIdx.forEach((i) => { boxes[i].clear(); boxes[i].recog.textContent = '　'; });
  }
  function next() {
    q = makeQuestion(); attempts = 0; boxes = [];
    feedback.textContent = ''; area.innerHTML = ''; area.className = 'little-area spell ' + q.type;
    if (q.type === 'pick') renderPick(); else renderWrite();
    ctx.pop(prompt); ctx.renderScore(); ctx.debug(q);
    speakPrompt();
  }
  return { next, onStart: () => boxes.forEach((b) => b.resize()), intro: t('spellIntro', { n: ctx.reward }) };
}
