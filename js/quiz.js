// 通用答题引擎：出题 → 孩子点选 → 答对星星/答错温和提示 → 一轮结束总结。
// 各模块只需要提供 makeQuestion()，返回一道题。
import { h, screen, speakerButton, sleep } from './ui.js';
import * as sound from './sound.js';
import { sayZh, say, saySequence, stop as stopSpeech } from './speech.js';
import { recordAnswer, recordRound, starBurstAt, encouragement, tryAgainText, showRoundSummary } from './rewards.js';

/**
 * 一道题的格式：
 * {
 *   speak: '有几个苹果？',              // 进入时自动朗读（必填）
 *   speakLang: 'zh-CN',                 // 可选，默认中文
 *   promptText: '有几个？',             // 显示在上方的文字（可选）
 *   render(area, ctx) {},               // 画题目区域；ctx.answer(value, el) 用于自定义点选
 *   choices: [{ label: '3', value: 3, html?: Element }],  // 可选：标准选项按钮
 *   choiceClass: 'choice',              // 可选：选项按钮样式
 *   answer: 3,                          // 正确值
 *   wrongHint(value) => '这是三角形哦', // 可选：答错时额外提示
 *   onCorrect(el) {},                   // 可选
 * }
 */
export function runQuiz({ title, moduleId, activityId, count = 5, makeQuestion, onExit, color }) {
  let index = 0;
  let earned = 0;
  let locked = false;
  let current = null;

  const speakCurrent = () => {
    if (!current) return;
    if (Array.isArray(current.speak)) saySequence(current.speak);
    else say(current.speak, { lang: current.speakLang || 'zh-CN' });
  };

  const ui = screen({
    title,
    color,
    onBack: () => { stopSpeech(); onExit(); },
    rightButton: speakerButton(speakCurrent),
  });

  const progress = h('div', { class: 'progress' });
  const prompt = h('div', { class: 'prompt' });
  const area = h('div', { class: 'question' });
  const choicesEl = h('div', { class: 'choices' });
  ui.body.append(progress, prompt, area, choicesEl);

  function renderProgress() {
    progress.innerHTML = '';
    for (let i = 0; i < count; i++) {
      progress.append(h('span', { class: i < index ? 'done' : '' }, '⭐'));
    }
  }

  async function handleAnswer(value, el) {
    if (locked || !current) return;
    const ok = value === current.answer;
    recordAnswer(moduleId, activityId, ok);
    if (ok) {
      locked = true;
      earned += 1;
      el?.classList.add('correct');
      if (el) starBurstAt(el, 12);
      sound.correct();
      current.onCorrect?.(el);
      index += 1;
      renderProgress();
      await sayZh(encouragement());
      await sleep(500);
      locked = false;
      next();
    } else {
      locked = true;
      if (el) {
        el.classList.add('shake');
        setTimeout(() => { el.classList.remove('shake'); el.classList.add('tried'); }, 500);
      }
      sound.gentle();
      const hint = current.wrongHint?.(value);
      if (hint && typeof hint === 'object') {
        await saySequence([hint, { text: tryAgainText(), lang: 'zh-CN' }]);
      } else {
        await sayZh(hint ? `${hint}，${tryAgainText()}` : tryAgainText());
      }
      locked = false;
    }
  }

  function next() {
    if (index >= count) {
      recordRound(moduleId, activityId);
      showRoundSummary({
        earned,
        total: count,
        onAgain: () => { index = 0; earned = 0; renderProgress(); next(); },
        onBack: () => { stopSpeech(); onExit(); },
      });
      return;
    }
    current = makeQuestion(index);
    prompt.innerHTML = '';
    area.innerHTML = '';
    choicesEl.innerHTML = '';
    if (current.promptText) prompt.append(h('span', {}, current.promptText));
    const ctx = { answer: handleAnswer };
    if (current.render) {
      area.style.display = '';
      choicesEl.classList.remove('fill');
      current.render(area, ctx);
    } else {
      // 没有单独的题目区时，让选项占满中间
      area.style.display = 'none';
      choicesEl.classList.add('fill');
    }
    if (current.choices) {
      for (const c of current.choices) {
        const btn = h('button', { class: 'btn ' + (current.choiceClass || 'choice') });
        if (c.html instanceof Node) btn.append(c.html); else btn.textContent = c.label ?? String(c.value);
        btn.addEventListener('click', () => handleAnswer(c.value, btn));
        choicesEl.append(btn);
      }
    }
    speakCurrent();
  }

  renderProgress();
  next();
}
