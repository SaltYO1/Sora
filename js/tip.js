/* Подсказка по нажатию: слово / частица / грамматика. На телефоне — снизу, на компьютере — у слова. */
import { D, POS, REG } from "./data.js";
import { TOK, esc, ruby } from "./render.js";
import { hasKanji } from "./markup.js";
import { db } from "./db.js";
import { setPaused } from "./cards.js";

const $ = s => document.querySelector(s);
let tip, body, cur = null;
let deckOf = () => null;         // контекст для колоды («text:shibuya», «unit:1»…)
let onGo = () => {};

const mobile = () => matchMedia("(max-width:820px)").matches;

export function initTip({ deck, go }) {
  deckOf = deck; onGo = go;
  tip = $("#tip"); body = $("#tipBody");
  document.addEventListener("click", e => {
    const w = e.target.closest(".w"); if (w) { open(w); return; }
    if (!e.target.closest("#tip")) close();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("w")) { e.preventDefault(); open(e.target); }
  });
  $("#tipClose").onclick = close;
  addEventListener("scroll", () => { if (!mobile()) close(); }, { passive: true });
  tip.addEventListener("click", async e => {
    const add = e.target.closest("[data-add]"), pause = e.target.closest("[data-pause]");
    if (add || pause) {
      const el = add || pause, [kind, ref] = el.dataset[add ? "add" : "pause"].split("|");
      if (add) await db.addItem(kind, ref, deckOf());
      else await setPaused(`${kind[0]}:${ref}`, true);
      el.closest(".card-btns").outerHTML = addBtn(add ? "active" : "paused", kind, ref);
      return;
    }
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); close(); onGo(go.dataset.go); }
  });
}

/* state: "none" | "active" | "paused" */
const addBtn = (state, kind, ref) => {
  const k = `${esc(kind)}|${esc(ref)}`;
  return `<span class="card-btns">${state === "active"
    ? `<span class="chip learn">✓ в карточках</span><button class="btn" data-pause="${k}">Убрать</button>`
    : state === "paused" ? `<button class="btn primary" data-add="${k}">Вернуть в изучение</button>`
    : `<button class="btn primary" data-add="${k}">＋ в карточки</button>`}</span>`;
};

async function wordHTML(t) {
  const e = t.e, lemma = t.lemma;
  const head = e
    ? `<span class="tip-jp">${esc(e.w || lemma)}</span><span class="tip-r">${e.r !== (e.w || lemma) ? esc(e.r) : ""}</span>`
    : `<span class="tip-jp">${esc(t.s)}</span><span class="tip-r">${esc(t.r || "")}</span>`;
  if (!e) return { kind: "Слово", head, rest: `<p class="tip-n">Этого слова пока нет в словаре.</p>` };
  const form = t.s !== lemma ? `<div class="tip-form">в тексте: <span class="jp">${ruby(t.s, t.r)}</span></div>` : "";
  const m = e.m.length > 1
    ? `<ol class="tip-m">${e.m.map((x, i) => `<li class="${t.sense === i + 1 ? "cur" : ""}">${esc(x)}</li>`).join("")}</ol>`
    : `<ul class="tip-m one"><li>${esc(e.m[0])}</li></ul>`;
  const col = e.col?.length ? `<div class="tip-col">${e.col.map(c => `<span>${esc(c)}</span>`).join("")}</div>` : "";
  const kj = [...new Set(e.w || lemma)].filter(ch => hasKanji(ch) && D.kanji[ch]);
  const kanji = kj.length ? `<div class="tip-kanji">${kj.map(ch => `<a href="#kanji/${encodeURIComponent(ch)}" data-go="kanji/${esc(ch)}"><b>${esc(ch)}</b>${esc(D.kanji[ch].m)}</a>`).join("")}</div>` : "";
  const note = e.note ? `<p class="tip-n">${esc(e.note)}</p>` : "";
  const has = await db.itemState("word", lemma);
  const kind = `${POS[e.pos] || "Слово"}${e.reg ? ` <span class="chip reg">${esc(REG[e.reg] || e.reg)}</span>` : ""}`;
  return { kind, head, rest: form + m + col + note + kanji + `<div class="tip-actions">${addBtn(has, "word", lemma)}</div>` };
}

function partHTML(t) {
  const senses = t.p?.m || [];
  const rest = t.note
    ? `<ul class="tip-m one"><li>${esc(t.note)}</li></ul>${senses.length ? `<p class="tip-n">Вообще: ${esc(senses.join(" · "))}</p>` : ""}`
    : `<ul class="tip-m${senses.length > 1 ? "" : " one"}">${senses.map(s => `<li>${esc(s)}</li>`).join("") || "<li>—</li>"}</ul>`;
  return { kind: "Частица", head: `<span class="tip-jp">${esc(t.s)}</span>`, rest };
}

async function gramHTML(t) {
  const g = t.gEntry;
  if (!g) return { kind: "Грамматика", head: `<span class="tip-jp">${esc(t.s)}</span>`, rest: `<p class="tip-n">Разбор пока не написан.</p>`, g: true };
  const has = await db.itemState("grammar", t.g);
  // слово внутри конструкции (寝ようとした → 寝る): чтение, значение, «＋ в карточки»
  const w = t.inner, we = w?.e;
  const inner = we ? `<div class="tip-inner"><div class="tip-kind">Слово внутри · ${esc(POS[we.pos] || "слово")}</div>
      <div class="tip-head"><span class="tip-jp sm">${esc(we.w || w.lemma)}</span><span class="tip-r">${esc(we.r)}</span></div>
      <div class="tip-form">в тексте: <span class="jp">${ruby(t.s, t.r)}</span></div>
      <ul class="tip-m one"><li>${esc(we.m.join("; "))}</li></ul>${we.note ? `<p class="tip-n">${esc(we.note)}</p>` : ""}
      <div class="tip-actions">${addBtn(await db.itemState("word", w.lemma), "word", w.lemma)}</div></div>` : "";
  return {
    kind: "Грамматика", g: true,
    head: `<span class="tip-jp">${esc(g.pat)}</span>`,
    rest: `<ul class="tip-m one"><li>${esc(g.m)}</li></ul>${g.form ? `<p class="tip-n">Форма: ${esc(g.form)}</p>` : ""}
      <div class="tip-actions"><a class="btn" href="#grammar/${esc(t.g)}" data-go="grammar/${esc(t.g)}">Открыть разбор →</a>${addBtn(has, "grammar", t.g)}</div>${inner}`,
  };
}

async function open(el) {
  const t = TOK[+el.dataset.t]; if (!t) return;
  cur?.classList.remove("on"); cur = el; el.classList.add("on");
  const h = t.k === "word" ? await wordHTML(t) : t.k === "part" ? partHTML(t) : await gramHTML(t);
  if (cur !== el) return;
  body.innerHTML = `<div class="tip-kind ${h.g ? "g" : ""}">${h.kind}</div><div class="tip-head">${h.head}</div>${h.rest}`;
  tip.hidden = false;
  if (mobile()) { tip.style.left = tip.style.top = ""; return; }
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), innerWidth - w - 16);
  let top = r.bottom + 10; if (top + hh > innerHeight - 12) top = r.top - hh - 10;
  tip.style.left = left + "px"; tip.style.top = Math.max(12, top) + "px";
}

export function close() { if (!tip) return; tip.hidden = true; cur?.classList.remove("on"); cur = null; }
