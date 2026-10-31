// 编程启蒙：网格迷宫。把方向箭头排成指令序列，按“开始”让小动物按顺序走；后面的关卡引入“重复 N 次”。
import { h, screen, bigButton, loadJSON, sleep, showOverlay, hideOverlay } from '../../js/ui.js';
import { sayZh, stop as stopSpeech } from '../../js/speech.js';
import * as sound from '../../js/sound.js';
import { starBurst, starBurstAt, recordAnswer, recordRound, encouragement } from '../../js/rewards.js';
import { getState, updateState } from '../../js/storage.js';

const MODULE_ID = 'coding';
const ARROW = { U: '⬆️', D: '⬇️', L: '⬅️', R: '➡️' };
const NAME = { U: '向上', D: '向下', L: '向左', R: '向右' };
const DELTA = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
let data = null;
async function loadData() {
  if (!data) data = await loadJSON(new URL('./levels.json', import.meta.url));
  return data;
}
const unlocked = () => Number(getState().extra.codingUnlocked) || 0;
const doneSet = () => new Set(getState().extra.codingDone || []);

// ---------------- 选关 ----------------
function levelSelect({ back, onPick }) {
  const ui = screen({ title: '🤖 编程迷宫', onBack: back, scroll: true });
  const grid = h('div', { class: 'levels' });
  const done = doneSet();
  const max = unlocked();
  data.levels.forEach((lv, i) => {
    const locked = i > max;
    const b = h('button', { class: 'btn level' + (locked ? ' locked' : ''), disabled: locked },
      h('span', { class: 'n' }, String(i + 1)),
      h('span', { class: 's' }, locked ? '🔒' : done.has(i) ? '⭐' : lv.actor));
    if (!locked) b.addEventListener('click', () => { sound.tap(); onPick(i); });
    grid.append(b);
  });
  ui.body.append(h('div', { class: 'prompt' }, '选一关'), grid);
  sayZh('帮小动物走迷宫！选一关。');
}

// ---------------- 游戏 ----------------
function playLevel(index, { back, onNext }) {
  const lv = data.levels[index];
  const ui = screen({ title: `🤖 第 ${index + 1} 关`, onBack: back });
  const program = []; // {type:'move', dir} | {type:'repeat', n}
  let running = false;

  // 棋盘
  const board = h('div', { class: 'board', style: { gridTemplateColumns: `repeat(${lv.cols}, 1fr)` } });
  const wallSet = new Set((lv.walls || []).map(([c, r]) => `${c},${r}`));
  for (let r = 0; r < lv.rows; r++) for (let c = 0; c < lv.cols; c++) {
    const cell = h('div', { class: 'cell' + ((r + c) % 2 ? ' alt' : '') });
    if (wallSet.has(`${c},${r}`)) { cell.classList.add('wall'); cell.textContent = '🌳'; }
    if (c === lv.goal[0] && r === lv.goal[1]) { cell.classList.add('goal'); cell.textContent = lv.goalEmoji; }
    board.append(cell);
  }
  const actor = h('div', { class: 'actor' }, lv.actor);
  board.append(actor);
  const boardWrap = h('div', { class: 'board-wrap', style: { '--cols': lv.cols, '--rows': lv.rows } }, board);

  let pos = [...lv.start];
  const place = (animate = true) => {
    actor.style.transition = animate ? 'transform .4s ease' : 'none';
    actor.style.transform = `translate(${pos[0] * 100}%, ${pos[1] * 100}%)`;
  };
  place(false);

  // 程序区
  const slots = h('div', { class: 'slots' });
  const renderProgram = () => {
    slots.innerHTML = '';
    for (let i = 0; i < lv.slots; i++) {
      const p = program[i];
      const s = h('div', { class: 'slot' + (p ? ' filled' : '') });
      if (p) {
        s.textContent = p.type === 'move' ? ARROW[p.dir] : `🔁${p.n}`;
        if (p.type === 'repeat') s.classList.add('rep');
        s.addEventListener('click', () => { if (running) return; sound.tap(); program.splice(i, 1); renderProgram(); });
      }
      slots.append(s);
    }
  };
  const add = (block) => {
    if (running) return;
    if (program.length >= lv.slots) { sound.gentle(); sayZh('格子满了。点一下积木可以拿掉它。'); return; }
    program.push(block); sound.pop(); renderProgram();
  };
  renderProgram();

  // 积木盘（点一下 or 拖进去都可以）
  const palette = h('div', { class: 'palette' });
  const makeBlock = (label, block, cls = '') => {
    const b = h('button', { class: 'btn block ' + cls }, label);
    enableDrag(b, slots, () => add(block));
    return b;
  };
  for (const d of lv.blocks) palette.append(makeBlock(ARROW[d], { type: 'move', dir: d }));
  for (const n of lv.repeats || []) palette.append(makeBlock(`🔁${n}`, { type: 'repeat', n }, 'rep'));
  palette.append(h('button', { class: 'btn block soft', onclick: () => { if (running) return; sound.tap(); program.pop(); renderProgram(); } }, '⌫'));

  const goBtn = h('button', { class: 'btn go', onclick: () => run() }, '▶ 开始');
  const hintBtn = h('button', { class: 'btn icon round', onclick: () => { sound.tap(); sayZh(lv.hint); } }, '💡');
  const controls = h('div', { class: 'controls' }, palette, h('div', { class: 'row' }, goBtn, hintBtn));

  ui.body.append(h('div', { class: 'coding-layout' }, boardWrap, h('div', { class: 'coding-side' }, slots, controls)));
  sayZh(lv.hint);

  function expand() {
    const steps = [];
    for (let i = 0; i < program.length; i++) {
      const p = program[i];
      if (p.type === 'move') steps.push(p.dir);
      else if (p.type === 'repeat') {
        const nxt = program[i + 1];
        if (nxt && nxt.type === 'move') { for (let k = 0; k < p.n; k++) steps.push(nxt.dir); i++; }
      }
    }
    return steps;
  }

  async function run() {
    if (running) return;
    if (!program.length) { sound.gentle(); sayZh('先放几个箭头，再按开始。'); return; }
    running = true; stopSpeech();
    pos = [...lv.start]; place(false);
    await sleep(200);
    const steps = expand();
    const slotEls = [...slots.children];
    let ok = true;
    for (let i = 0; i < steps.length; i++) {
      const d = steps[i];
      const [dc, dr] = DELTA[d];
      const nc = pos[0] + dc, nr = pos[1] + dr;
      slotEls.forEach((s) => s.classList.remove('active'));
      const blocked = nc < 0 || nr < 0 || nc >= lv.cols || nr >= lv.rows || wallSet.has(`${nc},${nr}`);
      if (blocked) {
        actor.classList.add('shake'); sound.gentle();
        await sayZh('哎呀，撞到了！再想一想。');
        actor.classList.remove('shake');
        ok = false; break;
      }
      pos = [nc, nr]; place(true); sound.tap();
      await sleep(450);
      if (pos[0] === lv.goal[0] && pos[1] === lv.goal[1]) break;
    }
    if (ok && pos[0] === lv.goal[0] && pos[1] === lv.goal[1]) {
      sound.correct(); starBurstAt(actor, 14);
      recordAnswer(MODULE_ID, 'maze', true); recordRound(MODULE_ID, 'maze');
      updateState((s) => {
        s.extra.codingUnlocked = Math.max(Number(s.extra.codingUnlocked) || 0, Math.min(index + 1, data.levels.length - 1));
        s.extra.codingDone = [...new Set([...(s.extra.codingDone || []), index])];
      });
      await sayZh(`${encouragement()}到啦！`);
      showWin();
    } else if (ok) {
      recordAnswer(MODULE_ID, 'maze', false);
      sound.gentle();
      await sayZh('还没有走到呢，再加几个箭头试试。');
      await sleep(400); pos = [...lv.start]; place(true);
    } else {
      recordAnswer(MODULE_ID, 'maze', false);
      await sleep(300); pos = [...lv.start]; place(true);
    }
    running = false;
  }

  function showWin() {
    const last = index >= data.levels.length - 1;
    showOverlay(h('div', { class: 'summary' },
      h('div', { class: 'big-emoji' }, '🎉'),
      h('div', { class: 'text' }, last ? '全部通关，太厉害了！' : `第 ${index + 1} 关完成！`),
      h('div', { class: 'stars-row' }, '⭐⭐⭐'),
      h('div', { class: 'row' },
        last ? bigButton('🏠 回去', () => { hideOverlay(); back(); }) : bigButton('➡️ 下一关', () => { hideOverlay(); onNext(index + 1); }),
        bigButton('🔁 再玩一次', () => { hideOverlay(); playLevel(index, { back, onNext }); }, 'soft'),
      ),
    ));
    sound.fanfare();
    setTimeout(() => starBurst(window.innerWidth / 2, window.innerHeight / 3, 16), 150);
  }
}

/** 积木可以点一下添加，也可以拖到程序区里 */
function enableDrag(el, dropZone, onDrop) {
  let ghost = null, startX = 0, startY = 0, dragging = false, pid = null;
  el.addEventListener('pointerdown', (e) => {
    pid = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false;
    try { el.setPointerCapture(pid); } catch (_) {}
  });
  el.addEventListener('pointermove', (e) => {
    if (pid !== e.pointerId) return;
    if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
      dragging = true;
      ghost = el.cloneNode(true); ghost.classList.add('ghost');
      document.body.append(ghost);
    }
    if (dragging && ghost) {
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      const r = dropZone.getBoundingClientRect();
      const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      dropZone.classList.toggle('over', over);
    }
  });
  const end = (e) => {
    if (pid !== e.pointerId) return;
    if (dragging) {
      const r = dropZone.getBoundingClientRect();
      const over = e.type === 'pointerup' && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      ghost?.remove(); ghost = null; dropZone.classList.remove('over');
      if (over) onDrop();
    } else if (e.type === 'pointerup') {
      onDrop();
    }
    dragging = false; pid = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => e.preventDefault());
}

// ---------------- 模块定义 ----------------
const codingModule = {
  id: MODULE_ID, name: '编程', icon: '🤖', color: 'var(--c-coding)',
  activities: [{ id: 'maze', name: '走迷宫', icon: '🤖' }],
  async mount({ goHome }) {
    await loadData();
    const select = () => { stopSpeech(); levelSelect({ back: goHome, onPick: play }); };
    const play = (i) => { stopSpeech(); playLevel(i, { back: select, onNext: play }); };
    select();
  },
};
export default codingModule;
