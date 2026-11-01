// 数学闯关：倒计时内做题赚金币。
// 大孩子（≥5 岁）：24 以内加减法，手写答案自动识别。
// 小孩子（<5 岁）：听题选数字卡片 / 照着写数字（0–9）。
import { h, scene, button, dialog, showOverlay, hideOverlay, sleep, randInt, fmtTime, loadJSON, shuffle } from '../core/ui.js';
import { currentKid, setting, addCoins, updateKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import * as speech from '../core/speech.js';
import { coinChip, refreshCoins, muteButton } from '../core/widgets.js';
import { flyCoins, burst, shake, pop } from '../core/fx.js';
import { loadModel, recognize } from '../ml/digits.js';
import { t } from '../core/i18n.js';
import * as limits from '../core/limits.js';

let rules = null;

export function mathModeFor(kid) {
  const m = setting('mathMode');
  if (m === 'little' || m === 'big') return m;
  return (Number(kid?.age) || 6) < 5 ? 'little' : 'big';
}

export async function mathScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  audio.stopMusic();
  const mode = mathModeFor(kid);
  const ui = scene({ title: t('math'), theme: 'math', left: button('🏠', () => confirmQuit(), 'icon'), right: [coinChip(), muteButton()] });
  const loading = h('div', { class: 'hint center' }, t('preparing'));
  ui.body.append(loading);
  try {
    [rules] = await Promise.all([rules || loadJSON(new URL('../../data/math.json', import.meta.url)), loadModel()]);
  } catch (e) { loading.textContent = t('loadFail'); return; }
  loading.remove();

  // ---------- 公共状态 ----------
  const total = Number(setting('roundSeconds')) || 300;
  const reward = Number(setting('rewardCoins')) || 1;
  let remaining = total, timer = null, running = false, ended = false;
  let q = null, attempts = 0, busy = false;
  const stats = { answered: 0, correct: 0, wrong: 0, net: 0, earned: 0 };
  const timerEl = h('div', { class: 'timer' }, fmtTime(remaining));
  const score = h('div', { class: 'q-score' });
  const renderScore = () => { score.textContent = t('score', { c: stats.correct, a: stats.answered }); };

  // ---------- 手写框工厂 ----------
  let idleTimer = null;
  function makeBox(onIdle) {
    const canvas = h('canvas', { class: 'digit-canvas' });
    const el = h('div', { class: 'digit-box' }, canvas);
    const ctx = canvas.getContext('2d');
    const strokes = [];
    let cur = null, size = 0;
    const resize = () => {
      const r = el.getBoundingClientRect(); size = Math.floor(r.width); const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); redraw();
    };
    const redraw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2F3B52'; ctx.lineWidth = Math.max(6, size * 0.06);
      for (const st of strokes) {
        if (!st.length) continue; ctx.beginPath(); ctx.moveTo(st[0].x, st[0].y);
        if (st.length === 1) ctx.lineTo(st[0].x + 0.1, st[0].y + 0.1);
        for (let i = 1; i < st.length; i++) ctx.lineTo(st[i].x, st[i].y);
        ctx.stroke();
      }
    };
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!running || busy) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      clearTimeout(idleTimer);
      cur = [pt(e)]; strokes.push(cur); redraw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) cur.push(pt(ev));
      redraw();
    });
    const up = () => { if (!cur) return; cur = null; clearTimeout(idleTimer); idleTimer = setTimeout(onIdle, rules.idleMs || 1500); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    return { el, strokes, resize, clear() { strokes.length = 0; redraw(); }, size: () => size, empty: () => !strokes.some((s) => s.length) };
  }
  function readBoxes(boxes) {
    const digits = []; let lowConf = false;
    for (const b of boxes) {
      if (b.empty()) continue;
      const r = recognize(b.strokes, b.size()); if (!r) continue;
      if (r.prob < (rules.minConfidence || 0.55)) lowConf = true;
      digits.push(r.digit);
    }
    if (!digits.length) return null;
    return { value: Number(digits.join('')), lowConf, text: digits.join('') };
  }

  // ---------- 奖励 / 判定（两种模式共用） ----------
  let onNext = () => {};
  async function reward_(fromEl, feedbackEl) {
    stats.answered += 1; stats.correct += 1; stats.net += reward; stats.earned += reward;
    addCoins(reward);
    if (feedbackEl) { feedbackEl.textContent = t('correct', { n: reward }); feedbackEl.className = 'q-feedback good'; }
    audio.sfx('correct'); burst(fromEl, ['⭐', '✨', '🌟'], 10);
    await flyCoins(fromEl, document.getElementById('coin-chip'), reward);
    audio.sfx('coin'); refreshCoins(); renderScore();
  }

  // ======================================================================
  // 大孩子：手写算式
  // ======================================================================
  function setupBig() {
    const qText = h('div', { class: 'q-text' });
    const feedback = h('div', { class: 'q-feedback' });
    const qPanel = h('div', { class: 'q-panel' }, timerEl, h('div', { class: 'q-main' }, qText, feedback), score);
    const recog = h('div', { class: 'recog' }, '　');
    const boxes = [makeBox(doRecognize), makeBox(doRecognize)];
    const clearBtn = button('🧹', () => { clearPad(); audio.sfx('erase'); }, 'icon round clear-btn');
    const padRow = h('div', { class: 'pad-row' }, boxes[0].el, boxes[1].el, clearBtn);
    const padPanel = h('div', { class: 'pad-panel' }, h('div', { class: 'pad-title' }, t('padTitle')), recog, padRow);
    ui.body.append(h('div', { class: 'math-layout' }, qPanel, padPanel));
    const clearPad = () => { clearTimeout(idleTimer); boxes.forEach((b) => b.clear()); recog.textContent = '　'; };

    function makeQuestion() {
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
    async function doRecognize() {
      if (!running || busy || !q) return;
      const ans = readBoxes(boxes); if (!ans) return;
      if (ans.lowConf) { recog.textContent = t('unclear', { text: ans.text }); recog.classList.add('warn'); audio.sfx('pop'); return; }
      recog.classList.remove('warn'); recog.textContent = ans.text;
      busy = true;
      if (ans.value === q.ans) {
        await reward_(padPanel, feedback); await sleep(350);
        busy = false; if (running) onNext();
      } else {
        stats.wrong += 1; attempts += 1; shake(qPanel); audio.sfx('wrong');
        if (attempts === 1) { feedback.textContent = t('tryAgain'); feedback.className = 'q-feedback bad'; await sleep(600); clearPad(); busy = false; }
        else {
          stats.answered += 1; renderScore();
          qText.textContent = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b} = ${q.ans}`; qText.classList.add('answer');
          feedback.textContent = t('answerIs', { n: q.ans }); feedback.className = 'q-feedback bad';
          await sleep(rules.wrongShowAnswerMs || 1800);
          busy = false; if (running) onNext();
        }
      }
    }
    onNext = () => {
      q = makeQuestion(); attempts = 0;
      qText.textContent = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b} = ?`; qText.classList.remove('answer'); pop(qText);
      feedback.textContent = ''; clearPad(); renderScore();
    };
    return { onStart: () => boxes.forEach((b) => b.resize()), intro: t('mathIntro', { n: reward }) };
  }

  // ======================================================================
  // 小孩子：听题选卡片 / 照着写
  // ======================================================================
  function setupLittle() {
    const cfg = rules.little || { max: 9, cards: 3, copyRatio: 0.4 };
    const prompt = h('div', { class: 'q-text little-prompt' });
    const feedback = h('div', { class: 'q-feedback' });
    const listenBtn = button(t('listen'), () => speakPrompt(), 'soft listen-btn');
    const qPanel = h('div', { class: 'q-panel' }, timerEl, h('div', { class: 'q-main' }, prompt, feedback), score);
    const area = h('div', { class: 'little-area' });
    ui.body.append(h('div', { class: 'math-layout' }, qPanel, listenBtn, area));
    let lastType = 'copy', box = null;

    const speakPrompt = () => {
      if (!q) return;
      speech.say(q.type === 'pick' ? t('whichIsSpoken', { n: q.n }) : t('copyDigitSpoken', { n: q.n }));
    };
    function makeQuestion() {
      const type = (lastType === 'pick' || Math.random() < (cfg.copyRatio ?? 0.4)) && lastType !== 'copy' ? 'copy' : 'pick';
      lastType = type;
      let n = randInt(0, cfg.max ?? 9);
      if (q && q.n === n) n = (n + 1 + randInt(0, cfg.max - 1)) % (cfg.max + 1);
      const opts = new Set([n]);
      while (opts.size < (cfg.cards || 3)) opts.add(randInt(0, cfg.max ?? 9));
      return { type, n, options: shuffle([...opts]) };
    }
    async function wrong(el) {
      stats.wrong += 1; attempts += 1; audio.sfx('wrong'); if (el) shake(el);
      if (attempts === 1) {
        feedback.textContent = t(q.type === 'pick' ? 'tryAgainPick' : 'tryAgain'); feedback.className = 'q-feedback bad';
        await speech.say(t('tryAgainSpoken')); await sleep(300);
        busy = false;
      } else {
        stats.answered += 1; renderScore();
        feedback.textContent = t('answerIs', { n: q.n }); feedback.className = 'q-feedback bad';
        if (q.type === 'pick') { const right = area.querySelector(`.num-card[data-n="${q.n}"]`); right?.classList.add('reveal'); }
        await speech.say(t('isThis', { n: q.n })); await sleep(rules.wrongShowAnswerMs || 1800);
        busy = false; if (running) onNext();
      }
    }
    async function right(el) {
      await reward_(el, feedback); await speech.say(t('wellDone')); await sleep(200);
      busy = false; if (running) onNext();
    }
    function renderPick() {
      prompt.textContent = t('whichIs', { n: q.n });
      const row = h('div', { class: 'num-cards' });
      for (const n of q.options) {
        const card = h('button', { class: 'num-card', dataset: { n } }, String(n));
        card.addEventListener('click', async () => {
          if (busy || !running) return; busy = true; audio.sfx('tap');
          if (n === q.n) { card.classList.add('correct'); await right(card); }
          else { card.classList.add('tried'); await speech.say(t('thatIs', { n }), { interrupt: true }); await wrong(card); }
        });
        row.append(card);
      }
      area.append(row);
    }
    function renderCopy() {
      prompt.textContent = t('copyDigit', { n: q.n });
      const model = h('button', { class: 'num-card model' }, String(q.n));
      model.addEventListener('click', () => { audio.sfx('tap'); speech.say(String(q.n)); });
      const recog = h('div', { class: 'recog' }, '　');
      box = makeBox(async () => {
        if (!running || busy) return;
        const ans = readBoxes([box]); if (!ans) return;
        if (ans.lowConf) { recog.textContent = t('unclear', { text: ans.text }); recog.classList.add('warn'); audio.sfx('pop'); return; }
        recog.classList.remove('warn'); recog.textContent = ans.text;
        busy = true;
        if (ans.value === q.n) await right(box.el);
        else { await wrong(box.el); box.clear(); recog.textContent = '　'; }
      });
      const clearBtn = button('🧹', () => { box.clear(); recog.textContent = '　'; audio.sfx('erase'); }, 'icon round clear-btn');
      area.append(h('div', { class: 'copy-row' }, model, h('div', { class: 'arrow' }, '➡️'), h('div', { class: 'copy-pad' }, recog, h('div', { class: 'pad-row' }, box.el, clearBtn))));
      requestAnimationFrame(() => box.resize());
    }
    onNext = () => {
      q = makeQuestion(); attempts = 0; box = null;
      feedback.textContent = ''; area.innerHTML = ''; area.className = 'little-area ' + q.type;
      if (q.type === 'pick') renderPick(); else renderCopy();
      pop(prompt); renderScore();
      speakPrompt();
    };
    return { onStart: () => {}, intro: t('littleIntro', { n: reward }) };
  }

  const impl = mode === 'little' ? setupLittle() : setupBig();

  // ---------- 计时 / 结算 ----------
  function startRound() {
    running = true; ended = false; remaining = total;
    limits.consume('math');
    timerEl.textContent = fmtTime(remaining);
    if (mode === 'big') audio.music('math');
    impl.onStart();
    onNext();
    timer = setInterval(() => {
      if (document.hidden) return;
      remaining -= 1; timerEl.textContent = fmtTime(remaining);
      timerEl.classList.toggle('urgent', remaining <= 10);
      if (remaining <= 10 && remaining > 0) audio.sfx('tick');
      if (remaining <= 0) endRound();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; running = false; clearTimeout(idleTimer); speech.stop(); }
  function endRound() {
    if (ended) return; ended = true; stopTimer(); audio.stopMusic();
    updateKid((k) => {
      k.stats.rounds += 1; k.stats.answered += stats.answered; k.stats.correct += stats.correct; k.stats.wrong += stats.wrong;
      k.stats.coinsEarned += stats.earned; k.stats.best = Math.max(k.stats.best || 0, stats.net); k.stats.lastPlayed = Date.now();
    });
    audio.sfx('fanfare');
    showOverlay(h('div', { class: 'dialog summary' },
      h('div', { class: 'big-emoji' }, stats.net > 0 ? '🎉' : '🙂'),
      h('div', { class: 'dialog-title' }, t('timeUp')),
      h('div', { class: 'sum-grid' },
        h('div', {}, h('b', {}, stats.answered), h('span', {}, t('answered'))),
        h('div', {}, h('b', {}, stats.correct), h('span', {}, t('right'))),
        h('div', {}, h('b', {}, stats.wrong), h('span', {}, t('wrong'))),
        h('div', { class: 'gold' }, h('b', {}, (stats.net >= 0 ? '+' : '') + stats.net), h('span', {}, t('coinsLabel'))),
      ),
      h('div', { class: 'hint' }, t('nowHave', { n: currentKid().coins })),
      h('div', { class: 'row' }, limits.remaining('math') > 0 ? button(t('again'), () => { hideOverlay(); mathScene(); }, 'primary big') : null, button(t('goHome'), () => { hideOverlay(); go('home'); }, 'big')),
    ));
  }
  function confirmQuit() {
    if (!running) { stopTimer(); return go('home'); }
    dialog({ emoji: '🏠', title: t('quitRound'), body: h('div', { class: 'hint' }, t('coinsKept')), buttons: [
      { label: t('end'), cls: 'primary', onClick: () => endRound() },
      { label: t('keepGoing'), cls: 'soft' }] });
  }

  showOverlay(h('div', { class: 'dialog' },
    h('div', { class: 'big-emoji' }, mode === 'little' ? '👂' : '✏️'),
    h('div', { class: 'dialog-title' }, t('countdown', { time: fmtTime(total) })),
    h('div', { class: 'hint' }, impl.intro),
    button(t('start'), () => { hideOverlay(); startRound(); }, 'primary big'),
  ));
  window.addEventListener('resize', () => impl.onStart());
}
