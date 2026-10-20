/* Шапки стилизованных тем (canvas в полном разрешении). sky.js вызывает SCENES[тема](g, W, H, o):
   g — контекст в CSS-пикселях; o = {r: rng(seed), bg} — bg: фон страницы (размыт CSS-фильтром, без мелочей).
   Текст шапки слева — сцены держат главные мотивы справа, чтобы надпись читалась.
     aoshingo  青信号      кобальтовое небо, пешеходный светофор, натриевые фонари
     kohaku    紅白        синяя плитка бассейна, карпы кохаку, клёны, камни; печать с зерном
     rock      ロックンニャー ретро-афиша: лучи, гитара, пластинка, молнии, кот выглядывает
     showa     昭和レトロ   стена со старыми афишами, эмблема-тако, ржавчина
     yokocho   横丁ハロウィン переулок с красными фонарями, жёлтые вывески, тыквы, обакэ */
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const JP = (w, s) => `${w} ${Math.round(s)}px "Zen Maru Gothic", "Zen Kaku Gothic New", "Hiragino Maru Gothic ProN", "Noto Sans CJK JP", sans-serif`;
/* все японские надписи сцен — чтобы шрифт успел подгрузить нужные знаки (sky.js) */
export const SCENE_TEXT = "ニャー!!昭和喫茶銭湯映画純夜市ラムネ大売出し東京たこ焼レトロ商店街歌謡洋食お化け横丁祭酒焼鳥おでんラーメン♪";

/* ---------- общие кисти ---------- */
function glow(g, x, y, rad, hex, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, rgba(hex, a)); gr.addColorStop(.3, rgba(hex, a * .45)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
}
/* зерно печати: шум прямо в пикселях */
function grain(g, amt) {
  const c = g.canvas, d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - .5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(d, 0, 0);
}
/* мягкая неровная клякса (камни, пятна) */
function blob(g, cx, cy, rx, ry, r, n = 12, j = .18) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (r() - .5) * 2 * j; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const s = mid(pts[n - 1], pts[0]);
  g.beginPath(); g.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath();
}
function star(path, cx, cy, R, r0, n = 5, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r0 : R; i ? path.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : path.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  path.closePath(); return path;
}
/* телефон: надпись шапки занимает почти всю ширину — затемняем левую часть, чтобы текст читался */
function scrim(g, W, H, hex, a) {
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, rgba(hex, a)); gr.addColorStop(.55, rgba(hex, a * .7)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
/* фон страницы для «бумажных» тем: бумага и большие мягкие пятна цвета */
function paper(g, W, H, r, base, spots) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) glow(g, r() * W, r() * H, Math.max(W, H) * (.18 + r() * .25), spots[i % spots.length], .55);
}

/* ================= 青信号 «Синий час» ================= */
const PICTO = {};
/* пиктограмма пешехода для точечной матрицы светофора: walk — идёт, stop — стоит */
function picto(kind) {
  if (PICTO[kind]) return PICTO[kind];
  const n = 22, c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d"); x.fillStyle = x.strokeStyle = "#fff"; x.lineCap = x.lineJoin = "round"; x.lineWidth = 2.7;
  x.beginPath(); x.arc(11, 3.8, 2.5, 0, TAU); x.fill();
  const L = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
  if (kind === "walk") { L(11, 7.5, 10, 13.5); L(11, 8, 7, 11.5); L(11, 8, 14.5, 10.5); L(10, 13.5, 6.5, 20); L(10, 13.5, 14, 20); }
  else { L(11, 7.5, 11, 14); L(11, 8, 8, 13.5); L(11, 8, 14, 13.5); L(11, 14, 9.3, 20.3); L(11, 14, 12.7, 20.3); }
  const d = x.getImageData(0, 0, n, n).data, m = [];
  for (let i = 0; i < n * n; i++) m.push(d[i * 4 + 3] > 100);
  return PICTO[kind] = { n, m };
}
function lamp(g, x, y, R, col, hot, kind, lit) {
  g.fillStyle = "#0b1122"; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  const { n, m } = picto(kind), step = 1.7 * R / n, dot = step * .34;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const px = x - .85 * R + (i + .5) * step, py = y - .85 * R + (j + .5) * step;
    if (Math.hypot(px - x, py - y) > R * .9) continue;
    const on = m[j * n + i];
    g.fillStyle = on && lit ? hot : on ? rgba(col, .28) : lit ? rgba(col, .16) : "rgba(120,130,160,.12)";
    g.beginPath(); g.arc(px, py, on && lit ? dot * 1.15 : dot, 0, TAU); g.fill();
  }
  // козырёк сверху: тёмный и с цветным краем у горящего
  g.lineCap = "butt";
  g.strokeStyle = "#202a47"; g.lineWidth = R * .3; g.beginPath(); g.arc(x, y, R * 1.15, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
  if (lit) { g.strokeStyle = rgba(col, .9); g.lineWidth = R * .11; g.beginPath(); g.arc(x, y, R * 1.32, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
}
function housing(g, x, y, w, h) {
  g.fillStyle = "#141b33"; g.beginPath(); g.roundRect(x, y, w, h, w * .1); g.fill();
  g.fillStyle = "#212b4b"; g.fillRect(x + w * .04, y + w * .06, w * .05, h - w * .12);
  g.fillStyle = "#2b3658"; for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(x + w * .95, y + h * k / 5, w * .025, 0, TAU); g.fill(); }
}
/* лучистые точки вокруг горящего огня, как на рисунке */
function sparkle(g, x, y, R, col, r) {
  g.fillStyle = rgba(col, .9);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + r() * .2;
    for (let d = 0; d < 3; d++) { const rr = R * (1.45 + d * .14 + r() * .05); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1, R * .03), 0, TAU); g.fill(); }
  }
}
/* натриевый фонарь: яркий центр и «закрученный» ореол из штрихов */
function streetGlow(g, x, y, s, r) {
  g.save(); g.globalCompositeOperation = "lighter";
  glow(g, x, y, s * 2.6, "#ff9a3a", .45); glow(g, x, y, s * 1.1, "#ffd27a", .8);
  g.restore();
  g.fillStyle = "#fff6d6"; g.beginPath(); g.arc(x, y, s * .32, 0, TAU); g.fill();
  g.lineWidth = 1.3; g.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    g.strokeStyle = rgba(k % 3 ? "#f5b14a" : "#ffd98a", .55 + r() * .35);
    const rx = s * (.7 + r() * 1.1), ry = rx * (.55 + r() * .3), a0 = r() * TAU;
    g.beginPath(); g.ellipse(x + (r() - .5) * s * .4, y + (r() - .5) * s * .3, rx, ry, r() * .6, a0, a0 + Math.PI * (1 + r()));
    g.stroke();
  }
}
function aoshingo(g, W, H, { r, bg }) {
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#15307f"); gr.addColorStop(.55, "#2149b4"); gr.addColorStop(1, "#2e62d2");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // облака мазками
  const cols = ["#3d67d2", "#4f79dd", "#2b50bd", "#6a8fe6", "#1b3a98", "#5a82e2"];
  g.lineCap = "round";
  // мазки собираются в полосы облаков
  const bands = Array.from({ length: 5 }, () => H * (.06 + r() * .8));
  for (let i = 0, n = W * H / 1000; i < n; i++) {
    const x = r() * W, y = bands[r() * bands.length | 0] + (r() - .5) * H * .16, L = 16 + r() * 80, dy = (r() - .5) * 10;
    g.strokeStyle = rgba(cols[r() * cols.length | 0], .22 + r() * .45); g.lineWidth = 2 + r() * 7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + dy - 5, x + L, y + dy); g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < W / 70; i++) { g.beginPath(); g.arc(r() * W, r() * H * .6, .7 + r() * .8, 0, TAU); g.fill(); }
  if (bg) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) glow(g, r() * W, r() * H, 120 + r() * 160, ["#ff9a3a", "#5ee6c8", "#ff4a3a"][i % 3], .35);
    g.restore(); return;
  }
  const narrow = W < 560, hw = narrow ? Math.min(H * .3, W * .2) : Math.max(54, H * .34), cx = W * (narrow ? .78 : .66), top = H * .1;
  // дома внизу с тёплыми окнами
  for (let x = -4; x < W * .78;) {
    const bw = 26 + r() * 50, bh = H * (.07 + r() * .13);
    g.fillStyle = r() < .5 ? "#18204d" : "#1d275a"; g.fillRect(x, H - bh, bw, bh);
    g.fillStyle = "#ffe0a0";
    for (let yy = H - bh + 6; yy < H - 5; yy += 9) for (let xx = x + 5; xx < x + bw - 6; xx += 9) if (r() < .32) { g.globalAlpha = .55 + r() * .45; g.fillRect(xx, yy, 4, 5); }
    g.globalAlpha = 1; x += bw + 2;
  }
  // крона дерева справа внизу
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU, d = Math.sqrt(r()), x = W * .99 + Math.cos(a) * H * .28 * d, y = H * 1.02 + Math.sin(a) * H * .3 * d;
    g.fillStyle = ["#21402f", "#33503a", "#9a6a3c", "#c48a4a", "#1a3326"][r() * 5 | 0]; g.globalAlpha = .7 + r() * .3;
    g.beginPath(); g.arc(x, y, 1.5 + r() * 2.8, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  // фонарный столб правее светофора, дугой над ним (справа остаётся место вертикальной надписи)
  const lx = Math.min(W - 16, cx + hw * 1.2), headX = cx + hw * .15, headY = H * .06, pw = Math.max(4, hw * .1);
  g.strokeStyle = "#c9b98c"; g.lineWidth = pw; g.lineCap = "butt";
  g.beginPath(); g.moveTo(lx, H); g.lineTo(lx, H * .34); g.quadraticCurveTo(lx, headY, headX, headY); g.stroke();
  g.lineWidth = pw * .7; g.beginPath(); g.moveTo(lx, H * .46); g.quadraticCurveTo(lx, H * .34, lx + hw * .7, H * .36); g.stroke();
  // пешеходный светофор: столб, боковая секция под углом, основная секция
  g.fillStyle = "#7d879e"; g.fillRect(cx - hw * .09, top + hw * 2, hw * .18, H);
  g.fillStyle = "#c2b79a"; g.fillRect(cx - hw * .14, top + hw * 2.12, hw * .28, hw * .12);
  const bx = cx - hw * .95;
  housing(g, bx - hw * .26, top + hw * .3, hw * .5, hw * 1.9);
  g.fillStyle = "#0b1122"; g.beginPath(); g.ellipse(bx, top + hw * .78, hw * .17, hw * .32, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(bx, top + hw * 1.72, hw * .17, hw * .32, 0, 0, TAU); g.fill();
  g.fillStyle = "#ff4a3a"; g.beginPath(); g.ellipse(bx - hw * .03, top + hw * .78, hw * .11, hw * .25, 0, 0, TAU); g.fill();
  housing(g, cx - hw / 2, top, hw, hw * 2.02);
  const R = hw * .37, y1 = top + hw * .52, y2 = top + hw * 1.52;
  lamp(g, cx, y1, R, "#ff4a3a", "#ffd0c4", "stop", true);
  lamp(g, cx, y2, R, "#4fe0c2", "#e6fff8", "walk", true);
  // знак «остановка запрещена» на столбе фонаря
  const sx = lx - (narrow ? hw * .35 : 0), sy = H * .66, sr = hw * .28;
  g.fillStyle = "#c8443c"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
  g.fillStyle = "#3a5bab"; g.beginPath(); g.arc(sx, sy, sr * .8, 0, TAU); g.fill();
  g.strokeStyle = "#c8443c"; g.lineWidth = sr * .18;
  g.beginPath(); g.moveTo(sx - sr * .55, sy - sr * .55); g.lineTo(sx + sr * .55, sy + sr * .55); g.moveTo(sx + sr * .55, sy - sr * .55); g.lineTo(sx - sr * .55, sy + sr * .55); g.stroke();
  // свечение огней и фонарей
  g.save(); g.globalCompositeOperation = "lighter";
  glow(g, cx, y1, R * 2.6, "#ff4a3a", .38); glow(g, cx, y2, R * 2.8, "#4fe0c2", .42); glow(g, bx, top + hw * .78, hw * .5, "#ff4a3a", .3);
  g.restore();
  sparkle(g, cx, y1, R, "#ff6a5a", r); sparkle(g, cx, y2, R, "#6ff0d2", r);
  streetGlow(g, headX - pw * .2, headY + pw, hw * .24, r);
  streetGlow(g, lx + hw * .72, H * .37, hw * .17, r);
  if (narrow) scrim(g, W, H, "#0e1a4a", .55);
}

/* ================= 紅白 «Кохаку» ================= */
function koi(g, x, y, L, ang, bend, r, shadow) {
  const w = L * .13, R = bend ? L / bend : 0;
  const map = (px, py) => { if (!R) return [px, py]; const a = px / R; return [(R - py) * Math.sin(a), R - (R - py) * Math.cos(a)]; };
  g.save(); g.translate(x, y); g.rotate(ang);
  const prof = t => t < .62 ? .14 + .86 * Math.sin(Math.PI / 2 * t / .62) : Math.sqrt(Math.max(0, 1 - ((t - .62) / .38) ** 2));
  const x0 = -.38 * L, x1 = .5 * L, N = 40, top = [], bot = [];
  for (let i = 0; i <= N; i++) { const t = i / N, px = lerp(x0, x1, t), hw = w * prof(t); top.push(map(px, -hw)); bot.push(map(px, hw)); }
  const body = new Path2D(); body.moveTo(...top[0]); top.forEach(p => body.lineTo(...p)); [...bot].reverse().forEach(p => body.lineTo(...p)); body.closePath();
  const tail = new Path2D();
  tail.moveTo(...map(x0 + .03 * L, -w * .14));
  tail.quadraticCurveTo(...map(x0 - .1 * L, -w * .4), ...map(x0 - .27 * L, -w * 1.25));
  tail.quadraticCurveTo(...map(x0 - .15 * L, -w * .1), ...map(x0 - .2 * L, 0));
  tail.quadraticCurveTo(...map(x0 - .15 * L, w * .1), ...map(x0 - .27 * L, w * 1.25));
  tail.quadraticCurveTo(...map(x0 - .1 * L, w * .4), ...map(x0 + .03 * L, w * .14)); tail.closePath();
  const fin = (fx, side, len) => { const p = new Path2D(); p.moveTo(...map(fx + .03 * L, side * w * .7)); p.quadraticCurveTo(...map(fx + .04 * L, side * w * len), ...map(fx - .1 * L, side * w * (len + .2)));
    p.quadraticCurveTo(...map(fx - .05 * L, side * w * 1.05), ...map(fx - .04 * L, side * w * .7)); p.closePath(); return p; };
  const fins = [fin(.18 * L, -1, 1.9), fin(.18 * L, 1, 1.9), fin(-.16 * L, -1, 1.3), fin(-.16 * L, 1, 1.3)];
  if (shadow) { g.fillStyle = "rgba(14,44,104,.5)"; [tail, ...fins, body].forEach(p => g.fill(p)); g.restore(); return; }
  g.fillStyle = "rgba(246,241,231,.86)"; g.fill(tail); fins.forEach(p => g.fill(p));
  // лучи плавников
  g.strokeStyle = "rgba(140,155,190,.5)"; g.lineWidth = .8;
  for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(...map(x0 - .01 * L, 0)); g.lineTo(...map(x0 - .24 * L, w * k * .28)); g.stroke(); }
  g.fillStyle = "#f5efe3"; g.fill(body);
  g.save(); g.clip(body);
  // пятна кохаку: шапка на голове и 2–3 пятна на спине
  const patch = (px, py, s) => { g.fillStyle = "#e3552b"; for (let k = 0; k < 5; k++) { const [qx, qy] = map(px + (r() - .5) * s * 1.2, py + (r() - .5) * s * .8); g.beginPath(); g.arc(qx, qy, s * (.45 + r() * .4), 0, TAU); g.fill(); } };
  patch(.36 * L, (r() - .5) * w * .4, w * .85);
  for (let k = 0, n = 2 + (r() * 2 | 0); k < n; k++) patch(lerp(-.26 * L, .2 * L, (k + r() * .6) / n), (r() - .5) * w * .7, w * (.7 + r() * .4));
  g.fillStyle = "rgba(255,140,90,.35)"; for (let k = 0; k < 40; k++) { const [qx, qy] = map(lerp(-.3 * L, .45 * L, r()), (r() - .5) * w * 1.6); g.fillRect(qx, qy, 1.5, 1.5); }
  g.strokeStyle = "rgba(110,125,170,.35)"; g.lineWidth = w * .35; g.stroke(body);
  g.restore();
  g.strokeStyle = "rgba(205,190,170,.6)"; g.lineWidth = w * .16; g.lineCap = "round";
  g.beginPath(); g.moveTo(...map(.22 * L, 0)); g.lineTo(...map(-.3 * L, 0)); g.stroke();
  g.fillStyle = "#1c2547"; for (const s of [-1, 1]) { const [ex, ey] = map(.43 * L, s * w * .5); g.beginPath(); g.arc(ex, ey, w * .085, 0, TAU); g.fill(); }
  g.restore();
}
function maple(g, x, y, s, a, col) {
  g.save(); g.translate(x, y); g.rotate(a);
  const tips = [[0, 1], [40, .9], [-40, .9], [80, .72], [-80, .72], [125, .42], [-125, .42]].sort((p, q) => p[0] - q[0]);
  const p = new Path2D();
  tips.forEach(([deg, len], i) => {
    const t = (deg - 90) * Math.PI / 180, nx = tips[(i + 1) % tips.length][0], mid = (deg + (i === tips.length - 1 ? nx + 360 : nx)) / 2;
    const tm = (mid - 90) * Math.PI / 180;
    i ? p.lineTo(Math.cos(t) * s * len, Math.sin(t) * s * len) : p.moveTo(Math.cos(t) * s * len, Math.sin(t) * s * len);
    p.lineTo(Math.cos(tm) * s * .3, Math.sin(tm) * s * .3);
  });
  p.closePath();
  g.fillStyle = col; g.fill(p);
  g.strokeStyle = "rgba(120,30,10,.45)"; g.lineWidth = Math.max(.8, s * .04);
  tips.forEach(([deg, len]) => { const t = (deg - 90) * Math.PI / 180; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t) * s * len * .85, Math.sin(t) * s * len * .85); g.stroke(); });
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s * .55); g.stroke();
  g.restore();
}
function rock(g, x, y, rx, ry, r) {
  blob(g, x + rx * .14, y + ry * .22, rx, ry, r, 14, .1); g.fillStyle = "rgba(12,38,92,.45)"; g.fill();
  blob(g, x, y, rx, ry, r, 14, .12);
  const gr = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry); gr.addColorStop(0, "#f0f3f8"); gr.addColorStop(.55, "#d3dcea"); gr.addColorStop(1, "#8fa5c8");
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  for (let i = 0, n = rx * ry / 9; i < n; i++) {
    const px = x + (r() * 2 - 1) * rx, py = y + (r() * 2 - 1) * ry, k = ((px - x) / rx + (py - y) / ry + 2) / 4;
    g.fillStyle = r() < k ? `rgba(28,55,120,${.12 + r() * .3})` : `rgba(255,255,255,${.3 + r() * .4})`;
    g.fillRect(px, py, 1 + r() * 1.4, 1 + r() * 1.4);
  }
  g.restore();
}
function kohaku(g, W, H, { r, bg }) {
  if (bg) return paper(g, W, H, r, "#efe6d6", ["#b9cbea", "#f2c9b4", "#c7d5ee", "#e9d9bc"]);
  g.fillStyle = "#2a57a6"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { blob(g, r() * W, r() * H, 30 + r() * 120, 20 + r() * 80, r, 9, .3); g.fillStyle = r() < .5 ? "rgba(24,64,140,.14)" : "rgba(70,115,200,.12)"; g.fill(); }
  // плитка
  const T = Math.max(24, H / 6.4); g.strokeStyle = "rgba(196,215,245,.5)"; g.lineWidth = Math.max(1.5, T * .07);
  for (let x = (r() * T) % T; x < W + T; x += T) { g.beginPath(); g.moveTo(x, -2); for (let y = 0; y <= H; y += T / 2) g.lineTo(x + (r() - .5) * 1.4, y); g.stroke(); }
  for (let y = (r() * T) % T; y < H + T; y += T) { g.beginPath(); g.moveTo(-2, y); for (let x = 0; x <= W; x += T / 2) g.lineTo(x, y + (r() - .5) * 1.4); g.stroke(); }
  const narrow = W < 560;
  // камни снизу (справа сверху — место для вертикальной надписи)
  rock(g, W * (narrow ? .6 : .5), H * 1.06, H * .3, H * .2, r);
  rock(g, W * 1.01, H * .98, H * .28, H * .24, r);
  // карпы плывут навстречу друг другу: сначала тени на дне, потом сами
  const fish = narrow ? [[W * .9, H * .66, H * .78, -1.75, .45]]
    : [[W * .6, H * .36, H * .86, .12, .45], [W * .8, H * .7, H * .8, Math.PI + .1, .5]];
  fish.forEach(([x, y, L, a, b]) => koi(g, x + L * .07, y + L * .1, L, a, b, r, true));
  // блики на воде
  g.strokeStyle = "rgba(236,243,255,.6)"; g.lineCap = "round";
  for (let i = 0; i < W / 26; i++) {
    let x = W * (.42 + r() * .58), y = r() * H, ph = r() * TAU; g.lineWidth = 1 + r() * 1.3;
    g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += 3 + r() * 3; g.lineTo(x, y + Math.sin(ph + k * .9) * 2.4); } g.stroke();
  }
  fish.forEach(([x, y, L, a, b]) => koi(g, x, y, L, a, b, r, false));
  // клёны
  const leaf = ["#e5552a", "#f07b2c", "#d8431f", "#f39a3a"];
  const cluster = (x, y, n, s) => { for (let k = 0; k < n; k++) maple(g, x + (r() - .5) * s * 3, y + (r() - .5) * s * 2, s * (.7 + r() * .5), r() * TAU, leaf[r() * 4 | 0]); };
  cluster(W * 1.0, H * .02, 3, H * .1);
  cluster(W * .97, H * .78, 3, H * .1);
  maple(g, W * (narrow ? .55 : .46), H * .82, H * .07, .6, leaf[0]);
  if (!narrow) { maple(g, W * .74, H * .14, H * .06, 2.2, leaf[3]); maple(g, W * .88, H * .42, H * .05, 4, leaf[1]); }
  if (narrow) scrim(g, W, H, "#173f8c", .35);
  grain(g, 24);
}

/* ================= ロックンニャー «Рок-кот» ================= */
const INK = "#1e1b18", CREAM = "#f6ead0", MUST = "#f2b632", TEAL = "#1d7a83", RED = "#d9472b", ORANGE = "#f08a2a";
/* наклейка: тень со сдвигом, заливка, толстый контур */
function sticker(g, p, fill, lw = 3, off = 4) {
  g.save(); g.translate(off, off); g.fillStyle = INK; g.fill(p); g.restore();
  g.fillStyle = fill; g.fill(p); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = "round"; g.stroke(p);
}
function bolt(g, x, y, s, a) {
  const pts = [[-.1, -1], [.45, -1], [.12, -.18], [.5, -.18], [-.3, 1.05], [-.02, .12], [-.38, .12]];
  g.save(); g.translate(x, y); g.rotate(a);
  const p = new Path2D(); pts.forEach(([px, py], i) => i ? p.lineTo(px * s, py * s) : p.moveTo(px * s, py * s)); p.closePath();
  sticker(g, p, MUST, Math.max(2, s * .07), 3); g.restore();
}
function record(g, x, y, R) {
  const p = new Path2D(); p.arc(x, y, R, 0, TAU); sticker(g, p, "#1b1918", 3, 5);
  g.strokeStyle = "rgba(255,255,255,.09)"; g.lineWidth = 1;
  for (let rr = R * .42; rr < R * .95; rr += 3.2) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = R * .05; g.beginPath(); g.arc(x, y, R * .72, -2.4, -1.7); g.stroke();
  g.fillStyle = RED; g.beginPath(); g.arc(x, y, R * .34, 0, TAU); g.fill();
  g.fillStyle = CREAM; g.beginPath(); g.arc(x, y, R * .06, 0, TAU); g.fill();
}
function guitar(g, x, y, s, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  // гриф и голова
  const neck = new Path2D(); neck.rect(s * .26, -s * .036, s * .66, s * .072); sticker(g, neck, "#c98b4a", 2.5, 3);
  g.strokeStyle = "rgba(30,27,24,.6)"; g.lineWidth = 1.5; for (let k = 1; k < 9; k++) { const fx = s * (.3 + k * .07); g.beginPath(); g.moveTo(fx, -s * .036); g.lineTo(fx, s * .036); g.stroke(); }
  const head = new Path2D(); head.roundRect(s * .9, -s * .07, s * .2, s * .14, s * .03); sticker(g, head, RED, 2.5, 3);
  g.fillStyle = CREAM; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(s * (.95 + k * .055), -s * .085, s * .02, 0, TAU); g.fill(); g.stroke(); }
  // корпус: две «восьмёрки» с общим контуром
  const lo = [0, 0, s * .22, s * .18], up = [s * .17, 0, s * .15, s * .13];
  g.save(); g.translate(5, 5); g.fillStyle = INK; for (const e of [lo, up]) { g.beginPath(); g.ellipse(e[0], e[1], e[2], e[3], 0, 0, TAU); g.fill(); } g.restore();
  g.strokeStyle = INK; g.lineWidth = 6; for (const e of [lo, up]) { g.beginPath(); g.ellipse(e[0], e[1], e[2], e[3], 0, 0, TAU); g.stroke(); }
  g.fillStyle = RED; for (const e of [lo, up]) { g.beginPath(); g.ellipse(e[0], e[1], e[2], e[3], 0, 0, TAU); g.fill(); }
  g.fillStyle = CREAM; g.beginPath(); g.ellipse(s * .05, s * .05, s * .13, s * .1, .3, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke();
  g.fillStyle = INK; for (const px of [-.02, .12]) g.fillRect(s * px, -s * .045, s * .045, s * .09);
  g.fillRect(-s * .13, -s * .05, s * .03, s * .1);
  g.fillStyle = CREAM; for (const [kx, ky] of [[-.08, .12], [-.01, .14], [.06, .15]]) { g.beginPath(); g.arc(s * kx, s * ky, s * .022, 0, TAU); g.fill(); g.stroke(); }
  g.strokeStyle = "rgba(246,234,208,.85)"; g.lineWidth = 1;
  for (let k = 0; k < 4; k++) { const sy = -s * .024 + k * s * .016; g.beginPath(); g.moveTo(-s * .12, sy); g.lineTo(s * .9, sy); g.stroke(); }
  g.restore();
}
function cat(g, x, y, R) {
  for (const sd of [-1, 1]) {
    const ear = new Path2D(); ear.moveTo(x + sd * .9 * R, y - .3 * R); ear.lineTo(x + sd * .66 * R, y - 1.15 * R); ear.lineTo(x + sd * .18 * R, y - .74 * R); ear.closePath();
    sticker(g, ear, ORANGE, 3, 3);
    g.fillStyle = "#f2a0a0"; g.beginPath(); g.moveTo(x + sd * .74 * R, y - .45 * R); g.lineTo(x + sd * .64 * R, y - .92 * R); g.lineTo(x + sd * .36 * R, y - .7 * R); g.closePath(); g.fill();
  }
  const head = new Path2D(); head.ellipse(x, y, R, R * .84, 0, 0, TAU); sticker(g, head, ORANGE, 3.5, 5);
  g.strokeStyle = "#c2561a"; g.lineWidth = R * .08; g.lineCap = "round";
  for (const dx of [-.16, 0, .16]) { g.beginPath(); g.moveTo(x + dx * R, y - .78 * R); g.lineTo(x + dx * R * .8, y - .52 * R); g.stroke(); }
  for (const sd of [-1, 1]) for (const dy of [-.05, .14]) { g.beginPath(); g.moveTo(x + sd * .98 * R, y + dy * R); g.lineTo(x + sd * .74 * R, y + (dy + .04) * R); g.stroke(); }
  g.fillStyle = CREAM; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * .2 * R, y + .2 * R, .28 * R, .22 * R, 0, 0, TAU); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = R * .07;
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(x + sd * .38 * R, y - .16 * R, .14 * R, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.fillStyle = "#e7787a"; g.beginPath(); g.moveTo(x - .08 * R, y + .02 * R); g.lineTo(x + .08 * R, y + .02 * R); g.lineTo(x, y + .11 * R); g.closePath(); g.fill();
  const m = new Path2D(); m.moveTo(x - .17 * R, y + .2 * R); m.quadraticCurveTo(x, y + .62 * R, x + .17 * R, y + .2 * R); m.quadraticCurveTo(x, y + .28 * R, x - .17 * R, y + .2 * R);
  g.fillStyle = "#b8321c"; g.fill(m); g.lineWidth = R * .05; g.stroke(m);
  g.lineWidth = 1.5; g.strokeStyle = INK;
  for (const sd of [-1, 1]) for (const k of [0, 1]) { g.beginPath(); g.moveTo(x + sd * .45 * R, y + (.18 + k * .1) * R); g.lineTo(x + sd * .95 * R, y + (.1 + k * .2) * R); g.stroke(); }
}
function rockScene(g, W, H, { r, bg }) {
  if (bg) return paper(g, W, H, r, "#f1e5c6", ["#f5cf6e", "#9fd0cf", "#f3b48e", "#e8d6a6"]);
  const narrow = W < 560;
  g.fillStyle = TEAL; g.fillRect(0, 0, W, H);
  // солнечные лучи
  const cx = W * (narrow ? .8 : .76), cy = H * .62, n = 24, RR = Math.hypot(W, H) * 1.2;
  g.fillStyle = MUST;
  for (let i = 0; i < n; i += 2) { const a0 = i / n * TAU + .05, a1 = (i + 1) / n * TAU + .05; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, RR, a0, a1); g.closePath(); g.fill(); }
  // растр точками к низу
  g.fillStyle = "rgba(20,20,20,.13)";
  for (let y = H * .5; y < H; y += 7) for (let x = (y / 7 % 2) * 3.5; x < W; x += 7) { const rr = (y - H * .5) / (H * .5) * 2.7; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
  // полосы снизу
  g.fillStyle = RED; g.fillRect(0, H - 17, W, 4); g.fillRect(0, H - 10, W, 4);
  // предметы
  record(g, W * (narrow ? .96 : .94), H * .42, H * .34);
  if (!narrow) guitar(g, W * .6, H * .74, H * 1.05, -.42);
  cat(g, W * (narrow ? .8 : .85), H * .9, H * .33);
  const sp = new Path2D(); star(sp, W * (narrow ? .7 : .8), H * (narrow ? .62 : .13), H * .07, H * .03); sticker(g, sp, CREAM, 2.5, 3);
  const sp2 = new Path2D(); star(sp2, W * .99, H * .8, H * .06, H * .026); sticker(g, sp2, MUST, 2.5, 3);
  if (!narrow) { const sp3 = new Path2D(); star(sp3, W * .5, H * .5, H * .045, H * .02); sticker(g, sp3, RED, 2.5, 3); }
  bolt(g, W * (narrow ? .6 : .52), H * (narrow ? .9 : .2), H * .15, .35);
  bolt(g, W * .985, H * .12, H * .12, -.2);
  if (!narrow) bolt(g, W * .44, H * .86, H * .1, .5);
  // «ニャー!!» в облачке-взрыве (на телефоне его закрыла бы надпись)
  if (!narrow) {
  const bx = W * (narrow ? .78 : .7), by = H * .22, bR = H * .17, burst = new Path2D();
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, rr = i % 2 ? bR * .74 : bR * (1.05 + (i % 4 === 0 ? .12 : 0)); i ? burst.lineTo(bx + Math.cos(a) * rr * 1.25, by + Math.sin(a) * rr) : burst.moveTo(bx + Math.cos(a) * rr * 1.25, by + Math.sin(a) * rr); }
  burst.closePath(); sticker(g, burst, CREAM, 3, 4);
  g.save(); g.translate(bx, by); g.rotate(-.08); g.fillStyle = INK; g.font = JP(900, bR * .42); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ニャー!!", 0, bR * .03); g.restore();
  }
  // ноты
  g.font = `900 ${Math.round(H * .17)}px "Zen Maru Gothic", serif`; g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = CREAM; g.textAlign = "center";
  if (!narrow) { g.strokeText("♪", W * .74, H * .5); g.fillText("♪", W * .74, H * .5); }
  grain(g, 26);
}

/* ================= 昭和レトロ «Сёва» ================= */
/* прямоугольник с рваным краем */
function torn(x, y, w, h, r, j = 2.4) {
  const p = new Path2D(), pts = [];
  const edge = (x0, y0, x1, y1, nx, ny) => { const L = Math.hypot(x1 - x0, y1 - y0); for (let d = 0; d < L; d += 5 + r() * 6) { const t = d / L, k = (r() - .5) * 2 * j * (r() < .08 ? 3.5 : 1); pts.push([lerp(x0, x1, t) + nx * k, lerp(y0, y1, t) + ny * k]); } };
  edge(x, y, x + w, y, 0, 1); edge(x + w, y, x + w, y + h, 1, 0); edge(x + w, y + h, x, y + h, 0, 1); edge(x, y + h, x, y, 1, 0);
  pts.forEach((q, i) => i ? p.lineTo(...q) : p.moveTo(...q)); p.closePath(); return p;
}
function rust(g, x, y, s, r) {
  for (let i = 0; i < 14; i++) { blob(g, x + (r() - .5) * s, y + (r() - .5) * s * .7, s * (.08 + r() * .22), s * (.06 + r() * .18), r, 9, .35); g.fillStyle = `rgba(122,59,34,${.07 + r() * .17})`; g.fill(); }
  for (let k = 0; k < 4; k++) {
    const dx = x + (r() - .5) * s * .6, L = s * (.4 + r() * 1.2), gr = g.createLinearGradient(0, y, 0, y + L);
    gr.addColorStop(0, "rgba(110,52,30,.5)"); gr.addColorStop(1, "rgba(110,52,30,0)");
    g.strokeStyle = gr; g.lineWidth = 1.2 + r() * 2.2; g.beginPath(); g.moveTo(dx, y); g.lineTo(dx + (r() - .5) * 3, y + L); g.stroke();
  }
}
/* эмблема: тако в повязке-хатимаки (своя, придуманная) */
function tako(g, x, y, R, r) {
  const C = "#ecdfc2", NAVY = "#24485e";
  g.save(); g.translate(x, y);
  g.lineCap = "round";
  const qp = (p0, p1, p2, t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  for (let k = 0; k < 8; k++) {
    const t = k / 7, sp = (t - .5) * 2, sd = sp < 0 ? -1 : 1, a = Math.abs(sp);
    const p0 = [lerp(-.2, .2, t) * R, .08 * R], p2 = [sp * .86 * R, (.42 + (1 - a) * .38) * R], p1 = [sp * .25 * R, (.75 - a * .1) * R];
    g.strokeStyle = C; g.lineWidth = R * .1; g.beginPath(); g.moveTo(...p0); g.quadraticCurveTo(...p1, ...p2); g.stroke();
    // кончик закручен вверх
    g.lineWidth = R * .065; g.beginPath(); g.arc(p2[0] - sd * .02 * R, p2[1] - .09 * R, .09 * R, Math.PI / 2, sd > 0 ? -Math.PI * .4 : Math.PI * 1.4, sd > 0); g.stroke();
    g.fillStyle = NAVY; for (let q = .3; q < .97; q += .11) { const [sx, sy] = qp(p0, p1, p2, q); g.beginPath(); g.arc(sx, sy + R * .022, R * .016, 0, TAU); g.fill(); }
  }
  g.fillStyle = C; g.beginPath(); g.ellipse(0, -.04 * R, .3 * R, .2 * R, 0, 0, TAU); g.fill();
  const head = new Path2D(); head.ellipse(0, -.36 * R, .36 * R, .38 * R, 0, 0, TAU); g.fill(head);
  // хатимаки — красно-белый жгут
  g.save(); g.clip(head);
  g.fillStyle = "#f6efdf"; g.fillRect(-.5 * R, -.56 * R, R, .11 * R);
  g.fillStyle = "#d6573f"; for (let sx = -.5 * R; sx < .5 * R; sx += .08 * R) { g.beginPath(); g.moveTo(sx, -.56 * R); g.lineTo(sx + .04 * R, -.56 * R); g.lineTo(sx + .08 * R, -.45 * R); g.lineTo(sx + .04 * R, -.45 * R); g.closePath(); g.fill(); }
  g.restore();
  g.fillStyle = "#d6573f"; g.beginPath(); g.ellipse(.37 * R, -.52 * R, .07 * R, .04 * R, -.5, 0, TAU); g.ellipse(.42 * R, -.44 * R, .07 * R, .035 * R, .4, 0, TAU); g.fill();
  g.fillStyle = NAVY; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * .13 * R, -.17 * R, .065 * R, .095 * R, 0, 0, TAU); g.fill(); }
  g.fillStyle = C; for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * .13 * R - .02 * R, -.21 * R, .024 * R, 0, TAU); g.fill(); }
  g.fillStyle = "rgba(214,87,63,.75)"; for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * .23 * R, -.04 * R, .045 * R, 0, TAU); g.fill(); }
  g.strokeStyle = NAVY; g.lineWidth = R * .022; g.beginPath(); g.arc(0, .02 * R, .035 * R, 0, TAU); g.stroke();
  g.restore();
}
function showa(g, W, H, { r, bg }) {
  if (bg) return paper(g, W, H, r, "#e5d9bf", ["#c9b48c", "#a9c3c3", "#d9a58f", "#d8c9a6"]);
  const narrow = W < 560;
  g.fillStyle = "#2a2521"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { blob(g, r() * W, r() * H, 20 + r() * 80, 15 + r() * 50, r, 8, .3); g.fillStyle = `rgba(${r() < .5 ? "0,0,0" : "90,80,70"},.15)`; g.fill(); }
  // слой старых афиш
  const WORDS = ["昭和", "喫茶", "銭湯", "映画", "純喫茶", "夜市", "ラムネ", "大売出し", "東京", "たこ焼", "レトロ", "商店街", "歌謡", "洋食"];
  const STY = [["#e8dbbb", "#24485e"], ["#e2d2ad", "#d6573f"], ["#d6573f", "#ecdfc4"], ["#24485e", "#ecdfc4"], ["#3f7480", "#ecdfc4"], ["#ecdfc4", "#3f7480"]];
  for (let x = -30; x < W; x += H * (.36 + r() * .14)) for (let y = -30; y < H; y += H * (.3 + r() * .2)) {
    const pw = H * (.36 + r() * .3), ph = H * (.3 + r() * .4), [bgc, fg] = STY[r() * STY.length | 0], word = WORDS[r() * WORDS.length | 0];
    g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate((r() - .5) * .07); g.translate(-pw / 2, -ph / 2);
    const p = torn(0, 0, pw, ph, r); g.fillStyle = "rgba(0,0,0,.3)"; g.save(); g.translate(2, 3); g.fill(p); g.restore();
    g.fillStyle = bgc; g.fill(p); g.save(); g.clip(p);
    g.globalAlpha = .82; g.fillStyle = fg; g.textBaseline = "middle";
    const vert = r() < .35 && word.length <= 4;
    if (vert) { const fs = Math.min(pw * .55, ph / (word.length + .4)); g.font = JP(900, fs); g.textAlign = "center"; [...word].forEach((ch, i) => g.fillText(ch, pw / 2, fs * (.7 + i))); }
    else { const fs = Math.min(pw / (word.length + .3), ph * .42); g.font = JP(900, fs); g.textAlign = "left"; g.fillText(word, pw * .08, ph * .42); }
    g.globalAlpha = .45; for (let k = 0; k < 3; k++) g.fillRect(pw * .08, ph * (.72 + k * .08), pw * (.4 + r() * .4), Math.max(1.5, ph * .025));
    g.globalAlpha = .25; g.fillStyle = "#fff"; for (let k = 0; k < 6; k++) g.fillRect(r() * pw, r() * ph, r() * pw * .4, 1);
    g.restore(); g.restore();
  }
  // узкая афиша у правого края — под вертикальную надпись и ярлык
  const strip = torn(W - 64, -10, 80, H + 20, r, 2.6);
  g.fillStyle = "rgba(0,0,0,.4)"; g.save(); g.translate(-3, 2); g.fill(strip); g.restore(); g.fillStyle = "#e8dbbb"; g.fill(strip);
  // эмблема: синий круг с рваным краем и тако
  const R = narrow ? 24 : Math.min(H * .42, W * .2), ex = narrow ? W - 32 : W - 64 - R * 1.12, ey = narrow ? H - 34 : H * .5;
  blob(g, ex + 3, ey + 4, R * 1.02, R * 1.02, r, 40, .02); g.fillStyle = "rgba(0,0,0,.35)"; g.fill();
  blob(g, ex, ey, R, R, r, 48, .02); g.fillStyle = "#24485e"; g.fill();
  tako(g, ex, ey + R * .02, R * .92, r);
  if (!narrow) rust(g, ex - R * .25, ey - R * .7, R * .6, r);
  // большая афиша слева — под надпись
  const mw = narrow ? W - 76 : Math.min(W * .5, 470);
  const main = torn(-14, -10, mw + 14, H + 20, r, 3.2);
  g.fillStyle = "rgba(0,0,0,.4)"; g.save(); g.translate(4, 0); g.fill(main); g.restore();
  g.fillStyle = "#ece0c4"; g.fill(main);
  g.save(); g.clip(main);
  for (let i = 0; i < 26; i++) { blob(g, r() * mw, r() * H, 20 + r() * 70, 10 + r() * 40, r, 8, .4); g.fillStyle = `rgba(150,120,70,${.03 + r() * .05})`; g.fill(); }
  g.strokeStyle = "rgba(120,100,70,.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(mw * .55, 0); g.lineTo(mw * .58, H); g.stroke();
  g.fillStyle = "#d6573f"; g.fillRect(mw - 26, 18, 8, 8);
  g.restore();
  rust(g, mw * .97, H * .88, H * .3, r);
  rust(g, W * .55, H * .05, H * .25, r);
  // виньетка
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(30,15,5,.35)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  grain(g, 34);
}

/* ================= 横丁ハロウィン «Ёкотё» ================= */
function chochin(g, x, y, s, kind, txt) {
  const rx = s * .5, ry = s * .64;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, s * 2.1, kind === "pumpkin" ? "#ff8a2a" : "#ff4a2a", .5); g.restore();
  const gr = g.createRadialGradient(x - rx * .3, y - ry * .2, 0, x, y, ry * 1.1);
  if (kind === "pumpkin") { gr.addColorStop(0, "#ffd27a"); gr.addColorStop(.6, "#ff8a2a"); gr.addColorStop(1, "#b5440f"); }
  else { gr.addColorStop(0, "#ff8a5a"); gr.addColorStop(.6, "#e0402f"); gr.addColorStop(1, "#8e1d16"); }
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  g.strokeStyle = "rgba(90,15,10,.45)"; g.lineWidth = Math.max(.8, s * .025);
  for (let k = -3; k <= 3; k++) { const yy = y + k * ry * .26, w = rx * Math.sqrt(1 - (k * .26) ** 2); g.beginPath(); g.ellipse(x, yy, w, s * .04, 0, 0, Math.PI); g.stroke(); }
  g.fillStyle = "#1a0e0e"; g.fillRect(x - rx * .62, y - ry - s * .1, rx * 1.24, s * .14); g.fillRect(x - rx * .62, y + ry - s * .04, rx * 1.24, s * .14);
  g.strokeStyle = "#1a0e0e"; g.lineWidth = Math.max(1, s * .03); g.beginPath(); g.moveTo(x, y - ry - s * .1); g.lineTo(x, y - ry - s * .3); g.stroke();
  if (kind === "pumpkin") {
    g.fillStyle = "#3a1206";
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x + sd * rx * .5, y - ry * .2); g.lineTo(x + sd * rx * .15, y - ry * .2); g.lineTo(x + sd * rx * .32, y - ry * .48); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(x - rx * .6, y + ry * .1);
    for (let k = 0; k <= 6; k++) g.lineTo(x - rx * .6 + k * rx * .2, y + ry * (k % 2 ? .22 : .1));
    g.lineTo(x + rx * .5, y + ry * .32); g.quadraticCurveTo(x, y + ry * .6, x - rx * .5, y + ry * .32); g.closePath(); g.fill();
  } else if (txt && s > 22) {
    g.fillStyle = "rgba(25,8,8,.85)"; g.textAlign = "center"; g.textBaseline = "middle";
    const fs = Math.min(rx * 1.05, ry * 1.6 / txt.length); g.font = JP(900, fs);
    [...txt].forEach((ch, i) => g.fillText(ch, x, y + (i - (txt.length - 1) / 2) * fs * 1.02));
  }
}
function pumpkin(g, x, y, s) {
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, s * 1.8, "#ff8a2a", .4); g.restore();
  g.fillStyle = "#e4701e";
  for (const [dx, w] of [[-.42, .42], [.42, .42], [-.18, .46], [.18, .46], [0, .44]]) { g.beginPath(); g.ellipse(x + dx * s, y, w * s, s * .58, 0, 0, TAU); g.fill(); }
  g.strokeStyle = "rgba(120,40,8,.5)"; g.lineWidth = 1.2;
  for (const dx of [-.42, -.18, .18, .42]) { g.beginPath(); g.ellipse(x + dx * s, y, s * .2, s * .55, 0, 0, TAU); g.stroke(); }
  g.fillStyle = "#3d5a1e"; g.fillRect(x - s * .06, y - s * .78, s * .12, s * .24);
  g.fillStyle = "#ffe08a";
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x + sd * s * .42, y - s * .05); g.lineTo(x + sd * s * .14, y - s * .05); g.lineTo(x + sd * s * .28, y - s * .3); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(x - s * .5, y + s * .12); for (let k = 0; k <= 5; k++) g.lineTo(x - s * .5 + k * s * .2, y + s * (k % 2 ? .25 : .12)); g.quadraticCurveTo(x, y + s * .5, x - s * .5, y + s * .12); g.fill();
}
function obake(g, x, y, s) {
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, s * 1.6, "#b9a6e8", .35); g.restore();
  g.fillStyle = "rgba(250,246,255,.94)"; g.beginPath(); g.moveTo(x - s * .5, y + s * .5);
  g.lineTo(x - s * .5, y - s * .05); g.bezierCurveTo(x - s * .5, y - s * .75, x + s * .5, y - s * .75, x + s * .5, y - s * .05); g.lineTo(x + s * .55, y + s * .45);
  for (let k = 0; k < 4; k++) g.quadraticCurveTo(x + s * (.42 - k * .26), y + s * (k % 2 ? .45 : .7), x + s * (.3 - k * .26), y + s * .5);
  g.closePath(); g.fill();
  g.fillStyle = "#2a1a2e"; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * s * .17, y - s * .12, s * .06, s * .09, 0, 0, TAU); g.fill(); }
  g.fillStyle = "rgba(255,140,170,.6)"; for (const sd of [-1, 1]) { g.beginPath(); g.arc(x + sd * s * .3, y + s * .03, s * .06, 0, TAU); g.fill(); }
  g.strokeStyle = "#2a1a2e"; g.lineWidth = s * .04; g.beginPath(); g.arc(x, y + s * .02, s * .07, .2, Math.PI - .2); g.stroke();
}
function bat(g, x, y, s) {
  g.fillStyle = "#0d0709"; g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(x - s * .3, y - s * .45, x - s, y - s * .2); g.quadraticCurveTo(x - s * .7, y, x - s * .55, y + s * .2); g.quadraticCurveTo(x - s * .35, y + s * .05, x, y + s * .2);
  g.quadraticCurveTo(x + s * .35, y + s * .05, x + s * .55, y + s * .2); g.quadraticCurveTo(x + s * .7, y, x + s, y - s * .2); g.quadraticCurveTo(x + s * .3, y - s * .45, x, y); g.fill();
}
function yokocho(g, W, H, { r, bg }) {
  const narrow = W < 560;
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#130a15"); gr.addColorStop(.55, "#2a1222"); gr.addColorStop(1, "#4a1d1f");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,240,220,.8)"; for (let i = 0; i < W / 40; i++) { g.beginPath(); g.arc(r() * W, r() * H * .45, .6 + r() * .8, 0, TAU); g.fill(); }
  const vx = W * (narrow ? .7 : .7), vy = H * .62;
  if (bg) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 14; i++) glow(g, r() * W, H * (.2 + r() * .7), 60 + r() * 140, ["#ff4a2a", "#ff8a2a", "#ffd36b"][i % 3], .4);
    g.restore(); return;
  }
  // луна и летучие мыши
  const mx = W * (narrow ? .58 : .55), my = H * .2, mr = H * .095;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, mx, my, mr * 4, "#ffb35a", .25); g.restore();
  g.fillStyle = "#ffe9bf"; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
  g.fillStyle = "rgba(220,170,110,.35)"; for (const [dx, dy, rr] of [[-.3, -.2, .22], [.25, .15, .16], [.05, -.4, .1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, TAU); g.fill(); }
  bat(g, mx - mr * 1.8, my + mr * .4, mr * .5); bat(g, mx + mr * 1.5, my - mr * .6, mr * .38); bat(g, mx + mr * 2.6, my + mr * .2, mr * .3);
  // переулок в перспективе: стены из лавок, свет из дверей, гирлянды фонарей поперёк
  const wallTop = (side, t) => lerp(side > 0 ? -H * .12 : H * .08, vy - H * .26, t), wallBot = t => lerp(H * 1.06, vy + H * .06, t);
  const wallX = (side, t) => side > 0 ? lerp(W * 1.02, vx + H * .12, t) : lerp(-W * .02, vx - H * .12, t);
  const depth = k => 1 - Math.pow(.7, k);
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, vx, vy - H * .05, H * .8, "#ff8a3a", .5); glow(g, vx, vy, H * .3, "#ffd27a", .5); g.restore();
  // земля
  g.fillStyle = "#24141a"; g.beginPath(); g.moveTo(wallX(-1, 0), H); g.lineTo(wallX(-1, 1), wallBot(1)); g.lineTo(wallX(1, 1), wallBot(1)); g.lineTo(wallX(1, 0), H); g.closePath(); g.fill();
  const SIGNS = ["酒", "焼鳥", "おでん", "祭", "酒", "ラーメン"];
  for (const side of [1, -1]) for (let k = 7; k >= 0; k--) {
    const t0 = depth(k), t1 = depth(k + 1), x0 = wallX(side, t0), x1 = wallX(side, t1);
    const q = (t, f) => lerp(wallTop(side, t), wallBot(t), f);
    g.fillStyle = k % 2 ? "#2a161b" : "#22121a"; if (side < 0) g.fillStyle = k % 2 ? "#1d0f15" : "#180c12";
    g.beginPath(); g.moveTo(x0, q(t0, 0)); g.lineTo(x1, q(t1, 0)); g.lineTo(x1, q(t1, 1)); g.lineTo(x0, q(t0, 1)); g.closePath(); g.fill();
    // дверь лавки: тёплый свет и норэн; ближние лавки слева (под надписью) и у правого края — закрыты ставнями
    const dx0 = lerp(x0, x1, .15), dx1 = lerp(x0, x1, .85), d = (x, t, f) => [x, q(t, f)];
    const ta = lerp(t0, t1, .15), tb = lerp(t0, t1, .85), lit = side > 0 ? 1 : .42;
    if ((side < 0 && k <= 2) || (side > 0 && k === 0)) {
      g.strokeStyle = "rgba(90,60,60,.35)"; g.lineWidth = 1;
      for (let f = .5; f < .98; f += .035) { g.beginPath(); g.moveTo(...d(dx0, ta, f)); g.lineTo(...d(dx1, tb, f)); g.stroke(); }
      continue;
    }
    const dg = g.createLinearGradient(0, q(ta, .5), 0, q(ta, 1));
    dg.addColorStop(0, rgba("#ffcf7a", .85 * lit)); dg.addColorStop(1, rgba("#ff8a3a", .7 * lit));
    g.fillStyle = dg; g.beginPath(); g.moveTo(...d(dx0, ta, .52)); g.lineTo(...d(dx1, tb, .52)); g.lineTo(...d(dx1, tb, .98)); g.lineTo(...d(dx0, ta, .98)); g.closePath(); g.fill();
    g.fillStyle = k % 3 ? "#7a1c18" : "#1e2a4a"; g.beginPath(); g.moveTo(...d(dx0, ta, .5)); g.lineTo(...d(dx1, tb, .5)); g.lineTo(...d(dx1, tb, .64)); g.lineTo(...d(dx0, ta, .64)); g.closePath(); g.fill();
    // вывеска над дверью
    const sg = g.createLinearGradient(dx0, 0, dx1, 0); sg.addColorStop(0, rgba("#ffe39a", .9 * lit)); sg.addColorStop(1, rgba("#ffc85a", .8 * lit));
    g.fillStyle = sg; g.beginPath(); g.moveTo(...d(dx0, ta, .3)); g.lineTo(...d(dx1, tb, .3)); g.lineTo(...d(dx1, tb, .42)); g.lineTo(...d(dx0, ta, .42)); g.closePath(); g.fill();
    const fs = Math.abs(q(ta, .42) - q(ta, .3)) * .72, word = SIGNS[(k + (side > 0 ? 0 : 3)) % SIGNS.length];
    if (fs > 9) { g.fillStyle = rgba("#8e1d16", lit); g.font = JP(900, fs); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(word, (dx0 + dx1) / 2, (q(ta, .36) + q(tb, .36)) / 2, Math.abs(dx1 - dx0) * .9); }
    if (side > 0 || k > 2) { g.save(); g.globalCompositeOperation = "lighter"; glow(g, (dx0 + dx1) / 2, q(ta, .8), Math.abs(dx1 - dx0) * 1.1, "#ff8a3a", .25 * lit); g.restore(); }
  }
  // мокрая мостовая: отражения
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 30; i++) { const x = W * (.4 + r() * .6), y = H * (.8 + r() * .18); g.fillStyle = rgba(["#ff4a2a", "#ffcf55", "#ff8a2a"][i % 3], .06 + r() * .1); g.fillRect(x, y, 2 + r() * 4, H * (.04 + r() * .1)); }
  g.restore();
  // гирлянды фонарей поперёк переулка: ближние — крупнее и выше, левая часть (под надписью) пустая
  g.strokeStyle = "rgba(10,5,8,.9)"; g.lineWidth = 1.2;
  const TXT = ["祭", "酒", "焼鳥", "祭", "おでん", "酒"];
  for (let k = 6; k >= 1; k--) {
    const t = depth(k) * .92, xl = Math.max(wallX(-1, t), W * (narrow ? .42 : .4)), xr = wallX(1, t), y = lerp(H * .02, vy - H * .2, t), s = lerp(H * .2, H * .03, t);
    g.beginPath(); g.moveTo(xl, y); g.quadraticCurveTo((xl + xr) / 2, y + s * .35, xr, y); g.stroke();
    const n = Math.max(2, Math.round((xr - xl) / (s * 1.5)));
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n, lx = lerp(xl, xr, u), ly = y + s * .35 * 4 * u * (1 - u) / 2 + s * .75;
      chochin(g, lx, ly, s, (k === 2 && i === n - 1) || (k === 4 && i === 0) ? "pumpkin" : "red", TXT[(i + k) % TXT.length]);
    }
  }
  // большой фонарь-тыква у правой стены
  chochin(g, W * (narrow ? .58 : .78), H * (narrow ? .62 : .58), H * .2, "pumpkin");
  // жёлтая вертикальная вывеска «お化け横丁»
  const sw = H * .12, sh = H * .6, sx = W * (narrow ? .79 : .84) - sw / 2, sy = H * .1;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, sx + sw / 2, sy + sh / 2, sh * .7, "#ffcf55", .45); g.restore();
  g.fillStyle = "#ffd36b"; g.fillRect(sx, sy, sw, sh); g.strokeStyle = "#3a1a0e"; g.lineWidth = 2; g.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);
  g.fillStyle = "#b2231a"; g.textAlign = "center"; g.textBaseline = "middle";
  const st = "お化け横丁", fs = Math.min(sw * .66, (sh - 14) / st.length); g.font = JP(900, fs);
  [...st].forEach((ch, i) => g.fillText(ch, sx + sw / 2, sy + 7 + fs * (i + .55)));
  // тыквы, обакэ, кот на крыше
  pumpkin(g, W * (narrow ? .58 : .6), H * .93, H * .09); pumpkin(g, W * (narrow ? .68 : .67), H * .96, H * .065);
  if (!narrow) pumpkin(g, W * .97, H * .94, H * .08);
  obake(g, W * (narrow ? .62 : .48), H * .5, H * .16);
  g.fillStyle = "#0d0709"; const cx = W * (narrow ? .9 : .93), cy = H * .05;
  g.beginPath(); g.ellipse(cx, cy + H * .04, H * .035, H * .03, 0, 0, TAU); g.arc(cx + H * .02, cy, H * .02, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(cx + H * .006, cy - H * .015); g.lineTo(cx + H * .01, cy - H * .04); g.lineTo(cx + H * .02, cy - H * .02); g.moveTo(cx + H * .022, cy - H * .02); g.lineTo(cx + H * .032, cy - H * .04); g.lineTo(cx + H * .036, cy - H * .012); g.fill();
  g.strokeStyle = "#0d0709"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - H * .03, cy + H * .05); g.quadraticCurveTo(cx - H * .07, cy + H * .06, cx - H * .06, cy + H * .1); g.stroke();
  g.fillStyle = "#ffd36b"; g.fillRect(cx + H * .012, cy - H * .004, 2, 2); g.fillRect(cx + H * .026, cy - H * .004, 2, 2);
  if (narrow) scrim(g, W, H, "#120810", .6);
  grain(g, 14);
}

export const SCENES = { aoshingo, kohaku, rock: rockScene, showa, yokocho };
