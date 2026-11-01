// 选孩子 / 新建孩子
import { h, svg, scene, button, toast, dialog } from '../core/ui.js';
import { getState, update, newKid } from '../core/store.js';
import { AVATARS, avatarSvg } from '../core/avatars.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { muteButton } from '../core/widgets.js';
import { t } from '../core/i18n.js';

export function kidsScene() {
  const st = getState();
  const ui = scene({ title: t('whoPlays', { family: st.account?.name || '' }), theme: 'sky', right: [muteButton()], scroll: true });
  audio.music('home');
  const grid = h('div', { class: 'kid-grid' });
  for (const kid of st.kids) {
    const card = h('button', { class: 'kid-card' },
      h('div', { class: 'kid-avatar' }, svg(avatarSvg(kid.avatar))),
      h('div', { class: 'kid-name' }, kid.name),
      h('div', { class: 'kid-sub' }, `${t('years', { n: kid.age })} · 🪙 ${kid.coins}`));
    card.addEventListener('click', () => { audio.sfx('pop'); update((s) => { s.currentKidId = kid.id; }); go('home'); });
    grid.append(card);
  }
  const add = h('button', { class: 'kid-card add' }, h('div', { class: 'kid-avatar plus' }, '＋'), h('div', { class: 'kid-name' }, t('newFriend')));
  add.addEventListener('click', () => { audio.sfx('tap'); go('newKid'); });
  grid.append(add);
  ui.body.append(grid);
  if (!st.kids.length) ui.body.prepend(h('div', { class: 'hint center' }, t('noKids')));
}

export function newKidScene({ editId = null } = {}) {
  const st = getState();
  const editing = editId ? st.kids.find((k) => k.id === editId) : null;
  const ui = scene({ title: editing ? t('editProfile') : t('newFriend'), theme: 'sky', left: button('⬅️', () => go(editing ? 'parent' : 'kids'), 'icon'), scroll: true });
  const name = h('input', { class: 'text-input', type: 'text', maxlength: 8, placeholder: t('name'), autocomplete: 'off', value: editing?.name || '' });
  let age = editing?.age || 6, avatar = editing?.avatar || AVATARS[0].id;
  const ages = h('div', { class: 'seg' });
  const renderAges = () => { ages.innerHTML = ''; for (let a = 3; a <= 9; a++) ages.append(button(t('years', { n: a }), () => { age = a; renderAges(); }, age === a ? 'on' : '')); };
  renderAges();
  const avs = h('div', { class: 'avatar-grid' });
  const renderAvs = () => {
    avs.innerHTML = '';
    for (const a of AVATARS) {
      const b = h('button', { class: 'avatar-pick' + (avatar === a.id ? ' on' : '') }, svg(a.svg));
      b.addEventListener('click', () => { audio.sfx('pop'); avatar = a.id; renderAvs(); });
      avs.append(b);
    }
  };
  renderAvs();
  const save = button(editing ? t('save') : t('letsPlay'), () => {
    const n = name.value.trim();
    if (!n) { toast(t('enterName')); name.focus(); return; }
    if (editing) {
      update((s) => { const k = s.kids.find((x) => x.id === editId); Object.assign(k, { name: n, age, avatar }); });
      go('parent');
    } else {
      const kid = newKid({ name: n, age, avatar });
      update((s) => { s.kids.push(kid); s.currentKidId = kid.id; });
      audio.sfx('fanfare');
      go('home');
    }
  }, 'primary big');
  ui.body.append(h('div', { class: 'card form-card' },
    h('div', { class: 'form-row' }, h('label', {}, t('name')), name),
    h('div', { class: 'form-row' }, h('label', {}, t('age')), ages),
    h('div', { class: 'form-row' }, h('label', {}, t('avatar')), avs),
    save,
  ));
}
