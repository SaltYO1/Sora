/* HTML из разметки v2. Каждый токен регистрируется в TOK — подсказка берёт данные оттуда. */
import { parse, resolve, rubySegments, innerWord } from "./markup.js";
import { D } from "./data.js";

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function ruby(s, r) {
  return rubySegments(s, r).map(p => p.r ? `<ruby>${esc(p.t)}<rt>${esc(p.r)}</rt></ruby>` : esc(p.t)).join("");
}

/* Текст варианта ответа с фуриганой (без нажатия): слова грамматических вариантов находятся по словарю. */
export const optHTML = s => { const w = innerWord(s, D.dict); return w ? ruby(s, w.r) : esc(s); };

export const TOK = [];
export const tokRef = t => TOK.push(t) - 1;

export const renderLine = src => renderTokens(resolve(parse(src), D.dict, D.grammar));

/* gapAt — индекс токена, который заменяется пропуском (для карточек). */
export function renderTokens(tokens, gapAt = -1, gapHTML = `<span class="gap">＿＿</span>`) {
  return tokens.map((t, i) => {
    if (i === gapAt) return gapHTML;
    if (t.k === "text") return esc(t.s);
    if (t.k === "gram" && !t.g) return `<span class="hl">${esc(t.s)}</span>`;
    const cls = t.k === "word" ? "word" + (t.err ? " bad" : "") : t.k;
    const inner = t.k === "word" || (t.k === "gram" && t.r) ? ruby(t.s, t.r) : esc(t.s);
    return `<span class="w ${cls}" tabindex="0" role="button" data-t="${tokRef(t)}">${inner}</span>`;
  }).join("");
}

/* Кликабельное слово словаря по id (для списков вне текста). */
export function wordChip(id, cls = "") {
  const e = D.dict.words[id];
  const t = { k: "word", s: id, lemma: id, r: e?.r, e, err: e ? null : "нет в словаре" };
  return `<span class="w word ${cls}" tabindex="0" role="button" data-t="${tokRef(t)}">${esc(id)}</span>`;
}

export const textBlock = (lines, cls = "") =>
  `<p class="jtext ${cls}">${lines.map(renderLine).join("")}</p>`;

/* Перевод абзаца или реплики: скрыт, пока не нажата кнопка «Перевод» (класс show-tr на body). */
export const trLine = s => s ? `<p class="tr">${esc(s)}</p>` : "";

export const legend = `<div class="legend"><span><i style="background:var(--accent-soft)"></i>слово</span><span><i style="background:var(--sunk)"></i>частица</span><span><i style="background:var(--gram-soft)"></i>грамматика</span><span class="muted">нажми на любое</span></div>`;

export function banner({ h1, ru, jpLead, vert, eyebrow, slim = true, seed = 11, tag }) {
  return `<section class="sky ${slim ? "slim" : ""}"><canvas data-seed="${seed}" aria-hidden="true"></canvas>
    <div class="sky-inner"><div class="sky-text">
      <div class="eyebrow"><span class="dot"></span>${esc(eyebrow)}</div>
      <h1>${esc(h1)}</h1>
      <p class="lead">${jpLead ? `<span class="jp">${esc(jpLead)}</span>` : ""}${esc(ru)}</p>
      <div class="rule"></div></div>
      <div class="sky-side">${tag ? `<span class="tag">${tag}</span>` : ""}${vert ? `<div class="vert">${esc(vert)}</div>` : ""}</div>
    </div></section>`;
}

/* Карточка конструкции (справочник «Грамматика» и шаг урока). */
export function gramCardHTML(id, g, extra = "") {
  return `<article class="gcard c-6" id="g-${esc(id)}">
    <div class="row between"><span class="pat">${esc(g.pat)}</span>${g.unit ? `<a class="chip learn" href="#course/${g.unit}">юнит ${g.unit}</a>` : ""}</div>
    <dl><dt>Значение</dt><dd><b>${esc(g.m)}</b></dd><dt>Форма</dt><dd>${esc(g.form)}</dd><dt>Нюанс</dt><dd>${esc(g.nuance)}</dd>
    ${g.cmp?.length ? `<dt>Не путать</dt><dd>${g.cmp.map(c => `${c.g && D.grammar[c.g] ? `<a href="#grammar/${esc(c.g)}" class="jp">${esc(D.grammar[c.g].pat)}</a>` : `<span class="jp">${esc(c.pat || c.g)}</span>`} — ${esc(c.note)}`).join("<br>")}</dd>` : ""}</dl>
    ${(g.ex || []).map(s => `<div class="ex">${textBlock([s], "sm")}</div>`).join("")}${extra}
  </article>`;
}
