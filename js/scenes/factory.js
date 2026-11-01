// 食品加工厂：两个加工位，用原料按配方做成成品，成品卖得更贵。
import { h, scene, button, toast, loadJSON, sleep } from '../core/ui.js';
import { currentKid, updateKid, setting } from '../core/store.js';
import { go } from '../core/router.js';
import * as audio from '../core/audio.js';
import { coinChip, muteButton } from '../core/widgets.js';
import { burst, flyCoins, pop, shake } from '../core/fx.js';
import { loadFarmData, seedById } from './home.js';
import { fmtRemaining } from '../core/farmlogic.js';
import { t, name as nm } from '../core/i18n.js';

let data = null;
export async function loadFactoryData() {
  if (!data) data = await loadJSON(new URL('../../data/factory.json', import.meta.url));
  return data;
}
export const recipeById = (id) => data?.recipes.find((r) => r.id === id);
const scale = () => Number(setting('timeScale')) || 1;
export const jobMs = (r) => r.minutes * 60 * 1000;
export const jobDone = (job, now = Date.now()) => job && (now - job.startedAt) * scale() >= jobMs(recipeById(job.recipe));
export const jobRemaining = (job, now = Date.now()) => Math.max(0, (jobMs(recipeById(job.recipe)) - (now - job.startedAt) * scale()) / scale());
/** 有多少个做好的成品待收取（主界面角标用） */
export function readyCount(kid) { return (kid?.factory?.slots || []).filter((j) => j && jobDone(j)).length; }

export async function factoryScene() {
  const kid = currentKid();
  if (!kid) return go('kids');
  await Promise.all([loadFarmData(), loadFactoryData()]);
  audio.music('shop');
  const ui = scene({ title: t('factoryTitle'), theme: 'shop', left: button('🏠', () => { stop(); go('home'); }, 'icon'), right: [coinChip(), muteButton()], scroll: true });
  const slotsEl = h('div', { class: 'slots-row' });
  const grid = h('div', { class: 'shop-grid' });
  ui.body.append(h('div', { class: 'keeper' }, h('span', { class: 'face' }, '👩‍🍳'), h('div', { class: 'bubble' }, t('factoryIntro'))), slotsEl, grid);

  const slots = () => currentKid().factory.slots;
  const crops = () => currentKid().inventory.crops;
  const canMake = (r) => Object.entries(r.inputs).every(([id, n]) => (crops()[id] || 0) >= n);
  const freeSlot = () => slots().findIndex((j) => !j);

  function renderSlots() {
    slotsEl.innerHTML = '';
    slots().forEach((job, i) => {
      const card = h('div', { class: 'fslot' + (job ? (jobDone(job) ? ' done' : ' busy') : '') });
      if (!job) { card.append(h('div', { class: 'em' }, '🍳'), h('div', { class: 'st' }, t('slotIdle'))); }
      else {
        const r = recipeById(job.recipe);
        const prog = Math.min(1, ((Date.now() - job.startedAt) * scale()) / jobMs(r));
        card.append(h('div', { class: 'em' }, r.emoji), h('div', { class: 'nm' }, nm(r)),
          h('div', { class: 'bar' }, h('i', { style: { width: Math.round(prog * 100) + '%' } })),
          jobDone(job) ? button(t('collect'), () => collect(i, card), 'primary') : h('div', { class: 'st' }, t('slotWorking', { time: fmtRemaining(jobRemaining(job)) })));
      }
      slotsEl.append(card);
    });
  }
  function renderRecipes() {
    grid.innerHTML = '';
    for (const r of data.recipes) {
      const ok = canMake(r);
      const inputs = h('div', { class: 'inputs' }, ...Object.entries(r.inputs).map(([id, n]) => { const s = seedById(id); const have = crops()[id] || 0; return h('span', { class: 'inp' + (have >= n ? ' ok' : '') }, `${s?.emoji || id}×${n}`, h('small', {}, ` (${have})`)); }));
      const card = h('div', { class: 'shop-card recipe' + (ok ? '' : ' lack') },
        h('div', { class: 'em' }, r.emoji), h('div', { class: 'name' }, nm(r)), inputs,
        h('div', { class: 'meta' }, `${t('takes', { time: fmtRemaining(jobMs(r)) })} · ${t('sellsFor', { n: r.sell })}`),
        button(t('make'), () => make(r, card), ok ? 'primary' : 'soft'));
      grid.append(card);
    }
  }
  async function make(r, card) {
    if (!canMake(r)) { audio.sfx('wrong'); shake(card); toast(t('needMore')); return; }
    const i = freeSlot(); if (i < 0) { audio.sfx('wrong'); shake(card); toast(t('noSlot')); return; }
    updateKid((k) => { for (const [id, n] of Object.entries(r.inputs)) k.inventory.crops[id] -= n; k.factory.slots[i] = { recipe: r.id, startedAt: Date.now() }; });
    audio.sfx('plant'); burst(card, ['✨', r.emoji], 8); toast(t('startedToast', { name: nm(r) }));
    await flyCoins(card, slotsEl.children[i], 3, r.emoji);
    renderSlots(); renderRecipes();
  }
  async function collect(i, card) {
    const job = slots()[i]; if (!job || !jobDone(job)) return;
    const r = recipeById(job.recipe);
    updateKid((k) => { k.inventory.products[r.id] = (k.inventory.products[r.id] || 0) + 1; k.factory.slots[i] = null; });
    audio.sfx('harvest'); burst(card, [r.emoji, '✨'], 10); toast(t('producedToast', { name: nm(r) }));
    renderSlots(); renderRecipes();
  }
  renderSlots(); renderRecipes();
  const timer = setInterval(() => { if (!document.hidden) renderSlots(); }, 1000);
  const stop = () => clearInterval(timer);
}
