// 算术：24 以内加减法，两个手写格写答案。
import { randInt } from '../core/ui.js';

export async function setup(ctx) {
  const { h, button, t, rules, st } = ctx;
  let q = null, attempts = 0;
  const qText = h('div', { class: 'q-text' });
  const feedback = h('div', { class: 'q-feedback' });
  const qPanel = h('div', { class: 'q-panel' }, ctx.timerEl, h('div', { class: 'q-main' }, qText, feedback), ctx.score);
  const recog = h('div', { class: 'recog' }, '　');
  const boxes = [ctx.makeBox(doRecognize), ctx.makeBox(doRecognize)];
  const clearBtn = button('🧹', () => { clearPad(); ctx.audio.sfx('erase'); }, 'icon round clear-btn');
  const padRow = h('div', { class: 'pad-row' }, boxes[0].el, boxes[1].el, clearBtn);
  const padPanel = h('div', { class: 'pad-panel' }, h('div', { class: 'pad-title' }, t('padTitle')), recog, padRow);
  ctx.body.append(h('div', { class: 'math-layout' }, qPanel, padPanel));
  const clearPad = () => { boxes.forEach((b) => b.clear()); recog.textContent = '　'; };
  const key = (a, op, b) => `${a}${op}${b}`;

  function fromKey(k) { const m = k.match(/^(\d+)([+-])(\d+)$/); if (!m) return null; const a = +m[1], b = +m[3], op = m[2]; return { a, b, op, ans: op === '+' ? a + b : a - b }; }
  function makeQuestion() {
    const rev = ctx.pickReview(q ? key(q.a, q.op, q.b) : null);
    if (rev) { const r = fromKey(rev.key); if (r) return r; }
    const max = rules.max || 24; let a, b, op, ans;
    const wantBig = Math.random() < (rules.bigRatio ?? 0.6);
    for (let guard = 0; guard < 80; guard++) {
      op = rules.ops[randInt(0, rules.ops.length - 1)];
      if (op === '+') { a = randInt(1, max - 2); b = randInt(1, max - 1 - a); ans = a + b; }
      else { a = randInt(2, max - 1); b = randInt(1, a - 1); ans = a - b; }
      if (a + b < (rules.minSum || 2)) continue;
      if (wantBig && a < 10 && b < 10 && ans < 10) continue;
      if (q && q.a === a && q.b === b && q.op === op) continue;
      break;
    }
    return { a, b, op, ans };
  }
  function readAnswer() {
    const digits = []; let lowConf = false;
    for (const b of boxes) { const r = ctx.readBox(b, 'digits'); if (!r) continue; if (r.lowConf) lowConf = true; digits.push(r.label); }
    if (!digits.length) return null;
    return { value: Number(digits.join('')), lowConf, text: digits.join('') };
  }
  async function doRecognize() {
    if (!st.running || st.busy || !q) return;
    const ans = readAnswer(); if (!ans) return;
    if (ans.lowConf) { recog.textContent = t('unclear', { text: ans.text }); recog.classList.add('warn'); ctx.audio.sfx('pop'); return; }
    recog.classList.remove('warn'); recog.textContent = ans.text;
    st.busy = true;
    const k = key(q.a, q.op, q.b), label = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b}`;
    if (ans.value === q.ans) {
      ctx.record(k, attempts === 0, label);
      await ctx.onCorrect(padPanel, feedback); await ctx.sleep(350);
      st.busy = false; if (st.running) next();
    } else {
      attempts += 1; ctx.shake(qPanel);
      if (attempts === 1) { ctx.onWrong(false); feedback.textContent = t('tryAgain'); feedback.className = 'q-feedback bad'; await ctx.sleep(600); clearPad(); st.busy = false; }
      else {
        ctx.onWrong(true); ctx.record(k, false, label);
        qText.textContent = `${label} = ${q.ans}`; qText.classList.add('answer');
        feedback.textContent = t('answerIs', { n: q.ans }); feedback.className = 'q-feedback bad';
        await ctx.sleep(rules.wrongShowAnswerMs || 1800);
        st.busy = false; if (st.running) next();
      }
    }
  }
  function next() {
    q = makeQuestion(); attempts = 0;
    qText.textContent = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b} = ?`; qText.classList.remove('answer'); ctx.pop(qText);
    feedback.textContent = ''; clearPad(); ctx.renderScore(); ctx.debug(q);
  }
  return { next, onStart: () => boxes.forEach((b) => b.resize()), intro: t('mathIntro', { n: ctx.reward }) };
}
