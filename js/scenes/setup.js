// 首次使用：创建家庭账户（名字 + 4 位家长密码）
import { h, scene, button, toast } from '../core/ui.js';
import { update } from '../core/store.js';
import { pinPad } from '../core/widgets.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';

export function setupScene() {
  const ui = scene({ title: '欢迎来到数学小农场', theme: 'sky', scroll: true });
  const name = h('input', { class: 'text-input', type: 'text', maxlength: 12, placeholder: '比如：我们家', autocomplete: 'off' });
  let step = 0, pin1 = '';
  const stage = h('div', { class: 'card setup-card' });
  const renderStep = () => {
    stage.innerHTML = '';
    if (step === 0) {
      stage.append(
        h('div', { class: 'big-emoji' }, '🏡'),
        h('div', { class: 'h2' }, '给这个家庭档案起个名字'),
        name,
        h('div', { class: 'hint' }, '只在这台设备上保存，不会上传到任何地方。'),
        button('下一步 ➡️', () => { if (!name.value.trim()) { toast('先起个名字吧'); return; } step = 1; renderStep(); }, 'primary big'),
      );
      setTimeout(() => name.focus(), 50);
    } else if (step === 1) {
      stage.append(h('div', { class: 'h2' }, '设置家长密码（4 位数字）'), h('div', { class: 'hint' }, '进入家长区、修改设置时需要。'),
        pinPad({ title: '', onDone: (p) => { pin1 = p; step = 2; renderStep(); }, onCancel: () => { step = 0; renderStep(); } }));
    } else {
      const pad = pinPad({ title: '再输入一次确认', onDone: (p) => {
        if (p !== pin1) { toast('两次不一样，再来一次'); audio.sfx('wrong'); pad.reset(); return; }
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
