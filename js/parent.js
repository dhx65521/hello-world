// 家长区：查看进度、设置时长、语速、重置。
import { getState, setSetting, resetProgress } from './storage.js';
import { h, screen, bigButton } from './ui.js';
import * as timer from './timer.js';
import { sayZh, sayEn } from './speech.js';
import { APP_VERSION, MODULES } from './registry.js';

const SESSION_OPTIONS = [5, 10, 15, 20, 30, 0];
const RATE_OPTIONS = [[0.7, '慢'], [0.85, '适中'], [1.0, '正常']];

export function mountParent({ goHome }) {
  const ui = screen({ title: '家长区', onBack: goHome, scroll: true });
  const st = getState();
  const wrap = h('div', { class: 'parent' });

  // 进度
  const rows = [];
  for (const mod of MODULES) {
    const acts = st.modules[mod.id] || {};
    for (const act of mod.activities || []) {
      const a = acts[act.id];
      if (!a) continue;
      rows.push(h('tr', {},
        h('td', {}, `${mod.icon} ${mod.name}`),
        h('td', {}, `${act.icon} ${act.name}`),
        h('td', {}, a.rounds),
        h('td', {}, `${a.correct} / ${a.total}` + (a.total ? ` (${Math.round(a.correct / a.total * 100)}%)` : '')),
        h('td', {}, `⭐ ${a.stars}`),
      ));
    }
  }
  wrap.append(h('section', {},
    h('h2', {}, `⭐ 累计星星：${st.stars}`),
    rows.length
      ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, '模块'), h('th', {}, '活动'), h('th', {}, '轮数'), h('th', {}, '答对 / 作答'), h('th', {}, '星星'))), h('tbody', {}, rows))
      : h('div', { class: 'hint' }, '还没有玩过，去首页选一个模块试试吧。'),
    h('div', { class: 'hint' }, '说明：答错不扣分，“作答”包括答错后重试的次数，所以正确率低于 100% 很正常。'),
  ));

  // 使用时长
  const segTime = h('div', { class: 'seg' });
  const renderTime = () => {
    segTime.innerHTML = '';
    const cur = Number(st.settings.sessionMinutes);
    for (const m of SESSION_OPTIONS) {
      segTime.append(h('button', { class: 'btn' + (cur === m ? ' on' : ''), onclick: () => {
        setSetting('sessionMinutes', m); timer.restart(); renderTime();
      } }, m === 0 ? '不限' : `${m} 分钟`));
    }
  };
  renderTime();
  wrap.append(h('section', {},
    h('h2', {}, '⏰ 每次使用时长'),
    segTime,
    h('div', { class: 'hint' }, '时间到了会出现“休息一下”的提示，家长长按 3 秒可以继续。改动后立即重新计时。'),
  ));

  // 语速
  const segRate = h('div', { class: 'seg' });
  const renderRate = () => {
    segRate.innerHTML = '';
    const cur = Number(st.settings.speechRate);
    for (const [r, label] of RATE_OPTIONS) {
      segRate.append(h('button', { class: 'btn' + (Math.abs(cur - r) < 0.01 ? ' on' : ''), onclick: () => {
        setSetting('speechRate', r); renderRate(); sayZh('你好，我是这样说话的。');
      } }, label));
    }
    segRate.append(h('button', { class: 'btn', onclick: () => sayZh('小朋友你好，我们一起来学习吧！') }, '🔊 试听中文'));
    segRate.append(h('button', { class: 'btn', onclick: () => sayEn('Hello! Let us learn together.') }, '🔊 Test English'));
  };
  renderRate();
  wrap.append(h('section', {},
    h('h2', {}, '🗣️ 语音速度'),
    segRate,
    h('div', { class: 'hint' }, '使用 iPad 自带的语音。如果没有声音，请检查静音开关和音量；中文声音可在“设置 › 辅助功能 › 朗读内容 › 声音”里下载更好听的声音（如“婷婷”）。'),
  ));

  // 重置
  let armed = false;
  const resetBtn = h('button', { class: 'btn danger', style: { minHeight: '64px', fontSize: '22px' }, onclick: () => {
    if (!armed) { armed = true; resetBtn.textContent = '再点一次确认清空'; setTimeout(() => { armed = false; resetBtn.textContent = '清空所有进度和星星'; }, 4000); return; }
    resetProgress(); mountParent({ goHome });
  } }, '清空所有进度和星星');
  wrap.append(h('section', {},
    h('h2', {}, '🧹 重置'),
    resetBtn,
    h('div', { class: 'hint' }, '只会清空这台 iPad 上的记录，设置会保留。'),
  ));

  // 关于 / 更新
  wrap.append(h('section', {},
    h('h2', {}, 'ℹ️ 关于'),
    h('div', {}, `版本 ${APP_VERSION} · 纯本地运行，不联网、不上传任何数据。`),
    h('div', { style: { marginTop: '12px' } },
      h('button', { class: 'btn', style: { minHeight: '56px', fontSize: '20px' }, onclick: async () => {
        try {
          const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
          for (const r of regs) await r.unregister();
          const keys = await caches?.keys?.() || [];
          for (const k of keys) await caches.delete(k);
        } catch (e) { /* ignore */ }
        location.reload();
      } }, '🔄 检查更新（重新下载最新版）'),
    ),
    h('div', { class: 'hint' }, '更新时需要联网一次，之后仍可离线使用。'),
  ));

  ui.body.append(wrap, h('div', { style: { height: '24px' } }));
  ui.body.append(bigButton('🏠 回到首页', goHome, 'soft'));
}
