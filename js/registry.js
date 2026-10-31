// 模块注册表：首页的 5 个大图标按这里的顺序显示。
import math from '../modules/math/index.js';
import chinese from '../modules/chinese/index.js';
import english from '../modules/english/index.js';
import coding from '../modules/coding/index.js';
import bible from '../modules/bible/index.js';

export const APP_VERSION = '0.2.0';

export const MODULES = [chinese, english, math, coding, bible];

export function findModule(id) {
  return MODULES.find((m) => m.id === id);
}
