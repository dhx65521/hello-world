// 存档：一个家庭账户 + 多个孩子。目前存在本机 localStorage；
// 以后要多设备同步，只需要替换下面的 adapter（load/save）即可，游戏逻辑不用改。
const KEY = 'math-farm.v1';

const localAdapter = {
  load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
  save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } },
};
let adapter = localAdapter;

const DEFAULT_SETTINGS = () => ({
  muted: false,
  roundSeconds: 300,     // 每局时长
  rewardCoins: 1,        // 答对 +N
  timeScale: 1,          // 农场时间倍速（测试模式用，60 = 1 分钟当 1 小时）
  dailyLimit: 2,         // 每天最多开始几局数学（0 = 不限）
  lang: 'zh',            // 界面语言 zh / en
});

const DEFAULTS = () => ({
  version: 1,
  account: null,          // { name, pin, createdAt }
  kids: [],               // Kid[]
  currentKidId: null,
  settings: DEFAULT_SETTINGS(),
  updatedAt: 0,
});

export function newKid({ name, age, avatar }) {
  return {
    id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, age, avatar,
    coins: 0,
    inventory: { seeds: {}, items: {}, crops: {} },
    farm: { plots: Array.from({ length: 8 }, () => null), harvests: 0, unlocked: [] },
    stats: { rounds: 0, answered: 0, correct: 0, wrong: 0, coinsEarned: 0, best: 0, lastPlayed: 0 },
    createdAt: Date.now(),
  };
}

let state = (() => {
  const d = adapter.load();
  if (!d) return DEFAULTS();
  return { ...DEFAULTS(), ...d, settings: { ...DEFAULT_SETTINGS(), ...(d.settings || {}) } };
})();

export const getState = () => state;
export function update(mutate) {
  mutate(state);
  state.updatedAt = Date.now();
  adapter.save(state);
  return state;
}
export const setting = (k) => state.settings[k];
export const setSetting = (k, v) => update((s) => { s.settings[k] = v; });

export const currentKid = () => state.kids.find((k) => k.id === state.currentKidId) || null;
export function updateKid(mutate) {
  return update((s) => { const k = s.kids.find((x) => x.id === s.currentKidId); if (k) mutate(k, s); });
}
export function addCoins(n) {
  let after = 0;
  updateKid((k) => { k.coins = Math.max(0, (k.coins || 0) + n); after = k.coins; });
  return after;
}

/** 导出 / 导入存档（备份、换设备） */
export function exportJSON() { return JSON.stringify(state, null, 2); }
export function importJSON(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.kids)) throw new Error('不是有效的存档文件');
  state = { ...DEFAULTS(), ...d, settings: { ...DEFAULT_SETTINGS(), ...(d.settings || {}) } };
  update(() => {});
}
export function resetAll() { state = DEFAULTS(); update(() => {}); }
