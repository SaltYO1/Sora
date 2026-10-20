/* Игры, пакет 2 — лексика и кандзи: генераторы заданий (движок показа — runQuiz из quiz.js).
     col   «Коллокации» (組み合わせ): 目覚ましを＿ → かける; неверные глаголы — кальки и соседи (units/NN.json → collocations)
     yomi  «Чтения» (読み分け): слово кандзи → чтение из 4; неверные — другие чтения тех же кандзи (予定 → よさだ, ていじ → じょうじ)
     ctx   «Слово в контексте» (文脈): японская фраза из корпуса с пропуском → слово кандзи из 4, без русского
     reg   «Кому как сказать» (言葉づかい): ситуация и адресат → вариант в нужном регистре (units/NN.json → register)
   Чтения выравниваются по kanji.json (он/кун, озвончение, っ); если не выходит — неверные варианты из правок
   долготы, っ и озвончения. */
import { D } from "./data.js";
import { parse, resolve, plain, isKana, hasKanji } from "./markup.js";
import { esc, ruby, renderLine, renderTokens } from "./render.js";

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniq = a => [...new Set(a)];
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const meaning = e => e.m.join("; ");
const wordOf = (id, e) => e.w || id;

/* ---------- чтения кандзи ---------- */
const VOICE = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ" };
const HANDAKU = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
const UNVOICE = Object.fromEntries([...Object.entries(VOICE), ...Object.entries(HANDAKU)].map(([a, b]) => [b, a]));
export const kanjiReadings = ch => { const k = D.kanji[ch]; return k ? uniq([...k.on.map(toHira), ...k.kun.map(x => toHira(x.split(".")[0]))]).filter(Boolean) : []; };
/* как чтение звучит внутри слова: озвончение (二度寝 → ね, 目覚まし → ざ) и っ (日記 → にっ) */
function forms(r) {
  const out = [r];
  if (VOICE[r[0]]) out.push(VOICE[r[0]] + r.slice(1));
  if (HANDAKU[r[0]]) out.push(HANDAKU[r[0]] + r.slice(1));
  if (r.length > 1 && /[つちくき]$/.test(r)) out.push(r.slice(0, -1) + "っ");
  return out;
}
/* 予定/よてい → [{ch:"予", r:"よ", base:"よ", k:true}, {ch:"定", r:"てい", …}]; не вышло — null */
export function alignReading(w, r) {
  const chars = [...w], R = toHira(r);
  const go = (i, j) => {
    if (i === chars.length) return j === R.length ? [] : null;
    const ch = chars[i];
    if (isKana(ch)) { if (toHira(ch) !== R[j]) return null; const rest = go(i + 1, j + 1); return rest && [{ ch, r: R[j], k: false }, ...rest]; }
    for (const base of kanjiReadings(ch)) for (const f of forms(base)) if (R.startsWith(f, j)) {
      const rest = go(i + 1, j + f.length); if (rest) return [{ ch, r: f, base, k: true }, ...rest];
    }
    return null;
  };
  return go(0, 0);
}
/* правдоподобные ошибки чтения: долгота, っ, озвончение, маленькие ゃゅょ */
const okKana = x => !/っ($|[あいうえおなにぬねのまみむめもやゆよらりるれろわをんっゃゅょー])/.test(x) && !/^[っゃゅょん]/.test(x);
function tweaks(R, from = 0, to = R.length) {
  const out = [], at = (i, s, n = 1) => R.slice(0, i) + s + R.slice(i + n);
  for (let i = from; i < to; i++) {
    const c = R[i], nx = R[i + 1];
    if (c === "っ") out.push(at(i, ""));
    if (c === "う" && i > 0 && /[おこそとのほもよろごぞどぼぽょ]/.test(R[i - 1])) out.push(at(i, ""));
    if (c === "い" && i > 0 && /[えけせてねへめれげぜでべぺ]/.test(R[i - 1])) out.push(at(i, ""));
    if (/[こそとのほもよろ]/.test(c) && nx !== "う" && i === R.length - 1 - (R.endsWith("る") ? 1 : 0)) out.push(at(i + 1, "う", 0));
    if (VOICE[c] && i > 0) out.push(at(i, VOICE[c]));
    if (UNVOICE[c]) out.push(at(i, UNVOICE[c]));
    if (/[ゃゅょ]/.test(c)) out.push(at(i, { ゃ: "や", ゅ: "ゆ", ょ: "よ" }[c]));
    if (/[きしちにひみりぎじびぴ]/.test(c) && /[やゆよ]/.test(nx || "")) out.push(at(i + 1, { や: "ゃ", ゆ: "ゅ", よ: "ょ" }[nx]));
    if (/[かきくけこさしすせそたちつてとはひふへほ]/.test(c) && i > 0 && i < R.length - 1 && !/っ/.test(R)) out.push(at(i, "っ" + c));
  }
  return uniq(out).filter(x => x && x !== R && x.length > 1 && okKana(x));
}
/* 3 неверных чтения: сначала другие чтения тех же кандзи, потом правки */
export function readingOptions(w, r) {
  const R = toHira(r), al = alignReading(w, r), swap = new Set();
  if (al) al.forEach((seg, i) => {
    if (!seg.k) return;
    for (const alt of kanjiReadings(seg.ch)) {
      if (alt === seg.base) continue;
      const a = seg.r.endsWith("っ") && /[つちくき]$/.test(alt) ? alt.slice(0, -1) + "っ" : alt;
      swap.add(al.map((s, j) => (j === i ? a : s.r)).join(""));
    }
    if (seg.r !== seg.base) swap.add(al.map((s, j) => (j === i ? seg.base : s.r)).join(""));
  });
  swap.delete(R);
  const out = shuffle([...swap].filter(okKana)).slice(0, 3);
  // правки — только в части, которую читают кандзи (окуригану не трогаем)
  let a = 0, b = R.length;
  if (al) { let p = 0; al.forEach(sg => { if (sg.k) { if (a === 0 && !al.slice(0, al.indexOf(sg)).some(x => x.k)) a = p; b = p + sg.r.length; } p += sg.r.length; }); }
  for (const t of shuffle(tweaks(R, a, b))) { if (out.length >= 3) break; if (!out.includes(t)) out.push(t); }
  // и чтения похожих слов с тем же окончанием (寝る → ねむる, きめる): перепутать 寝 и 眠 — частая ошибка
  // слова с теми же кандзи (毎晩 → まいにち, まいあさ)
  for (const t of shuffle(uniq([...w].flatMap(ch => D.kanjiWords[ch] || [])).map(x => toHira(D.dict.words[x].r)).filter(t => Math.abs(t.length - R.length) <= 2))) {
    if (out.length >= 3) break; if (t !== R && !out.includes(t)) out.push(t);
  }
  if (out.length < 3) for (const t of shuffle(tweaks(R))) { if (out.length >= 3) break; if (!out.includes(t)) out.push(t); }
  if (out.length < 3) {
    const tail = R.slice(b), n = R.length;
    const near = shuffle(Object.entries(D.dict.words).filter(([id, e]) => hasKanji(wordOf(id, e)) && e.pos !== "col" && e.pos !== "phrase"
      && toHira(e.r).endsWith(tail) && Math.abs(e.r.length - n) <= 1).map(([, e]) => toHira(e.r)));
    for (const t of near) { if (out.length >= 3) break; if (t !== R && !out.includes(t)) out.push(t); }
  }
  return out;
}

/* ---------- общие кусочки ---------- */
const lineHTML = src => resolve(parse(src), D.dict, D.grammar).map(t => t.r && t.k !== "part" ? ruby(t.s, t.r) : esc(t.s)).join("");
const plainOf = src => plain(parse(src));
const wordTok = id => { const e = D.dict.words[id]; return { k: "word", s: wordOf(id, e), lemma: id, r: e.r, e }; };
/* после ответа: каждый кандзи слова — значение, он/кун и другие слова с ним (нажимаются) */
function kanjiBlock(w, selfId) {
  const rows = uniq([...w].filter(ch => hasKanji(ch) && D.kanji[ch])).map(ch => {
    const k = D.kanji[ch], others = (D.kanjiWords[ch] || []).filter(id => id !== selfId && D.dict.words[id].pos !== "col").slice(0, 6);
    return `<div class="krow"><span class="kbig jp">${esc(ch)}</span><span class="kinfo"><b>${esc(k.m)}</b>
      <span class="jp rd">${esc([...k.on, ...k.kun].join(" · "))}</span>
      ${others.length ? `<span class="kws jtext sm">${others.map(id => renderTokens([wordTok(id)])).join("、")}</span>` : ""}</span></div>`;
  });
  return rows.length ? `<div class="krows">${rows.join("")}</div>` : "";
}
export const variants = (ok, bad) => `<div class="vars">${[[ok, true], ...bad.map(b => [b, false])].map(([s, good]) =>
  `<div class="var ${good ? "ok" : "bad"}"><span class="vm" aria-label="${good ? "верно" : "неверно"}">${good ? "✓" : "✗"}</span><p class="jtext sm">${renderLine(s)}</p></div>`).join("")}</div>`;

/* ---------- пулы ---------- */
/* слова юнитов с кандзи (для чтений и значений) */
export function kanjiWordsOf(units) {
  return uniq(units.flatMap(u => [...u.words, ...(u.phrases || [])])).filter(id => {
    const e = D.dict.words[id]; return e && e.pos !== "col" && e.pos !== "phrase" && hasKanji(wordOf(id, e));
  });
}

/* ---------- задания ---------- */
export function colTask(it) {
  return { label: "Коллокации", mode: "choice", key: it.key,
    prompt: `<div class="q-jp jp">${lineHTML(it.head)}<span class="gap">＿＿</span></div>`, hint: it.ru,
    options: shuffle([it.ok, ...it.bad]), answers: [it.ok], why: it.why,
    back: `<p class="jtext">${renderLine(`${it.head}[${it.ok}]`)}</p><p class="ans-m">${esc(it.ru)}</p>`,
    jp: plainOf(it.head) + it.ok, ru: it.ru };
}

export function yomiTask(id) {
  const e = D.dict.words[id], w = wordOf(id, e), R = toHira(e.r), bad = readingOptions(w, e.r);
  return { label: "Чтения", mode: "choice", key: `yo:${id}`, item: `w:${id}`,
    prompt: `<div class="q-jp jp">${esc(w)}</div>`, hint: "Как читается?",
    options: shuffle([R, ...bad]), answers: [R],
    back: `<div class="ans-jp jp">${ruby(w, e.r)}</div><div class="ans-m">${esc(meaning(e))}</div>${e.note ? `<p class="ans-n">${esc(e.note)}</p>` : ""}${kanjiBlock(w, id)}`,
    jp: `${w}（${e.r}）`, ru: meaning(e) };
}

/* ---------- «Слово в контексте»: японская фраза с пропуском → слово кандзи из 4, без русского ---------- */
/* класс пропуска: подставляются только слова, которые встанут на место грамматически */
const CLASS = e => /^v/.test(e.pos) ? "v" : e.pos === "adj-i" ? "ai" : e.pos === "adj-na" ? "na" : e.pos === "adv" ? "adv" : e.pos === "n" || e.pos === "n,vs" ? "n" : null;
const fits = (e, cls) => cls === "vs" ? e.pos === "n,vs" : cls === "n" ? e.pos === "n" || e.pos === "n,vs"
  : cls === "v" ? /^v/.test(e.pos) && e.pos !== "vs" : cls === "ai" ? e.pos === "adj-i" : cls === "na" ? e.pos === "adj-na" : cls === "adv" ? e.pos === "adv" : false;
/* где в строке корпуса можно сделать пропуск: глагол и い-прил. — только в словарной форме,
   существительное — целиком или основой перед する (寝坊|しちゃった) */
export function gapOf(l, id) {
  const e = D.dict.words[id], w = wordOf(id, e), cls = CLASS(e); if (!cls) return null;
  const i = l.toks.findIndex(t => t.k === "word" && t.lemma === id); if (i < 0) return null;
  const s = l.toks[i].s;
  if (cls === "v" || cls === "ai") return s === w ? { i, rest: "", cls } : null;
  if (!s.startsWith(w)) return null;
  const rest = s.slice(w.length), vs = /^[しすさせ]/.test(rest);
  if (rest && cls === "n" && !vs) return null;
  if (rest && (cls === "adv")) return null;
  return { i, rest, cls: vs ? "vs" : cls };
}
/* неверные слова: того же класса, с кандзи, не из этих юнитов (слова одной темы часто подходят оба —
   また寝坊しちゃった / また遅刻しちゃった); сначала с общими кандзи — их легко спутать на вид */
/* слова времени взаимозаменяемы (毎朝 / 毎日) — если ответ про время, других слов времени в вариантах нет */
const TIME = new Set(["昨日", "明日", "今日", "今", "朝", "夜", "夕方", "毎朝", "毎晩", "毎日", "最近", "週末", "平日", "今年", "来年", "来月", "来週", "今夜", "今回", "将来", "最初", "最後", "前", "一日", "一週間", "一か月", "休み", "夏休み"]);
const isTime = (id, e) => TIME.has(id) || /[時分]$/.test(wordOf(id, e));
/* корень одного слова внутри другого — часто почти синонимы (起きる / 起き上がる, 目 / 目覚まし) */
const stemOf = w => w.replace(/[ぁ-ん]+$/, "");
const related = (a, b) => { const x = stemOf(a), y = stemOf(b); return !!x && !!y && (a.startsWith(y) || b.startsWith(x)); };
function ctxOptions(id, cls, own) {
  const w = wordOf(id, D.dict.words[id]), time = isTime(id, D.dict.words[id]);
  const all = Object.entries(D.dict.words).filter(([x, xe]) => x !== id && !own.has(x) && fits(xe, cls) && hasKanji(wordOf(x, xe))
    && !(time && isTime(x, xe)) && !related(w, wordOf(x, xe)));
  const share = all.filter(([x, xe]) => [...wordOf(x, xe)].some(ch => hasKanji(ch) && w.includes(ch)));
  const out = [];
  for (const [x, xe] of [...shuffle(share), ...shuffle(all)]) {
    if (out.length >= 3) break;
    const t = wordOf(x, xe); if (t !== w && !out.includes(t)) out.push(t);
  }
  return out;
}
/* пул: слова юнитов, у которых есть хотя бы одна подходящая строка в корпусе */
export function ctxPool(units, lines) {
  const own = new Set(units.flatMap(u => [...u.words, ...(u.phrases || [])]));
  // строка не годится, если слово видно ещё где-то в ней (いい習慣をつける…＿＿になるまで)
  const elsewhere = (l, g, w) => l.toks.some((t, j) => j !== g.i && t.s.includes(w));
  return kanjiWordsOf(units).map(id => { const w = wordOf(id, D.dict.words[id]);
    return { id, own, cands: lines.map(l => ({ l, g: gapOf(l, id) })).filter(c => c.g && !elsewhere(c.l, c.g, w)) };
  }).filter(x => x.cands.length);
}
export function ctxTask({ id, own, cands }) {
  const e = D.dict.words[id], w = wordOf(id, e), { l, g } = cands[Math.floor(Math.random() * cands.length)];
  return { label: "Слово в контексте", mode: "choice", bare: true, contest: true, key: `cx:${id}`, item: `w:${id}`,
    prompt: `<p class="jtext sm">${renderTokens(l.toks, g.i, `<span class="gap">＿＿</span>${esc(g.rest)}`)}</p>`,
    hint: "Какое слово подходит по смыслу?",
    options: shuffle([w, ...ctxOptions(id, g.cls, own)]), answers: [w],
    back: `<p class="jtext sm">${renderTokens(l.toks)}</p><div class="ans-jp jp">${ruby(w, e.r)}</div>${kanjiBlock(w, id)}`,
    jp: `${w}（${e.r}）`, ru: meaning(e) };
}

export function regTask(it) {
  const opts = [it.ok, ...it.bad], labels = Object.fromEntries(opts.map(s => [plainOf(s), lineHTML(s)]));
  return { label: "Кому как сказать", mode: "choice", cols: true, key: it.key,
    prompt: `<div class="q-to">${esc(it.to)}</div><div class="q-ru">«${esc(it.ru)}»</div>`, hint: "Как сказать именно этому человеку?",
    options: shuffle(opts.map(plainOf)), labels, answers: [plainOf(it.ok)], why: it.why,
    back: variants(it.ok, it.bad), jp: plainOf(it.ok), ru: it.ru };
}
