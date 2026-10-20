/* 空 Sora · N3 — точка входа: загрузка данных, маршрутизация (#раздел/параметр), экраны, тема и сохранение. */
import { D, boot, libText, unitFile, POS } from "./data.js";
import { TOK, esc, banner, textBlock, legend, renderLine, wordChip, gramCardHTML, trLine } from "./render.js";
import { initTip, close as closeTip } from "./tip.js";
import { initSky, mountSkies } from "./sky.js";
import { db } from "./db.js";
import { cardsHTML, mountCards, endSession } from "./review.js";
import { sync, stats } from "./cards.js";
import { unitHTML, mountUnit, unitProgress, STEPS, textTools } from "./unit.js";
import { gamesHTML, mountGames, endGames } from "./games.js";

const $ = s => document.querySelector(s);
const store = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const NAV = [
  { group: "Сегодня" },
  { id: "home", ru: "Главная", jp: "ホーム", ic: "家" },
  { group: "Учёба" },
  { id: "course", ru: "Курс", jp: "課", ic: "課" },
  { id: "cards", ru: "Карточки", jp: "復習", ic: "復" },
  { id: "games", ru: "Игры", jp: "練習", ic: "練" },
  { id: "gaps", ru: "Мои пробелы", jp: "弱点", ic: "穴", soon: true },
  { group: "Справочник" },
  { id: "vocab", ru: "Лексика", jp: "語彙", ic: "語" },
  { id: "grammar", ru: "Грамматика", jp: "文法", ic: "文" },
  { id: "kanji", ru: "Кандзи", jp: "漢字", ic: "漢" },
  { id: "reading", ru: "Чтение", jp: "読解", ic: "読" },
];

const SOON = {
  gaps: { lead: "Всё, что не вспомнилось, — сюда и в повторение.", stage: "Задача 10", items: ["Быстрая запись: что хотел сказать и как правильно", "«Пиявки» из карточек (4+ провала) попадают сюда сами", "Связь с карточками лексики и грамматики"] },
};

let ctx = null; // текущая колода для «＋ в карточки»

/* ================= VIEWS ================= */
const VIEWS = {
  async home() {
    const unit = D.units.find(u => u.file) || D.units[0];
    const items = await sync();
    const cnt = k => items.filter(i => i.kind === k && !i.suspended).length;
    const st = await stats();
    const lines = (await Promise.all(D.library.map(t => libText(t.id)))).flatMap(t => t.paras.flat().map(s => ({ s, id: t.id })));
    const day = Math.floor(Date.now() / 864e5), phrase = lines[day % lines.length];
    ctx = `text:${phrase.id}`;
    return banner({ slim: false, eyebrow: "Japan series · N3", h1: "日本語 N3", jpLead: "言葉を、自分のものに。", ru: "Сделать язык своим: слово приходит в нужный момент.", vert: "東京の空は、ここに。", tag: "JPN<br>N3" }) +
    `<div class="grid">
      <section class="card c-7"><h2>План на сегодня <span class="jp">今日のメニュー</span></h2>
        <ul class="tasks">
          <li><span class="n">復</span><div><b>Повторение · ${st.due + st.fresh}</b><small>${st.due} к повторению · ${st.fresh} новых${st.today ? ` · сделано ${st.today}` : ""}</small></div>${st.due + st.fresh ? `<a href="#cards/review">Начать</a>` : `<a href="#cards">Колоды</a>`}</li>
          <li><span class="n">課</span><div><b>Юнит ${unit.n} · ${esc(unit.title)}</b><small>${esc(unit.task)}</small></div><a href="#course/${unit.n}">Открыть</a></li>
          <li><span class="n">練</span><div><b>Игра</b><small>Грамматика · лексика и кандзи · беглость: скажи быстро, ответь в чате</small></div><a href="#games">Играть</a></li>
          <li><span class="n">読</span><div><b>Чтение</b><small>${esc(D.library.map(t => t.title).join(" · "))}</small></div><a href="#reading">Читать</a></li>
        </ul></section>
      <section class="card c-5"><h2>В изучении <span class="jp">進み具合</span></h2>
        <div class="stats">
          <div class="stat"><b>${cnt("word")}</b><span>слов и коллокаций</span></div>
          <div class="stat"><b>${cnt("grammar")}</b><span>конструкций</span></div>
          <div class="stat"><b>${st.due}</b><span>к повторению сегодня</span></div>
          <div class="stat"><b>${Object.keys(D.dict.words).length}</b><span>слов в словаре</span></div>
        </div>
        <p class="muted small" style="margin:0">«＋ в карточки» в подсказке добавляет слово в изучение.</p></section>
      <section class="card c-12"><h2>Фраза дня <span class="jp">今日の一文</span></h2>
        ${textBlock([phrase.s])}${legend}</section>
    </div>`;
  },

  async course(n) {
    if (n) { const [u, step] = n.split("/"); ctx = `unit:${u}`; return unitHTML(+u, step); }
    ctx = null;
    const prog = {};
    for (const u of D.units.filter(u => u.file)) prog[u.n] = Object.keys((await unitProgress(u.n)).done || {}).length;
    return banner({ eyebrow: "課 · Курс", h1: "課", jpLead: "話すための25課", ru: "25 юнитов: тема + речевая задача.", vert: "一課ずつ、確かに。", seed: 31, tag: `N3<br>${D.units.length} UNITS` }) +
      D.course.blocks.map(b => `<div class="block-h"><b>${esc(b.id)}</b><span class="muted">${esc(b.title)}</span></div>
        <div class="ulist">${b.units.map(u => `<a class="ucard" href="#course/${u.n}">
          <div class="row between"><span class="num">${u.n}</span>${u.file ? (prog[u.n] === STEPS.length ? `<span class="chip learn">пройден ✓</span>` : `<span class="chip learn">${prog[u.n] ? `${prog[u.n]}/${STEPS.length}` : "готов"}</span>`) : `<span class="chip">план</span>`}</div>
          <span class="ti">${esc(u.title)}</span><span class="ta">${esc(u.task)}</span>
          <span class="kj">${esc(u.kanji)}</span></a>`).join("")}</div>`).join("");
  },

  async cards(arg) { ctx = "manual"; return cardsHTML(arg); },

  async games(arg) { ctx = "manual"; return gamesHTML(arg); },

  async vocab() {
    ctx = null;
    const all = Object.entries(D.dict.words);
    const items = await db.all("items"), has = new Set(items.filter(i => !i.suspended).map(i => i.id)), paused = new Set(items.filter(i => i.suspended).map(i => i.id));
    const card = ([id, e]) => `<div class="vcard" data-q="${esc((id + " " + e.r + " " + e.m.join(" ")).toLowerCase())}">
      <div class="top">${wordChip(id, "k")}${has.has("w:" + id) ? `<span class="chip learn">в карточках</span>` : paused.has("w:" + id) ? `<span class="chip">убрано</span>` : ""}</div>
      <span class="r">${e.r !== id ? esc(e.r) : "&nbsp;"}</span><span class="m">${esc(e.m.join("; "))}</span>
      ${e.col?.length ? `<span class="ex">${esc(e.col.join(" · "))}</span>` : ""}</div>`;
    const words = all.filter(([, e]) => e.pos !== "col" && e.pos !== "phrase"), cols = all.filter(([, e]) => e.pos === "col" || e.pos === "phrase");
    return banner({ eyebrow: "語彙 · Лексика", h1: "語彙", jpLead: "一語ずつ、確かに。", ru: "Слова и коллокации из пройденного.", vert: "言葉は使ってこそ。", seed: 57, tag: `N3<br>${all.length} WORDS` }) +
    `<section class="card"><input class="search" id="q" type="search" placeholder="Поиск: 傘, かさ, зонт" autocomplete="off">
      <h2>Слова <span class="jp">単語</span></h2><div class="vlist">${words.map(card).join("")}</div>
      <h2>Коллокации и фразы <span class="jp">組み合わせ</span></h2><div class="vlist">${cols.map(card).join("")}</div>
      <p class="empty" id="qEmpty" hidden>Ничего не нашлось</p></section>`;
  },

  async grammar() {
    ctx = null;
    const items = Object.entries(D.grammar);
    return banner({ eyebrow: "文法 · Грамматика", h1: "文法", jpLead: "かたちと、きもち。", ru: "Форма конструкции и чувство, которое она передаёт.", vert: "使えてこそ文法。", seed: 41, tag: `N3<br>${items.length} ITEMS` }) +
    `<div class="grid">${items.map(([id, g]) => gramCardHTML(id, g)).join("")}</div>`;
  },

  async kanji() {
    ctx = null;
    const items = Object.entries(D.kanji);
    return banner({ eyebrow: "漢字 · Кандзи", h1: "漢字", jpLead: "言葉から、字へ。", ru: "Кандзи через слова: только узнавание и чтение.", vert: "読めれば、見える。", seed: 19, tag: `N3<br>${items.length} KANJI` }) +
    `<section class="card"><p class="muted small" style="margin:0">Карточка кандзи появится сама, когда в колоде будет 2+ слова с ним.</p>
      <div class="klist">${items.map(([ch, k]) => {
        const ws = D.kanjiWords[ch] || [];
        return `<div class="kcard" id="k-${esc(ch)}"><span class="big">${esc(ch)}</span><span class="m">${esc(k.m)}</span>
          <span class="rd">${esc(k.on.join("、"))}</span><span class="rd">${esc(k.kun.join("、"))}</span>
          ${ws.length ? `<div class="ws">${ws.map(id => wordChip(id)).join("")}</div>` : ""}</div>`;
      }).join("")}</div></section>`;
  },

  async reading(id) {
    if (id) {
      const t = await libText(id);
      if (!t) return `<div class="empty">Текст не найден</div>`;
      ctx = `text:${id}`;
      const tr = t.tr || [];
      return banner({ eyebrow: `読解 · ${t.genre}`, h1: t.title, jpLead: t.titleR, ru: t.ru, vert: "ゆっくり読もう。", seed: 23, tag: `${esc(t.level)}<br>TEXT` }) +
      `<div class="grid"><section class="card c-12">
        <div class="row between"><h2>Текст <span class="jp">本文</span></h2><div class="row">${textTools(tr.length > 0)}</div></div>
        ${t.paras.map((p, pi) => `<p class="jtext para">${p.map(renderLine).join("")}</p>${trLine(tr[pi])}`).join("")}${legend}
        <a href="#reading" class="small">← все тексты</a></section></div>`;
    }
    ctx = null;
    return banner({ eyebrow: "読解 · Чтение", h1: "読解", jpLead: "読むのが、楽しい。", ru: "Тексты юнитов и библиотека для свободного чтения.", vert: "ゆっくり読もう。", seed: 23, tag: "N3<br>LIBRARY" }) +
    `<section class="card"><h2>Библиотека <span class="jp">図書室</span></h2>
      <ul class="tasks">${D.library.map(t => `<li><span class="n">読</span><div><b class="jp">${esc(t.title)}</b><small>${esc(t.ru)} · ${esc(t.genre)}</small></div><a href="#reading/${esc(t.id)}">Читать</a></li>`).join("")}</ul>
      </section>
    <section class="card"><h2>Тексты юнитов <span class="jp">課の本文</span></h2>
      <ul class="tasks">${(await Promise.all(D.units.filter(u => u.file).map(async u => ((await unitFile(u.n))?.texts || []).map(t => `<li><span class="n">${u.n}</span><div><b class="jp">${esc(t.title)}</b><small>${esc(t.ru || "")} · ${esc(t.genre)} · юнит ${u.n}</small></div><a href="#course/${u.n}/texts">Читать</a></li>`).join("")))).join("") || `<li><div><small>Пока нет</small></div></li>`}</ul></section>`;
  },
};

function soonView(id) {
  const n = NAV.find(x => x.id === id), s = SOON[id];
  ctx = null;
  return banner({ eyebrow: `${n.jp} · ${n.ru}`, h1: n.jp, ru: s.lead, vert: "準備中です。", seed: id.length * 13, tag: "SOON" }) +
  `<section class="card"><h2>Что здесь будет <span class="jp">これから</span></h2>
    <ul class="plan">${s.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
    <span class="stage"><span class="dot" style="background:var(--sun)"></span>${esc(s.stage)} по плану проекта</span></section>`;
}

/* ================= ROUTER ================= */
function renderNav(cur) {
  $("#nav").innerHTML = NAV.map(n => n.group ? `<div class="nav-label">${n.group}</div>` :
    `<a href="#${n.id}" ${n.id === cur ? 'aria-current="page"' : ""}><span class="ic">${n.ic}</span><span class="t"><span>${n.ru}</span><small>${n.jp}</small></span>${n.soon ? '<span class="soon">скоро</span>' : ""}</a>`).join("");
}

let seq = 0, shown = null;   // shown — какой экран сейчас на странице
async function route() {
  const raw = decodeURIComponent(location.hash.slice(1)) || store.get("sora:last") || "home";
  let [id, ...rest] = raw.split("/"); const arg = rest.join("/");
  if (!NAV.some(n => n.id === id && !n.group)) id = "home";
  const my = ++seq;
  // тот же экран перерисовался (фильтр, пилюли, ситуация письма) — остаёмся на месте; новый экран — наверх
  const same = raw === shown, keepY = scrollY;
  TOK.length = 0; closeTip(); closePops(); setSide(false); endGames();
  const n = NAV.find(x => x.id === id);
  renderNav(id); $("#topTitle").textContent = n.ru; $("#topJp").textContent = n.jp;
  let html;
  try { html = await (VIEWS[id] ? VIEWS[id](arg) : soonView(id)); }
  catch (e) { console.error(e); html = `<div class="empty">Не удалось загрузить: ${esc(e.message)}</div>`; }
  if (my !== seq) return;
  $("#main").innerHTML = `<div class="page">${html}</div>`;
  store.set("sora:last", raw); shown = raw;
  mountSkies($("#main")); wireView();
  if (id === "cards") mountCards(arg); else endSession();
  if (id === "course" && arg) { const [u, step] = arg.split("/"); mountUnit(+u, step); }
  if (id === "games") mountGames(arg);
  const focus = id === "grammar" && arg ? $("#g-" + CSS.escape(arg)) : id === "kanji" && arg ? $("#k-" + CSS.escape(arg)) : null;
  if (focus) { focus.scrollIntoView({ behavior: "smooth", block: "center" }); focus.classList.add("flash"); setTimeout(() => focus.classList.remove("flash"), 1600); }
  else scrollTo(0, same ? keepY : 0);
}

function wireView() {
  const q = $("#q");
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll(".vcard").forEach(c => { const ok = !v || c.dataset.q.includes(v); c.hidden = !ok; shown += ok; });
    $("#qEmpty").hidden = shown > 0;
  };
  applyPrefs();
}

/* ================= ФУРИГАНА И ПЕРЕВОД ================= */
const furi = $("#furi");
const prefs = { f: true, t: false, ...store.get("sora:prefs", {}) };
function applyPrefs() {
  furi.checked = prefs.f;
  document.body.classList.toggle("no-furi", !prefs.f);
  document.body.classList.toggle("show-tr", prefs.t);
  document.querySelectorAll(".rdFuri").forEach(b => b.setAttribute("aria-pressed", prefs.f));
  document.querySelectorAll(".rdTr").forEach(b => b.setAttribute("aria-pressed", prefs.t));
  store.set("sora:prefs", prefs);
}
furi.onchange = () => { prefs.f = furi.checked; applyPrefs(); };
document.addEventListener("click", e => {
  if (e.target.closest(".rdFuri")) { prefs.f = !prefs.f; applyPrefs(); }
  else if (e.target.closest(".rdTr")) { prefs.t = !prefs.t; applyPrefs(); }
});

/* ================= ТЕМА И СОХРАНЕНИЕ (кнопки вверху справа) ================= */
/* Темы: «небо» — пиксельный Токио (вечер / ночь); стилизованные — своя палитра и рисунок шапки (js/scenes.js).
   color — цвет строки состояния на телефоне. */
const THEMES = [
  { id: "auto", ru: "Как в системе", sub: "днём вечер, ночью ночь", group: "sky" },
  { id: "light", ru: "Вечер", sub: "закатное небо", group: "sky", color: "#6f93cf" },
  { id: "dark", ru: "Ночь", sub: "ночной Токио", group: "sky", color: "#141a3a" },
  { id: "aoshingo", ru: "Синий час", jp: "青信号", sub: "светофор и фонари, кобальтовое небо", color: "#17338a" },
  { id: "kohaku", ru: "Кохаку", jp: "紅白", sub: "карпы в синей плитке, клёны, бумага", color: "#2a57a6" },
  { id: "rock", ru: "Рок-кот", jp: "ロックンニャー", sub: "ретро-афиша: лучи, гитара, кот", color: "#1d7a83" },
  { id: "showa", ru: "Сёва", jp: "昭和レトロ", sub: "старые афиши на стене, тако", color: "#24485e" },
  { id: "yokocho", ru: "Хэллоуин", jp: "横丁ハロウィン", sub: "переулок: фонари, вывески, тыквы", color: "#1a0f1c" },
];
function applyTheme(id) {
  const root = document.documentElement, t = THEMES.find(x => x.id === id) || THEMES[0];
  id = t.id;
  if (id === "auto") delete root.dataset.theme; else root.dataset.theme = id;
  if (t.group === "sky") delete root.dataset.scene; else root.dataset.scene = id;
  const dark = id === "auto" && matchMedia("(prefers-color-scheme: dark)").matches;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.content = t.color || (dark ? "#141a3a" : "#6f93cf"));
  store.set("sora:theme", id);
}

const POPS = { theme: "#popTheme", save: "#popSave" };
function closePops() {
  for (const [k, sel] of Object.entries(POPS)) { const p = $(sel); if (p) p.hidden = true; $(`[data-pop="${k}"]`)?.setAttribute("aria-expanded", "false"); }
}
function openPop(k, btn) {
  const p = $(POPS[k]), was = !p.hidden;
  closePops(); closeTip(); if (was) return;
  if (k === "theme") drawTheme(); else drawSave();
  p.hidden = false; btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect();
  p.style.top = `${r.bottom + 8}px`; p.style.right = `${Math.max(12, innerWidth - r.right)}px`;
  p.querySelector("button")?.focus({ preventScroll: true });
}
function drawTheme() {
  const cur = store.get("sora:theme", "auto");
  const opt = t => `<button class="theme-opt" role="radio" aria-checked="${t.id === cur}" data-theme-id="${t.id}">
      <span class="sw sw-${t.id}" aria-hidden="true"></span><span><b>${esc(t.ru)}${t.jp ? ` <span class="jp muted">${esc(t.jp)}</span>` : ""}</b><small>${esc(t.sub)}</small></span></button>`;
  $("#popTheme .pop-body").innerHTML = `<div class="themes" role="radiogroup" aria-label="Тема">
      <div class="theme-group">Небо Токио</div>${THEMES.filter(t => t.group === "sky").map(opt).join("")}
      <div class="theme-group">Стилизованные</div>${THEMES.filter(t => !t.group).map(opt).join("")}</div>`;
}
function fmtDate(iso) { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); }
async function drawSave(msg = "") {
  const last = store.get("sora:lastSave");
  const [items, cards] = [await db.count("items"), await db.count("cards")];
  $("#popSave .pop-body").innerHTML = `<p style="margin:0">Весь прогресс живёт в этом браузере: карточки и их расписание, пройденные шаги юнитов, черновики письма, пробелы, рекорды игр, настройки.</p>
    <div class="save-stat"><span><b>${items}</b> в изучении</span><span><b>${cards}</b> карточек</span></div>
    <div class="row"><button class="btn primary" id="exportBtn">Скачать файл</button><label class="btn" for="importFile">Загрузить файл</label><input id="importFile" type="file" accept=".json,application/json" hidden></div>
    <p class="muted small" style="margin:0" id="ioMsg">${msg || (last ? `Последнее сохранение: ${esc(fmtDate(last))}` : "Ещё ни разу не сохранял. Скачай файл — это и резервная копия, и перенос.")}</p>
    <p class="muted small" style="margin:0">Перенос на другое устройство: «Скачать» здесь → «Загрузить» там. Загрузка дополняет и обновляет, ничего не удаляет.</p>`;
  $("#exportBtn").onclick = async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `sora-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    store.set("sora:lastSave", new Date().toISOString());
    drawSave(`Сохранено: ${data.items.length} элементов, ${data.cards.length} карточек, прохождение юнитов и черновики.`);
  };
  $("#importFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      await db.importAll(data); await sync();
      drawSave(`Загружено: ${data.items?.length || 0} элементов, ${data.cards?.length || 0} карточек.`);
      route();
    } catch (err) { $("#ioMsg").textContent = `Не получилось: ${err.message}`; }
  };
}
document.querySelectorAll("[data-pop]").forEach(b => b.onclick = e => { e.stopPropagation(); openPop(b.dataset.pop, b); });
$("#popTheme").addEventListener("click", e => {
  const b = e.target.closest("[data-theme-id]"); if (!b) return;
  applyTheme(b.dataset.themeId); drawTheme();
});
document.addEventListener("click", e => { if (!e.composedPath().some(el => el.matches?.(".pop, [data-pop], #tip"))) closePops(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closePops(); });
addEventListener("resize", closePops);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme(store.get("sora:theme", "auto")));

const side = $("#side"), scrim = $("#scrim"), menuBtn = $("#menuBtn");
function setSide(open) { side.classList.toggle("open", open); scrim.hidden = !open; menuBtn.setAttribute("aria-expanded", open); }
menuBtn.onclick = () => setSide(!side.classList.contains("open"));
scrim.onclick = () => setSide(false);

/* ================= OFFLINE ================= */
function setStatus(ok, text) { $("#status").innerHTML = `<span class="dot ${ok ? "ok" : ""}"></span>${esc(text)}`; }
async function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return setStatus(false, "Офлайн недоступен");
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    setStatus(true, "Работает офлайн");
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) setStatus(true, "Есть обновление — перезапусти"); });
    });
  } catch { setStatus(false, "Офлайн недоступен"); }
}

/* ================= START ================= */
applyTheme(store.get("sora:theme", "auto"));
initSky();
initTip({ deck: () => ctx, go: path => { location.hash = path; } });
addEventListener("hashchange", route);
boot().then(route).catch(e => { $("#main").innerHTML = `<div class="page"><div class="empty">Не удалось загрузить данные: ${esc(e.message)}</div></div>`; });
registerSW();
