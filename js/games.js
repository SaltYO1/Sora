/* Игры (#games — выбор, #games/<игра> — раунд). Пакет 2 (лексика и кандзи: col, yomi, ctx, reg) — js/words.js,
   пакет 3 (беглость: say, reply, chat) — js/fluency.js.
   Пакет 1 — грамматика:
     asm    «Собери фразу» (組み立て): русский смысл → предложение банка из кусочков; одна плитка лишняя — близкая конструкция
     blitz  «На время» (早押し): выбор из близких конструкций, 60 секунд; ошибка ставит время на паузу и объясняет
     iikae  «Скажи иначе» (言い換え): какая фраза значит то же самое — units/NN.json → iikae
     calque «Найди кальку» (直訳しない): русская мысль → как скажет японец — units/NN.json → calques
   Режимы (kv gameScope): юнит · блок (まとめ) · всё пройденное · «Мои пробелы».
   Ошибка → gaps {kind:"miss", src:"game:<id>", g?, line?, key?}; верный ответ закрывает такие записи (fixedAt).
   Рекорды и последний результат — kv games. */
import { D, unitFile, bank } from "./data.js";
import { db } from "./db.js";
import { parse, resolve, plain } from "./markup.js";
import { esc, ruby, banner, renderTokens, renderLine, optHTML, TOK } from "./render.js";
import { runQuiz, grammarTask, shuffle, showTop, showBottom } from "./quiz.js";
import { unitProgress } from "./unit.js";
import { colTask, yomiTask, ctxTask, ctxPool, regTask, kanjiWordsOf, readingOptions } from "./words.js";
import { corpus } from "./cards.js";
import { sayPool, runSay, replyTask, runChat, SAY_SEC, SAY_ROUND, CHAT_ROUND } from "./fluency.js";

const $ = s => document.querySelector(s);
export const PACKS = [[1, "Грамматика", "文法"], [2, "Лексика и кандзи", "語彙・漢字"], [3, "Беглость", "瞬発力"]];
export const GAMES = [
  { id: "asm", pack: 1, ic: "組", jp: "組み立て", ru: "Собери фразу", main: true,
    lead: "Смысл по-русски — собери японскую фразу из кусочков. Одна плитка лишняя: похожая конструкция." },
  { id: "blitz", pack: 1, ic: "速", jp: "早押し", ru: "На время",
    lead: "60 секунд: выбирай конструкцию по смыслу. Ошибка ставит время на паузу и объясняет." },
  { id: "iikae", pack: 1, ic: "換", jp: "言い換え", ru: "Скажи иначе",
    lead: "Какая фраза значит то же самое? Учит слышать оттенок конструкции." },
  { id: "calque", pack: 1, ic: "訳", jp: "直訳しない", ru: "Найди кальку",
    lead: "Русская мысль и три японских варианта, два из них — кальки. Выбери, как скажет японец." },
  { id: "col", pack: 2, ic: "合", jp: "組み合わせ", ru: "Коллокации", main: true,
    lead: "目覚ましを＿ — какой глагол? Японцы «вешают» будильник и «пьют» лекарство: ловим кальки." },
  { id: "yomi", pack: 2, ic: "読", jp: "読み分け", ru: "Чтения",
    lead: "Как читается слово? Неверные варианты — другие чтения тех же кандзи." },
  { id: "ctx", pack: 2, ic: "脈", jp: "文脈", ru: "Слово в контексте",
    lead: "Японская фраза с пропуском — узнай нужное слово по кандзи. Без русского, думаем по-японски." },
  { id: "reg", pack: 2, ic: "敬", jp: "言葉づかい", ru: "Кому как сказать",
    lead: "Подруге, коллеге или начальнику — выбери фразу в нужном регистре." },
  { id: "say", pack: 3, ic: "即", jp: "即答", ru: "Скажи быстро", main: true,
    lead: "Смысл по-русски — скажи по-японски за 6 секунд, открой и честно отметь себя. Тренирует скорость, а не узнавание." },
  { id: "reply", pack: 3, ic: "応", jp: "相づち", ru: "Ответь репликой",
    lead: "Друг пишет новость — какая реакция прозвучит естественно: いいなあ, 大変だったね или えらい?" },
  { id: "chat", pack: 3, ic: "返", jp: "返信", ru: "Ответь в чате",
    lead: "Сообщение и что нужно сказать — пишешь ответ сам, с конструкцией юнита, и сверяешь с образцом." },
];
const ROUND = 8, BLITZ_SEC = 60;

/* ================= режим: юнит / всё пройденное / пробелы ================= */
const readyUnits = () => D.units.filter(u => u.file);
const plural = (n, [one, few, many]) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const MODES = [["unit", "Юнит"], ["block", "Блок"], ["all", "Всё пройденное"], ["gaps", "Мои пробелы"]];
const passedUnits = async () => { const out = []; for (const u of readyUnits()) if (Object.keys((await unitProgress(u.n)).done || {}).length) out.push(u.n); return out; };
/* {mode:"unit"|"block"|"all"|"gaps", unit, block} — юнит и блок помнятся отдельно от режима */
async function getScope() {
  const s = { ...(await db.getKV("gameScope", {})) }, ready = readyUnits();
  if (!ready.some(u => u.n === s.unit)) { const p = await passedUnits(); s.unit = p.at(-1) ?? ready.at(-1)?.n ?? 1; }
  if (!ready.some(u => u.block === s.block)) s.block = D.units.find(u => u.n === s.unit)?.block ?? ready[0]?.block;
  if (!MODES.some(([m]) => m === s.mode)) s.mode = "unit";
  return s;
}
async function scopeUnits(scope) {
  const ready = readyUnits();
  if (scope.mode === "unit") return [scope.unit];
  if (scope.mode === "block") return ready.filter(u => u.block === scope.block).map(u => u.n);
  if (scope.mode === "gaps") return ready.map(u => u.n);
  const passed = await passedUnits();
  return passed.length ? passed : ready.map(u => u.n);
}
const blockOf = id => D.course.blocks.find(b => b.id === id);
const scopeLabel = s => s.mode === "unit" ? `Юнит ${s.unit}` : s.mode === "block" ? `Блок ${s.block} · まとめ` : s.mode === "all" ? "Всё пройденное" : "Мои пробелы";

/* что не вспомнилось: предложения, конструкции, задания игр (закрытые записи не считаются) */
async function weak() {
  const out = { lines: new Set(), gids: new Set(), keys: new Set(), n: 0 };
  for (const g of await db.all("gaps")) {
    if (g.fixedAt) continue;
    let hit = false;
    if (g.line) { out.lines.add(g.line); hit = true; }
    if (g.key) { out.keys.add(g.key); hit = true; }
    if (g.g) { out.gids.add(g.g); hit = true; }
    if (g.kind === "leech" && g.item?.startsWith("g:")) { out.gids.add(g.item.slice(2)); hit = true; }
    out.n += hit;
  }
  return out;
}
async function missGap(src, rec) { await db.put("gaps", { at: Date.now(), kind: "miss", src: `game:${src}`, ...rec }); }
async function fixGaps(match) {
  for (const g of await db.all("gaps")) if (!g.fixedAt && match(g)) await db.put("gaps", { ...g, fixedAt: Date.now() });
}

/* ================= пулы заданий ================= */
const unitsOf = async ns => (await Promise.all(ns.map(unitFile))).filter(Boolean);
async function bankItems(gids) {
  const out = [];
  for (const gid of gids) { const b = await bank(gid); for (const it of b?.items || []) out.push({ gid, it }); }
  return out;
}
async function grammarPool(scope) {
  const units = await unitsOf(await scopeUnits(scope));
  if (scope.mode !== "gaps") return bankItems([...new Set(units.flatMap(u => u.grammar))]);
  const w = await weak(), all = await bankItems([...new Set([...units.flatMap(u => u.grammar), ...w.gids])]);
  const exact = all.filter(x => w.lines.has(x.it.jp));
  return exact.length >= ROUND ? exact : [...exact, ...shuffle(all.filter(x => w.gids.has(x.gid) && !w.lines.has(x.it.jp)))];
}
async function unitItems(scope, field, prefix) {
  const units = await unitsOf(await scopeUnits(scope));
  const all = units.flatMap(u => (u[field] || []).map((it, i) => ({ ...it, key: `${prefix}:${u.n}:${i}` })));
  if (scope.mode !== "gaps") return all;
  const w = await weak();
  return all.filter(x => w.keys.has(x.key) || (x.g && w.gids.has(x.g)));
}
/* слова юнитов с кандзи; в режиме пробелов — только те, что не вспомнились в этой игре */
async function wordsPool(scope, prefix, ok = () => true) {
  const ids = kanjiWordsOf(await unitsOf(await scopeUnits(scope))).filter(ok);
  if (scope.mode !== "gaps") return ids;
  const w = await weak();
  return ids.filter(id => w.keys.has(`${prefix}:${id}`));
}
const POOLS = {
  asm: async s => (await grammarPool(s)).filter(x => { const n = assembly(x).chunks.length; return n >= 3 && n <= 8; }),
  blitz: async s => (await grammarPool(s)).filter(x => x.it.opts?.length),
  iikae: s => unitItems(s, "iikae", "ii"),
  calque: s => unitItems(s, "calques", "cq"),
  col: s => unitItems(s, "collocations", "co"),
  reg: s => unitItems(s, "register", "rg"),
  reply: s => unitItems(s, "replies", "re"),
  chat: s => unitItems(s, "chats", "ch"),
  say: async s => {
    const pool = sayPool(await unitsOf(await scopeUnits(s)));
    if (s.mode !== "gaps") return pool;
    const w = await weak(); return pool.filter(x => w.keys.has(x.key));
  },
  yomi: s => wordsPool(s, "yo", id => { const e = D.dict.words[id]; return readingOptions(e.w || id, e.r).length >= 3; }),
  ctx: async s => {
    const units = await unitsOf(await scopeUnits(s)), pool = ctxPool(units, await corpus());
    if (s.mode !== "gaps") return pool;
    const w = await weak(); return pool.filter(x => w.keys.has(`cx:${x.id}`));
  },
};

/* ================= экран выбора ================= */
export async function gamesHTML(arg) {
  const scope = await getScope(), rec = await db.getKV("games", {});
  const game = GAMES.find(g => g.id === arg);
  if (game) return playShell(game, scope);
  const w = await weak(), ready = readyUnits();
  const counts = Object.fromEntries(await Promise.all(GAMES.map(async g => [g.id, (await POOLS[g.id](scope)).length])));
  const recLine = id => { const r = rec[id]; if (!r) return ""; return id === "blitz" ? `<span class="chip">рекорд ${r.best}</span>` : `<span class="chip">последний раз ${r.last}</span>`; };
  const NOUN = { iikae: ["задание", "задания", "заданий"], reply: ["сообщение", "сообщения", "сообщений"], chat: ["ситуация", "ситуации", "ситуаций"], col: ["сочетание", "сочетания", "сочетаний"], yomi: ["слово", "слова", "слов"], ctx: ["слово", "слова", "слов"], reg: ["ситуация", "ситуации", "ситуаций"] };
  const size = (id, n) => id === "blitz" ? `${BLITZ_SEC} секунд` : id === "say" ? `${Math.min(n, SAY_ROUND)} × ${SAY_SEC} с` : `${n} ${plural(n, NOUN[id] || ["фраза", "фразы", "фраз"])}`;
  return banner({ eyebrow: "練習 · Игры", h1: "練習", jpLead: "遊んで、身につける。", ru: "Из «знаю» — в «говорю».", vert: "楽しく、何度も。", seed: 47, tag: "GAMES<br>N3" }) +
  `<section class="card"><h2>Что тренируем <span class="jp">範囲</span></h2>
    <div class="seg scope" role="radiogroup" aria-label="Что тренируем">
      ${MODES.map(([m, ru]) => `<button class="btn" role="radio" data-mode="${m}" aria-pressed="${scope.mode === m}">${ru}${m === "gaps" && w.n ? ` · ${w.n}` : ""}</button>`).join("")}
    </div>
    ${await pickerHTML(scope)}
    <p class="muted small" style="margin:0">${scopeNote(scope, w)}</p>
  </section>
  ${PACKS.map(([pk, ru, jp]) => `<div class="block-h"><b>${esc(ru)}</b><span class="muted jp">${esc(jp)}</span></div>
  <div class="grid">${GAMES.filter(g => g.pack === pk).map(g => {
    const n = counts[g.id];
    return `<a class="card game c-6${g.main ? " main" : ""}" href="#games/${g.id}" ${n ? "" : 'aria-disabled="true" tabindex="-1"'}>
      <span class="gic jp" aria-hidden="true">${g.ic}</span>
      <span class="gtx"><h2>${esc(g.ru)} <span class="jp">${esc(g.jp)}</span></h2><p>${esc(g.lead)}</p>
        <span class="meta">${n ? `<span class="chip learn">${size(g.id, n)}</span>` : `<span class="chip">в этом режиме пусто</span>`}${recLine(g.id)}</span></span></a>`;
  }).join("")}</div>`).join("")}`;
}

/* Выбор юнита — сетка номеров по блокам (готовые активны, пройденные с галочкой); выбор блока — карточки блоков. */
async function pickerHTML(scope) {
  const passed = new Set(await passedUnits());
  if (scope.mode === "unit") return `<div class="picker" role="radiogroup" aria-label="Юнит">${D.course.blocks.map(b => `<div class="pk-row">
      <span class="pk-b" title="${esc(b.title)}">${esc(b.id)}</span>
      <span class="pk-units">${b.units.map(u => `<button class="pk${passed.has(u.n) ? " done" : ""}" role="radio" data-unit="${u.n}" aria-pressed="${scope.unit === u.n}" ${u.file ? "" : "disabled"} title="${esc(u.title)}${u.file ? "" : " — ещё не наполнен"}">${u.n}</button>`).join("")}</span></div>`).join("")}</div>`;
  if (scope.mode === "block") return `<div class="picker blocks" role="radiogroup" aria-label="Блок">${D.course.blocks.map(b => {
      const ready = b.units.filter(u => u.file).length;
      return `<button class="pkb" role="radio" data-block="${esc(b.id)}" aria-pressed="${scope.block === b.id}" ${ready ? "" : "disabled"}>
        <b>${esc(b.id)}</b><span>${esc(b.title)}</span><small>${ready ? `готово ${ready} из ${b.units.length}` : "ещё нет юнитов"}</small></button>`;
    }).join("")}</div>`;
  return "";
}
function scopeNote(scope, w) {
  if (scope.mode === "unit") { const u = D.units.find(x => x.n === scope.unit); return `<b>Юнит ${u.n} · ${esc(u.title)}</b> — только его конструкции и фразы.`; }
  if (scope.mode === "block") { const b = blockOf(scope.block), r = b.units.filter(u => u.file).map(u => u.n);
    return `<b>Блок ${esc(b.id)} · ${esc(b.title)}</b> — まとめ: все готовые юниты блока вперемешку (${r.join(", ")}), без подсказки, какая нужна конструкция.`; }
  if (scope.mode === "all") return "Все юниты, где пройден хотя бы один шаг урока.";
  return w.n ? "То, что не вспомнилось в уроках, карточках и играх. Верный ответ закрывает пробел." : "Пробелов пока нет — ошибки из уроков и игр будут попадать сюда.";
}

function playShell(g, scope) {
  return `<section class="unit-head"><span class="eyebrow"><span class="dot"></span>練習 · ${esc(scopeLabel(scope))}</span>
      <h1><span class="jp">${esc(g.jp)}</span> ${esc(g.ru)}</h1></section>
    <section class="card"><p class="muted small" style="margin:0">${esc(g.lead)}</p>
      <div class="review quizbox" id="gameBox"><div class="loading">読み込み中…</div></div>
      <p class="muted small drill-note">Игры не трогают расписание карточек. Ошибки попадают в «Мои пробелы», верный ответ их закрывает.</p></section>
    <nav class="step-nav"><a class="btn" href="#games">← Все игры</a></nav>`;
}

/* ================= поведение ================= */
let AC = null, timer = null;
export function endGames() { AC?.abort(); AC = null; clearInterval(timer); timer = null; }

export async function mountGames(arg) {
  AC = new AbortController();
  const sig = AC.signal;
  if (!arg) {
    const set = async upd => { await db.setKV("gameScope", { ...(await getScope()), ...upd }); dispatchEvent(new HashChangeEvent("hashchange")); };
    document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => set({ mode: b.dataset.mode }));
    document.querySelectorAll("[data-unit]").forEach(b => b.onclick = () => set({ unit: +b.dataset.unit }));
    document.querySelectorAll("[data-block]").forEach(b => b.onclick = () => set({ block: b.dataset.block }));
    return;
  }
  const box = $("#gameBox"); if (!box) return;
  const scope = await getScope();
  const pool = await POOLS[arg](scope);
  if (sig.aborted) return;
  if (!pool.length) { box.innerHTML = `<p class="empty">В режиме «${esc(scopeLabel(scope))}» для этой игры пока нет заданий. <a href="#games">Выбрать другой</a></p>`; return; }
  const start = () => { if (!sig.aborted) RUN[arg](box, pool, sig, start, H); };
  start();
}

async function saveResult(id, upd) {
  const rec = await db.getKV("games", {});
  rec[id] = upd(rec[id] || { plays: 0 });
  rec[id].plays = (rec[id].plays || 0) + 1; rec[id].at = Date.now();
  await db.setKV("games", rec);
  return rec[id];
}

const doneHTML = (title, line, misses, again = "Ещё раунд") => `<div class="rv-done"><div class="q-jp jp">${esc(title)}</div>
  <p>${line}</p>
  ${misses.length ? `<div class="misses">${misses.map(m => `<div class="noterow"><span class="jp ja">${esc(m.jp)}</span><span class="ru">${esc(m.ru)}</span>${m.why ? `<span class="nn">${esc(m.why)}</span>` : ""}</div>`).join("")}</div>` : ""}
  <div class="row" style="justify-content:center"><button class="btn primary" data-g="again">${esc(again)}</button><a class="btn" href="#games">Все игры</a></div></div>`;

/* ================= «Собери фразу» ================= */
const FREE_P = new Set(["が", "を", "に", "で", "へ", "と", "から", "まで", "も"]);
const TIME = new Set(["昨日", "明日", "今日", "今", "毎朝", "毎晩", "毎日", "最近", "週末", "今年", "来年", "来月", "来週", "今夜", "平日", "将来", "今回"]);
const NOUNISH = /^(n|pron|propn|n,vs)$/, MODIFIER = /^(v1|v5|vk|vs|adj-i)$/;
const asmCache = new Map();

/* Предложение → кусочки (文節): слово + его частицы и окончания; определение склеено с существительным
   (寝る前に, 遠いところに); целевая конструкция — отдельной плиткой. free — кусочек можно переставить
   (обстоятельство с が/を/に/で/…, время, наречие): порядок таких кусочков между собой засчитывается любой. */
export function assembly({ gid, it }) {
  if (asmCache.has(it.jp)) return asmCache.get(it.jp);
  const toks = resolve(parse(it.jp), D.dict, D.grammar);
  let out = [], cur = null;
  const push = () => { if (cur?.toks.length) out.push(cur); cur = null; };
  for (const t of toks) {
    const content = t.k === "word" || (t.k === "gram" && t.g);
    if (content && cur?.content) push();
    (cur ||= { toks: [], content: false }).toks.push(t);
    if (content) cur.content = true;
    if (t.k === "text" && /[、，]$/.test(t.s)) push();
  }
  push();
  // знак в конце фразы — не плитка
  let end = "";
  const last = out.at(-1), lt = last?.toks.at(-1);
  if (lt?.k === "text") {
    const m = /[。！？!?…]+$/.exec(lt.s);
    if (m) { end = m[0]; const rest = lt.s.slice(0, -end.length); if (rest) last.toks[last.toks.length - 1] = { ...lt, s: rest }; else last.toks.pop(); }
    if (!last.toks.length) out.pop();
  }
  // определение + существительное — одним кусочком
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1], al = a.toks.at(-1), bf = b.toks.find(t => t.k !== "text");
    if (a.toks.some(t => t.k === "gram" && t.g === gid)) continue;
    const no = al.k === "part" && al.s === "の";
    const noun = bf?.k === "word" && NOUNISH.test(bf.e?.pos || "");
    // определительная форма: словарная, прошедшая, отрицательная (寝る前, 遠いところ, 書いた日記) — не て/ても/く
    const pos = al.e?.pos || "";
    const attr = al.k === "word" && a.toks.length === 1 && (/^(この|その|あの|どの|同じ)$/.test(al.s)
      || (MODIFIER.test(pos) && /[るうくぐすつぬぶむいただ]$/.test(al.s) && !(pos === "adj-i" && al.s.endsWith("く"))));
    if (no || (attr && noun)) { b.toks = [...a.toks, ...b.toks]; out.splice(i, 1); i--; }
  }
  const html = ts => ts.map(t => t.r && t.k !== "part" ? ruby(t.s, t.r) : esc(t.s)).join("");
  const chunks = out.map((c, i) => {
    const gi = c.toks.findIndex(t => t.k === "gram" && t.g === gid);
    const lastT = c.toks.at(-1);
    const free = gi < 0 && ((lastT.k === "part" && FREE_P.has(lastT.s)) || (c.toks.length === 1 && lastT.k === "word" && (lastT.e?.pos === "adv" || TIME.has(lastT.lemma))));
    return { i, text: plain(c.toks), html: html(c.toks), gram: gi >= 0, free,
      pre: gi < 0 ? "" : html(c.toks.slice(0, gi)), post: gi < 0 ? "" : html(c.toks.slice(gi + 1)),
      preT: gi < 0 ? "" : plain(c.toks.slice(0, gi)), postT: gi < 0 ? "" : plain(c.toks.slice(gi + 1)) };
  });
  const res = { toks, chunks, end };
  asmCache.set(it.jp, res);
  return res;
}

/* Правильно ли собрано: точно как в оригинале — или переставлены только свободные кусочки внутри одной группы. */
function judge(chunks, ans) {
  if (ans.length !== chunks.length) return { ok: false };
  const orig = chunks.map(c => c.text);
  if (ans.every((t, i) => t === orig[i])) return { ok: true, exact: true };
  for (let i = 0; i < orig.length;) {
    if (!chunks[i].free) { if (ans[i] !== orig[i]) return { ok: false }; i++; continue; }
    let j = i; while (j < orig.length && chunks[j].free) j++;
    if (ans.slice(i, j).sort().join("|") !== orig.slice(i, j).sort().join("|")) return { ok: false };
    i = j;
  }
  return { ok: true, exact: false };
}

function runAsm(box, pool, sig, again) {
  const items = shuffle(pool).slice(0, ROUND);
  const S = { i: 0, ok: 0, miss: [] };
  const next = () => {
    TOK.length = 0;
    if (S.i > 0) showTop(box);
    if (S.i >= items.length) {
      saveResult("asm", r => ({ ...r, last: `${S.ok}/${items.length}` }));
      box.innerHTML = doneHTML(S.ok === items.length ? "完璧！" : "おつかれさま！", `Собрано верно: <b>${S.ok}</b> из ${items.length}.`, S.miss);
      box.querySelector("[data-g=again]").onclick = again;
      return;
    }
    const x = items[S.i], A = assembly(x), gch = A.chunks.find(c => c.gram);
    const opt = shuffle(x.it.opts || [])[0];
    const tiles = A.chunks.map(c => ({ id: c.i, text: c.text, html: c.html, g: c.gram }));
    if (gch && opt) tiles.push({ id: -1, text: gch.preT + opt + gch.postT, html: gch.pre + optHTML(opt) + gch.post, g: true, extra: true });
    const bankT = shuffle(tiles), line = [];
    box.innerHTML = `<div class="row between"><span class="chip learn">Собери фразу</span><span class="muted small">фраза <b>${S.i + 1}</b> из <b>${items.length}</b> · верно <b>${S.ok}</b></span></div>
      <div class="rv-body">
        <div class="asm-task"><div class="q-ru">${esc(x.it.ru)}</div>
          <div class="asm-line" data-a="line" data-ph="Нажимай на кусочки по порядку${tiles.some(t => t.extra) ? " — одна плитка лишняя" : ""}" aria-live="polite"></div></div>
        <div class="asm-bank" data-a="bank">${bankT.map((t, k) => `<button class="tile${t.g ? " g" : ""}" data-k="${k}">${t.html}</button>`).join("")}</div>
        <div class="row asm-actions"><button class="btn primary" data-a="check" disabled>Проверить<span class="kbd"> · Enter</span></button><button class="btn" data-a="skip">Не знаю</button></div>
        <div data-a="back"></div></div>`;
    const q = k => box.querySelector(`[data-a="${k}"]`);
    let done = false;
    const draw = () => {
      q("line").innerHTML = line.map((k, p) => `<button class="tile${bankT[k].g ? " g" : ""}" data-p="${p}">${bankT[k].html}</button>`).join("");
      box.querySelectorAll("[data-k]").forEach(b => b.classList.toggle("used", line.includes(+b.dataset.k)));
      q("check").disabled = !line.length || done;
    };
    q("bank").onclick = e => { const b = e.target.closest("[data-k]"); if (!b || done || line.includes(+b.dataset.k)) return; line.push(+b.dataset.k); draw(); };
    q("line").onclick = e => { const b = e.target.closest("[data-p]"); if (!b || done) return; line.splice(+b.dataset.p, 1); draw(); };
    const finish = async give => {
      if (done) return; done = true;
      const ans = line.map(k => bankT[k].text), extra = line.some(k => bankT[k].extra);
      const v = give ? { ok: false } : extra ? { ok: false } : judge(A.chunks, ans);
      if (v.ok) { S.ok++; await fixGaps(g => g.line === x.it.jp); }
      else { S.miss.push({ jp: plain(A.toks), ru: x.it.ru, why: extra ? x.it.why : "" });
        await missGap("asm", { g: x.gid, line: x.it.jp, jp: plain(A.toks), ru: x.it.ru, said: ans.join("") + (A.end || ""), note: "Собери фразу" }); }
      box.querySelectorAll(".asm-bank .tile, .asm-line .tile").forEach(b => b.disabled = true);
      // подсветка: лишняя — красная, остальные сверяются с оригиналом по месту (лишняя плитка место не занимает)
      let pos = 0;
      box.querySelectorAll(".asm-line .tile").forEach((b, p) => {
        const t = bankT[line[p]];
        b.classList.add(t.extra ? "wrong" : v.ok || t.text === A.chunks[pos]?.text ? "right" : "wrong");
        if (!t.extra) pos++;
      });
      q("check").remove(); q("skip").remove();
      const extraT = tiles.find(t => t.extra);
      q("back").innerHTML = `<p class="verdict ${v.ok ? "ok" : "bad"}">${v.ok ? (v.exact ? "✓ Верно" : "✓ Верно — так тоже можно. Чаще порядок такой:") : extra ? `✗ Лишняя плитка — <span class="jp">${esc(extraT.text)}</span>` : give ? "Вот как правильно:" : "✗ Не совсем. Правильно так:"}</p>
        <div class="rv-a"><p class="jtext sm">${renderTokens(A.toks)}</p>
          ${x.it.why && (extra || !v.ok) ? `<p class="ans-n why">${esc(x.it.why)}</p>` : ""}
          ${D.grammar[x.gid] ? `<p class="ans-n"><a href="#grammar/${esc(x.gid)}" class="jp">${esc(D.grammar[x.gid].pat)}</a> — ${esc(D.grammar[x.gid].m)}</p>` : ""}</div>
        <button class="btn primary big" data-a="next" style="align-self:center">${S.i + 1 < items.length ? "Дальше →" : "Итог"}</button>`;
      box.querySelector(".row.between b:last-of-type").textContent = S.ok;
      const nx = q("next"); nx.focus({ preventScroll: true }); showBottom(nx);
      nx.onclick = () => { S.i++; next(); };
    };
    q("check").onclick = () => finish(false);
    q("skip").onclick = () => finish(true);
    draw();
  };
  addEventListener("keydown", e => {
    if (!box.isConnected || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const chk = box.querySelector('[data-a="check"]');
    if (e.key === "Enter" && chk && !chk.disabled && e.target.tagName !== "BUTTON") { e.preventDefault(); chk.click(); }
    if (e.key === "Backspace" && chk) { const t = box.querySelectorAll(".asm-line .tile"); if (t.length) { e.preventDefault(); t[t.length - 1].click(); } }
  }, { signal: sig });
  next();
}

/* ================= «На время» ================= */
function runBlitz(box, pool, sig, again) {
  const S = { score: 0, streak: 0, best: 0, left: BLITZ_SEC * 1000, miss: [], deck: [], t: null, paused: true, last: 0 };
  const draw = () => { const bar = box.querySelector(".tbar"); if (!bar) return;
    bar.firstElementChild.style.transform = `scaleX(${Math.max(0, S.left) / (BLITZ_SEC * 1000)})`;
    bar.classList.toggle("low", S.left < 10000);
    box.querySelector("[data-b=sec]").textContent = Math.ceil(Math.max(0, S.left) / 1000); };
  const tick = () => { if (S.paused) return; const now = performance.now(); S.left -= now - S.last; S.last = now; draw(); if (S.left <= 0) end(); };
  const resume = () => { S.paused = false; S.last = performance.now(); };
  const end = async () => {
    clearInterval(timer); timer = null; S.paused = true;
    const prev = (await db.getKV("games", {})).blitz?.best || 0;
    await saveResult("blitz", r => ({ ...r, best: Math.max(r.best || 0, S.score), last: S.score }));
    box.innerHTML = doneHTML("時間です！", `Верно: <b>${S.score}</b>${S.best > 2 ? ` · лучшая серия ${S.best}` : ""}${S.score > prev ? ` · <b>новый рекорд!</b>` : prev ? ` · рекорд ${prev}` : ""}`, S.miss, "Ещё раз");
    box.querySelector("[data-g=again]").onclick = again;
  };
  const nextQ = () => {
    TOK.length = 0;
    if (!S.deck.length) S.deck = shuffle(pool);
    const x = S.deck.shift(), t = grammarTask(x.gid, x.it); S.cur = { x, t };
    box.querySelector("[data-b=q]").innerHTML = `<div class="rv-q">${t.prompt}</div><p class="rv-hint">${esc(t.hint)}</p>
      <div class="rv-opts">${t.options.map((o, k) => `<button class="btn opt txt jp" data-opt="${esc(o)}"><span class="okey">${k + 1}</span><span>${optHTML(o)}</span></button>`).join("")}</div><div data-b="back"></div>`;
    box.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => answer(b.dataset.opt));
    resume();
  };
  const answer = async val => {
    if (S.paused || !S.cur) return;
    const { x, t } = S.cur, ok = t.answers.includes(val); S.cur = null;
    box.querySelectorAll("[data-opt]").forEach(b => { b.disabled = true; if (t.answers.includes(b.dataset.opt)) b.classList.add("right"); else if (b.dataset.opt === val) b.classList.add("wrong"); });
    if (ok) {
      S.score++; S.streak++; S.best = Math.max(S.best, S.streak);
      box.querySelector("[data-b=score]").textContent = S.score;
      const st = box.querySelector("[data-b=streak]"); st.textContent = S.streak > 2 ? `серия ${S.streak}` : ""; st.classList.remove("pop"); void st.offsetWidth; st.classList.add("pop");
      fixGaps(g => g.line === x.it.jp);
      setTimeout(() => { if (!sig.aborted && box.isConnected && S.left > 0) nextQ(); }, 380);
      return;
    }
    S.paused = true; S.streak = 0; box.querySelector("[data-b=streak]").textContent = "";
    S.miss.push(t);
    await missGap("blitz", { g: x.gid, line: x.it.jp, jp: t.jp, ru: t.ru, said: val, note: "На время" });
    const back = box.querySelector("[data-b=back]");
    back.innerHTML = `<p class="verdict bad">✗ Верно: <span class="jp">${esc(t.answers[0])}</span> · время на паузе</p>
      <div class="rv-a">${t.back}${t.why ? `<p class="ans-n why">${esc(t.why)}</p>` : ""}</div>
      <button class="btn primary big" data-b="go" style="align-self:center">Дальше →<span class="kbd"> · Enter</span></button>`;
    const go = back.querySelector("[data-b=go]"); go.focus({ preventScroll: true }); showBottom(go);
    go.onclick = () => { showTop(box); nextQ(); };
  };
  box.innerHTML = `<div class="blitz-top"><span class="chip learn">На время</span><div class="tbar" aria-hidden="true"><i></i></div>
      <span class="small muted"><b data-b="sec">${BLITZ_SEC}</b> с</span><span class="score">⚡ <b data-b="score">0</b></span></div>
    <span class="streak small" data-b="streak"></span>
    <div class="rv-body" data-b="q"><div class="rv-done"><div class="q-jp jp">よーい、どん！</div>
      <p>${BLITZ_SEC} секунд. Смысл по-русски — выбери конструкцию. Верно — сразу следующая; ошибка ставит время на паузу и объясняет.</p>
      <p class="muted small kbd" style="margin:0">Варианты — клавиши 1–4, «Дальше» — Enter.</p>
      <button class="btn primary big" data-b="start" style="align-self:center">Старт</button></div></div>`;
  box.querySelector("[data-b=start]").onclick = () => { box.querySelector(".blitz-top").classList.add("on"); nextQ(); clearInterval(timer); timer = setInterval(tick, 100); };
  draw();
  addEventListener("keydown", e => {
    if (!box.isConnected || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (/^[1-4]$/.test(e.key)) { const b = box.querySelectorAll("[data-opt]:not(:disabled)")[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
    if (e.key === "Enter") { const g = box.querySelector("[data-b=go]") || box.querySelector("[data-b=start]"); if (g && e.target !== g) { e.preventDefault(); g.click(); } }
  }, { signal: sig });
}

/* ================= «Скажи иначе» и «Найди кальку» — через общий движок заданий ================= */
const lineHTML = src => resolve(parse(src), D.dict, D.grammar).map(t => t.r && t.k !== "part" ? ruby(t.s, t.r) : esc(t.s)).join("");
const plainOf = src => plain(parse(src));

/* после ответа — все варианты разметкой: каждое слово нажимается (чтение, значение, «＋ в карточки») */
const variants = (ok, bad) => `<div class="vars">${[[ok, true], ...bad.map(b => [b, false])].map(([s, good]) =>
  `<div class="var ${good ? "ok" : "bad"}"><span class="vm" aria-label="${good ? "верно" : "неверно"}">${good ? "✓" : "✗"}</span><p class="jtext sm">${renderLine(s)}</p></div>`).join("")}</div>`;

function iikaeTask(it) {
  const opts = [it.ok, ...it.bad], labels = Object.fromEntries(opts.map(s => [plainOf(s), lineHTML(s)]));
  return { label: "Скажи иначе", mode: "choice", cols: true, key: it.key, g: it.g,
    prompt: `<p class="jtext sm">${renderLine(it.jp)}</p>`, hint: "Какая фраза значит то же самое?",
    options: shuffle(opts.map(plainOf)), labels, answers: [plainOf(it.ok)], why: it.why,
    back: `${variants(it.ok, it.bad)}<p class="ans-m">${esc(it.ru)}</p>`, jp: plainOf(it.jp), ru: it.ru };
}
function calqueTask(it) {
  const opts = [it.jp, ...it.bad], labels = Object.fromEntries(opts.map(s => [plainOf(s), lineHTML(s)]));
  return { label: "Найди кальку", mode: "choice", cols: true, key: it.key,
    prompt: `<div class="q-ru">${esc(it.ru)}</div>`, hint: "Как скажет японец? Два варианта — кальки с русского.",
    options: shuffle(opts.map(plainOf)), labels, answers: [plainOf(it.jp)], why: it.note,
    back: variants(it.jp, it.bad), jp: plainOf(it.jp), ru: it.ru };
}
function runChoice(id, make) {
  return (box, pool, sig, again) => {
    const tasks = shuffle(pool).slice(0, ROUND).map(it => make(it, pool));
    runQuiz(box, tasks, {
      onRestart: again,
      onHit: t => fixGaps(g => g.key === t.key),
      onMiss: (t, val) => missGap(id, { key: t.key, ...(t.g ? { g: t.g } : {}), ...(t.item ? { item: t.item } : {}), jp: t.jp, ru: t.ru, said: val || "", note: t.label }),
      onDone: r => saveResult(id, x => ({ ...x, last: `${r.ok}/${r.total}` })),
    });
  };
}

const H = { missGap, fixGaps, saveResult, doneHTML };
const RUN = { asm: runAsm, blitz: runBlitz, iikae: runChoice("iikae", iikaeTask), calque: runChoice("calque", calqueTask),
  col: runChoice("col", colTask), yomi: runChoice("yomi", yomiTask), ctx: runChoice("ctx", ctxTask), reg: runChoice("reg", regTask),
  say: runSay, reply: runChoice("reply", replyTask), chat: runChat };
