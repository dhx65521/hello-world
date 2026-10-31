// 本地存储：所有进度、星星、设置都只存在这台设备的 localStorage 里。
const KEY = 'xuexi-leyuan.v1';

const DEFAULTS = () => ({
  settings: {
    sessionMinutes: 10,   // 每次使用时长（0 = 不限）
    speechRate: 0.85,     // 语速（1 = 正常）
  },
  stars: 0,               // 累计星星
  modules: {},            // modules[moduleId][activityId] = { rounds, correct, total, stars }
  extra: {},              // 模块自定义进度（如编程已解锁关卡、看过的故事）
  updatedAt: 0,
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const data = JSON.parse(raw);
    return { ...DEFAULTS(), ...data, settings: { ...DEFAULTS().settings, ...(data.settings || {}) }, extra: data.extra || {} };
  } catch (e) {
    return DEFAULTS();
  }
}

let state = load();

export function getState() {
  return state;
}

/** 修改状态：mutate(state) 里直接改，然后自动保存。 */
export function updateState(mutate) {
  mutate(state);
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* 隐私模式下可能失败，忽略 */
  }
  return state;
}

export function getSetting(name) {
  return state.settings[name];
}

export function setSetting(name, value) {
  updateState((s) => { s.settings[name] = value; });
}

export function resetProgress() {
  const settings = state.settings;
  state = DEFAULTS();
  state.settings = settings;
  updateState(() => {});
}
