// Проверка данных: node tools/validate.mjs
// Ошибки — то, что сломает подсказки (слова нет в словаре, чтение не выводится, неизвестная грамматика).
// Предупреждения — недонаполненное (грамматика юнита ещё не описана и т. п.).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, resolve, hasKanji, plain } from "../js/markup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const load = p => JSON.parse(readFileSync(join(root, p), "utf8"));
const dict = load("dict.json");
const grammar = load("grammar.json").items;
const kanji = load("kanji.json").items;
const course = load("course.json");

let errors = 0, warns = 0;
const missingKanji = new Set();
const used = new Set();   // леммы, встречающиеся в предложениях
const err = (where, msg) => { errors++; console.log(`✗ ${where}: ${msg}`); };
const warn = (where, msg) => { warns++; console.log(`· ${where}: ${msg}`); };

function checkLine(where, src, corpus = true) {
  const toks = resolve(parse(src), dict, grammar);
  // частица в конце фразы (の？, の。) почти всегда эмоциональная — нужно пояснение к месту
  toks.forEach((t, i) => { const nx = toks[i + 1];
    if (t.k === "part" && t.s === "の" && !t.note && (!nx || (nx.k === "text" && /^[？?。！!…]/.test(nx.s)))) warn(where, "の в конце фразы — добавь пояснение (の:…), иначе подсказка покажет «притяжательную»"); });
  for (const t of toks) {
    if (t.k === "word" && corpus) used.add(t.lemma);
    if (t.err) err(where, `${t.s} — ${t.err}${t.k === "word" && t.lemma !== t.s ? ` (лемма ${t.lemma})` : ""}`);
    if (t.k === "word" && t.sense && t.e && !t.e.m[t.sense - 1]) err(where, `${t.s} — нет значения #${t.sense}`);
  }
}

// перевод текста: tr[] — по строке на абзац (в чате — на реплику)
function checkTr(where, t) {
  if (!t.tr) return warn(where, "нет перевода tr");
  if (t.tr.length !== (t.paras || []).length) err(where, `tr: ${t.tr.length} строк, а абзацев ${t.paras.length}`);
}

// словарь
for (const [id, e] of Object.entries(dict.words)) {
  if (!e.r || !Array.isArray(e.m) || !e.m.length) err(`dict ${id}`, "нужны r и m[]");
  for (const ch of (e.w || id)) if (hasKanji(ch) && !kanji[ch]) (e.u ? warn(`dict ${id}`, `кандзи ${ch} нет в kanji.json`) : missingKanji.add(ch));
}
// грамматика
for (const [id, g] of Object.entries(grammar)) {
  (g.ex || []).forEach((s, i) => checkLine(`grammar ${id} ex${i + 1}`, s));
  (g.pairs || []).forEach((p, i) => { checkLine(`grammar ${id} пара ${i + 1}a`, p.a); checkLine(`grammar ${id} пара ${i + 1}b`, p.b); });
  for (const c of g.cmp || []) if (c.g && !grammar[c.g]) warn(`grammar ${id}`, `«не путать» ссылается на ${c.g} — ещё не описано`);
}
// банки
const banks = join(root, "banks");
const bankIx = existsSync(join(banks, "index.json")) ? load("banks/index.json").banks : [];
if (existsSync(banks)) for (const f of readdirSync(banks).filter(f => f.endsWith(".json") && f !== "index.json")) {
  if (!bankIx.includes(f.slice(0, -5))) err(`banks/${f}`, "не указан в banks/index.json");
  const b = load(`banks/${f}`);
  if (!grammar[b.g]) err(`banks/${f}`, `нет грамматики ${b.g}`);
  b.items.forEach((it, i) => {
    checkLine(`banks/${f} #${i + 1}`, it.jp);
    if (!parse(it.jp).some(t => t.k === "gram" && t.g === b.g)) err(`banks/${f} #${i + 1}`, `нет пропуска {…|${b.g}}`);
    const ans = parse(it.jp).find(t => t.k === "gram" && t.g === b.g)?.s;
    if (!it.opts?.length) warn(`banks/${f} #${i + 1}`, "нет вариантов opts — будет ввод вместо выбора");
    else if (it.opts.includes(ans)) err(`banks/${f} #${i + 1}`, `правильный ответ ${ans} среди неверных вариантов`);
    if (it.opts?.length && !it.why) warn(`banks/${f} #${i + 1}`, "нет пояснения why");
  });
}
// библиотека
for (const t of load("library/index.json").texts) {
  const doc = load(t.file);
  doc.paras.flat().forEach((s, i) => checkLine(`${t.file} #${i + 1}`, s));
  checkTr(t.file, doc);
}
// юниты
const units = [];
for (const b of course.blocks) for (const u of b.units) {
  if (!u.file) continue;
  const unit = load(u.file);
  for (const g of unit.grammar) if (!grammar[g]) warn(`unit ${u.n}`, `грамматика ${g} ещё не описана`);
  for (const w of unit.words) if (!dict.words[w]) err(`unit ${u.n}`, `слова ${w} нет в словаре`);
  for (const w of unit.phrases || []) if (!dict.words[w]) err(`unit ${u.n}`, `фразы ${w} нет в словаре`);
  for (const t of unit.texts) { (t.paras || []).flat().forEach((s, i) => checkLine(`unit ${u.n} «${t.title}» #${i + 1}`, s)); checkTr(`unit ${u.n} «${t.title}»`, t); }
  for (const [ti, t] of (unit.output?.tasks || []).entries()) {
    if (!t.situation || !t.plan?.length) warn(`unit ${u.n}`, `ситуация ${ti + 1}: нужны situation и plan`);
    (t.models || []).forEach((s, i) => checkLine(`unit ${u.n} ситуация ${ti + 1} образец ${i + 1}`, s, false));
    if (t.incoming) checkLine(`unit ${u.n} ситуация ${ti + 1} входящее`, t.incoming.jp, false);
    if (t.heading) checkLine(`unit ${u.n} ситуация ${ti + 1} заголовок`, t.heading, false);
    for (const g of t.use || []) if (!grammar[g]) warn(`unit ${u.n}`, `ситуация ${ti + 1}: грамматика ${g} не описана`);
  }
  // игры: 言い換え (iikae) и «найди кальку» (calques)
  for (const [i, it] of (unit.iikae || []).entries()) {
    const w = `unit ${u.n} 言い換え ${i + 1}`;
    if (!grammar[it.g]) err(w, `нет грамматики ${it.g}`);
    if (!unit.grammar.includes(it.g)) warn(w, `конструкция ${it.g} не из этого юнита`);
    checkLine(w, it.jp, false); checkLine(`${w} ok`, it.ok, false);
    (it.bad || []).forEach((s, j) => checkLine(`${w} bad${j + 1}`, s, false));
    if (!parse(it.jp).some(t => t.k === "gram" && t.g === it.g)) err(w, `нет конструкции {…|${it.g}}`);
    if ((it.bad || []).length < 2) err(w, "нужно 2+ неверных варианта bad");
    const opts = [it.ok, ...(it.bad || [])].map(s => plain(parse(s)));
    if (new Set(opts).size !== opts.length) err(w, "варианты совпадают");
    if (!it.ru || !it.why) warn(w, "нужны ru и why");
  }
  for (const [i, it] of (unit.calques || []).entries()) {
    const w = `unit ${u.n} калька ${i + 1}`;
    checkLine(w, it.jp, false);
    if ((it.bad || []).length < 2) err(w, "нужно 2 кальки bad");
    (it.bad || []).forEach((s, j) => checkLine(`${w} bad${j + 1}`, s, false));
    if (!it.ru || !it.note) warn(w, "нужны ru и note");
  }
  // игры пакета 2: коллокации (collocations) и «кому как сказать» (register)
  for (const [i, it] of (unit.collocations || []).entries()) {
    const w = `unit ${u.n} коллокация ${i + 1}`;
    checkLine(w, it.head + `[${it.ok}]`, false);
    if ((it.bad || []).length < 2) err(w, "нужно 2–3 неверных глагола bad");
    if ((it.bad || []).includes(it.ok)) err(w, "верный глагол среди неверных");
    if (!it.ru || !it.why) warn(w, "нужны ru и why");
  }
  for (const [i, it] of (unit.register || []).entries()) {
    const w = `unit ${u.n} регистр ${i + 1}`;
    checkLine(`${w} ok`, it.ok, false); (it.bad || []).forEach((s, j) => checkLine(`${w} bad${j + 1}`, s, false));
    if ((it.bad || []).length < 2) err(w, "нужно 2 варианта в другом регистре");
    if (!it.to || !it.ru || !it.why) warn(w, "нужны to, ru и why");
  }
  // игры пакета 3: «Ответь репликой» (replies) и «Ответь в чате» (chats)
  for (const [i, it] of (unit.replies || []).entries()) {
    const w = `unit ${u.n} реплика ${i + 1}`;
    checkLine(`${w} jp`, it.jp, false); checkLine(`${w} ok`, it.ok, false);
    (it.bad || []).forEach((s, j) => checkLine(`${w} bad${j + 1}`, s, false));
    if ((it.bad || []).length < 2) err(w, "нужно 2 неуместные реакции bad");
    const opts = [it.ok, ...(it.bad || [])].map(s => plain(parse(s)));
    if (new Set(opts).size !== opts.length) err(w, "варианты совпадают");
    if (!it.from || !it.why) warn(w, "нужны from и why");
  }
  for (const [i, it] of (unit.chats || []).entries()) {
    const w = `unit ${u.n} чат ${i + 1}`;
    if (!it.incoming?.jp && !it.heading) err(w, "нужно incoming {from, jp} или heading");
    if (it.incoming?.jp) checkLine(`${w} incoming`, it.incoming.jp, false);
    if (it.heading) checkLine(`${w} heading`, it.heading, false);
    checkLine(`${w} model`, it.model, false);
    for (const g of it.use || []) {
      if (!grammar[g]) err(w, `нет грамматики ${g}`);
      else if (!parse(it.model).some(t => t.k === "gram" && t.g === g)) err(w, `в образце нет {…|${g}}`);
    }
    if (!it.to || !it.ru || !it.reg) warn(w, "нужны to, reg и ru");
  }
  for (const k of unit.kanji || "") if (!kanji[k]) warn(`unit ${u.n}`, `кандзи ${k} нет в kanji.json`);
  units.push(unit);
}
// слова юнитов без единого предложения — не будет карточки-пропуска
for (const unit of units) {
  const miss = [...unit.words, ...(unit.phrases || [])].filter(w => !used.has(w));
  if (miss.length) warn(`unit ${unit.n}`, `нет в предложениях (не будет пропуска): ${miss.join(" ")}`);
}
if (missingKanji.size) console.log(`· кандзи вне kanji.json в служебных словах (${missingKanji.size}): ${[...missingKanji].join("")}`);

console.log(`\n${errors ? "✗" : "✓"} ошибок: ${errors}, предупреждений: ${warns}`);
process.exit(errors ? 1 : 0);
