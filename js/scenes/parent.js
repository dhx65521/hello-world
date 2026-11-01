// 家长区：密码进入；设置、孩子管理、存档导入导出、测试模式
import { h, svg, scene, button, toast, dialog } from '../core/ui.js';
import { getState, update, setting, setSetting, exportJSON, importJSON, resetAll } from '../core/store.js';
import { pinPad, muteButton } from '../core/widgets.js';
import { avatarSvg } from '../core/avatars.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { APP_VERSION } from '../version.js';

let unlockedUntil = 0;

export function parentScene() {
  const st = getState();
  if (Date.now() > unlockedUntil && st.account?.pin) {
    const ui = scene({ title: '家长区', theme: 'sky', left: button('⬅️', () => go('home'), 'icon') });
    const pad = pinPad({ title: '请输入家长密码', onDone: (p) => {
      if (p === st.account.pin) { unlockedUntil = Date.now() + 5 * 60 * 1000; audio.sfx('open'); parentScene(); }
      else { audio.sfx('wrong'); toast('密码不对'); pad.reset(); }
    } });
    ui.body.append(pad);
    return;
  }
  audio.stopMusic();
  const ui = scene({ title: '家长区', theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [muteButton()], scroll: true });
  const wrap = h('div', { class: 'parent' });
  const seg = (label, options, get, set, hint = '') => {
    const row = h('div', { class: 'seg' });
    const render = () => { row.innerHTML = ''; for (const [v, text] of options) row.append(button(text, () => { set(v); render(); }, get() === v ? 'on' : '')); };
    render();
    return h('section', {}, h('h2', {}, label), row, hint ? h('div', { class: 'hint' }, hint) : null);
  };

  // 孩子管理
  const kidsSec = h('section', {}, h('h2', {}, '👧 小朋友'));
  for (const kid of st.kids) {
    kidsSec.append(h('div', { class: 'kid-row' },
      h('span', { class: 'av' }, svg(avatarSvg(kid.avatar))),
      h('span', { class: 'kid-row-name' }, `${kid.name}（${kid.age} 岁）`),
      h('span', { class: 'kid-row-stat' }, `🪙 ${kid.coins} · 做题 ${kid.stats.rounds} 局 · 答对 ${kid.stats.correct}/${kid.stats.answered}`),
      button('✏️', () => go('newKid', { editId: kid.id }), 'small'),
      button('🗑️', () => dialog({ emoji: '🗑️', title: `删除 ${kid.name} 的全部记录？`, body: h('div', { class: 'hint' }, '金币、农场、做题记录都会清掉，不能恢复。'), buttons: [
        { label: '删除', cls: 'danger', onClick: () => { update((s) => { s.kids = s.kids.filter((k) => k.id !== kid.id); if (s.currentKidId === kid.id) s.currentKidId = s.kids[0]?.id || null; }); parentScene(); } },
        { label: '取消', cls: 'soft' }] }), 'small'),
    ));
  }
  kidsSec.append(button('＋ 添加小朋友', () => go('newKid'), 'soft'));
  wrap.append(kidsSec);

  wrap.append(seg('⏱️ 数学每局时长', [[180, '3 分钟'], [300, '5 分钟'], [480, '8 分钟'], [600, '10 分钟']], () => setting('roundSeconds'), (v) => setSetting('roundSeconds', v)));
  wrap.append(seg('🪙 答对奖励', [[1, '+1'], [2, '+2'], [3, '+3']], () => setting('rewardCoins'), (v) => setSetting('rewardCoins', v), '答错不扣金币，可以再写一次；第二次答对也有奖励，再错就显示答案进入下一题。'));
  wrap.append(seg('🧪 农场时间（测试模式）', [[1, '正常'], [10, '快 10 倍'], [60, '快 60 倍'], [600, '快 600 倍']], () => setting('timeScale'), (v) => setSetting('timeScale', v), '正常模式下番茄 1 小时成熟、火龙果 2 天；测试模式用来快速推演。'));

  // 存档
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    try { importJSON(await f.text()); toast('导入成功'); audio.sfx('fanfare'); setTimeout(() => go('kids'), 600); }
    catch (e) { toast('导入失败：' + e.message); }
  });
  wrap.append(h('section', {}, h('h2', {}, '💾 存档'),
    h('div', { class: 'row left' },
      button('📤 导出存档', async () => {
        const text = exportJSON();
        const file = new File([text], `math-farm-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
        try {
          if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '数学小农场存档' }); return; }
        } catch (e) { /* 用户取消 */ return; }
        const url = URL.createObjectURL(file); const a = h('a', { href: url, download: file.name }); document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, 'soft'),
      button('📥 导入存档', () => fileInput.click(), 'soft'),
      fileInput,
    ),
    h('div', { class: 'hint' }, '导出一个 JSON 文件（可存到“文件”或用隔空投送发到另一台设备），在另一台设备上导入即可搬家。'),
  ));

  // 危险操作 + 关于
  let armed = false;
  const resetBtn = button('清空全部数据（账户和所有小朋友）', () => {
    if (!armed) { armed = true; resetBtn.textContent = '再点一次确认清空'; setTimeout(() => { armed = false; resetBtn.textContent = '清空全部数据（账户和所有小朋友）'; }, 4000); return; }
    resetAll(); go('setup');
  }, 'danger');
  wrap.append(h('section', {}, h('h2', {}, '⚠️ 重置'), resetBtn));
  wrap.append(h('section', {}, h('h2', {}, 'ℹ️ 关于'),
    h('div', {}, `数学小农场 v${APP_VERSION} · 家庭自用 · 纯本地运行`),
    h('div', { style: { marginTop: '10px' } }, button('🔄 检查更新', async () => {
      try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* ignore */ }
      location.reload();
    }, 'soft')),
  ));
  ui.body.append(wrap);
}
