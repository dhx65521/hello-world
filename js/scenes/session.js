// 训练课：倒计时 + 金币 + 结算的公共外壳；具体题型在 js/subjects/*.js 里。
import { h, scene, button, dialog, showOverlay, hideOverlay, sleep, fmtTime, loadJSON } from '../core/ui.js';
import { currentKid, setting, addCoins, updateKid } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import * as speech from '../core/speech.js';
import { coinChip, refreshCoins, muteButton } from '../core/widgets.js';
import { flyCoins, burst, shake, pop } from '../core/fx.js';
import { loadModel, recognize } from '../ml/digits.js';
import { t } from '../core/i18n.js';
import * as limits from '../core/limits.js';
import * as mistakes from '../core/mistakes.js';
import { SUBJECTS } from './train.js';

let rules = null;

export async function sessionScene({ subject = 'arith' } = {}) {
  const kid = currentKid();
  if (!kid) return go('kids');
  const meta = SUBJECTS[subject] || SUBJECTS.arith;
  audio.stopMusic();
  const ui = scene({ title: `${meta.icon} ${t(meta.name)}`, theme: 'math', left: button('⬅️', () => confirmQuit(), 'icon'), right: [coinChip(), muteButton()] });
  const loading = h('div', { class: 'hint center' }, t('preparing'));
  ui.body.append(loading);
  let impl;
  try {
    const [r, mod] = await Promise.all([rules || loadJSON(new URL('../../data/math.json', import.meta.url)), import(`../subjects/${meta.module}.js`), ...meta.models.map((m) => loadModel(m))]);
    rules = r; impl = mod;
  } catch (e) { console.error(e); loading.textContent = t('loadFail'); return; }
  loading.remove();

  // ---------- 公共状态 ----------
  const total = Number(setting('roundSeconds')) || 300;
  const reward = Number(setting('rewardCoins')) || 1;
  let remaining = total, timer = null, ended = false;
  const st = { running: false, busy: false };
  const stats = { answered: 0, correct: 0, wrong: 0, net: 0, earned: 0 };
  const timerEl = h('div', { class: 'timer' }, fmtTime(remaining));
  const score = h('div', { class: 'q-score' });
  const renderScore = () => { score.textContent = t('score', { c: stats.correct, a: stats.answered }); };
  let idleTimer = null;

  // ---------- 手写框工厂 ----------
  function makeBox(onIdle, { letter = false } = {}) {
    const canvas = h('canvas', { class: 'digit-canvas' });
    const el = h('div', { class: 'digit-box' + (letter ? ' letter-box' : '') }, canvas);
    const ctx = canvas.getContext('2d');
    const strokes = [];
    let cur = null, size = 0;
    const resize = () => {
      const r = el.getBoundingClientRect(); size = Math.floor(r.width); if (!size) return; const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); redraw();
    };
    const redraw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2F3B52'; ctx.lineWidth = Math.max(6, size * 0.06);
      for (const s of strokes) {
        if (!s.length) continue; ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
        if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
        ctx.stroke();
      }
    };
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!st.running || st.busy) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      clearTimeout(idleTimer);
      if (!size) resize();
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
    const box = { el, strokes, resize, clear() { strokes.length = 0; redraw(); }, size: () => size, empty: () => !strokes.some((s) => s.length) };
    requestAnimationFrame(resize);
    return box;
  }
  /** 读一个框：返回 { label, prob } 或 null */
  function readBox(box, modelName = 'digits') {
    if (box.empty()) return null;
    const r = recognize(box.strokes, box.size(), modelsCache[modelName]);
    if (!r) return null;
    const m = modelsCache[modelName]; const labels = m.labels || Array.from({ length: r.probs.length }, (_, i) => String(i));
    const probOf = (lab) => { const i = labels.indexOf(String(lab).toUpperCase()); return i >= 0 ? r.probs[i] : 0; };
    return { label: r.label, prob: r.prob, lowConf: r.prob < (rules.minConfidence || 0.55), probOf };
  }
  const modelsCache = {}; for (const m of meta.models) modelsCache[m] = await loadModel(m);

  // ---------- 奖励 / 记录 ----------
  async function onCorrect(fromEl, feedbackEl) {
    stats.answered += 1; stats.correct += 1; stats.net += reward; stats.earned += reward;
    addCoins(reward);
    if (feedbackEl) { feedbackEl.textContent = t('correct', { n: reward }); feedbackEl.className = 'q-feedback good'; }
    audio.sfx('correct'); if (fromEl) burst(fromEl, ['⭐', '✨', '🌟'], 10);
    await flyCoins(fromEl, document.getElementById('coin-chip'), reward);
    audio.sfx('coin'); refreshCoins(); renderScore();
  }
  function onWrong(final) { stats.wrong += 1; if (final) { stats.answered += 1; renderScore(); } audio.sfx('wrong'); }
  const ctx = {
    body: ui.body, timerEl, score, rules, reward, st, stats, t, speech, audio, h, button, sleep, shake, pop, burst,
    makeBox, readBox, onCorrect, onWrong, renderScore,
    record: (key, correct, label) => mistakes.record(subject, key, correct, label),
    pickReview: (except) => mistakes.pickReview(subject, rules.reviewRatio ?? 0.4, except),
    isRunning: () => st.running,
    debug: (q) => { if (window.__debug) window.__q = q; },
  };
  ctx.kind = meta.kind;
  const game = await impl.setup(ctx, meta.kind);

  // ---------- 计时 / 结算 ----------
  function startRound() {
    st.running = true; ended = false; remaining = total;
    limits.consume(meta.limitKey);
    timerEl.textContent = fmtTime(remaining);
    if (meta.music) audio.music(meta.music);
    game.onStart?.();
    game.next();
    timer = setInterval(() => {
      if (document.hidden) return;
      remaining -= 1; timerEl.textContent = fmtTime(remaining);
      timerEl.classList.toggle('urgent', remaining <= 10);
      if (remaining <= 10 && remaining > 0) audio.sfx('tick');
      if (remaining <= 0) endRound();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; st.running = false; clearTimeout(idleTimer); speech.stop(); }
  function endRound() {
    if (ended) return; ended = true; stopTimer(); audio.stopMusic();
    updateKid((k) => {
      k.stats.rounds += 1; k.stats.answered += stats.answered; k.stats.correct += stats.correct; k.stats.wrong += stats.wrong;
      k.stats.coinsEarned += stats.earned; k.stats.best = Math.max(k.stats.best || 0, stats.net); k.stats.lastPlayed = Date.now();
      k.subjectStats = k.subjectStats || {};
      const ss = (k.subjectStats[subject] = k.subjectStats[subject] || { rounds: 0, answered: 0, correct: 0, wrong: 0, coins: 0 });
      ss.rounds += 1; ss.answered += stats.answered; ss.correct += stats.correct; ss.wrong += stats.wrong; ss.coins += stats.earned;
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
      h('div', { class: 'row' }, limits.remaining(meta.limitKey) > 0 ? button(t('again'), () => { hideOverlay(); sessionScene({ subject }); }, 'primary big') : null, button('🎓 ' + t('learn'), () => { hideOverlay(); go('train'); }, 'big'), button(t('goHome'), () => { hideOverlay(); go('home'); }, 'big')),
    ));
  }
  function confirmQuit() {
    if (!st.running) { stopTimer(); return go('train'); }
    dialog({ emoji: '🏠', title: t('quitRound'), body: h('div', { class: 'hint' }, t('coinsKept')), buttons: [
      { label: t('end'), cls: 'primary', onClick: () => endRound() },
      { label: t('keepGoing'), cls: 'soft' }] });
  }

  showOverlay(h('div', { class: 'dialog' },
    h('div', { class: 'big-emoji' }, meta.icon),
    h('div', { class: 'dialog-title' }, t('countdown', { time: fmtTime(total) })),
    h('div', { class: 'hint' }, game.intro),
    button(t('start'), () => { hideOverlay(); startRound(); }, 'primary big'),
  ));
  window.addEventListener('resize', () => game.onStart?.());
}
