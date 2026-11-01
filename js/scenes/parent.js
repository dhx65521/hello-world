// 家长区：密码进入；语言、孩子管理、数学设置、每日次数、农场时间、存档、重置
import { h, svg, scene, button, toast, dialog } from '../core/ui.js';
import { getState, update, setting, setSetting, exportJSON, importJSON, resetAll } from '../core/store.js';
import { pinPad, muteButton } from '../core/widgets.js';
import { avatarSvg } from '../core/avatars.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { APP_VERSION } from '../version.js';
import { t, lang, setLang } from '../core/i18n.js';
import * as limits from '../core/limits.js';
import * as speech from '../core/speech.js';

let unlockedUntil = 0;

export function parentScene() {
  const st = getState();
  if (Date.now() > unlockedUntil && st.account?.pin) {
    const ui = scene({ title: t('parent'), theme: 'sky', left: button('⬅️', () => go('home'), 'icon') });
    const pad = pinPad({ title: t('enterParentPin'), onDone: (p) => {
      if (p === st.account.pin) { unlockedUntil = Date.now() + 5 * 60 * 1000; audio.sfx('open'); parentScene(); }
      else { audio.sfx('wrong'); toast(t('wrongPin')); pad.reset(); }
    } });
    ui.body.append(pad);
    return;
  }
  audio.stopMusic();
  const ui = scene({ title: t('parent'), theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [muteButton()], scroll: true });
  const wrap = h('div', { class: 'parent' });
  const seg = (label, options, get, set, hint = '') => {
    const row = h('div', { class: 'seg' });
    const render = () => { row.innerHTML = ''; for (const [v, text] of options) row.append(button(text, () => { set(v); render(); }, get() === v ? 'on' : '')); };
    render();
    return h('section', {}, h('h2', {}, label), row, hint ? h('div', { class: 'hint' }, hint) : null);
  };

  // 语言
  wrap.append(seg(t('language'), [['zh', '中文'], ['en', 'English']], () => lang(), (v) => { setLang(v); parentScene(); }));

  // 孩子管理
  const kidsSec = h('section', {}, h('h2', {}, t('kids')));
  for (const kid of st.kids) {
    kidsSec.append(h('div', { class: 'kid-row' },
      h('span', { class: 'av' }, svg(avatarSvg(kid.avatar))),
      h('span', { class: 'kid-row-name' }, t('kidLine', { name: kid.name, age: kid.age })),
      h('span', { class: 'kid-row-stat' }, t('kidStat', { c: kid.coins, r: kid.stats.rounds, x: kid.stats.correct, y: kid.stats.answered, d: limits.usedToday('math', kid) })),
      button('✏️', () => go('newKid', { editId: kid.id }), 'small'),
      button('🗑️', () => dialog({ emoji: '🗑️', title: t('deleteKid', { name: kid.name }), body: h('div', { class: 'hint' }, t('deleteKidHint')), buttons: [
        { label: t('delete'), cls: 'danger', onClick: () => { update((s) => { s.kids = s.kids.filter((k) => k.id !== kid.id); if (s.currentKidId === kid.id) s.currentKidId = s.kids[0]?.id || null; }); parentScene(); } },
        { label: t('cancel'), cls: 'soft' }] }), 'small'),
    ));
  }
  kidsSec.append(button(t('addKid'), () => go('newKid'), 'soft'));
  wrap.append(kidsSec);

  wrap.append(seg(t('dailyLimit'), [[1, t('times', { n: 1 })], [2, t('times', { n: 2 })], [3, t('times', { n: 3 })], [5, t('times', { n: 5 })], [0, t('unlimited')]], () => limits.dailyLimit(), (v) => setSetting('dailyLimit', v), t('dailyHint')));
  wrap.append(seg(t('mathMode'), [['auto', t('modeAuto')], ['little', t('modeLittle')], ['big', t('modeBig')]], () => setting('mathMode') || 'auto', (v) => setSetting('mathMode', v)));
  wrap.append(seg(t('roundLength'), [[180, t('minutes', { n: 3 })], [300, t('minutes', { n: 5 })], [480, t('minutes', { n: 8 })], [600, t('minutes', { n: 10 })]], () => setting('roundSeconds'), (v) => setSetting('roundSeconds', v)));
  wrap.append(seg(t('reward'), [[1, '+1'], [2, '+2'], [3, '+3']], () => setting('rewardCoins'), (v) => setSetting('rewardCoins', v), t('rewardHint')));
  wrap.append(seg(t('farmTime'), [[1, t('normal')], [10, t('faster', { n: 10 })], [60, t('faster', { n: 60 })], [600, t('faster', { n: 600 })]], () => setting('timeScale'), (v) => setSetting('timeScale', v), t('farmTimeHint')));

  // 语音
  const voiceSec = h('section', {}, h('h2', {}, t('voice')));
  const voiceRow = h('div', { class: 'seg' });
  const renderVoices = () => {
    voiceRow.innerHTML = '';
    const list = speech.voicesFor(lang()); const cur = speech.currentVoice(lang());
    if (!list.length) { voiceRow.append(h('div', { class: 'hint' }, t('noVoices'))); return; }
    for (const v of list.slice(0, 8)) {
      const label = v.name + ((v.voiceURI + v.name).toLowerCase().includes('premium') ? ' ★★' : (v.voiceURI + v.name).toLowerCase().includes('enhanced') ? ' ★' : '');
      voiceRow.append(button(label, () => { speech.setVoice(lang(), v.voiceURI); renderVoices(); speech.say(lang() === 'en' ? 'Hello! Which one is the number 7?' : '你好！下面哪个是数字 7？'); }, cur && cur.voiceURI === v.voiceURI ? 'on' : ''));
    }
  };
  renderVoices();
  if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', renderVoices);
  const rateRow = h('div', { class: 'seg' });
  const renderRate = () => { rateRow.innerHTML = ''; for (const [r, label] of [[0.75, t('slow')], [0.9, t('normalRate')], [1.0, t('fast')]]) rateRow.append(button(label, () => { setSetting('speechRate', r); renderRate(); speech.say(lang() === 'en' ? 'Write the number 5.' : '照着写数字 5。'); }, Math.abs((Number(setting('speechRate')) || 0.9) - r) < 0.01 ? 'on' : '')); };
  renderRate();
  voiceSec.append(voiceRow, h('div', { class: 'hint', style: { margin: '8px 0' } }, t('speechRate')), rateRow, h('div', { class: 'hint' }, t('voiceHint')));
  wrap.append(voiceSec);

  // 存档
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    try { importJSON(await f.text()); toast(t('importOk')); audio.sfx('fanfare'); setTimeout(() => go('kids'), 600); }
    catch (e) { toast(t('importFail') + e.message); }
  });
  wrap.append(h('section', {}, h('h2', {}, t('saveData')),
    h('div', { class: 'row left' },
      button(t('exportSave'), async () => {
        const text = exportJSON();
        const file = new File([text], `math-farm-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
        try {
          if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: t('appName') }); return; }
        } catch (e) { return; }
        const url = URL.createObjectURL(file); const a = h('a', { href: url, download: file.name }); document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, 'soft'),
      button(t('importSave'), () => fileInput.click(), 'soft'),
      fileInput,
    ),
    h('div', { class: 'hint' }, t('saveHint')),
  ));

  let armed = false;
  const resetBtn = button(t('resetAll'), () => {
    if (!armed) { armed = true; resetBtn.textContent = t('resetConfirm'); setTimeout(() => { armed = false; resetBtn.textContent = t('resetAll'); }, 4000); return; }
    resetAll(); go('setup');
  }, 'danger');
  wrap.append(h('section', {}, h('h2', {}, t('reset')), resetBtn));
  wrap.append(h('section', {}, h('h2', {}, t('about')),
    h('div', {}, t('aboutLine', { v: APP_VERSION })),
    h('div', { style: { marginTop: '10px' } }, button(t('checkUpdate'), async () => {
      try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* ignore */ }
      location.reload();
    }, 'soft')),
  ));
  ui.body.append(wrap);
}
