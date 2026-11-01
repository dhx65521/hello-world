// 数学闯关：倒计时内做 24 以内加减法，手写答案，自动识别判对错。
import { h, scene, button, dialog, showOverlay, hideOverlay, sleep, randInt, fmtTime, loadJSON, toast } from '../core/ui.js';
import { currentKid, setting, addCoins, updateKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, refreshCoins, muteButton } from '../core/widgets.js';
import { flyCoins, burst, shake, pop } from '../core/fx.js';
import { loadModel, recognize } from '../ml/digits.js';

let rules = null;

export async function mathScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  audio.stopMusic();
  const ui = scene({ title: '🧮 数学', theme: 'math', left: button('🏠', () => confirmQuit(), 'icon'), right: [coinChip(), muteButton()] });
  const loading = h('div', { class: 'hint center' }, '准备中…');
  ui.body.append(loading);
  try {
    [rules] = await Promise.all([rules || loadJSON(new URL('../../data/math.json', import.meta.url)), loadModel()]);
  } catch (e) { loading.textContent = '加载失败，请联网后重试。'; return; }
  loading.remove();

  // ---------- 状态 ----------
  const total = Number(setting('roundSeconds')) || 300;
  const reward = Number(setting('rewardCoins')) || 1;
  let remaining = total, timer = null, running = false, ended = false;
  let q = null, attempts = 0, busy = false;
  const stats = { answered: 0, correct: 0, wrong: 0, net: 0, earned: 0 };

  // ---------- 布局 ----------
  const timerEl = h('div', { class: 'timer' }, fmtTime(remaining));
  const qText = h('div', { class: 'q-text' });
  const feedback = h('div', { class: 'q-feedback' });
  const score = h('div', { class: 'q-score' });
  const qPanel = h('div', { class: 'q-panel' }, timerEl, h('div', { class: 'q-main' }, qText, feedback), score);

  const recog = h('div', { class: 'recog' }, '　');
  const boxes = [makeBox(), makeBox()];
  const clearBtn = button('🧹', () => { clearPad(); audio.sfx('erase'); }, 'icon round clear-btn');
  clearBtn.setAttribute('aria-label', '擦掉重写');
  const padRow = h('div', { class: 'pad-row' }, boxes[0].el, boxes[1].el, clearBtn);
  const padPanel = h('div', { class: 'pad-panel' }, h('div', { class: 'pad-title' }, '✍️ 把答案写在这里，写完停一下就会自动判断'), recog, padRow);
  ui.body.append(h('div', { class: 'math-layout' }, qPanel, padPanel));

  // ---------- 手写板 ----------
  let idleTimer = null;
  function makeBox() {
    const canvas = h('canvas', { class: 'digit-canvas' });
    const el = h('div', { class: 'digit-box' }, canvas);
    const ctx = canvas.getContext('2d');
    const strokes = [];
    let cur = null, size = 0, dpr = 1;
    const resize = () => {
      const r = el.getBoundingClientRect(); size = Math.floor(r.width); dpr = window.devicePixelRatio || 1;
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
    const up = (e) => { if (!cur) return; cur = null; scheduleRecognize(); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    const box = { el, strokes, resize, clear() { strokes.length = 0; redraw(); }, size: () => size, empty: () => !strokes.some((s) => s.length) };
    return box;
  }
  const clearPad = () => { clearTimeout(idleTimer); boxes.forEach((b) => b.clear()); recog.textContent = '　'; };
  function scheduleRecognize() { clearTimeout(idleTimer); idleTimer = setTimeout(doRecognize, rules.idleMs || 900); }
  function readAnswer() {
    const digits = []; let lowConf = false;
    for (const b of boxes) {
      if (b.empty()) continue;
      const r = recognize(b.strokes, b.size());
      if (!r) continue;
      if (r.prob < (rules.minConfidence || 0.55)) lowConf = true;
      digits.push(r.digit);
    }
    if (!digits.length) return null;
    return { value: Number(digits.join('')), lowConf, text: digits.join('') };
  }
  async function doRecognize() {
    if (!running || busy || !q) return;
    const ans = readAnswer();
    if (!ans) return;
    if (ans.lowConf) { recog.textContent = `${ans.text}？再写清楚一点 ✏️`; recog.classList.add('warn'); audio.sfx('pop'); return; }
    recog.classList.remove('warn');
    recog.textContent = ans.text;
    await judge(ans.value);
  }

  // ---------- 出题 ----------
  function makeQuestion() {
    const max = rules.max || 24; let a, b, op, ans;
    const wantBig = Math.random() < (rules.bigRatio ?? 0.6); // 一部分题目要用到 10 以上的数
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
  function nextQuestion() {
    q = makeQuestion(); attempts = 0;
    qText.textContent = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b} = ?`;
    qText.classList.remove('answer');
    pop(qText);
    feedback.textContent = '';
    clearPad();
    renderScore();
  }
  const renderScore = () => { score.textContent = `答对 ${stats.correct} · 答题 ${stats.answered}`; };

  // ---------- 判定 ----------
  async function judge(value) {
    busy = true;
    stats.answered += 1;
    if (value === q.ans) {
      stats.correct += 1; stats.net += reward; stats.earned += reward;
      addCoins(reward);
      feedback.textContent = `✅ 对啦！ +${reward}`; feedback.className = 'q-feedback good';
      audio.sfx('correct'); burst(padPanel, ['⭐', '✨', '🌟'], 10);
      await flyCoins(padPanel, document.getElementById('coin-chip'), reward);
      audio.sfx('coin'); refreshCoins();
      await sleep(350);
      busy = false; if (running) nextQuestion();
    } else {
      stats.wrong += 1;
      attempts += 1;
      shake(qPanel); audio.sfx('wrong');
      if (attempts === 1) {
        feedback.textContent = '再想一想，再写一次 ✏️';
        feedback.className = 'q-feedback bad';
        await sleep(600);
        clearPad();
        busy = false;
      } else {
        qText.textContent = `${q.a} ${q.op === '-' ? '−' : '+'} ${q.b} = ${q.ans}`;
        qText.classList.add('answer');
        feedback.textContent = `答案是 ${q.ans}，记住了吗？`; feedback.className = 'q-feedback bad';
        await sleep(rules.wrongShowAnswerMs || 1800);
        busy = false; if (running) nextQuestion();
      }
    }
  }

  // ---------- 计时 ----------
  function startRound() {
    running = true; ended = false; remaining = total;
    timerEl.textContent = fmtTime(remaining);
    audio.music('math');
    boxes.forEach((b) => b.resize());
    nextQuestion();
    timer = setInterval(() => {
      if (document.hidden) return;
      remaining -= 1; timerEl.textContent = fmtTime(remaining);
      timerEl.classList.toggle('urgent', remaining <= 10);
      if (remaining <= 10 && remaining > 0) audio.sfx('tick');
      if (remaining <= 0) endRound();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; running = false; clearTimeout(idleTimer); }
  function endRound() {
    if (ended) return; ended = true; stopTimer(); audio.stopMusic();
    updateKid((k) => {
      k.stats.rounds += 1; k.stats.answered += stats.answered; k.stats.correct += stats.correct; k.stats.wrong += stats.wrong;
      k.stats.coinsEarned += stats.earned; k.stats.best = Math.max(k.stats.best || 0, stats.net); k.stats.lastPlayed = Date.now();
    });
    audio.sfx('fanfare');
    showOverlay(h('div', { class: 'dialog summary' },
      h('div', { class: 'big-emoji' }, stats.net > 0 ? '🎉' : '🙂'),
      h('div', { class: 'dialog-title' }, '时间到！'),
      h('div', { class: 'sum-grid' },
        h('div', {}, h('b', {}, stats.answered), h('span', {}, '答题')),
        h('div', {}, h('b', {}, stats.correct), h('span', {}, '答对')),
        h('div', {}, h('b', {}, stats.wrong), h('span', {}, '答错')),
        h('div', { class: 'gold' }, h('b', {}, (stats.net >= 0 ? '+' : '') + stats.net), h('span', {}, '🪙 金币')),
      ),
      h('div', { class: 'hint' }, `现在一共有 🪙 ${currentKid().coins}`),
      h('div', { class: 'row' }, button('🔁 再来一局', () => { hideOverlay(); mathScene(); }, 'primary big'), button('🏠 回家', () => { hideOverlay(); go('home'); }, 'big')),
    ));
  }
  function confirmQuit() {
    if (!running) { stopTimer(); return go('home'); }
    dialog({ emoji: '🏠', title: '要结束这一局吗？', body: h('div', { class: 'hint' }, '已经赚到的金币会保留。'), buttons: [
      { label: '结束', cls: 'primary', onClick: () => endRound() },
      { label: '继续做题', cls: 'soft' }] });
  }

  // 开始前的提示
  showOverlay(h('div', { class: 'dialog' },
    h('div', { class: 'big-emoji' }, '✏️'),
    h('div', { class: 'dialog-title' }, `${fmtTime(total)} 倒计时`),
    h('div', { class: 'hint' }, `答对一题 +${reward} 🪙，答错不扣，可以再写一次。两位数写两格，一位数写一格就行。`),
    button('▶ 开始！', () => { hideOverlay(); startRound(); }, 'primary big'),
  ));
  window.addEventListener('resize', () => boxes.forEach((b) => b.resize()), { once: false });
}
