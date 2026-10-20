/* Шапка-небо (canvas): пиксельное вечернее небо над Токио — для тем «Вечер» и «Ночь»;
   у стилизованных тем своя сцена из js/scenes.js. */
import { SCENES, SCENE_TEXT } from "./scenes.js";
function rng(seed) { return () => (seed = seed * 16807 % 2147483647, (seed - 1) / 2147483646); }

/* сцена стилизованной темы: полное разрешение; фон страницы рисуется вполовину — он всё равно размыт */
function drawScene(c, scene) {
  const box = c.getBoundingClientRect(), bg = c.id === "bgSky";
  const W = Math.max(1, Math.round(box.width)), H = Math.max(1, Math.round(box.height));
  const dpr = bg ? .5 : Math.min(2, devicePixelRatio || 1);
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  try { scene(g, W, H, { r: rng(c.dataset.seed ? +c.dataset.seed : 11), bg }); }
  catch (e) { console.error(e); }
}

export function drawSky(c) {
  const scene = SCENES[document.documentElement.dataset.theme];
  if (scene) return drawScene(c, scene);
  const box = c.getBoundingClientRect();
  const W = Math.max(1, Math.round(box.width)), H = Math.max(1, Math.round(box.height));
  const dpr = Math.min(2, devicePixelRatio || 1), px = 3;
  c.width = W * dpr; c.height = H * dpr;
  const w = Math.ceil(W / px), h = Math.ceil(H / px);
  const o = document.createElement("canvas"); o.width = w; o.height = h;
  const g = o.getContext("2d"), cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const r = rng(c.dataset.seed ? +c.dataset.seed : 11);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, v("--sky-1")); grd.addColorStop(.42, v("--sky-2")); grd.addColorStop(.78, v("--sky-3")); grd.addColorStop(1, v("--sky-4"));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = v("--window"); g.globalAlpha = .35;
  for (let i = 0; i < w / 6; i++) g.fillRect(r() * w | 0, r() * h * .35 | 0, 1, 1);
  g.fillStyle = v("--cloud");
  for (let i = 0; i < 7; i++) {
    const cx = r() * w, cy = h * (.12 + r() * .38), L = 10 + r() * 26;
    g.globalAlpha = .45 + r() * .3;
    g.fillRect(cx | 0, cy | 0, L | 0, 2); g.fillRect((cx + L * .2) | 0, (cy - 1) | 0, (L * .5) | 0, 1); g.fillRect((cx - L * .25) | 0, (cy + 2) | 0, (L * .8) | 0, 1);
  }
  g.globalAlpha = 1;
  const towerX = Math.round(w * .6), towerW = Math.max(18, Math.round(w * .13));
  g.fillStyle = v("--city-far");
  for (let x = 0; x < w;) { const bw = 3 + r() * 8 | 0, bh = (x > towerX ? h * (.1 + r() * .12) : h * (.1 + r() * .14 + .25 * (x / towerX))) | 0; g.fillRect(x, h - bh, bw, bh); x += bw + (r() < .3 ? 1 : 0); }
  for (let x = -2; x < w;) {
    const bw = 5 + r() * 10 | 0; const bh = (x > towerX ? h * (.07 + r() * .12) : h * (.06 + r() * .14 + .3 * (x / towerX))) | 0;
    if (x + bw > towerX - 2 && x < towerX + towerW + 2) { x += bw; continue; }
    g.fillStyle = v("--city"); g.fillRect(x, h - bh, bw, bh);
    g.fillStyle = v("--window");
    for (let yy = h - bh + 2; yy < h - 4; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) if (r() < .28) { g.globalAlpha = .5 + r() * .5; g.fillRect(xx, yy, 1, 1); }
    g.globalAlpha = 1; x += bw + (r() < .4 ? 1 : 0);
  }
  const th = h * .8 | 0;
  g.fillStyle = v("--city"); g.fillRect(towerX, h - th, towerW, th);
  const sx = towerX + 3, sy = h - th + Math.round(th * .18), sw = towerW - 6, sh = Math.round(th * .3);
  const sg = g.createLinearGradient(sx, sy, sx, sy + sh); sg.addColorStop(0, v("--screen-b")); sg.addColorStop(1, v("--screen-a"));
  g.fillStyle = sg; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = v("--window");
  for (let yy = sy + sh + 3; yy < h - 4; yy += 3) for (let xx = towerX + 2; xx < towerX + towerW - 2; xx += 2) if (r() < .45) { g.globalAlpha = .4 + r() * .6; g.fillRect(xx, yy, 1, 1); }
  g.globalAlpha = 1;
  g.fillStyle = v("--city"); g.fillRect(0, h - 4, w, 4);
  g.fillStyle = v("--sky-3"); g.globalAlpha = .55;
  for (let x = 4; x < w; x += 5) g.fillRect(x, h - 2, 3, 1);
  g.globalAlpha = 1;
  g.fillStyle = v("--signal"); g.fillRect(Math.round(w * .08), h - 12, 1, 1);
  const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.drawImage(o, 0, 0, c.width, c.height);
}

const ro = new ResizeObserver(es => es.forEach(e => { const c = e.target.querySelector("canvas"); if (c) drawSky(c); }));
export function mountSkies(root = document) {
  root.querySelectorAll(".sky canvas").forEach(c => { drawSky(c); ro.observe(c.parentElement); });
}
export function initSky() {
  ro.observe(document.querySelector(".backdrop"));
  const redraw = () => document.querySelectorAll(".sky canvas, #bgSky").forEach(drawSky);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.fonts?.ready.then(redraw);
  // надписи на сценах (афиши, вывески) — догрузить нужные знаки шрифта и перерисовать
  document.fonts?.load(`900 40px "Zen Maru Gothic"`, SCENE_TEXT).then(redraw, () => {});
}
export const hasScene = id => !!SCENES[id];
