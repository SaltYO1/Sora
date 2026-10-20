/* Экран «Карточки» (#cards) и сессия повторения (#cards/review[/колода]). */
import { D } from "./data.js";
import { db } from "./db.js";
import { esc, banner, TOK, optHTML } from "./render.js";
import { sync, queue, stats, answer, face, check, addCustom, DECK_NAMES, setPaused, itemList, whenLabel, KINDS, getKinds, setKinds, getAnswerMode } from "./cards.js";
import { preview, fmtIvl } from "./fsrs.js";
import { optClass, showTop, showBottom } from "./quiz.js";

const $ = s => document.querySelector(s);
const GRADES = [["Снова", "again"], ["Трудно", "hard"], ["Хорошо", "good"], ["Легко", "easy"]];
const KIND_RU = { word: "Слова", grammar: "Грамматика", kanji: "Кандзи" };

/* Переключатель «что повторять»: три пилюли, можно оставить одну или любые две. */
async function kindsHTML(withCounts = true) {
  const on = await getKinds();
  const counts = withCounts ? Object.fromEntries(await Promise.all(KINDS.map(async k => { const s = await stats(null, Date.now(), [k]); return [k, s.due + s.fresh]; }))) : {};
  return `<div class="kinds" role="group" aria-label="Что повторять">${KINDS.map(k => `<button class="kind" data-kind="${k}" aria-pressed="${on.includes(k)}">
    ${KIND_RU[k]}${withCounts ? `<small>${counts[k]}</small>` : ""}</button>`).join("")}</div>`;
}
function wireKinds(onChange) {
  document.querySelectorAll("[data-kind]").forEach(b => b.onclick = async () => {
    const on = new Set(await getKinds()), k = b.dataset.kind;
    if (on.has(k)) { if (on.size === 1) return; on.delete(k); } else on.add(k);
    await setKinds(KINDS.filter(x => on.has(x)));
    document.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-pressed", on.has(x.dataset.kind)));
    onChange();
  });
}

/* ================= обзор ================= */
export async function cardsHTML(arg) {
  await sync();
  if (arg?.startsWith("review")) return await reviewShell(arg.slice(7) || null);
  const s = await stats();
  const items = await db.all("items");
  const decks = [...new Set(items.flatMap(i => i.decks || []))];
  const deckRows = await Promise.all(decks.map(async d => ({ d, s: await stats(d) })));
  const newPerDay = await db.getKV("newPerDay", 15), ansMode = await getAnswerMode();
  const leeches = (await db.all("gaps")).filter(g => g.kind === "leech").length;
  return banner({ eyebrow: "復習 · Карточки", h1: "復習", jpLead: "忘れる前に、もう一度。", ru: "Карточка приходит перед тем, как забудется.", vert: "毎日すこしずつ。", seed: 37, tag: `${s.total}<br>CARDS` }) +
  `<div class="grid">
    <section class="card c-7"><h2>Сегодня <span class="jp">今日</span></h2>
      <div class="stats">
        <div class="stat"><b>${s.due}</b><span>к повторению</span></div>
        <div class="stat"><b>${s.fresh}</b><span>новых</span></div>
        <div class="stat"><b>${s.today}</b><span>уже сделано</span></div>
        <div class="stat"><b>${s.total}</b><span>карточек всего</span></div>
      </div>
      ${await kindsHTML()}
      ${s.due + s.fresh ? `<a class="btn primary big" href="#cards/review">Начать повторение · ${s.due + s.fresh}</a>
        <p class="muted small" style="margin:0">Общая очередь из всех колод. Нажми на «Слова», «Грамматику» или «Кандзи», чтобы убрать их из сегодняшнего повторения или вернуть. Колоды справа — чтобы повторить что-то одно.</p>`
        : `<p class="empty" style="margin:0">${s.total ? "На сегодня всё. Новые появятся завтра." : "Пока пусто. Нажми на слово в тексте и выбери «＋ в карточки» или добавь слово ниже."}</p>`}
      ${leeches ? `<p class="muted small" style="margin:0">Пиявок в «Моих пробелах»: ${leeches}</p>` : ""}
    </section>
    <section class="card c-5"><h2>Колоды <span class="jp">デッキ</span></h2>
      ${deckRows.length ? `<ul class="decks">${deckRows.map(({ d, s }) => `<li><div><b>${esc(DECK_NAMES(d))}</b><small>${s.total} карт. · сегодня ${s.due + s.fresh}</small></div>
        ${s.due + s.fresh ? `<a class="btn" href="#cards/review/${encodeURIComponent(d)}">Только эту</a>` : `<span class="chip">готово</span>`}</li>`).join("")}</ul>`
        : `<p class="muted small" style="margin:0">Колоды создаются сами: по тексту, юниту или «вручную».</p>`}
    </section>
    <section class="card c-12"><h2>Добавить <span class="jp">追加</span></h2>
      <input class="search" id="addQ" type="search" placeholder="Найти в словаре: 傘, かさ, зонт" autocomplete="off">
      <div id="addRes" class="addres"></div>
      <details class="custom"><summary>Своё слово, которого нет в словаре</summary>
        <form id="addForm" class="form">
          <label>Японский<input id="cW" lang="ja" required placeholder="例: 寝坊する"></label>
          <label>Чтение<input id="cR" lang="ja" placeholder="ねぼうする"></label>
          <label>Значение<input id="cM" required placeholder="проспать"></label>
          <button class="btn primary" type="submit">Добавить в карточки</button>
          <span class="muted small" id="addMsg"></span>
        </form></details>
    </section>
    <section class="card c-12"><h2>В изучении <span class="jp">学習中</span></h2>
      <div class="row between"><input class="search" id="lsQ" type="search" placeholder="Найти: 傘, зонт" autocomplete="off" style="flex:1 1 220px;width:auto">
        <div class="seg" role="group" aria-label="Фильтр"><button class="btn" data-ls="active" aria-pressed="true">Учу</button><button class="btn" data-ls="paused" aria-pressed="false">Убранные</button></div></div>
      <div id="lsList" class="lslist"></div>
      <p class="muted small" style="margin:0">«Убрать» прячет элемент из повторений, история сохраняется. «Вернуть» — и он продолжит с того же места.</p>
    </section>
    <section class="card c-12"><h2>Настройки <span class="jp">設定</span></h2>
      <form class="form" id="setForm"><label>Новых карточек в день<input id="newPerDay" type="number" min="0" max="100" value="${newPerDay}"></label></form>
      <div class="row"><span class="small">Ответ в карточках</span><div class="seg" role="group" aria-label="Ответ в карточках">
        <button class="btn" data-ans="self" aria-pressed="${ansMode === "self"}">Вслух и перевернуть</button><button class="btn" data-ans="type" aria-pressed="${ansMode === "type"}">Вводом</button></div></div>
      <p class="muted small" style="margin:0">«Вслух и перевернуть» — говоришь ответ про себя, открываешь и честно оцениваешь. Выбор из вариантов (грамматика, похожие кандзи) остаётся кнопками.
        Главные карточки (RU → JP) слов из юнита выходят сразу, вне лимита. Лимит действует на остальные виды и на слова из текстов и ручного добавления.
        Сохранить или перенести весь прогресс — кнопка «Сохранение» вверху справа.</p>
    </section>
  </div>`;
}

export function mountCards(arg) {
  if (arg?.startsWith("review")) return startSession(arg.slice(7) || null);
  const q = $("#addQ"), res = $("#addRes");
  q.oninput = async () => {
    const v = q.value.trim().toLowerCase();
    if (!v) { res.innerHTML = ""; return; }
    const has = new Set((await db.all("items")).map(i => i.id));
    const hits = Object.entries(D.dict.words).filter(([id, e]) => (id + " " + e.r + " " + e.m.join(" ")).toLowerCase().includes(v)).slice(0, 8);
    res.innerHTML = hits.length ? hits.map(([id, e]) => `<div class="addrow"><span class="jp k">${esc(id)}</span><span class="jp muted">${e.r !== id ? esc(e.r) : ""}</span><span class="m">${esc(e.m.join("; "))}</span>
      ${has.has("w:" + id) ? `<span class="chip learn">в карточках</span>` : `<button class="btn primary" data-addw="${esc(id)}">＋</button>`}</div>`).join("")
      : `<p class="muted small" style="margin:0">В словаре нет — можно добавить своё слово ниже.</p>`;
  };
  res.onclick = async e => {
    const b = e.target.closest("[data-addw]"); if (!b) return;
    await db.addItem("word", b.dataset.addw, "manual"); await sync();
    b.outerHTML = `<span class="chip learn">в карточках</span>`;
  };
  $("#addForm").onsubmit = async e => {
    e.preventDefault();
    const w = $("#cW").value.trim(), r = $("#cR").value.trim(), m = $("#cM").value.trim();
    if (!w || !m) return;
    if (D.dict.words[w]) await db.addItem("word", w, "manual"); else await addCustom({ w, r, m });
    await sync();
    $("#addMsg").textContent = `Добавлено: ${w}`; e.target.reset();
  };
  let lsMode = "active";
  const drawList = async () => {
    const v = $("#lsQ").value.trim().toLowerCase();
    const rows = (await itemList()).filter(r => (lsMode === "paused") === r.paused && (!v || `${r.jp} ${r.r} ${r.m}`.toLowerCase().includes(v)));
    $("#lsList").innerHTML = rows.length ? rows.slice(0, 200).map(r => `<div class="lsrow">
        <span class="jp k">${esc(r.jp)}</span>
        <span class="m">${esc(r.m)}<small>${esc(r.decks.map(DECK_NAMES).join(" · "))} · ${r.paused ? "убрано" : whenLabel(r.next)}</small></span>
        <button class="btn${r.paused ? " primary" : ""}" data-toggle="${esc(r.id)}">${r.paused ? "Вернуть" : "Убрать"}</button></div>`).join("")
      : `<p class="empty" style="margin:0">${lsMode === "paused" ? "Ничего не убрано" : v ? "Ничего не нашлось" : "Пока пусто"}</p>`;
  };
  $("#lsQ").oninput = drawList;
  document.querySelectorAll("[data-ls]").forEach(b => b.onclick = () => {
    lsMode = b.dataset.ls;
    document.querySelectorAll("[data-ls]").forEach(x => x.setAttribute("aria-pressed", x === b));
    drawList();
  });
  $("#lsList").onclick = async e => {
    const b = e.target.closest("[data-toggle]"); if (!b) return;
    const it = (await itemList()).find(r => r.id === b.dataset.toggle);
    await setPaused(b.dataset.toggle, !it.paused); await sync(); drawList();
  };
  drawList();
  $("#newPerDay").onchange = e => db.setKV("newPerDay", Math.max(0, Math.min(100, +e.target.value || 0)));
  document.querySelectorAll("[data-ans]").forEach(b => b.onclick = async () => {
    await db.setKV("answerMode", b.dataset.ans);
    document.querySelectorAll("[data-ans]").forEach(x => x.setAttribute("aria-pressed", x === b));
  });
  wireKinds(() => dispatchEvent(new HashChangeEvent("hashchange")));
}

/* ================= сессия ================= */
async function reviewShell(deck) {
  return `${deck ? "" : `<div class="rv-kinds">${await kindsHTML(false)}</div>`}<section class="card review" id="rv">
    <div class="row between"><span class="chip learn" id="rvLabel">…</span>
      <span class="muted small rv-meta"><button class="linkbtn" id="rvPause" title="Убрать из изучения, история сохранится">Больше не показывать</button> · <span id="rvDeck">${deck ? esc(DECK_NAMES(deck)) : "Все колоды"}</span> · осталось <b id="rvLeft">…</b></span></div>
    <div id="rvBody" class="rv-body"><div class="loading">読み込み中…</div></div>
  </section><a href="#cards" class="small">← к колодам</a>`;
}

let S = null;
async function startSession(deck) {
  S = { deck, q: await queue(deck), used: new Set(), done: 0, again: 0, paused: 0, ans: await getAnswerMode() };
  // переключили виды посреди сессии — очередь пересобирается, сделанное сегодня не повторяется
  if (!deck) wireKinds(async () => { if (!S) return; S.q = await queue(null); TOK.length = 0; next(); });
  $("#rvPause").onclick = async () => {
    if (!S?.card || busy) return;
    const item = S.card.item;
    await setPaused(item, true);
    S.q = S.q.filter(c => c.item !== item); S.paused++;
    TOK.length = 0; next();
  };
  next();
}

async function next() {
  const body = $("#rvBody"); if (!body || !S) return;
  $("#rvLeft").textContent = S.q.length;
  if (S.done || S.paused) showTop($("#rv"));
  if (!S.q.length) {
    $("#rvLabel").textContent = "Готово"; $("#rvPause").hidden = true;
    body.innerHTML = `<div class="rv-done"><div class="q-jp jp">おつかれさま！</div>
      <p>Повторено карточек: <b>${S.done}</b>${S.again ? `, «Снова»: ${S.again}` : ""}${S.paused ? `, убрано: ${S.paused}` : ""}.</p>
      <a class="btn primary" href="#cards">К колодам</a></div>`;
    return;
  }
  const card = S.q[0];
  let f = await face(card, S.used);
  if (!f) { S.q.shift(); return next(); }
  if (f.mode === "type" && S.ans === "self") f = { ...f, mode: "self" };
  S.card = card; S.face = f; S.revealed = false;
  $("#rvLabel").textContent = f.label;
  body.innerHTML = `<div class="rv-q">${f.prompt}</div>
    ${f.hint ? `<p class="rv-hint">${esc(f.hint)}</p>` : ""}
    ${f.mode === "type" ? `<form id="rvForm" class="rv-form"><input id="rvIn" class="search jp" lang="ja" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ответ по-японски">
        <div class="row"><button class="btn primary" type="submit">Проверить</button><button class="btn" type="button" id="rvSkip">Не помню</button></div></form>`
      : f.mode === "choice" ? `<div class="rv-opts">${f.options.map(o => `<button class="btn ${optClass(o)}" data-opt="${esc(o)}"><span>${[...o].length > 1 ? optHTML(o) : esc(o)}</span></button>`).join("")}</div>`
      : `<button class="btn primary big" id="rvShow">Показать ответ<span class="kbd"> · пробел</span></button>`}
    <div id="rvBack"></div>`;
  if (f.mode === "type") {
    const inp = $("#rvIn"); inp.focus({ preventScroll: true });
    $("#rvForm").onsubmit = e => { e.preventDefault(); reveal(inp.value); };
    $("#rvSkip").onclick = () => reveal(null);
  } else if (f.mode === "choice") {
    body.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => reveal(b.dataset.opt));
  } else $("#rvShow").onclick = () => reveal(undefined);
}

function reveal(input) {
  if (S.revealed) return; S.revealed = true;
  const f = S.face;
  let verdict = "", suggest = 3;
  if (f.mode !== "self") {
    const ok = input != null && check(input, f.answers);
    suggest = ok ? 3 : 1;
    verdict = ok ? `<p class="verdict ok">✓ Верно</p>`
      : input ? `<p class="verdict bad">✗ Твой ответ: <span class="jp">${esc(input)}</span> · верно: <span class="jp">${esc(f.answers[0])}</span></p>`
      : `<p class="verdict bad">Ответ: <span class="jp">${esc(f.answers[0])}</span></p>`;
    document.querySelectorAll("#rvForm input, #rvForm button, [data-opt]").forEach(el => el.disabled = true);
    document.querySelectorAll("[data-opt]").forEach(b => { if (f.answers.includes(b.dataset.opt)) b.classList.add("right"); else if (b.dataset.opt === input) b.classList.add("wrong"); });
  }
  $("#rvShow")?.remove();
  const pv = preview(S.card);
  $("#rvBack").innerHTML = `${verdict}<div class="rv-a">${f.back}</div>
    <div class="grades">${GRADES.map(([n, cls], i) => `<button class="grade ${cls}${i + 1 === suggest ? " sug" : ""}" data-g="${i + 1}"><b>${n}</b><small>${fmtIvl(pv[i])}</small></button>`).join("")}</div>
    <p class="muted small" style="margin:0">${f.mode === "self" ? "Оцени себя честно." : "Подсвечена подсказка, решаешь ты."}<span class="kbd"> Клавиши 1–4.</span></p>`;
  $("#rvBack").querySelectorAll("[data-g]").forEach(b => b.onclick = () => grade(+b.dataset.g));
  $("#rvBack").querySelector(".sug")?.focus({ preventScroll: true });
  showBottom($("#rvBack .grades"));
}

let busy = false;
async function grade(g) {
  if (busy || !S?.revealed) return; busy = true;
  try {
    const card = S.q.shift();
    const upd = await answer(card, g);
    S.done++;
    // сестринские карточки этого элемента — не сегодня
    S.q = S.q.filter(c => c.item !== card.item);
    if (g === 1) { S.again++; S.q.push(upd); }
    TOK.length = 0;
    await next();
  } finally { busy = false; }
}

addEventListener("keydown", e => {
  if (!S || !$("#rv")) return;
  if (!S.revealed) {
    if ((e.key === " " || e.key === "Enter") && $("#rvShow") && !/INPUT|BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); reveal(undefined); }
    return;
  }
  if (["1", "2", "3", "4"].includes(e.key) && e.target.tagName !== "INPUT") { e.preventDefault(); grade(+e.key); }
});
export const endSession = () => { S = null; };
