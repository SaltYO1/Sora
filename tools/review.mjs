// Выгрузка юнита для «свежего взгляда»: node tools/review.mjs 2 > review-02.md
// Вся разметка юнита — тексты, банки, игры, письмо, словарь, кандзи — читаемым текстом с чтениями:
// слово〔чтение〕, 【форма〔чтение〕｜конструкция】. Рецензенту не нужно разбирать JSON и разметку,
// а чтения внутри 【】 — те, что увидит ученик (innerWord), — сразу видны и проверяемы.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, resolve } from "../js/markup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const L = p => JSON.parse(readFileSync(join(root, p), "utf8"));
const n = Number(process.argv[2]);
const course = L("course.json"), meta = course.blocks.flatMap(b => b.units).find(u => u.n === n);
if (!meta?.file) { console.error(`юнит ${n}: нет файла (course.json → file)`); process.exit(1); }
const dict = L("dict.json"), G = L("grammar.json").items, K = L("kanji.json").items, u = L(meta.file);
const bankIx = L("banks/index.json").banks;
const show = s => resolve(parse(s), dict, G).map(t => t.k === "word" ? (t.r && t.r !== t.s ? `${t.s}〔${t.r}〕` : t.s)
  : t.k === "gram" ? `【${t.s}${t.r ? "〔" + t.r + "〕" : ""}｜${t.g}】` : t.s).join("");
const out = [], P = (...a) => out.push(a.join(""));

P(`# Юнит ${n} «${u.title}» — выгрузка для рецензии`);
P("Обозначения: слово〔чтение〕, 【конструкция〔чтение〕｜id】 — то, что ученик выбирает или вставляет.\n");
P("## Конструкции");
for (const g of u.grammar) {
  const x = G[g]; if (!x) continue;
  P(`\n### ${g}: ${x.pat} — ${x.m}\nФорма: ${x.form}\nНюанс: ${x.nuance}\nНе путать: ${(x.cmp || []).map(c => `${c.pat} — ${c.note}`).join("; ")}`);
  (x.ex || []).forEach(e => P("Пример: ", show(e)));
  (x.pairs || []).forEach(p => P(`Пара: ${show(p.a)} = ${p.ar} | ${show(p.b)} = ${p.br}`));
  if (!bankIx.includes(g)) continue;
  P(`\nБанк ${g} (ответ в 【】, «неверные» — дистракторы; подходить должен ровно один):`);
  L(`banks/${g}.json`).items.forEach((it, i) => P(`${i + 1}. ${show(it.jp)}\n   смысл: ${it.ru}\n   неверные: ${(it.opts || []).join(" / ")}\n   why: ${it.why}`));
}
P("\n## Тексты");
for (const t of u.texts) { P(`\n### ${t.title} (${t.genre}) — ${t.ru}`); t.paras.forEach((p, i) => P(`${p.map(show).join(" ")}\n   → ${t.tr?.[i] ?? "—"}`)); }
P("\n## Заметки «по-русски → по-японски»"); (u.notes || []).forEach(x => P(`- ${x.ru} → ${x.jp} — ${x.note}`));
P("\n## Письмо");
(u.output?.tasks || []).forEach(t => P(`\n### ${t.title} (${t.reg})\n${t.situation}\nПлан: ${t.plan.join("; ")}\n${t.incoming ? "Входящее: " + show(t.incoming.jp) : "Заголовок: " + show(t.heading)}\nОбразец: ${t.models.map(show).join(" ")}`));
P("\n## 言い換え (ok — тот же смысл, bad — другой)");
(u.iikae || []).forEach((x, i) => P(`${i + 1}. [${x.g}] ${show(x.jp)} — ${x.ru}\n   ok: ${show(x.ok)}\n   bad: ${x.bad.map(show).join(" / ")}\n   why: ${x.why}`));
P("\n## Кальки (jp — естественно, bad — кальки)");
(u.calques || []).forEach((x, i) => P(`${i + 1}. ${x.ru} → ${show(x.jp)}\n   bad: ${x.bad.map(show).join(" / ")}\n   note: ${x.note}`));
P("\n## Коллокации"); (u.collocations || []).forEach((x, i) => P(`${i + 1}. ${show(x.head)}＿ (${x.ru}) ok: ${x.ok}; bad: ${x.bad.join(", ")} — ${x.why}`));
P("\n## Кому как сказать"); (u.register || []).forEach((x, i) => P(`${i + 1}. ${x.to}: «${x.ru}»\n   ok: ${show(x.ok)}\n   bad: ${x.bad.map(show).join(" / ")}\n   why: ${x.why}`));
P("\n## Ответь репликой"); (u.replies || []).forEach((x, i) => P(`${i + 1}. ${x.from}: ${show(x.jp)}\n   ok: ${show(x.ok)}; bad: ${x.bad.map(show).join(" / ")} — ${x.why}`));
P("\n## Ответь в чате"); (u.chats || []).forEach((x, i) => P(`${i + 1}. ${x.to} (${x.reg}) — ${x.ru}\n   ${x.incoming ? "входящее: " + show(x.incoming.jp) : "заголовок: " + show(x.heading)}\n   образец: ${show(x.model)}`));
P("\n## Слова и фразы юнита");
[...u.words, ...(u.phrases || [])].forEach(id => { const e = dict.words[id]; if (!e) return P(`- ${id}: НЕТ В СЛОВАРЕ`);
  P(`- ${e.w || id}〔${e.r}〕 ${e.pos}${e.reg ? " " + e.reg : ""}: ${e.m.join("; ")}${e.note ? " — " + e.note : ""}${e.col ? " | " + e.col.join(", ") : ""}`); });
P("\n## Кандзи юнита"); for (const c of u.kanji || "") P(`- ${c}: ${K[c]?.m ?? "НЕТ"}; он ${K[c]?.on.join(",")}; кун ${K[c]?.kun.join(",")}`);
console.log(out.join("\n"));
