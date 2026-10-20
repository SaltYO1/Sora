/* Юнит: обзор (#course/N) и ход урока (#course/N/шаг).
   Шаги: слова → грамматика → кандзи → тексты → упражнения → письмо.
   Прогресс шагов и черновики письма — в kv `unit:N`. */
import { D, unitFile, bank } from "./data.js";
import { db } from "./db.js";
import { esc, ruby, banner, textBlock, legend, renderLine, renderTokens, wordChip, gramCardHTML, trLine } from "./render.js";
import { sync, corpus, clozeHint, SPEAKER } from "./cards.js";
import { runQuiz, grammarTask, shuffle } from "./quiz.js";

const $ = s => document.querySelector(s);
export const STEPS = [
  { id: "words", ru: "Слова", jp: "語彙", ic: "語" },
  { id: "grammar", ru: "Грамматика", jp: "文法", ic: "文" },
  { id: "kanji", ru: "Кандзи", jp: "漢字", ic: "漢" },
  { id: "texts", ru: "Тексты", jp: "読解", ic: "読" },
  { id: "drill", ru: "Упражнения", jp: "練習", ic: "練" },
  { id: "output", ru: "Письмо", jp: "作文", ic: "書" },
];
const DRILL_SIZE = 10, CHOOSE_SIZE = 8;

export async function unitProgress(n) { return (await db.getKV(`unit:${n}`)) || { done: {} }; }
async function saveProgress(n, p) { await db.setKV(`unit:${n}`, p); }
async function markDone(n, step) { const p = await unitProgress(n); p.done[step] = Date.now(); await saveProgress(n, p); }

const entry = id => D.dict.words[id];
const meaning = e => e.m.join("; ");
const outputTasks = u => u.output?.tasks || (u.output?.prompt ? [{ title: "Задание", situation: u.output.prompt, plan: [], use: u.output.use || [], models: u.output.models || [] }] : []);

/* все элементы юнита для «в карточки» */
const unitItems = u => [...u.words.map(r => ["word", r]), ...(u.phrases || []).map(r => ["word", r]), ...u.grammar.filter(g => D.grammar[g]).map(r => ["grammar", r])];
async function inCardsCount(u) {
  const items = new Map((await db.all("items")).map(i => [i.id, i]));
  return unitItems(u).filter(([k, r]) => { const i = items.get(`${k[0]}:${r}`); return i && !i.suspended; }).length;
}

/* предложения банков юнита → задания на выбор; минимум одно на каждую конструкцию */
async function grammarTasks(u, size) {
  const per = [];
  for (const gid of u.grammar) { const b = await bank(gid); if (b?.items.length) per.push(shuffle(b.items).map(it => grammarTask(gid, it))); }
  const out = per.map(l => l.shift()).filter(Boolean);
  const rest = shuffle(per.flat());
  while (out.length < size && rest.length) out.push(rest.shift());
  return shuffle(out).slice(0, size);
}

/* Кнопки над текстом: фуригана и перевод (работают через app.js, состояние запоминается). */
export const textTools = (hasTr = true) => `<button class="btn rdFuri">Фуригана</button>${hasTr ? `<button class="btn rdTr">Перевод</button>` : ""}`;

/* ================= HTML ================= */
export async function unitHTML(n, step) {
  const meta = D.units.find(x => x.n === n);
  if (!meta) return `<div class="empty">Юнит не найден</div>`;
  const u = await unitFile(n);
  if (!u) return planView(meta);
  const prog = await unitProgress(n);
  if (!step || !STEPS.some(s => s.id === step)) return overview(meta, u, prog);
  const i = STEPS.findIndex(s => s.id === step), s = STEPS[i];
  const body = await STEP_HTML[step](u, prog);
  return `${stepBar(n, step, prog)}
    <section class="unit-head"><span class="eyebrow"><span class="dot"></span>Юнит ${n} · ${esc(u.title)}</span>
      <h1><span class="jp">${esc(s.jp)}</span> ${esc(s.ru)}</h1></section>
    ${body}
    <nav class="step-nav">
      ${i > 0 ? `<a class="btn" href="#course/${n}/${STEPS[i - 1].id}">← ${esc(STEPS[i - 1].ru)}</a>` : `<a class="btn" href="#course/${n}">← К юниту</a>`}
      <button class="btn primary big" id="stepDone" data-next="${i < STEPS.length - 1 ? STEPS[i + 1].id : ""}">${i < STEPS.length - 1 ? `Готово · дальше: ${esc(STEPS[i + 1].ru)} →` : "Завершить урок ✓"}</button>
    </nav>`;
}

function stepBar(n, cur, prog) {
  return `<nav class="stepbar" aria-label="Шаги урока">${STEPS.map(s => `<a href="#course/${n}/${s.id}" class="${s.id === cur ? "cur" : ""} ${prog.done[s.id] ? "done" : ""}" ${s.id === cur ? 'aria-current="step"' : ""}>
    <span class="ic jp">${prog.done[s.id] ? "✓" : esc(s.ic)}</span><span>${esc(s.ru)}</span></a>`).join("")}</nav>`;
}

async function overview(meta, u, prog) {
  const counts = { words: u.words.length + (u.phrases?.length || 0), grammar: u.grammar.length, kanji: [...u.kanji].length, texts: u.texts.length, drill: DRILL_SIZE, output: outputTasks(u).length };
  const label = { words: "слов и фраз", grammar: "конструкций", kanji: "кандзи", texts: "текста", drill: "заданий", output: "ситуации" };
  const doneN = STEPS.filter(s => prog.done[s.id]).length;
  const next = STEPS.find(s => !prog.done[s.id]);
  const total = unitItems(u).length, inCards = await inCardsCount(u);
  return banner({ eyebrow: `${meta.blockTitle} · юнит ${u.n}`, h1: u.jp, jpLead: u.title, ru: "", vert: "話せるように。", seed: 7 + u.n * 3, tag: `UNIT<br>${String(u.n).padStart(2, "0")}` }) +
  `<div class="grid">
    <section class="card c-7"><h2>Ход урока <span class="jp">流れ</span><span class="sample">${doneN}/${STEPS.length}</span></h2>
      ${u.intro ? `<p style="margin:0">${esc(u.intro)}</p>` : ""}
      <ol class="flow">${STEPS.map(s => `<li class="${prog.done[s.id] ? "done" : ""}"><a href="#course/${u.n}/${s.id}">
        <span class="n jp">${prog.done[s.id] ? "✓" : esc(s.ic)}</span><span class="t"><b>${esc(s.ru)}</b><small>${counts[s.id]} ${label[s.id]}</small></span></a></li>`).join("")}</ol>
      <a class="btn primary big" href="#course/${u.n}/${(next || STEPS[0]).id}">${doneN === 0 ? "Начать урок" : next ? `Продолжить: ${esc(next.ru)}` : "Пройти ещё раз"}</a>
    </section>
    <section class="card c-5"><h2>В карточки <span class="jp">復習へ</span></h2>
      <p style="margin:0">Слова, фразы и конструкции юнита — в общее повторение. Главные карточки (RU → JP) появятся сегодня же, без лимита. Кандзи добавятся сами.</p>
      <div class="stat"><b>${inCards}<small> / ${total}</small></b><span>уже в изучении</span></div>
      <button class="btn ${inCards < total ? "primary" : ""} big" id="addAll" ${inCards >= total ? "disabled" : ""}>${inCards >= total ? "✓ Всё в карточках" : "Всё из юнита в карточки"}</button>
      <span class="muted small" id="addAllMsg"></span>
    </section>
    <section class="card c-12"><h2>Кандзи юнита <span class="jp">漢字</span></h2>
      <p class="jp" style="margin:0;font-size:26px;letter-spacing:.14em">${esc(u.kanji)}</p>
      <a href="#course" class="small">← все юниты</a></section>
  </div>`;
}

function planView(meta) {
  return banner({ eyebrow: `${meta.blockTitle} · юнит ${meta.n}`, h1: meta.title, ru: "", vert: "話せるように。", seed: 7 + meta.n * 3, tag: `UNIT<br>${String(meta.n).padStart(2, "0")}` }) +
  `<div class="grid">
    <section class="card c-7"><h2>Грамматика <span class="jp">文法</span></h2><p class="muted" style="margin:0">${esc(meta.task)}</p><div class="glist">${meta.grammar.map(g => `<span>${esc(g)}</span>`).join("")}</div>
      ${meta.phrases ? `<h3>Фразы</h3><p class="jp" style="margin:0">${esc(meta.phrases)}</p>` : ""}
      <h3>Тексты</h3><ul class="plan">${meta.texts.map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>
    <section class="card c-5"><h2>Кандзи <span class="jp">漢字</span></h2>
      <p class="jp" style="margin:0;font-size:26px;letter-spacing:.14em">${esc(meta.kanji)}</p>
      <span class="stage"><span class="dot" style="background:var(--sun)"></span>Юнит ещё не наполнен</span></section>
  </div><a href="#course" class="small">← все юниты</a>`;
}

const STEP_HTML = {
  async words(u) {
    const items = new Map((await db.all("items")).map(i => [i.id, i]));
    const card = id => {
      const e = entry(id); if (!e) return "";
      const it = items.get(`w:${id}`), st = it ? (it.suspended ? `<span class="chip">убрано</span>` : `<span class="chip learn">в карточках</span>`) : "";
      return `<div class="vcard" tabindex="0"><div class="top"><span class="hideable">${wordChip(id, "k")}</span>${st}</div>
        <span class="r hideable">${e.r !== id ? esc(e.r) : "&nbsp;"}</span><span class="m">${esc(meaning(e))}${e.reg ? ` <span class="chip reg">${esc(e.reg === "colloq" ? "разг." : e.reg)}</span>` : ""}</span>
        ${e.note ? `<span class="note">${esc(e.note)}</span>` : ""}
        ${e.col?.length ? `<span class="ex hideable">${esc(e.col.join(" · "))}</span>` : ""}</div>`;
    };
    const phrases = u.phrases || [], cols = phrases.filter(id => entry(id)?.pos !== "phrase"), lines = phrases.filter(id => entry(id)?.pos === "phrase");
    return `<section class="card">
      <div class="row between"><h2>Слова <span class="jp">単語</span></h2>
        <div class="row"><button class="btn" id="hideJp" aria-pressed="false">Проверь себя: скрыть японский</button></div></div>
      <div class="vlist" id="wordList">${u.words.map(card).join("")}</div>
      ${cols.length ? `<h2>Коллокации <span class="jp">組み合わせ</span></h2><div class="vlist">${cols.map(card).join("")}</div>` : ""}
      ${lines.length ? `<h2>Живые реплики <span class="jp">あいづち</span></h2><div class="vlist">${lines.map(card).join("")}</div>` : ""}
      <p class="muted small" style="margin:0">Нажми на слово — подсказка с кандзи и кнопкой «＋ в карточки». В режиме проверки нажми на карточку, чтобы открыть японский.</p>
    </section>
    ${u.notes?.length ? `<section class="card"><h2>По-русски думаем так → японец скажет так <span class="jp">直訳しない</span></h2>
      <div class="notes">${u.notes.map(x => `<div class="noterow"><span class="ru">${esc(x.ru)}</span><span class="jp ja">${esc(x.jp)}</span><span class="nn">${esc(x.note)}</span></div>`).join("")}</div></section>` : ""}`;
  },

  async grammar(u) {
    const blocks = u.grammar.map(gid => {
      const g = D.grammar[gid];
      if (!g) return `<article class="gcard c-6"><span class="pat">${esc(gid)}</span><p class="muted">Разбор ещё не написан.</p></article>`;
      const pairs = (g.pairs || []).length ? `<div class="pairs"><h3>Почувствуй разницу</h3>${g.pairs.map(p => `<div class="pair">
          <div class="pa">${textBlock([p.a], "sm")}<span class="pr">${esc(p.ar)}</span></div>
          <div class="pa">${textBlock([p.b], "sm")}<span class="pr">${esc(p.br)}</span></div></div>`).join("")}</div>` : "";
      return gramCardHTML(gid, g, pairs + `<div class="row"><button class="btn" data-addg="${esc(gid)}">＋ в карточки</button></div>`);
    });
    return `<div class="grid">${blocks.join("")}</div>
      <section class="card"><h2>Выбери конструкцию <span class="jp">どれが合う？</span></h2>
        <p class="muted small" style="margin:0">Смысл дан по-русски — выбери конструкцию юнита, которая его передаёт. После ответа — почему не подходят остальные.</p>
        <div class="review quizbox" id="choose"><div class="loading">読み込み中…</div></div></section>`;
  },

  async kanji(u) {
    const unitWords = new Set([...u.words, ...(u.phrases || [])]);
    return `<section class="card"><p class="muted small" style="margin:0">Только узнавание и чтение. Сначала слова этого юнита, потом другие из словаря.</p>
      <div class="klist">${[...u.kanji].map(ch => {
        const k = D.kanji[ch]; if (!k) return `<div class="kcard"><span class="big">${esc(ch)}</span><span class="m muted">описание позже</span></div>`;
        const ws = (D.kanjiWords[ch] || []).sort((a, b) => unitWords.has(b) - unitWords.has(a));
        return `<div class="kcard" id="k-${esc(ch)}"><span class="big">${esc(ch)}</span><span class="m">${esc(k.m)}</span>
          <span class="rd">${esc(k.on.join("、"))}</span><span class="rd">${esc(k.kun.join("、"))}</span>
          ${ws.length ? `<div class="ws">${ws.map(id => wordChip(id, unitWords.has(id) ? "mine" : "")).join("")}</div>` : ""}</div>`;
      }).join("")}</div></section>`;
  },

  async texts(u) {
    return u.texts.map(t => {
      const chat = t.genre === "чат", tr = t.tr || [];
      const first = (SPEAKER.exec(t.paras[0]?.[0] || "") || [""])[0].slice(0, -1);
      const body = chat ? `<div class="chat">${t.paras.map((p, pi) => p.map((line, li) => {
          const m = SPEAKER.exec(line), who = m ? m[0].slice(0, -1) : "", src = m ? line.slice(m[0].length) : line;
          return `<div class="bubble ${who && who === first ? "me" : "you"}">${who ? `<span class="who">${esc(who)}</span>` : ""}<p class="jtext sm">${renderLine(src)}</p>${li === p.length - 1 ? trLine(tr[pi]) : ""}</div>`;
        }).join("")).join("")}</div>`
        : t.paras.map((p, pi) => `<p class="jtext para">${p.map(renderLine).join("")}</p>${trLine(tr[pi])}`).join("");
      return `<section class="card"><div class="row between"><h2><span class="ttl jp">${esc(t.title)}</span> <span class="jp">${esc(t.ru)}</span></h2>
        <div class="row"><span class="chip">${esc(t.genre)}</span>${textTools(tr.length > 0)}</div></div>
        ${body}${legend}</section>`;
    }).join("");
  },

  async drill() {
    return `<section class="card"><div class="review quizbox" id="drill"><div class="loading">読み込み中…</div></div>
      <p class="muted small drill-note">Тренировка: грамматика — выбором, слова — вводом. Расписание карточек она не трогает, ошибки попадают в «Мои пробелы».</p></section>`;
  },

  async output(u, prog) {
    const tasks = outputTasks(u); if (!tasks.length) return `<p class="empty">Задание на письмо ещё не написано.</p>`;
    const cur = Math.min(prog.outTask || 0, tasks.length - 1), t = tasks[cur];
    const drafts = prog.drafts || {};
    return `<div class="sitpick" role="tablist">${tasks.map((x, i) => `<button class="sit ${i === cur ? "on" : ""}" role="tab" aria-selected="${i === cur}" data-sit="${i}">
        <b>${esc(x.title)}</b><small>${esc(x.reg || "")}</small>${drafts[i]?.trim() ? `<span class="chip learn">черновик</span>` : ""}</button>`).join("")}</div>
    <section class="card"><h2>${esc(t.title)} <span class="jp">場面</span>${t.reg ? `<span class="chip reg">${esc(t.reg)}</span>` : ""}</h2>
      <p class="situation">${esc(t.situation)}</p>
      ${t.plan?.length ? `<div><h3>Что сказать</h3><ol class="plan-list">${t.plan.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>` : ""}
      <div class="usechips" id="useChips">${(t.use || []).map(g => D.grammar[g] ? `<span class="usechip" data-g="${esc(g)}">${esc(D.grammar[g].pat)}</span>` : "").join("")}</div>
      ${t.incoming ? `<div class="msgr">
          <div class="bubble you"><span class="who">${esc(t.incoming.from || "")}</span><p class="jtext sm">${renderLine(t.incoming.jp)}</p></div>
          <div class="reply"><textarea id="outText" class="outtext jp" lang="ja" rows="6" placeholder="返信を書く…" data-task="${cur}">${esc(drafts[cur] ?? "")}</textarea></div>
        </div>`
      : t.heading ? `<div class="diary"><p class="diary-h jtext sm">${renderLine(t.heading)}</p>
          <textarea id="outText" class="outtext jp" lang="ja" rows="7" placeholder="今日は…" data-task="${cur}">${esc(drafts[cur] ?? "")}</textarea></div>`
      : `<textarea id="outText" class="outtext jp" lang="ja" rows="7" placeholder="ここに書いてください…" data-task="${cur}">${esc(drafts[cur] ?? "")}</textarea>`}
      <div class="row between"><span class="muted small" id="outMsg">Черновик сохраняется сам.</span>
        <button class="btn primary" id="showModels">Сравнить с образцом</button></div>
    </section>
    <section class="card" id="models" hidden><h2>Как написал бы носитель <span class="jp">お手本</span></h2>
      ${(t.models || []).map(m => `<div class="model">${textBlock([m], "sm")}</div>`).join("")}
      ${legend}
      <p class="muted small" style="margin:0">Сравни по пунктам плана: что сказал так же, что получилось иначе, какие слова стоит забрать себе — их можно отправить в карточки прямо отсюда.</p>
    </section>`;
  },
};

/* ================= поведение ================= */
export async function mountUnit(n, step) {
  const curStep = document.querySelector(".stepbar a.cur");
  if (curStep) { const bar = curStep.parentElement; bar.scrollLeft = curStep.offsetLeft - (bar.clientWidth - curStep.offsetWidth) / 2; }
  const addAll = $("#addAll");
  if (addAll) addAll.onclick = async () => {
    const u = await unitFile(n);
    addAll.disabled = true;
    for (const [k, r] of unitItems(u)) {
      const it = await db.get("items", `${k[0]}:${r}`);
      if (!it || it.suspended || !(it.decks || []).includes(`unit:${n}`)) await db.addItem(k, r, `unit:${n}`);
    }
    await sync();
    addAll.textContent = "✓ Всё в карточках"; addAll.classList.remove("primary");
    $("#addAllMsg").innerHTML = `Главные карточки уже ждут: <a href="#cards/review">начать повторение</a>`;
  };
  const done = $("#stepDone");
  if (done) done.onclick = async () => {
    await markDone(n, step);
    location.hash = done.dataset.next ? `course/${n}/${done.dataset.next}` : `course/${n}`;
  };
  const u = await unitFile(n); if (!u) return;
  const miss = async (t, val) => db.put("gaps", { at: Date.now(), kind: "miss", src: `unit:${n}`, jp: t.jp, ru: t.ru, said: val || "", note: t.label, ...(t.gid ? { g: t.gid, line: t.line } : {}) });

  if (step === "words") {
    const b = $("#hideJp");
    b.onclick = () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      document.querySelectorAll(".vlist").forEach(l => l.classList.toggle("hide-jp", on));
      document.querySelectorAll(".vcard.open").forEach(c => c.classList.remove("open"));
    };
    document.querySelectorAll(".vlist").forEach(l => l.addEventListener("click", e => {
      if (!l.classList.contains("hide-jp")) return;
      const c = e.target.closest(".vcard");
      if (c && !c.classList.contains("open")) { c.classList.add("open"); e.stopPropagation(); e.preventDefault(); }
    }, true));
  }
  if (step === "grammar") {
    document.querySelectorAll("[data-addg]").forEach(b => b.onclick = async () => {
      await db.addItem("grammar", b.dataset.addg, `unit:${n}`); await sync();
      b.outerHTML = `<span class="chip learn">✓ в карточках</span>`;
    });
    for (const b of document.querySelectorAll("[data-addg]")) if (await db.hasItem("grammar", b.dataset.addg)) b.outerHTML = `<span class="chip learn">✓ в карточках</span>`;
    const start = async () => runQuiz($("#choose"), await grammarTasks(u, CHOOSE_SIZE), { onMiss: miss, onRestart: start });
    start();
  }
  if (step === "drill") {
    const start = async () => runQuiz($("#drill"), await drillTasks(u), { onMiss: miss, onRestart: start });
    start();
  }
  if (step === "output") mountOutput(n);
}

/* ---------- упражнения: грамматика выбором + слова вводом ---------- */
async function drillTasks(u) {
  const lines = await corpus();
  const tasks = await grammarTasks(u, u.grammar.length);
  const words = shuffle([...u.words, ...(u.phrases || [])]).filter(entry);
  for (const id of words) {
    if (tasks.length >= DRILL_SIZE) break;
    const e = entry(id);
    const ls = lines.filter(l => !l.from.startsWith("bank:") && l.toks.some(t => t.k === "word" && t.lemma === id && t.r));
    if (ls.length && Math.random() < .6) {
      const l = shuffle(ls)[0], i = l.toks.findIndex(t => t.k === "word" && t.lemma === id), t = l.toks[i];
      tasks.push({ label: "Вставь слово", mode: "type", prompt: `<p class="jtext sm">${renderTokens(l.toks, i)}</p>`, hint: clozeHint(e, t), answers: [t.s, t.r], back: `<p class="jtext sm">${renderTokens(l.toks)}</p>`, jp: t.s, ru: meaning(e) });
    } else {
      tasks.push({ label: "Скажи по-японски", mode: "type", prompt: `<div class="q-ru">${esc(meaning(e))}</div>`, hint: "", answers: [id, e.r], back: `<div class="ans-jp jp">${ruby(id, e.r)}</div>${e.note ? `<p class="ans-n">${esc(e.note)}</p>` : ""}`, jp: id, ru: meaning(e) });
    }
  }
  return shuffle(tasks).slice(0, DRILL_SIZE);
}

/* ---------- письмо ---------- */
async function mountOutput(n) {
  document.querySelectorAll("[data-sit]").forEach(b => b.onclick = async () => {
    const p = await unitProgress(n); p.outTask = +b.dataset.sit; await saveProgress(n, p);
    dispatchEvent(new HashChangeEvent("hashchange"));
  });
  const ta = $("#outText"); if (!ta) return;
  const chips = [...document.querySelectorAll(".usechip")];
  const detect = () => {
    const v = ta.value; let used = 0;
    chips.forEach(c => { const hit = (D.grammar[c.dataset.g].detect || []).some(p => v.includes(p)); c.classList.toggle("on", hit); used += hit; });
    $("#outMsg").textContent = v.trim() ? `Использовано конструкций: ${used} из ${chips.length}. Черновик сохранён.` : "Черновик сохраняется сам.";
  };
  let t = null;
  ta.oninput = () => {
    detect(); clearTimeout(t);
    t = setTimeout(async () => { const p = await unitProgress(n); p.drafts = { ...(p.drafts || {}), [ta.dataset.task]: ta.value }; await saveProgress(n, p); }, 400);
  };
  detect();
  $("#showModels").onclick = () => { $("#models").hidden = false; $("#models").scrollIntoView({ behavior: "smooth", block: "start" }); };
}
