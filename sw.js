/* Service Worker：把所有资源缓存到本地，断网也能用。
 * 资源清单在 sw-assets.js 里，由 `node tools/build.js` 自动生成（内容变了版本号也会变）。 */
importScripts('sw-assets.js');

const CACHE = 'xuexi-leyuan-' + (self.__VERSION || 'dev');
const ASSETS = (self.__ASSETS || []).map((p) => new URL(p, self.registration.scope).href);

self.addEventListener('install', (event) => {
  // 逐个缓存：个别文件缺失也不影响其它文件离线可用
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不处理外部请求（本应用也没有外部请求）

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      // 页面导航请求离线兜底：返回首页
      if (req.mode === 'navigate') {
        const index = await cache.match(new URL('index.html', self.registration.scope).href);
        if (index) return index;
      }
      return new Response('离线中，暂时打不开这个文件。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
