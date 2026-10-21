/* Service worker: приложение работает офлайн.
   Оболочка (HTML/CSS/JS/иконки) — из кэша, обновляется при смене VERSION.
   Данные (data/*.json) — сначала сеть, при отсутствии сети — кэш: новые юниты подхватываются сразу.
   Шрифты Google — кэшируются при первом показе.
   ⚠ Меняй VERSION при каждом изменении файлов оболочки. */
const VERSION = "sora-v2.9.1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/cards.js", "js/data.js", "js/fsrs.js", "js/review.js", "js/unit.js", "js/quiz.js", "js/games.js", "js/words.js", "js/fluency.js", "js/db.js", "js/markup.js", "js/render.js", "js/sky.js", "js/scenes.js", "js/tip.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "data/dict.json", "data/grammar.json", "data/kanji.json", "data/course.json", "data/library/index.json",
];
const DATA = `${VERSION}-data`, FONTS = "sora-fonts";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== VERSION && k !== DATA && k !== FONTS).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/data/")) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && req.mode !== "navigate") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === "navigate" ? caches.match("index.html") : undefined)));
});
