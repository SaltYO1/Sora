/* Задания с одним ответом: выбор из вариантов (грамматика) или ввод (слова).
   task: {label, mode:"choice"|"type", prompt (html), hint, answers[], options[], why, back (html), jp, ru, cols?, labels?}
   bare — варианты без фуриганы (узнать слово по кандзи); contest — после ошибки можно засчитать свой вариант; cols — варианты-предложения столбиком (言い換え, «найди кальку»); labels — html кнопки по тексту варианта (фуригана).
   runQuiz — показывает задания по одному, итог в конце. Используется в уроке (грамматика, упражнения) и в играх. */
import { D } from "./data.js";
import { parse, resolve } from "./markup.js";
import { esc, renderTokens, optHTML } from "./render.js";
import { check } from "./cards.js";

export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* Прокрутка: верх задания должен быть виден (под шапкой), кнопка «Дальше» — в пределах экрана. */
const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
const headH = () => { const t = document.querySelector(".topbar"); return t && getComputedStyle(t).position === "sticky" ? t.getBoundingClientRect().bottom : 0; };
export function showTop(el) {
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  if (top < headH() + 4 || top > innerHeight * .6) scrollTo({ top: scrollY + top - headH() - 12, behavior: motion() });
}
export function showBottom(el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom > innerHeight - 12) scrollTo({ top: scrollY + r.bottom - innerHeight + 24, behavior: motion() });
}

/* Задание на конструкцию из предложения банка. line — исходная разметка (для «Моих пробелов» и игр). */
export function grammarTask(gid, item) {
  const toks = resolve(parse(item.jp), D.dict, D.grammar), i = toks.findIndex(t => t.k === "gram" && t.g === gid);
  const ans = toks[i].s, choice = item.opts?.length > 0;
  return {
    label: choice ? "Выбери конструкцию" : "Вставь конструкцию", mode: choice ? "choice" : "type",
    prompt: `<p class="jtext sm">${renderTokens(toks, i)}</p>`, hint: item.ru || "",
    answers: [ans, ...(item.alt || [])], options: choice ? shuffle([ans, ...item.opts]) : [],
    why: item.why || "", back: `<p class="jtext sm">${renderTokens(toks)}</p>`, jp: ans, ru: item.ru || "", gid, line: item.jp,
  };
}

export const optClass = o => [...o].length > 1 ? "opt txt jp" : "opt jp";

export function runQuiz(root, tasks, { onMiss, onHit, onRestart, onDone, doneText = "おつかれさま！" } = {}) {
  const S = { i: 0, ok: 0, miss: [], answered: false };
  root.innerHTML = `<div class="row between"><span class="chip learn" data-q="label">…</span>
      <span class="muted small">задание <b data-q="pos">1</b> из <b>${tasks.length}</b> · верно <b data-q="ok">0</b></span></div>
    <div class="rv-body" data-q="body"></div>`;
  const q = k => root.querySelector(`[data-q="${k}"]`);

  const show = () => {
    const body = q("body");
    q("ok").textContent = S.ok;
    if (S.i > 0) showTop(root);
    if (S.i >= tasks.length) {
      q("label").textContent = "Итог";
      body.innerHTML = `<div class="rv-done"><div class="q-jp jp">${S.ok === tasks.length ? "完璧！" : esc(doneText)}</div>
        <p>Верно: <b>${S.ok}</b> из ${tasks.length}.</p>
        ${S.miss.length ? `<div class="misses">${S.miss.map(m => `<div class="noterow"><span class="jp ja">${esc(m.jp)}</span><span class="ru">${esc(m.ru)}</span>${m.why ? `<span class="nn">${esc(m.why)}</span>` : ""}</div>`).join("")}</div>` : ""}
        ${onRestart ? `<button class="btn" data-q="again">Ещё раз</button>` : ""}</div>`;
      q("again") && (q("again").onclick = onRestart);
      onDone?.({ ok: S.ok, total: tasks.length, miss: S.miss });
      return;
    }
    const t = tasks[S.i]; S.answered = false;
    q("pos").textContent = S.i + 1; q("label").textContent = t.label;
    body.innerHTML = `<div class="rv-q">${t.prompt}</div>${t.hint ? `<p class="rv-hint">${esc(t.hint)}</p>` : ""}
      ${t.mode === "choice"
        ? `<div class="rv-opts${t.cols ? " cols" : ""}">${t.options.map((o, k) => `<button class="btn ${t.cols ? "opt line jp" : t.bare ? "opt txt jp" : optClass(o)}" data-opt="${esc(o)}">${t.cols ? `<span class="okey">${k + 1}</span><span>${t.labels?.[o] ?? optHTML(o)}</span>` : `<span>${[...o].length > 1 && !t.bare ? optHTML(o) : esc(o)}</span>`}</button>`).join("")}</div>`
        : `<form class="rv-form" data-q="form"><input class="search jp" lang="ja" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ответ по-японски" data-q="in">
            <div class="row"><button class="btn primary" type="submit">Проверить</button><button class="btn" type="button" data-q="skip">Не помню</button></div></form>`}
      <div data-q="back"></div>`;
    if (t.mode === "choice") body.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => answer(b.dataset.opt));
    else {
      const inp = q("in"); inp.focus({ preventScroll: true });
      q("form").onsubmit = e => { e.preventDefault(); answer(inp.value); };
      q("skip").onclick = () => answer(null);
    }
  };

  const answer = async val => {
    if (S.answered) return; S.answered = true;
    const t = tasks[S.i], ok = val != null && check(val, t.answers);
    if (ok) { S.ok++; await onHit?.(t); } else { S.miss.push(t); await onMiss?.(t, val); }
    root.querySelectorAll("[data-opt], [data-q=form] input, [data-q=form] button").forEach(el => el.disabled = true);
    root.querySelectorAll("[data-opt]").forEach(b => { if (t.answers.includes(b.dataset.opt)) b.classList.add("right"); else if (b.dataset.opt === val) b.classList.add("wrong"); });
    q("back").innerHTML = `<p class="verdict ${ok ? "ok" : "bad"}">${ok ? "✓ Верно" : val && t.mode === "type" ? `✗ Твой ответ: <span class="jp">${esc(val)}</span> · верно: <span class="jp">${esc(t.answers[0])}</span>` : t.cols ? "✗ Не то" : `Верно: <span class="jp">${esc(t.answers[0])}</span>`}</p>
      <div class="rv-a">${t.back}${t.why ? `<p class="ans-n why">${esc(t.why)}</p>` : ""}</div>
      ${!ok && t.contest && val != null ? `<button class="linkbtn" data-q="contest" style="align-self:center">Мой вариант тоже подходит — засчитать</button>` : ""}
      <button class="btn primary big" data-q="next" style="align-self:center">${S.i + 1 < tasks.length ? "Дальше →" : "Итог"}</button>`;
    q("ok").textContent = S.ok;
    const nx = q("next"); nx.focus({ preventScroll: true }); showBottom(nx);
    nx.onclick = () => { S.i++; show(); };
    // автоматически подобранный вариант иногда тоже подходит по смыслу — засчитываем по честному слову
    const ct = q("contest");
    if (ct) ct.onclick = async () => {
      ct.remove(); S.ok++; S.miss.pop(); await onHit?.(t);
      q("ok").textContent = S.ok;
      const v = q("back").querySelector(".verdict"); v.className = "verdict ok"; v.textContent = "✓ Засчитано: твой вариант тоже подходит";
    };
  };
  // цифры 1–4 выбирают вариант-предложение (только пока этот блок на экране)
  const keys = e => {
    if (!root.isConnected) return removeEventListener("keydown", keys);
    if (S.answered || !/^[1-4]$/.test(e.key) || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const b = root.querySelectorAll(".rv-opts.cols [data-opt]")[+e.key - 1];
    if (b) { e.preventDefault(); b.click(); }
  };
  if (root._keys) removeEventListener("keydown", root._keys);
  root._keys = keys; addEventListener("keydown", keys);
  show();
}
