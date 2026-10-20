/* Карточки: генерация из элементов знания (db.items), очередь на сегодня, лицевая сторона, проверка ответа.
   Типы:
     слово / коллокация — ru-jp (главная) · jp-ru · cloze (пропуск в предложении) · col (傘を＿ → さす)
     грамматика         — gap (пропуск, каждый раз новое предложение из банка и текстов)
     кандзи             — k-mean (значение + свои слова) · k-read (чтение слова, ввод) · k-sim (выбор среди похожих)
   Кандзи-элемент появляется сам, когда в изучении 2+ слова с этим кандзи.
   Сестринские карточки (одного элемента) не попадают на один день. */
import { D, json, bank, libText, unitFile } from "./data.js";
import { parse, resolve, hasKanji } from "./markup.js";
import { db } from "./db.js";
import { review as fsrsReview, DAY } from "./fsrs.js";
import { esc, ruby, renderTokens, wordChip } from "./render.js";

export const TYPES = {
  word: ["ru-jp", "jp-ru", "cloze", "col"],
  grammar: ["gap"],
  kanji: ["k-mean", "k-read", "k-sim"],
};
export const TYPE_LABEL = {
  "ru-jp": "Скажи по-японски", "jp-ru": "Что значит", "cloze": "Вставь слово", "col": "С чем сочетается",
  "gap": "Вставь грамматику", "k-mean": "Кандзи", "k-read": "Прочитай", "k-sim": "Какой кандзи",
};
const DEFAULT_NEW = 15;

/* ---------- время: сутки начинаются в 4:00 ---------- */
export function dayStart(now = Date.now()) {
  const d = new Date(now); d.setHours(4, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/* ---------- данные элемента ---------- */
export const entryOf = item => item.kind === "word" ? (D.dict.words[item.ref] || item.custom || null)
  : item.kind === "grammar" ? D.grammar[item.ref] || null : D.kanji[item.ref] || null;
const wordW = (id, e) => e?.w || id;

/* реплика чата «ゆい：…» → без имени говорящего (в пропусках и заданиях имя только мешает) */
export const SPEAKER = /^[^\[\(\{：]+：/;
export const stripSpeaker = s => s.replace(SPEAKER, "");

/* ---------- корпус предложений (тексты, примеры, банки) ---------- */
let corpusP = null;
export function corpus() {
  return corpusP ||= (async () => {
    const lines = [];
    const add = (src, from, ru) => lines.push({ src, from, ru, toks: resolve(parse(src), D.dict, D.grammar) });
    for (const t of D.library) { const doc = await libText(t.id); doc?.paras.flat().forEach(s => add(s, `text:${t.id}`)); }
    for (const u of D.units.filter(u => u.file)) { const doc = await unitFile(u.n); doc?.texts?.forEach(t => (t.paras || []).flat().forEach(s => add(stripSpeaker(s), `unit:${u.n}`))); }
    for (const [gid, g] of Object.entries(D.grammar)) {
      (g.ex || []).forEach(s => add(s, `ex:${gid}`));
      const b = await bank(gid); b?.items.forEach(it => add(it.jp, `bank:${gid}`, it.ru));
    }
    return lines;
  })();
}
const wordLines = (lines, id) => lines.filter(l => l.toks.some(t => t.k === "word" && t.lemma === id && t.r));
const gramLines = (lines, gid) => lines.filter(l => l.toks.some(t => t.k === "gram" && t.g === gid));

/* подсказка к пропуску: значение + что вписать (遅刻 → 遅刻する — «с する») */
export function clozeHint(e, t) {
  const m = [].concat(e.m).join("; ");
  if (t.s === t.lemma) return m;
  const vs = /vs/.test(e.pos || "") && t.s.startsWith(t.lemma) && /^(し|す|さ|せ)/.test(t.s.slice(t.lemma.length));
  return `${m} · ${vs ? "с する, в нужной форме" : "в нужной форме"}`;
}

/* коллокация «傘をさす» → {head:"傘を", tail:"さす", tailR:"さす"} */
function splitCol(id, e) {
  const w = wordW(id, e), m = /^(.+?)(を|が|に|で|と|へ)(.+)$/.exec(w);
  if (!m) return null;
  const [, noun, p, tail] = m;
  const nounR = D.dict.words[noun]?.r;
  let tailR = !hasKanji(tail) ? tail : null;
  if (!tailR && nounR && e.r.startsWith(nounR + p)) tailR = e.r.slice(nounR.length + 1);
  return { head: noun + p, tail, tailR };
}
const colsOf = (id, e) => e.pos === "col" ? [id] : (e.col || []).filter(c => D.dict.words[c]);

/* ---------- какие карточки возможны у элемента ---------- */
async function possibleTypes(item, ctx) {
  const e = entryOf(item); if (!e) return [];
  if (item.kind === "word") {
    const t = ["ru-jp", "jp-ru"];
    if (!item.custom && wordLines(ctx.lines, item.ref).length) t.push("cloze");
    if (!item.custom && colsOf(item.ref, e).some(c => splitCol(c, D.dict.words[c]))) t.push("col");
    return t;
  }
  if (item.kind === "grammar") return gramLines(ctx.lines, item.ref).length ? ["gap"] : [];
  const t = ["k-mean"];
  if (kanjiWords(item.ref, ctx.items).length) t.push("k-read");
  if (similarOf(item.ref).length) t.push("k-sim");
  return t;
}
const kanjiWords = (ch, items) => items.filter(i => i.kind === "word" && wordW(i.ref, entryOf(i)).includes(ch) && entryOf(i));
const similarOf = ch => (D.similar.find(g => g.includes(ch)) || []).filter(x => x !== ch);

/* Создать недостающие карточки (и кандзи-элементы). Идемпотентно. */
export async function sync() {
  let items = await db.all("items");
  // кандзи: 2+ слова в изучении
  const count = {};
  for (const i of items) if (i.kind === "word" && !i.suspended) for (const ch of new Set(wordW(i.ref, entryOf(i))))
    if (D.kanji[ch]) count[ch] = (count[ch] || 0) + 1;
  for (const [ch, n] of Object.entries(count)) if (n >= 2 && !items.some(i => i.id === `k:${ch}`)) {
    await db.put("items", { id: `k:${ch}`, kind: "kanji", ref: ch, decks: ["kanji"], added: Date.now(), auto: true });
  }
  items = await db.all("items");
  const cards = new Map((await db.all("cards")).map(c => [c.id, c]));
  const ctx = { lines: await corpus(), items };
  for (const item of items) for (const type of await possibleTypes(item, ctx)) {
    const id = `${item.id}|${type}`;
    if (!cards.has(id)) await db.put("cards", { id, item: item.id, type, state: "new", due: 0, reps: 0, lapses: 0, created: Date.now() });
  }
  return items;
}

/* ---------- что повторять: слова (с коллокациями и репликами), грамматика, кандзи ---------- */
export const KINDS = ["word", "grammar", "kanji"];
export async function getKinds() { const k = await db.getKV("kinds", KINDS); return k?.length ? k : KINDS; }
export const setKinds = k => db.setKV("kinds", k);
/* как отвечать в карточках: "self" — сказать про себя и перевернуть, "type" — ввести */
export const getAnswerMode = () => db.getKV("answerMode", "self");

/* ---------- очередь ---------- */
/* Фильтр видов (getKinds) действует на общую очередь; у отдельной колоды — всё, что в ней есть. */
export async function stats(deck = null, now = Date.now(), kinds = null) {
  const q = await queue(deck, now, true, kinds);
  return { due: q.due.length, fresh: q.fresh.length, total: q.total, today: q.doneToday };
}

export async function queue(deck = null, now = Date.now(), countOnly = false, kinds = null) {
  const ks = deck ? KINDS : kinds || await getKinds();
  const items = (await db.all("items")).filter(i => !i.suspended && ks.includes(i.kind) && (!deck || (i.decks || []).includes(deck)));
  const ids = new Set(items.map(i => i.id));
  const all = (await db.all("cards")).filter(c => ids.has(c.item) && !c.suspended);
  const start = dayStart(now);
  const order = c => TYPES[c.item[0] === "w" ? "word" : c.item[0] === "g" ? "grammar" : "kanji"].indexOf(c.type);
  const touched = new Map();       // элемент → карточка, которую уже повторяли сегодня
  for (const c of all) if (c.last >= start) touched.set(c.item, c.id);
  // главная карточка элемента из юнита выходит вне лимита (прошёл юнит утром — всё сразу в повторение)
  const allItems = new Map((await db.all("items")).map(i => [i.id, i]));
  const isMain = c => order(c) === 0 && (allItems.get(c.item)?.decks || []).some(d => d.startsWith("unit:"));
  const newToday = (await db.all("cards")).filter(c => c.firstAt >= start && !isMain(c)).length;
  const limit = await db.getKV("newPerDay", DEFAULT_NEW);

  const due = all.filter(c => c.state !== "new" && c.due <= now + (c.state === "review" ? 0 : 20 * 6e4)
      && (!touched.has(c.item) || touched.get(c.item) === c.id))
    .sort((a, b) => (a.state === "review") - (b.state === "review") || a.due - b.due)
    .filter((c, i, arr) => arr.findIndex(x => x.item === c.item) === i);   // одна карточка элемента в день
  const dueItems = new Set(due.map(c => c.item));

  const byItem = new Map();
  for (const c of all) (byItem.get(c.item) || byItem.set(c.item, []).get(c.item)).push(c);
  const fresh = [];
  for (const it of items.sort((a, b) => a.added - b.added)) {
    if (touched.has(it.id) || dueItems.has(it.id)) continue;
    const sib = (byItem.get(it.id) || []).sort((a, b) => order(a) - order(b));
    const cand = sib.find(c => c.state === "new");
    if (!cand) continue;
    const first = sib[0] === cand;
    if (first || sib.some(c => c.reps > 0 && c.last < start)) fresh.push(cand);
  }
  const main = fresh.filter(isMain), rest = fresh.filter(c => !isMain(c));
  const freshCut = [...main, ...rest.slice(0, Math.max(0, limit - newToday))];
  const doneToday = all.filter(c => c.last >= start).length;
  if (countOnly) return { due, fresh: freshCut, total: all.length, doneToday };
  // повторения, между ними новые (каждая третья)
  const out = [], d = [...due], f = [...freshCut];
  while (d.length || f.length) { out.push(...d.splice(0, 3)); if (f.length) out.push(f.shift()); }
  return out;
}

/* Записать ответ. Возвращает обновлённую карточку. */
export async function answer(card, grade, now = Date.now()) {
  const next = fsrsReview(card, grade, now);
  if (!card.firstAt) next.firstAt = now;
  if (next.lapses >= 4 && !card.leech) {
    next.leech = true;
    const item = await db.get("items", card.item), e = item && entryOf(item);
    await db.put("gaps", { at: now, item: card.item, card: card.id, kind: "leech",
      jp: e?.pat || (item ? wordW(item.ref, e) : card.item), ru: e?.m ? [].concat(e.m).join("; ") : "", note: "пиявка: 4+ провала" });
  }
  await db.put("cards", next);
  await db.put("reviews", { card: card.id, at: now, grade, state: card.state, ivl: next.ivl });
  return next;
}

/* ---------- лицевая сторона ---------- */
const pick = (arr, used) => {
  const fresh = arr.filter(x => !used.has(x.src || x));
  const pool = fresh.length ? fresh : arr;
  const x = pool[Math.floor(Math.random() * pool.length)];
  used.add(x.src || x); return x;
};
const meaning = e => [].concat(e.m).join("; ");

/* face: {label, prompt, hint, mode:"type"|"self"|"choice", answers, options, back} */
export async function face(card, used = new Set()) {
  const item = await db.get("items", card.item); const e = item && entryOf(item);
  if (!e) return null;
  const label = TYPE_LABEL[card.type];
  const lines = await corpus();

  if (item.kind === "word") {
    const id = item.ref, w = wordW(id, e);
    const back = `<div class="ans-jp jp">${ruby(w, e.r)}</div><div class="ans-m">${esc(meaning(e))}</div>${e.note ? `<p class="ans-n">${esc(e.note)}</p>` : ""}${e.col?.length ? `<p class="ans-n jp">${esc(e.col.join(" · "))}</p>` : ""}`;
    if (card.type === "ru-jp") return { label, mode: "type", prompt: `<div class="q-ru">${esc(meaning(e))}</div>`,
      hint: e.reg ? `регистр: ${e.reg}` : "", answers: [w, e.r], back };
    if (card.type === "jp-ru") return { label, mode: "self", prompt: `<div class="q-jp jp">${esc(w)}</div>`, hint: "", back };
    if (card.type === "cloze") {
      const l = pick(wordLines(lines, id), used); const i = l.toks.findIndex(t => t.k === "word" && t.lemma === id);
      const t = l.toks[i];
      return { label, mode: "type", prompt: `<p class="jtext sm">${renderTokens(l.toks, i)}</p>`,
        hint: clozeHint(e, t), answers: [t.s, t.r], back: `<p class="jtext sm">${renderTokens(l.toks)}</p>${back}` };
    }
    if (card.type === "col") {
      const c = pick(colsOf(id, e).filter(x => splitCol(x, D.dict.words[x])), used); const ce = D.dict.words[c], sp = splitCol(c, ce);
      return { label, mode: "type", prompt: `<div class="q-jp jp">${esc(sp.head)}<span class="gap">＿＿</span></div>`,
        hint: meaning(ce), answers: [sp.tail, sp.tailR].filter(Boolean), back: `<div class="ans-jp jp">${ruby(wordW(c, ce), ce.r)}</div><div class="ans-m">${esc(meaning(ce))}</div>` };
    }
  }

  if (item.kind === "grammar") {
    // предпочтительно предложения банка с вариантами — выбор из близких конструкций
    const b = await bank(item.ref), withOpts = (b?.items || []).filter(x => x.opts?.length);
    const info = `<div class="ans-jp jp">${esc(e.pat)}</div><div class="ans-m">${esc(e.m)}</div>`;
    if (withOpts.length) {
      const it = pick(withOpts.map(x => ({ ...x, src: x.jp })), used);
      const toks = resolve(parse(it.jp), D.dict, D.grammar), i = toks.findIndex(t => t.k === "gram" && t.g === item.ref), ans = toks[i].s;
      return { label: "Выбери конструкцию", mode: "choice", prompt: `<p class="jtext sm">${renderTokens(toks, i)}</p>`, hint: it.ru || "",
        options: [ans, ...it.opts].sort(() => Math.random() - .5), answers: [ans],
        back: `<p class="jtext sm">${renderTokens(toks)}</p>${it.why ? `<p class="ans-n why">${esc(it.why)}</p>` : ""}${info}` };
    }
    const l = pick(gramLines(lines, item.ref), used); const i = l.toks.findIndex(t => t.k === "gram" && t.g === item.ref);
    return { label, mode: "type", prompt: `<p class="jtext sm">${renderTokens(l.toks, i)}</p>`,
      hint: l.ru || "какая конструкция подходит по смыслу?", answers: [l.toks[i].s],
      back: `<p class="jtext sm">${renderTokens(l.toks)}</p>${info}${e.form ? `<p class="ans-n">Форма: ${esc(e.form)}</p>` : ""}` };
  }

  // кандзи
  const ch = item.ref, items = await db.all("items"), mine = kanjiWords(ch, items);
  const kInfo = `<div class="ans-m"><span class="jp">${esc(ch)}</span> — ${esc(e.m)}</div><p class="ans-n jp">${esc([...e.on, ...e.kun].join("、"))}</p>`;
  if (card.type === "k-mean") return { label, mode: "self", prompt: `<div class="q-kanji jp">${esc(ch)}</div>`,
    hint: "значение и 2–3 своих слова", back: kInfo + `<div class="ans-words">${mine.map(i => wordChip(i.ref)).join("")}</div>` };
  const wi = pick(mine, used), we = entryOf(wi), ww = wordW(wi.ref, we);
  if (card.type === "k-read") return { label, mode: "type", prompt: `<div class="q-jp jp">${esc(ww)}</div>`,
    hint: "чтение хираганой", answers: [we.r], back: `<div class="ans-jp jp">${ruby(ww, we.r)}</div><div class="ans-m">${esc(meaning(we))}</div>` };
  const opts = [ch, ...similarOf(ch)].sort(() => Math.random() - .5);
  return { label, mode: "choice", prompt: `<div class="q-jp jp">${esc(ww.replace(ch, "＿"))}</div><div class="q-sub jp">${esc(we.r)}</div>`,
    hint: meaning(we), options: opts, answers: [ch], back: `<div class="ans-jp jp">${ruby(ww, we.r)}</div>${kInfo}` };
}

/* ---------- проверка ввода ---------- */
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const norm = s => toHira(String(s || "").normalize("NFKC")).replace(/[\s、。，．,.!?！？「」『』()（）・〜~]/g, "");
export const check = (input, answers) => !!norm(input) && answers.some(a => norm(a) === norm(input));

/* ---------- убрать / вернуть (история сохраняется) ---------- */
export async function setPaused(itemId, paused) {
  const it = await db.get("items", itemId); if (!it) return;
  await db.put("items", { ...it, suspended: paused, pausedAt: paused ? Date.now() : undefined });
}

/* Список элементов для экрана «В изучении»: подпись, значение, когда следующее повторение. */
export async function itemList(now = Date.now()) {
  const items = await db.all("items"), cards = await db.all("cards");
  return items.map(i => {
    const e = entryOf(i), cs = cards.filter(c => c.item === i.id);
    const seen = cs.filter(c => c.state !== "new");
    const next = seen.length ? Math.min(...seen.map(c => c.due)) : null;
    return { id: i.id, kind: i.kind, paused: !!i.suspended, decks: i.decks || [], added: i.added,
      jp: i.kind === "grammar" ? e?.pat || i.ref : wordW(i.ref, e), r: i.kind === "word" ? e?.r : "",
      m: e ? [].concat(e.m).join("; ") : "", cards: cs.length, seen: seen.length, next };
  }).sort((a, b) => b.added - a.added);
}

export function whenLabel(next, now = Date.now()) {
  if (next == null) return "новое";
  const d = Math.round((next - now) / DAY);
  if (next <= now || d <= 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d < 30) return `через ${d} д`;
  return `через ${Math.round(d / 30)} мес`;
}

/* ---------- ручное добавление ---------- */
export async function addCustom({ w, r, m }, deck = "manual") {
  const id = `w:${w}`;
  await db.put("items", { id, kind: "word", ref: w, decks: [deck], added: Date.now(), custom: { w, r: r || w, m: [m], pos: "n" } });
  return id;
}

export const DECK_NAMES = deck => deck === "manual" ? "Вручную" : deck === "kanji" ? "Кандзи" : deck.startsWith("unit:") ? `Юнит ${deck.slice(5)}`
  : deck.startsWith("text:") ? `«${D.library.find(t => t.id === deck.slice(5))?.title || deck.slice(5)}»` : deck;
