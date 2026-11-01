// 首次使用：创建家庭账户（名字 + 4 位家长密码）
import { h, scene, button, toast } from '../core/ui.js';
import { update } from '../core/store.js';
import { pinPad } from '../core/widgets.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { t, lang, setLang } from '../core/i18n.js';

export function setupScene() {
  const ui = scene({ title: t('welcome'), theme: 'sky', scroll: true });
  const name = h('input', { class: 'text-input', type: 'text', maxlength: 12, placeholder: t('familyPlaceholder'), autocomplete: 'off' });
  let step = 0, pin1 = '';
  const stage = h('div', { class: 'card setup-card' });
  const renderStep = () => {
    stage.innerHTML = '';
    if (step === 0) {
      const langSeg = h('div', { class: 'seg center' },
        button('中文', () => { setLang('zh'); setupScene(); }, lang() === 'zh' ? 'on' : ''),
        button('English', () => { setLang('en'); setupScene(); }, lang() === 'en' ? 'on' : ''));
      stage.append(
        langSeg,
        h('div', { class: 'big-emoji' }, '🏡'),
        h('div', { class: 'h2' }, t('familyNamePrompt')),
        name,
        h('div', { class: 'hint' }, t('localOnly')),
        button(t('next'), () => { if (!name.value.trim()) { toast(t('needName')); return; } step = 1; renderStep(); }, 'primary big'),
      );
      setTimeout(() => name.focus(), 50);
    } else if (step === 1) {
      stage.append(h('div', { class: 'h2' }, t('setPin')), h('div', { class: 'hint' }, t('pinWhy')),
        pinPad({ title: '', onDone: (p) => { pin1 = p; step = 2; renderStep(); }, onCancel: () => { step = 0; renderStep(); } }));
    } else {
      const pad = pinPad({ title: t('confirmPin'), onDone: (p) => {
        if (p !== pin1) { toast(t('pinMismatch')); audio.sfx('wrong'); pad.reset(); return; }
        update((s) => { s.account = { name: name.value.trim(), pin: p, createdAt: Date.now() }; });
        audio.sfx('fanfare');
        go('kids');
      }, onCancel: () => { step = 1; renderStep(); } });
      stage.append(pad);
    }
  };
  renderStep();
  ui.body.append(stage);
}
