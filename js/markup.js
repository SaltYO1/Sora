/* Разметка v2 — чистые функции без DOM (работают и в браузере, и в node для валидатора).

   [слово]                    слово из словаря (id = написание)
   [форма=лемма]              изменённая форма: 終わって=終わる
   [форма:чтение]             явное чтение (исключения, слова вне словаря)
   [форма=лемма:чтение#2]     всё вместе; #2 — номер значения в словаре (с 1)
   (частица)                  частица; значение берётся из общего списка
   (частица:пояснение)        частица с пояснением именно для этого места
   {текст|id}                 грамматика; id из grammar.json
   {текст}                    просто выделение без ссылки
   Всё остальное — обычный текст. ASCII-пробелы вне скобок игнорируются,
   так что разметку можно расставлять пробелами для читаемости.
   \[ \] \( \) \{ \} — буквальные символы.
*/

const KANA = /[぀-ヿ]/;
const KANJI = /[㐀-鿿豈-﫿々〆ヶ]/;
export const isKana = ch => KANA.test(ch);
export const hasKanji = s => KANJI.test(s);

const CLOSE = { "[": "]", "(": ")", "{": "}" };

export function parse(src) {
  const out = [];
  let text = "";
  const flush = () => { if (text) { out.push({ k: "text", s: text }); text = ""; } };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) { text += src[++i]; continue; }
    if (ch === " " || ch === "\t" || ch === "\n") continue;
    if (CLOSE[ch]) {
      const end = src.indexOf(CLOSE[ch], i + 1);
      if (end < 0) { text += ch; continue; }
      flush();
      out.push(token(ch, src.slice(i + 1, end).trim()));
      i = end;
      continue;
    }
    text += ch;
  }
  flush();
  return out;
}

function token(open, body) {
  if (open === "{") {
    const bar = body.indexOf("|");
    return bar < 0 ? { k: "gram", s: body, g: null } : { k: "gram", s: body.slice(0, bar), g: body.slice(bar + 1).trim() };
  }
  if (open === "(") {
    const c = body.indexOf(":");
    return c < 0 ? { k: "part", s: body } : { k: "part", s: body.slice(0, c), note: body.slice(c + 1).trim() };
  }
  // word: форма(=лемма)?(:чтение)?(#n)?
  let rest = body, sense = null, reading = null, lemma = null;
  const h = rest.lastIndexOf("#");
  if (h > 0 && /^\d+$/.test(rest.slice(h + 1))) { sense = +rest.slice(h + 1); rest = rest.slice(0, h); }
  const c = rest.indexOf(":");
  if (c >= 0) { reading = rest.slice(c + 1).trim(); rest = rest.slice(0, c); }
  const e = rest.indexOf("=");
  if (e >= 0) { lemma = rest.slice(e + 1).trim(); rest = rest.slice(0, e); }
  const s = rest.trim();
  return { k: "word", s, lemma: lemma || s, reading, sense };
}

/* Чтение изменённой формы по чтению леммы.
   終わる/おわる + 終わって → おわって; 思い出す/おもいだす + 思い出した → おもいだした */
export function deriveReading(lemma, lemmaR, surface) {
  if (surface === lemma) return lemmaR;
  if (!hasKanji(surface)) return surface;
  // 来る — чтение основы зависит от формы
  if (lemma.endsWith("来る") && surface.startsWith(lemma.slice(0, -1))) {
    const base = lemma.slice(0, -2), baseR = lemmaR.slice(0, -2);
    const after = surface.slice(base.length + 1), n = after[0] || "";
    const k = "まてたちそ".includes(n) ? "き" : "なよらさいずせ".includes(n) ? "こ" : "く";
    return baseR + k + after;
  }
  let tail = 0;
  while (tail < lemma.length && isKana(lemma[lemma.length - 1 - tail])) tail++;
  const stemW = lemma.slice(0, lemma.length - tail);
  const tailW = lemma.slice(lemma.length - tail);
  if (!lemmaR.endsWith(tailW) || !surface.startsWith(stemW)) return null;
  const stemR = lemmaR.slice(0, lemmaR.length - tail);
  const restS = surface.slice(stemW.length);
  if (hasKanji(restS)) return null;
  return stemR + restS;
}

/* Фуригана по сегментам: 思い出した/おもいだした → 思(おも)い出(だ)した */
export function rubySegments(s, r) {
  if (!r || !hasKanji(s)) return [{ t: s }];
  const parts = [];
  let buf = "", kanjiRun = null;
  for (const ch of s) {
    const kj = !isKana(ch);
    if (kanjiRun === null || kj === kanjiRun) buf += ch;
    else { parts.push({ t: buf, kj: kanjiRun }); buf = ch; }
    kanjiRun = kj;
  }
  parts.push({ t: buf, kj: kanjiRun });
  const toHira = x => x.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const reSrc = parts.map(p => p.kj ? "(.+?)" : "(" + toHira(p.t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")").join("");
  const m = new RegExp("^" + reSrc + "$").exec(toHira(r));
  if (!m) return [{ t: s, r }];
  return parts.map((p, i) => p.kj ? { t: p.t, r: m[i + 1] } : { t: p.t });
}

/* Слово внутри грамматического кусочка: 寝ようとした → 寝る (ねようとした), 我慢しようとした → 我慢.
   Берётся самая длинная основа слова из словаря, с которой начинается текст; без кандзи — null.
   Пары 自動詞・他動詞 с одной основой (出る / 出す, 消える / 消す, 開く / 開ける) различаются по окуригане
   и по тому, может ли следующая кана быть формой этого глагола: 出して — す-ряд (出す), 出よう — 一段 (出る). */
const GODAN = { う: "わいうえおっ", く: "かきくけこいっ", ぐ: "がぎぐげごい", す: "さしすせそ", つ: "たちつてとっ", ぬ: "なにぬねのん", ぶ: "ばびぶべぼん", む: "まみむめもん", る: "らりるれろっ" };
const ICHIDAN = "ないますてたよさらられろずん";
function conjFit(e, okuri, rest, k) {
  if (!okuri || k !== okuri.length - 1) return 0;          // общая часть окуриганы должна совпасть целиком
  const last = okuri[okuri.length - 1], next = rest[okuri.length - 1];
  if (!next) return 0;
  if (e.pos === "v5") return (GODAN[last] || "").includes(next) ? 1 : 0;
  if (e.pos === "v1") return ICHIDAN.includes(next) ? 0.5 : 0;
  return 0;
}
const innerCache = new WeakMap();
export function innerWord(s, dict) {
  if (!s || !hasKanji(s)) return null;
  let c = innerCache.get(dict); if (!c) innerCache.set(dict, c = new Map());
  if (c.has(s)) return c.get(s);
  let best = null;
  for (const [id, e] of Object.entries(dict.words)) {
    const w = e.w || id;
    if (!hasKanji(w) || e.pos === "col" || e.pos === "phrase") continue;
    let tail = 0; while (tail < w.length && isKana(w[w.length - 1 - tail])) tail++;
    const stem = w.slice(0, w.length - tail);
    if (!s.startsWith(stem)) continue;
    // длиннее основа — лучше; при равной — у кого окуригана совпадает с текстом (降りよう → 降りる, а не 降る),
    // затем — чья форма возможна дальше (出して → 出す, 出よう → 出る)
    const okuri = w.slice(stem.length), rest = s.slice(stem.length);
    let k = 0; while (k < okuri.length - 1 && okuri[k] === rest[k]) k++;
    const score = stem.length * 10 + k * 2 + conjFit(e, okuri, rest, k);
    if (best && score <= best.score) continue;
    const r = deriveReading(w, e.r, s);
    if (r) best = { lemma: id, e, r, stem, score };
  }
  c.set(s, best);
  return best;
}

/* Собрать токены со словарём: добавляет entry, чтение формы, ошибки. */
export function resolve(tokens, dict, grammar) {
  return tokens.map(t => {
    if (t.k === "word") {
      const e = dict.words[t.lemma] || null;
      const r = t.reading || (e ? deriveReading(e.w || t.lemma, e.r, t.s) : null);
      const err = !e ? "нет в словаре" : (hasKanji(t.s) && !r ? "не выводится чтение" : null);
      return { ...t, e, r: r || (hasKanji(t.s) ? null : t.s), err };
    }
    if (t.k === "part") {
      const p = dict.particles?.[t.s] || null;
      return { ...t, p, err: !p && !t.note ? "частицы нет в списке" : null };
    }
    if (t.k === "gram" && t.g) {
      const g = grammar?.[t.g] || null, inner = innerWord(t.s, dict);
      return { ...t, gEntry: g, inner, r: inner?.r || null, err: g ? null : "нет в grammar.json" };
    }
    return t;
  });
}

/* Плоский текст строки (для поиска, сравнения ответов). */
export const plain = tokens => tokens.map(t => t.s).join("");
