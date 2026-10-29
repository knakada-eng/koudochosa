// 入力画面をスマホに保存して、電波がなくても開けるようにする（Service Worker）
// 画面を更新したら VERSION を変える → 次に電波のある所で開いたとき入れ替わる
const VERSION = 'chosa-v0.10.2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'leaflet.js', 'leaflet.css', 'layers.png', 'layers-2x.png', 'dock-home.png', 'dock-camera.png', 'dock-zumen.png', 'dock-map.png', 'dock-todo.png'];
const TILES = 'tiles-v1';            // 「航空写真を前もって保存」で保存した所（範囲ごとに150日（v0.10。前は30日）。画面側で消す）
const SEEN = 'tiles-seen-';          // 地図で見ただけの所（10日ごとの箱に入れ、30日たった箱から捨てる）
const seenBox = () => SEEN + Math.floor(Date.now() / 864000000);
function dropOldSeen() {
  const now = Math.floor(Date.now() / 864000000);
  return caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(SEEN) && now - Number(k.slice(SEEN.length)) >= 3).map(k => caches.delete(k))));
}

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== TILES && !k.startsWith(SEEN)).map(k => caches.delete(k)))).then(dropOldSeen).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname === 'cyberjapandata.gsi.go.jp') {      // 地図の画像：保存してあればそれを使い、なければ取りに行って保存
    ev.respondWith((async () => {
      const hit = await caches.match(req.url);              // 前もって保存した所 → 見ただけの所
      if (hit) return hit;
      try { const r = await fetch(req.url, { mode: 'cors' }); if (r.ok) { const c = await caches.open(seenBox()); c.put(req.url, r.clone()); } return r; }
      catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== location.origin) return;               // データの送受信（Google）は素通し
  const key = req.mode === 'navigate' ? 'index.html' : req;
  ev.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { ev.waitUntil(net); return hit; }
    return (await net) || new Response('電波がありません', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
