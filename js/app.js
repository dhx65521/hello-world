// 入口：注册场景、首次触摸解锁音频、启动
import { register, go } from './core/router.js';
import { getState } from './core/store.js';
import * as audio from './core/audio.js';
import { setupScene } from './scenes/setup.js';
import { kidsScene, newKidScene } from './scenes/kids.js';
import { homeScene } from './scenes/home.js';
import { mathScene } from './scenes/math.js';
import { bagScene } from './scenes/bag.js';
import { parentScene } from './scenes/parent.js';
import { shopScene } from './scenes/shop.js';

register('setup', setupScene);
register('kids', kidsScene);
register('newKid', newKidScene);
register('home', homeScene);
register('math', mathScene);
register('bag', bagScene);
register('shop', shopScene);
register('parent', parentScene);

let unlocked = false;
const unlockOnce = () => { if (unlocked) return; unlocked = true; audio.unlock(); };
['pointerdown', 'touchstart', 'click'].forEach((ev) => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

const st = getState();
if (!st.account) go('setup');
else if (!st.kids.length || !st.currentKidId) go('kids');
else go('home');
