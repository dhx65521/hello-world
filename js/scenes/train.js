// 学习训练中心：按年龄分组列出科目，每个科目每天有次数上限。
import { h, scene, button, dialog, toast } from '../core/ui.js';
import { currentKid, setting } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton, requirePin } from '../core/widgets.js';
import { t } from '../core/i18n.js';
import * as limits from '../core/limits.js';
import * as mistakes from '../core/mistakes.js';

export const SUBJECTS = {
  digits:   { icon: '🔢', name: 'subjDigits',   desc: 'subjDigitsDesc',   group: 'little', module: 'little', kind: 'digits',  models: ['digits'],  limitKey: 'math',     music: null },
  letters:  { icon: '🔤', name: 'subjLetters',  desc: 'subjLettersDesc',  group: 'little', module: 'little', kind: 'letters', models: ['letters'], limitKey: 'letters',  music: null },
  arith:    { icon: '➕', name: 'subjArith',    desc: 'subjArithDesc',    group: 'big',    module: 'arith',  kind: 'arith',   models: ['digits'],  limitKey: 'math',     music: 'math' },
  spelling: { icon: '📝', name: 'subjSpelling', desc: 'subjSpellingDesc', group: 'big',    module: 'spelling', kind: 'spelling', models: ['letters'], limitKey: 'spelling', music: null },
};
export function ageGroup(kid) {
  const m = setting('mathMode');
  if (m === 'little' || m === 'big') return m;
  return (Number(kid?.age) || 6) < 5 ? 'little' : 'big';
}

export function trainScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  audio.music('home');
  const ui = scene({ title: t('trainTitle'), theme: 'sky', left: button('🏠', () => go('home'), 'icon'), right: [coinChip(), muteButton()], scroll: true });
  const group = ageGroup(kid);
  const grid = h('div', { class: 'subject-grid' });
  for (const [id, m] of Object.entries(SUBJECTS)) {
    if (m.group !== group) continue;
    const left = limits.remaining(m.limitKey);
    const due = mistakes.due(id, kid).length;
    const card = h('button', { class: 'subject-card' + (left === 0 ? ' dim' : '') },
      h('div', { class: 'em' }, m.icon), h('div', { class: 'name' }, t(m.name)), h('div', { class: 'desc' }, t(m.desc)),
      h('div', { class: 'meta' }, left === Infinity ? '' : left > 0 ? t('leftToday', { n: left }) : t('usedUp'), due ? h('span', { class: 'due' }, t('reviewDue', { n: due })) : null));
    card.addEventListener('click', () => start(id, m));
    grid.append(card);
  }
  ui.body.append(h('div', { class: 'hint center' }, t('trainHint', { m: Math.round((Number(setting('roundSeconds')) || 300) / 60) })), grid);

  function start(id, m) {
    audio.sfx('tap');
    if (limits.remaining(m.limitKey) > 0) return go('session', { subject: id });
    audio.sfx('wrong');
    dialog({ emoji: '🌙', title: t('dailyUsedUp'), body: h('div', { class: 'hint' }, t('dailyUsedUpHint', { n: limits.dailyLimit() })), buttons: [
      { label: t('parentUnlock'), cls: 'soft', onClick: () => requirePin(() => { limits.grantBonus(1, m.limitKey); toast(t('unlockedRound')); go('session', { subject: id }); }, t('unlockOnce')) },
      { label: t('tomorrow'), cls: 'primary' }] });
  }
}
