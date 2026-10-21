// План курса: кандзи N3 и лексика по 25 юнитам. node tools/plan.mjs
// Вход:  data/course.json (кандзи юнитов из карты курса), data/units/*.json (готовые юниты не трогаем),
//        tools/n3/kanji.json + tools/n3/vocab.json (списки N5–N3, см. tools/n3/build.py), tools/plan-config.json.
// Выход: docs/plan.json (машинный план для наполнения и audit.mjs) и docs/PLAN.md (обзор для человека).
//
// Правила:
//  1. Каждый кандзи N3 — ровно в одном юните: кандзи из course.json + решения из plan-config.json → kanji.
//  2. Каждое слово N3 — ровно в одном юните. Дом слова — самый поздний юнит среди его кандзи N3
//     (к этому юниту все его кандзи уже пройдены). Если значение попадает в тему более позднего юнита — туда.
//     Если тема раньше дома, слово уходит в тему, когда в доме для того кандзи остаётся 3+ других слова
//     (кандзи ещё не пройден — слово учится с фуриганой, кандзи придёт позже).
//     Слова без кандзи N3 — по теме; не подошли ни к одной теме — «общие», делятся поровну как запас для текстов.
//  3. Главные слова юнита (core, ~30): сперва по слову на каждый кандзи юнита (кандзи через слова),
//     затем слова темы, затем самые частотные. Остальное — extra: запас для текстов и банков.
//  4. Спираль: review — слова прошлых юнитов, которые должны вернуться в тексты нового
//     (больше из соседних юнитов, меньше — с шагом из давних; сначала подходящие по теме, затем реже повторённые).
//  5. Готовые юниты (frozen) не меняются: их слова взяты из файла юнита, новые туда не добавляются.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = p => JSON.parse(readFileSync(join(root, p), "utf8"));
const course = load("data/course.json"), dict = load("data/dict.json").words;
const K = load("tools/n3/kanji.json").items, ALL = load("tools/n3/vocab.json"), cfg = load("tools/plan-config.json");
const V = ALL.filter(v => v.lvl >= 3), N2 = ALL.filter(v => v.lvl === 2);  // N2 — только подсказки
const isKanji = ch => /[㐀-鿿々]/.test(ch);
const units = course.blocks.flatMap(b => b.units.map(u => ({ ...u, block: b.id })));
const N = units.length, frozen = new Set(cfg.frozen || []);
const notes = [];                                   // предупреждения в отчёт

/* ---------- 1. кандзи ---------- */
const kUnit = {}, kWhy = {};
for (const u of units) for (const ch of u.kanji) {
  if (kUnit[ch]) { notes.push(`кандзи ${ch} в course.json дважды: юниты ${kUnit[ch]} и ${u.n} — оставлен в ${kUnit[ch]}`); continue; }
  kUnit[ch] = u.n; kWhy[ch] = "карта курса";
  if (K[ch]?.lvl !== 3) notes.push(`кандзи ${ch} (юнит ${u.n}) — не N3 (${K[ch] ? "N" + K[ch].lvl : "вне N5–N3"})`);
}
for (const [ch, [n, why]] of Object.entries(cfg.kanji)) {
  if (kUnit[ch] === n) { kWhy[ch] = why; continue; }      // course.json уже несёт полный список юнита — причина остаётся из конфига
  if (kUnit[ch]) { notes.push(`кандзи ${ch} из plan-config уже есть в юните ${kUnit[ch]}`); continue; }
  kUnit[ch] = n; kWhy[ch] = why;
}
const n3k = Object.keys(K).filter(ch => K[ch].lvl === 3);
const kMissing = n3k.filter(ch => !kUnit[ch]);
const kByUnit = n => Object.keys(kUnit).filter(ch => kUnit[ch] === n);

/* ---------- 2. слова ---------- */
// «word» — целое слово (с окончаниями), «stem*» — начало слова: \btea\b не ловит teach
const kw = s => s.split("|").map(x => x.trim()).filter(Boolean).map(x => x.endsWith("*") ? x.slice(0, -1).replace(/\*/g, "\\w*") : `${x}(?:s|es|ed|ing)?\\b`).join("|");
const theme = Object.fromEntries(Object.entries(cfg.theme).map(([n, s]) => [n, new RegExp(`\\b(?:${kw(s)})`, "gi")]));
const hitsOf = (en, n) => (en.match(theme[n]) || []).length;
const isVerb = v => /^to /.test(v.en);
// частотность: wordfreq (z) или субтитры (zs); у глаголов счёт делится по формам, поэтому поправка
const score = v => Math.max(v.z ?? 0, (v.zs ?? 0) + 0.3) + (isVerb(v) ? 0.8 : 0);
const RARE = 2.6;                                    // ниже — редкое или книжное, в главные не берём
const rawFreq = v => Math.max(v.z ?? 0, v.zs ?? 0);
const n3kOf = v => [...new Set([...v.w].filter(ch => kUnit[ch] && K[ch]?.lvl === 3))];

// готовые юниты: слова из файла
const frozenWords = {};
for (const u of units) if (frozen.has(u.n) && u.file) {
  const f = load(`data/${u.file}`);
  frozenWords[u.n] = [...f.words, ...(f.phrases || [])].map(id => dict[id]?.w || id);
}
const frozenOf = w => Object.entries(frozenWords).find(([, ws]) => ws.includes(w))?.[0];

// слова вне списков (N2+) для кандзи без единого слова в N5–N3
// (если слово всё же есть в списках N5–N3 — это просто ручное решение «в юнит N»)
const EXTRA = [];
for (const x of cfg.extraWords || []) {
  const inList = V.find(v => v.w === x.w);
  if (inList) cfg.words[x.w] = x.unit;
  else EXTRA.push({ ...(ALL.find(v => v.w === x.w) || {}), w: x.w, r: x.r, en: x.en, lvl: 2, z: ALL.find(v => v.w === x.w)?.z ?? 3.5, zs: null, unit: x.unit });
}
const words = [];                                    // {v, unit, why, hits, sc, kanji[]}
// свои слова юнитов: всё N3 и слова N5–N4 с кандзи N3 (窓, 静か, 雪 — в списках N4, а знак — N3)
for (const v of [...V, ...EXTRA]) {
  if (v.lvl === 2 ? !v.unit : v.lvl !== 3 && !n3kOf(v).length) continue;
  const w = v.w.replace(/^～/, "");
  const sc = score(v), ks = n3kOf(v);
  const th = Object.keys(theme).map(n => [+n, hitsOf(v.en, n)]).filter(([n, h]) => h && !frozen.has(n)).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const rec = { v, w, sc, kanji: ks, th, rare: (v.z != null || v.zs != null) && rawFreq(v) < RARE };
  const fz = frozenOf(w) ?? frozenOf(v.w);
  if (v.unit) { rec.unit = v.unit; rec.why = "вне списков (N2+)"; rec.rare = false; }
  else if (cfg.words[v.w] === 0) { rec.unit = 0; rec.why = "исключено вручную"; }
  else if (cfg.words[v.w]) { rec.unit = cfg.words[v.w]; rec.why = "вручную"; }
  else if (fz) { rec.unit = +fz; rec.why = "готовый юнит"; }
  else if (ks.length) {
    let home = Math.max(...ks.map(ch => kUnit[ch]));
    // простые слова N5–N4 — опора для своего кандзи (吸う, 静か, 窓): остаются в юните знака
    const later = v.lvl > 3 ? th.filter(([n]) => n === home) : th.filter(([n]) => n >= home);
    if (later.length) { rec.unit = later[0][0]; rec.why = later[0][0] === home ? "кандзи + тема" : `тема (кандзи из ${home})`; }
    else if (frozen.has(home)) { rec.unit = home; rec.why = "кандзи готового юнита"; rec.spill = true; }
    else { rec.unit = home; rec.why = "кандзи"; }
    rec.home = home;
  } else if (th.length) { rec.unit = th[0][0]; rec.why = "тема"; }
  else { rec.unit = null; rec.why = "общее"; }
  words.push(rec);
}
// тема раньше дома: переносим, если у кандзи в доме останется 3+ слова
const homeCount = ch => words.filter(r => r.unit === kUnit[ch] && r.kanji.includes(ch) && !r.rare).length;
for (const r of words) {
  if (!r.kanji.length || r.why !== "кандзи" || !r.th.length) continue;
  const t = r.th.find(([n]) => n < r.unit)?.[0]; if (!t) continue;
  if (r.kanji.every(ch => kUnit[ch] !== r.unit || homeCount(ch) > 3)) { r.why = `тема (кандзи впереди: ${r.kanji.filter(ch => kUnit[ch] > t).join("")})`; r.unit = t; }
}
// слова с кандзи готового юнита: в первый подходящий по теме не готовый юнит, иначе в ближайший не готовый
for (const r of words.filter(x => x.spill)) {
  const t = r.th.find(([n]) => n > r.home)?.[0];
  r.unit = t || units.find(u => u.n > r.home && !frozen.has(u.n)).n;
  r.why = `кандзи юнита ${r.home} (спираль)`;
}
// общие слова — поровну по не готовым юнитам, частотные первыми
const open = units.filter(u => !frozen.has(u.n)).map(u => u.n);
words.filter(r => r.unit === null).sort((a, b) => b.sc - a.sc).forEach((r, i) => { r.unit = open[i % open.length]; r.general = true; });
// у каждого кандзи — хотя бы одно живое слово в своём юните: если тема всё увела (戻る → «Транспорт»), возвращаем лучшее
for (const ch of n3k) {
  const n = kUnit[ch]; if (!n || frozen.has(n)) continue;
  if (words.some(r => r.unit === n && r.kanji.includes(ch) && !r.rare)) continue;
  const best = words.filter(r => r.kanji.includes(ch) && r.unit > 0 && !frozen.has(r.unit) && r.why !== "вручную").sort((a, b) => a.rare - b.rare || b.sc - a.sc)[0];
  if (best) { best.why = `единственное слово для ${ch} (было в ${best.unit})`; best.unit = n; best.general = false; }
}

/* ---------- 3. главные слова юнита ---------- */
const plan = [];
for (const u of units) {
  const mine = words.filter(r => r.unit === u.n);
  const kanji = kByUnit(u.n);
  const core = [], used = new Set();
  const take = (r, why) => { if (!used.has(r.w)) { used.add(r.w); core.push({ ...r, pick: why }); } };
  if (frozen.has(u.n)) {
    for (const w of frozenWords[u.n]) { const r = mine.find(x => x.w === w || x.v.w === w);
      if (r) take(r, "в юните"); else { used.add(w); core.push({ w, v: { r: Object.values(dict).find(e => (e.w || "") === w)?.r || dict[w]?.r || "", en: (dict[w]?.m || []).join("; "), lvl: null }, pick: "в юните (не N3)", kanji: [], th: [], sc: 0 }); } }
  } else {
    const byScore = (a, b) => (b.th.find(([n]) => n === u.n)?.[1] || 0) - (a.th.find(([n]) => n === u.n)?.[1] || 0) || b.sc - a.sc;
    for (const ch of kanji) {
      // лучшее слово для знака: частотное, по теме юнита и со значением самого знака (息 → 息 «дыхание», а не 息子)
      const th = r => r.th.find(([n]) => n === u.n)?.[1] || 0;
      const kw = new Set((K[ch]?.en || "").toLowerCase().match(/[a-z]{4,}/g) || []);
      const same = r => ((r.v.en || "").toLowerCase().match(/[a-z]{4,}/g) || []).some(x => kw.has(x)) ? 1.5 : 0;
      const multi = r => 0.7 * (r.kanji.filter(x => kanji.includes(x)).length - 1);   // 性格 закрывает и 性, и 格
      const val = r => r.sc + Math.min(th(r), 2) + same(r) + multi(r);
      const c = mine.filter(r => r.kanji.includes(ch) && !r.general).sort((a, b) => (a.rare - b.rare) || val(b) - val(a));
      if (c[0] && !core.some(r => r.kanji.includes(ch))) take(c[0], `кандзи ${ch}`);
    }
    for (const r of mine.filter(r => !r.rare && !r.general && r.th.some(([n]) => n === u.n)).sort(byScore)) { if (core.length >= cfg.core) break; take(r, "тема"); }
    // добор до нормы — только слова со знаками юнита (общие слова остаются запасом для текстов)
    for (const r of mine.filter(r => !r.rare && !r.general && r.kanji.length).sort((a, b) => b.sc - a.sc)) { if (core.length >= cfg.core) break; take(r, "частотное со знаком юнита"); }
  }
  const extra = mine.filter(r => !used.has(r.w)).sort((a, b) => b.sc - a.sc);
  // покрытие кандзи: сколько слов (N3 юнита + N5–N4 из списков) его несут
  const kc = kanji.map(ch => {
    const own = mine.filter(r => r.kanji.includes(ch)).map(r => r.w);
    const inCore = core.filter(r => r.kanji?.includes(ch) || r.w.includes(ch)).length;
    // во всём курсе: для k-read нужно 2+ слова с этим знаком
    const course = words.filter(r => r.unit > 0 && r.w.includes(ch)).map(r => `${r.w}·${r.unit}`);
    const n2 = course.length < 2 ? N2.filter(v => v.w.includes(ch)).sort((a, b) => score(b) - score(a)).slice(0, 4).map(v => v.w) : [];
    return { ch, why: kWhy[ch], on: K[ch]?.on || [], kun: K[ch]?.kun || [], en: K[ch]?.en || "", core: inCore, words: own.length, course, ...(n2.length ? { n2 } : {}) };
  });
  // база N5–N4 по теме — не своя лексика юнита, а то, на чём удобно писать тексты
  const base = V.filter(v => v.lvl > 3 && !n3kOf(v).length && hitsOf(v.en, u.n)).map(v => ({ v, h: hitsOf(v.en, u.n), sc: score(v) }))
    .sort((a, b) => b.h - a.h || b.sc - a.sc).slice(0, 15).map(x => x.v.w);
  plan.push({ n: u.n, title: u.title, block: u.block, frozen: frozen.has(u.n), kanji: kc, core, extra, base });
}

/* ---------- 4. спираль ---------- */
const reviewUses = {};
for (const p of plan) {
  if (p.n === 1 || p.frozen) { p.review = []; continue; }
  const quota = [[p.n - 1, 4], [p.n - 2, 2], [p.n - 3, 2]];
  for (const back of [5, 8, 13, 21]) if (p.n - back >= 1) quota.push([p.n - back, 1]);
  const picked = [];
  const pick = (from, k) => {
    const src = plan.find(x => x.n === from); if (!src) return;
    const c = src.core.filter(r => !picked.includes(r.w)).sort((a, b) =>
      hitsOf(b.v.en || "", p.n) - hitsOf(a.v.en || "", p.n) || (reviewUses[a.w] || 0) - (reviewUses[b.w] || 0) || b.sc - a.sc);
    for (const r of c.slice(0, k)) { picked.push(r.w); reviewUses[r.w] = (reviewUses[r.w] || 0) + 1; }
  };
  for (const [from, k] of quota) pick(from, k);
  // добор до нормы — с ближайших юнитов (у первых юнитов прошлого мало)
  for (let back = 1; picked.length < cfg.review && back < p.n; back++) pick(p.n - back, cfg.review - picked.length);
  p.review = picked.slice(0, cfg.review);
}

/* ---------- 5. проверки и выход ---------- */
const placed = words.filter(r => r.unit > 0);
const cov = {
  kanji: { n3: n3k.length, placed: n3k.length - kMissing.length, missing: kMissing.join("") },
  words: { n3: words.filter(r => r.v.lvl === 3).length, own: words.length, placedN3: words.filter(r => r.v.lvl === 3 && r.unit > 0).length, placed: placed.length, excluded: words.filter(r => r.unit === 0).length, core: plan.reduce((s, p) => s + p.core.length, 0),
           general: words.filter(r => r.general).length, rare: placed.filter(r => r.rare).length },
};
for (const p of plan) {
  if (p.frozen) continue;
  const n = p.kanji.length;
  if (n < 8 || n > 17) notes.push(`юнит ${p.n}: ${n} кандзи (норма 10–16)`);
  for (const k of p.kanji) {
    if (!k.core) notes.push(`юнит ${p.n}: у кандзи ${k.ch} нет главного слова`);
    if (k.course.length < 2) notes.push(`юнит ${p.n}: кандзи ${k.ch} — во всём курсе одно слово (${k.course.join(" ")}); для k-read нужно второе: ${k.n2?.join(" ") || "сочетание с ним"} (N2) или коллокация`);
  }
  if (p.core.length < 25) notes.push(`юнит ${p.n}: главных слов ${p.core.length} (норма 25–35)`);
}
const dup = Object.entries(placed.reduce((m, r) => (m[r.w] = (m[r.w] || 0) + 1, m), {})).filter(([, c]) => c > 1);
// одно слово в N3 бывает двумя записями (омонимы с разным чтением) — это не повтор

const slim = r => ({ w: r.w, r: r.v.r, en: r.v.en, lvl: r.v.lvl, z: r.v.z ?? null, why: r.pick || r.why, ...(r.rare ? { rare: true } : {}), ...(r.general ? { general: true } : {}) });
const out = { _doc: "Сгенерировано tools/plan.mjs — не править руками: меняй tools/plan-config.json и запускай заново.", coverage: cov, notes,
  units: plan.map(p => ({ n: p.n, title: p.title, block: p.block, frozen: p.frozen, kanji: p.kanji, core: p.core.map(slim), extra: p.extra.map(slim), base: p.base, review: p.review })) };
// по юниту на строку: в git видно, какой юнит изменился
writeFileSync(join(root, "docs/plan.json"), "{\n" + Object.entries(out).map(([k, v]) => k === "units" ? ` "units": [\n${v.map(u => "  " + JSON.stringify(u)).join(",\n")}\n ]` : ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n");

/* ---------- PLAN.md ---------- */
const md = [`# План курса: кандзи и лексика N3 по юнитам`, "",
  `Сгенерировано \`node tools/plan.mjs\` (не править руками — менять \`tools/plan-config.json\`). Машинная версия — \`docs/plan.json\`.`, "",
  `**Покрытие.** Кандзи N3: ${cov.kanji.placed} / ${cov.kanji.n3}${cov.kanji.missing ? ` (без юнита: ${cov.kanji.missing})` : ", все распределены, без повторов"}. ` +
  `Слова N3: ${cov.words.placedN3} / ${cov.words.n3} распределены (исключено вручную ${cov.words.excluded}); вместе со словами N5–N4, где знак из N3, и добавками N2+ — ${cov.words.placed}. Главных — ${cov.words.core}, ` +
  `общих (запас для текстов) — ${cov.words.general}, редких/книжных — ${cov.words.rare}.`, "",
  "**Как читать.** *Главные* — слова для карточек юнита (по слову на каждый кандзи, затем тема и частотность). *Запас* — для текстов, банков и игр, без обязательных карточек. " +
  "*База N5–N4* — простые слова темы, на которых строятся тексты. *Спираль* — слова прошлых юнитов, которые обязаны вернуться в тексты и банки этого юнита. " +
  "Пометка ⚠ — редкое или книжное слово (низкая частотность): брать только с пометкой регистра или заменить живым.", ""];
if (notes.length) md.push("## Что проверить", "", ...notes.map(s => `- ${s}`), "");
let blk = null;
for (const p of out.units) {
  const u = units.find(x => x.n === p.n);
  if (u.block !== blk) { blk = u.block; md.push(`## Блок ${blk}`, ""); }
  md.push(`### ${p.n}. ${p.title}${p.frozen ? " · готов" : ""}`, "");
  md.push(`**Кандзи (${p.kanji.length}):** ${p.kanji.map(k => `${k.ch}${k.why === "карта курса" ? "" : `*`}`).join(" ")}` + (p.kanji.some(k => k.why !== "карта курса") ? "  \n\\* — добавлен к карте курса: " + p.kanji.filter(k => k.why !== "карта курса").map(k => `${k.ch} (${k.why})`).join(", ") : ""), "");
  md.push(`**Главные (${p.core.length}):** ` + p.core.map(r => `${r.w}${r.rare ? "⚠" : ""}`).join(" · "), "");
  if (p.extra.length) md.push(`**Запас (${p.extra.length}):** ` + p.extra.slice(0, 40).map(r => `${r.w}${r.rare ? "⚠" : ""}`).join(" · ") + (p.extra.length > 40 ? ` … ещё ${p.extra.length - 40}` : ""), "");
  if (p.base.length) md.push(`**База N5–N4:** ${p.base.join(" · ")}`, "");
  if (p.review.length) md.push(`**Спираль:** ${p.review.join(" · ")}`, "");
}
writeFileSync(join(root, "docs/PLAN.md"), md.join("\n") + "\n");

console.log(`кандзи N3: ${cov.kanji.placed}/${cov.kanji.n3}${cov.kanji.missing ? " — без юнита: " + cov.kanji.missing : ""}`);
console.log(`слова N3: ${cov.words.placedN3}/${cov.words.n3} (всего слов юнитов с N5–N4 и N2+: ${cov.words.placed}), главных ${cov.words.core}, общих ${cov.words.general}, редких ${cov.words.rare}, исключено ${cov.words.excluded}`);
for (const p of out.units) console.log(`${String(p.n).padStart(2)} ${p.frozen ? "■" : "□"} кандзи ${String(p.kanji.length).padStart(2)} · главных ${String(p.core.length).padStart(2)} · запас ${String(p.extra.length).padStart(3)} · спираль ${p.review.length}`);
if (notes.length) console.log(`\nпроверить (${notes.length}):\n` + notes.map(s => "  · " + s).join("\n"));
if (dup.length) console.log(`\nслова с несколькими записями (омонимы): ${dup.map(([w]) => w).join(" ")}`);
process.exit(kMissing.length ? 1 : 0);
