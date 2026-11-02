// 小龄：听题选卡片 / 照着写。kind = 'digits'（0–9）或 'letters'（A–Z）。
import { randInt, shuffle } from '../core/ui.js';

export async function setup(ctx, kind) {
  const { h, button, t, rules, st, speech } = ctx;
  const isLetters = kind === 'letters' || ctx.kind === 'letters';
  const cfg = rules.little || { max: 9, cards: 3, copyRatio: 0.4 };
  const items = isLetters ? Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)) : Array.from({ length: (cfg.max ?? 9) + 1 }, (_, i) => String(i));
  const model = isLetters ? 'letters' : 'digits';
  const say = {
    pick: (n) => speech.say(isLetters ? t('whichLetterSpoken', { n }) : t('whichIsSpoken', { n })),
    copy: (n) => speech.say(isLetters ? t('copyLetterSpoken', { n }) : t('copyDigitSpoken', { n })),
    item: (n) => speech.say(isLetters ? t('letterSpoken', { n }) : String(n)),
    thatIs: (n) => speech.say(isLetters ? t('thatIsLetter', { n }) : t('thatIs', { n })),
    isThis: (n) => speech.say(isLetters ? t('isThisLetter', { n }) : t('isThis', { n })),
  };

  let q = null, attempts = 0, lastType = 'copy', box = null;
  const prompt = h('div', { class: 'q-text little-prompt' });
  const feedback = h('div', { class: 'q-feedback' });
  const listenBtn = button(t('listen'), () => speakPrompt(), 'soft listen-btn');
  const qPanel = h('div', { class: 'q-panel' }, ctx.timerEl, h('div', { class: 'q-main' }, prompt, feedback), ctx.score);
  const area = h('div', { class: 'little-area' });
  ctx.body.append(h('div', { class: 'math-layout' }, qPanel, listenBtn, area));

  const speakPrompt = () => { if (q) (q.type === 'pick' ? say.pick : say.copy)(q.n); };
  function makeQuestion() {
    const type = lastType === 'pick' ? 'copy' : 'pick';
    lastType = type;
    const rev = ctx.pickReview(q?.n ?? null);
    let n = rev ? rev.key : items[randInt(0, items.length - 1)];
    if (!rev && q && q.n === n) n = items[(items.indexOf(n) + 1 + randInt(0, items.length - 2)) % items.length];
    const opts = new Set([n]);
    while (opts.size < (cfg.cards || 3)) opts.add(items[randInt(0, items.length - 1)]);
    return { type, n, options: shuffle([...opts]) };
  }
  async function wrong(el) {
    attempts += 1; if (el) ctx.shake(el);
    if (attempts === 1) {
      ctx.onWrong(false);
      feedback.textContent = t(q.type === 'pick' ? 'tryAgainPick' : 'tryAgain'); feedback.className = 'q-feedback bad';
      await speech.say(t('tryAgainSpoken')); await ctx.sleep(300);
      st.busy = false;
    } else {
      ctx.onWrong(true); ctx.record(q.n, false, q.n);
      feedback.textContent = t('answerIs', { n: q.n }); feedback.className = 'q-feedback bad';
      if (q.type === 'pick') area.querySelector(`.num-card[data-n="${q.n}"]`)?.classList.add('reveal');
      await say.isThis(q.n); await ctx.sleep(rules.wrongShowAnswerMs || 1800);
      st.busy = false; if (st.running) next();
    }
  }
  async function right(el) {
    ctx.record(q.n, attempts === 0, q.n);
    await ctx.onCorrect(el, feedback); await speech.say(t('wellDone')); await ctx.sleep(200);
    st.busy = false; if (st.running) next();
  }
  const cardLabel = (n) => isLetters ? [h('span', { class: 'up' }, n), h('span', { class: 'low' }, n.toLowerCase())] : [String(n)];
  function renderPick() {
    prompt.textContent = t('whichIsHidden'); // 题目里不显示答案，只靠听
    const row = h('div', { class: 'num-cards' });
    for (const n of q.options) {
      const card = h('button', { class: 'num-card' + (isLetters ? ' letter' : ''), dataset: { n } }, ...cardLabel(n));
      card.addEventListener('click', async () => {
        if (st.busy || !st.running) return; st.busy = true; ctx.audio.sfx('tap');
        if (n === q.n) { card.classList.add('correct'); await right(card); }
        else { card.classList.add('tried'); await say.thatIs(n); await wrong(card); }
      });
      row.append(card);
    }
    area.append(row);
  }
  function renderCopy() {
    prompt.textContent = isLetters ? t('copyLetter', { n: q.n }) : t('copyDigit', { n: q.n });
    const modelCard = h('button', { class: 'num-card model' + (isLetters ? ' letter' : '') }, ...cardLabel(q.n));
    modelCard.addEventListener('click', () => { ctx.audio.sfx('tap'); say.item(q.n); });
    const recog = h('div', { class: 'recog' }, '　');
    box = ctx.makeBox(async () => {
      if (!st.running || st.busy) return;
      const r = ctx.readBox(box, model); if (!r) return;
      const accepted = r.label === q.n || (isLetters && r.probOf(q.n) >= (rules.letterTolerance ?? 0.25));
      if (r.lowConf && !accepted) { recog.textContent = t('unclear', { text: r.label }); recog.classList.add('warn'); ctx.audio.sfx('pop'); return; }
      recog.classList.remove('warn'); recog.textContent = accepted ? q.n : r.label;
      st.busy = true;
      if (accepted) await right(box.el);
      else { await wrong(box.el); box.clear(); recog.textContent = '　'; }
    }, { letter: isLetters });
    const clearBtn = button('🧹', () => { box.clear(); recog.textContent = '　'; ctx.audio.sfx('erase'); }, 'icon round clear-btn');
    area.append(h('div', { class: 'copy-row' }, modelCard, h('div', { class: 'arrow' }, '➡️'), h('div', { class: 'copy-pad' }, recog, h('div', { class: 'pad-row' }, box.el, clearBtn))));
    requestAnimationFrame(() => box.resize());
  }
  function next() {
    q = makeQuestion(); attempts = 0; box = null;
    feedback.textContent = ''; area.innerHTML = ''; area.className = 'little-area ' + q.type;
    if (q.type === 'pick') renderPick(); else renderCopy();
    ctx.pop(prompt); ctx.renderScore(); ctx.debug(q);
    speakPrompt();
  }
  return { next, onStart: () => box?.resize(), intro: t('littleIntro', { n: ctx.reward }) };
}
