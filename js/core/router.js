// 场景路由：register('home', fn) / go('home', params)
const scenes = {};
let currentName = null;
export function register(name, fn) { scenes[name] = fn; }
export function go(name, params = {}) {
  const fn = scenes[name];
  if (!fn) { console.warn('没有这个场景', name); return; }
  currentName = name;
  document.getElementById('overlay-root').innerHTML = '';
  fn(params);
}
export const current = () => currentName;
