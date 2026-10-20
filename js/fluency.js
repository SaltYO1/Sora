/* Игры пакета 3 — беглость и выход (瞬発力). Поведение общее с играми (games.js передаёт помощники H).
     say   «Скажи быстро» (即答): русский смысл → скажи по-японски про себя за 6 секунд, открой и отметь себя
     reply «Ответь репликой» (相づち): сообщение друга → естественная реакция — units/NN.json → replies
     chat  «Ответь в чате» (返信): сообщение + что сказать → пишешь ответ сам, сверяешь с образцом — units/NN.json → chats
   H = {missGap(src, rec), fixGaps(match), saveResult(id, upd), doneHTML(title, line, misses, again)} */
import { D } from "./data.js";
import { parse, resolve, plain } from "./markup.js";
import { esc, ruby, renderLine, TOK } from "./render.js";
import { shuffle, showTop, showBottom } from "./quiz.js";
import { variants } from "./words.js";

export const SAY_SEC = 6, SAY_ROUND = 20, CHAT_SEC = 90, CHAT_ROUND = 5;
const meaning = e => [].concat(e.m).join("; ");
const plainOf = src => plain(parse(src));
const lineHTML = src => resolve(parse(src), D.dict, D.grammar).map(t => t.r && t.k !== "part" ? ruby(t.s, t.r) : esc(t.s)).join("");
const REG = { colloq: "разговорное", polite: "вежливое", formal: "официальное" };

/* ================= «Скажи быстро» ================= */
/* слова и реплики юнитов + «как не сказать» (notes: русская фраза → японская) */
export function sayPool(units) {
  const out = [], seen = new Set();
  for (const u of units) {
    for (const id of [...u.words, ...(u.phrases || [])]) {
      const e = D.dict.words[id]; if (!e || seen.has(id)) continue; seen.add(id);
      out.push({ key: `sb:${id}`, item: `w:${id}`, ru: meaning(e), jp: e.w || id, html: ruby(e.w || id, e.r), note: e.note || "", reg: e.reg });
    }
    (u.notes || []).forEach((n, i) => out.push({ key: `sb:${u.n}:${i}`, ru: n.ru, jp: n.jp, html: esc(n.jp), note: n.note || "", phrase: true }));
  }
  return out;
}

export function runSay(box, pool, sig, again, H) {
  const items = shuffle(pool).slice(0, SAY_ROUND);
  const S = { i: 0, fast: 0, slow: 0, miss: [], slowL: [], t0: 0, open: false, marked: false, iv: null };
  const stop = () => { clearInterval(S.iv); S.iv = null; };
  sig.addEventListener("abort", stop);
  const q = k => box.querySelector(`[data-s="${k}"]`);
  const next = () => {
    stop(); TOK.length = 0;
    if (S.i > 0) showTop(box);
    if (S.i >= items.length) {
      H.saveResult("say", r => ({ ...r, last: `${S.fast}/${items.length}`, best: Math.max(r.best || 0, S.fast) }));
      const list = [...S.miss, ...S.slowL];
      box.innerHTML = H.doneHTML(S.fast === items.length ? "完璧！" : "おつかれさま！",
        `<span class="say-sum"><span><b>${S.fast}</b> быстро</span><span><b>${S.slow}</b> медленно</span><span><b>${S.miss.length}</b> не вспомнил</span></span>`
        + (list.length ? `<br><span class="muted small">Ниже — что не успело всплыть за ${SAY_SEC} секунд.</span>` : ""), list);
      box.querySelector("[data-g=again]").onclick = again;
      return;
    }
    const x = items[S.i]; S.open = false; S.marked = false;
    box.innerHTML = `<div class="blitz-top on"><span class="chip learn">Скажи быстро</span><div class="tbar" data-s="bar" aria-hidden="true"><i></i></div>
        <span class="small muted"><b>${S.i + 1}</b> / ${items.length}</span></div>
      <div class="rv-body say">
        <div class="rv-q"><div class="q-ru">${esc(x.ru)}</div>
          <div class="say-meta">${x.phrase ? `<span class="chip">фраза</span>` : ""}${x.reg ? `<span class="chip">${esc(REG[x.reg] || x.reg)}</span>` : ""}</div></div>
        <p class="rv-hint" data-s="hint">Скажи по-японски вслух или про себя — и открой.</p>
        <button class="btn primary big" data-s="show" style="align-self:center">Показать<span class="kbd"> · Пробел</span></button>
        <div data-s="back"></div></div>`;
    const bar = q("bar");
    S.t0 = performance.now();
    S.iv = setInterval(() => {
      const left = 1 - (performance.now() - S.t0) / (SAY_SEC * 1000);
      bar.firstElementChild.style.transform = `scaleX(${Math.max(0, left)})`;
      bar.classList.toggle("low", left < .34);
      if (left <= 0) { stop(); if (!S.open) q("hint").textContent = "Время вышло — всё равно попробуй вспомнить."; }
    }, 100);
    q("show").onclick = () => reveal(x);
  };
  const reveal = x => {
    if (S.open) return; S.open = true;
    const ms = performance.now() - S.t0, late = ms > SAY_SEC * 1000; stop();
    q("show").remove(); q("hint").remove();
    q("back").innerHTML = `<div class="rv-a"><div class="ans-jp jp">${x.html}</div>${x.note ? `<p class="ans-n">${esc(x.note)}</p>` : ""}
        <p class="muted small" style="margin:0">${late ? "открыто после таймера" : `${(ms / 1000).toFixed(1)} с`}</p></div>
      <div class="row say-grade"><button class="btn primary" data-s="yes">✓ Вспомнил<span class="kbd"> · 1</span></button><button class="btn" data-s="no">✗ Не вспомнил<span class="kbd"> · 2</span></button></div>`;
    const yes = q("yes"); yes.focus({ preventScroll: true }); showBottom(yes);
    yes.onclick = () => mark(x, true, late);
    q("no").onclick = () => mark(x, false, late);
  };
  const mark = async (x, ok, late) => {
    if (S.marked) return; S.marked = true;
    const row = { jp: x.jp, ru: x.ru, why: x.note };
    if (ok && !late) { S.fast++; await H.fixGaps(g => g.key === x.key); }
    else if (ok) { S.slow++; S.slowL.push({ ...row, why: "вспомнилось медленно" }); }
    else { S.miss.push(row); await H.missGap("say", { key: x.key, ...(x.item ? { item: x.item } : {}), jp: x.jp, ru: x.ru, said: "", note: "Скажи быстро" }); }
    S.i++; next();
  };
  addEventListener("keydown", e => {
    if (!box.isConnected || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.key === " " || e.key === "Enter") && q("show")) { e.preventDefault(); q("show").click(); return; }
    if (e.key === "1" && q("yes")) { e.preventDefault(); q("yes").click(); }
    if (e.key === "2" && q("no")) { e.preventDefault(); q("no").click(); }
  }, { signal: sig });
  next();
}

/* ================= «Ответь репликой» ================= */
export function replyTask(it) {
  const opts = [it.ok, ...it.bad], labels = Object.fromEntries(opts.map(s => [plainOf(s), lineHTML(s)]));
  return { label: "Ответь репликой", mode: "choice", cols: true, key: it.key,
    prompt: `<div class="msgr chat-in"><div class="bubble you"><span class="who">${esc(it.from || "")}</span><p class="jtext sm">${renderLine(it.jp)}</p></div></div>`,
    hint: "Как естественно отреагировать?",
    options: shuffle(opts.map(plainOf)), labels, answers: [plainOf(it.ok)], why: it.why,
    back: variants(it.ok, it.bad), jp: plainOf(it.ok), ru: `на «${plainOf(it.jp)}»` };
}

/* ================= «Ответь в чате» ================= */
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export function runChat(box, pool, sig, again, H) {
  const items = shuffle(pool).slice(0, CHAT_ROUND);
  const S = { i: 0, wrote: 0, good: 0, miss: [], iv: null };
  const stop = () => { clearInterval(S.iv); S.iv = null; };
  sig.addEventListener("abort", stop);
  const q = k => box.querySelector(`[data-c="${k}"]`);
  // телефон: панель с кнопками держится над экранной клавиатурой (--kb — сколько экрана она закрыла)
  const vv = window.visualViewport;
  if (vv && !box._kb) {
    box._kb = true;
    const kb = () => box.style.setProperty("--kb", `${Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`);
    vv.addEventListener("resize", kb, { signal: sig }); vv.addEventListener("scroll", kb, { signal: sig });
    sig.addEventListener("abort", () => { box._kb = false; });
    kb();
  }
  const next = () => {
    stop(); TOK.length = 0;
    if (S.i > 0) showTop(box);
    if (S.i >= items.length) {
      H.saveResult("chat", r => ({ ...r, last: `${S.good}/${items.length}` }));
      box.innerHTML = H.doneHTML("おつかれさま！", `Написано: <b>${S.wrote}</b> из ${items.length} · получилось: <b>${S.good}</b>.`, S.miss, "Ещё ситуации");
      box.querySelector("[data-g=again]").onclick = again;
      return;
    }
    const x = items[S.i], gs = (x.use || []).filter(g => D.grammar[g]);
    box.innerHTML = `<div class="row between"><span class="chip learn">Ответь в чате</span>
        <span class="muted small">ситуация <b>${S.i + 1}</b> из <b>${items.length}</b> · <span class="chat-clock" data-c="clock">${fmt(CHAT_SEC)}</span></span></div>
      <div class="rv-body">
        <div class="chat-task"><span class="q-to">${esc(x.to)}</span>${x.reg ? `<span class="chip">${esc(x.reg)}</span>` : ""}</div>
        <p class="chat-ru">${esc(x.ru)}</p>
        ${gs.length ? `<div class="usechips">${gs.map(g => `<span class="usechip" data-g="${esc(g)}">${esc(D.grammar[g].pat)}</span>`).join("")}</div>` : ""}
        ${x.incoming ? `<div class="msgr">
            <div class="bubble you"><span class="who">${esc(x.incoming.from || "")}</span><p class="jtext sm">${renderLine(x.incoming.jp)}</p></div>
            <div class="reply"><textarea class="outtext jp" data-c="in" lang="ja" rows="3" placeholder="返信を書く…"></textarea></div></div>`
          : `<div class="diary"><p class="diary-h jtext sm">${renderLine(x.heading || "")}</p>
            <textarea class="outtext jp" data-c="in" lang="ja" rows="4" placeholder="ここに書く…"></textarea></div>`}
        <div class="chat-actions"><button class="btn" data-c="give">Не знаю<span class="lg"> — показать</span></button><button class="btn primary" data-c="cmp" disabled><span>Сравнить<span class="lg"> с образцом</span></span><span class="kbd"> · Ctrl+Enter</span><span class="send" aria-hidden="true">↑</span></button></div>
        <div data-c="back"></div></div>`;
    const ta = q("in"), chips = [...box.querySelectorAll(".usechip")];
    const detect = () => chips.forEach(c => c.classList.toggle("on", (D.grammar[c.dataset.g].detect || []).some(p => ta.value.includes(p))));
    ta.oninput = () => { detect(); q("cmp").disabled = !ta.value.trim(); };
    ta.focus({ preventScroll: true });
    // мягкий таймер: время вышло — просто напоминание, писать можно дальше
    const t0 = Date.now();
    S.iv = setInterval(() => {
      const left = CHAT_SEC - Math.floor((Date.now() - t0) / 1000), el = q("clock"); if (!el) return stop();
      el.textContent = left > 0 ? fmt(left) : "время вышло — допиши и сравни";
      el.classList.toggle("low", left <= 15);
      if (left <= 0) stop();
    }, 500);
    const compare = give => {
      stop(); const said = ta.value.trim();
      ta.readOnly = true; box.querySelector(".chat-actions").remove();
      const usedAll = chips.every(c => c.classList.contains("on"));
      if (said) S.wrote++;
      q("back").innerHTML = `<p class="verdict${said && (!chips.length || usedAll) ? " ok" : ""}">${said ? (chips.length && !usedAll ? "Нужная конструкция у тебя не нашлась — сравни с образцом:" : "✓ Конструкция на месте — сравни с образцом:") : "Как можно ответить:"}</p>
        <div class="rv-a"><div class="var ok"><span class="vm" aria-hidden="true">例</span><p class="jtext sm">${renderLine(x.model)}</p></div>
          ${gs.map(g => `<p class="ans-n"><a href="#grammar/${esc(g)}" class="jp">${esc(D.grammar[g].pat)}</a> — ${esc(D.grammar[g].m)}</p>`).join("")}
          <p class="muted small" style="margin:0">Образец — один из вариантов. Свой ответ засчитывай, если смысл и регистр те же и конструкция на месте.</p></div>
        ${said ? `<div class="row say-grade"><button class="btn primary" data-c="yes">✓ Получилось<span class="kbd"> · 1</span></button><button class="btn" data-c="no">Надо повторить<span class="kbd"> · 2</span></button></div>`
          : `<button class="btn primary big" data-c="no" style="align-self:center">Дальше →</button>`}`;
      const first = q("yes") || q("no"); first.focus({ preventScroll: true }); showBottom(first);
      const row = { jp: plainOf(x.model), ru: x.ru, why: "" };
      const done = async ok => {
        if (ok) { S.good++; await H.fixGaps(g => g.key === x.key); }
        else { S.miss.push(row); await H.missGap("chat", { key: x.key, ...(gs[0] ? { g: gs[0] } : {}), jp: row.jp, ru: x.ru, said, note: "Ответь в чате" }); }
        S.i++; next();
      };
      q("yes") && (q("yes").onclick = () => done(true));
      q("no").onclick = () => done(false);
    };
    q("cmp").onclick = () => compare(false);
    q("give").onclick = () => compare(true);
  };
  addEventListener("keydown", e => {
    if (!box.isConnected) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && q("cmp") && !q("cmp").disabled) { e.preventDefault(); q("cmp").click(); return; }
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "1" && q("yes")) { e.preventDefault(); q("yes").click(); }
    if (e.key === "2" && q("no")) { e.preventDefault(); q("no").click(); }
  }, { signal: sig });
  next();
}
