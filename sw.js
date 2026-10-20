// 入力画面をスマホに保存して、電波がなくても開けるようにする（Service Worker）
// 画面を更新したら VERSION を変える → 次に電波のある所で開いたとき入れ替わる
const VERSION = 'chosa-v0.2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // データの送受信（Google）は素通し
  const key = req.mode === 'navigate' ? 'index.html' : req;
  ev.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { ev.waitUntil(net); return hit; }          // 保存してある画面をすぐ出し、裏で新しい版を取っておく
    return (await net) || new Response('電波がありません', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
