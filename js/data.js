/* Загрузка учебных данных из data/*.json. Всё статично, кэшируется service worker'ом. */
import { hasKanji } from "./markup.js";

const cache = new Map();
export function json(path) {
  if (!cache.has(path)) cache.set(path, fetch(`data/${path}`).then(r => {
    if (!r.ok) throw new Error(`data/${path}: ${r.status}`);
    return r.json();
  }));
  return cache.get(path);
}

export const D = { dict: null, grammar: null, kanji: null, course: null, library: null, kanjiWords: null };

export async function boot() {
  const [dict, grammar, kanji, course, library] = await Promise.all(
    ["dict.json", "grammar.json", "kanji.json", "course.json", "library/index.json"].map(json));
  Object.assign(D, { dict, grammar: grammar.items, kanji: kanji.items, similar: kanji.similar || [], course, library: library.texts });
  // кандзи → слова словаря, где он встречается
  D.kanjiWords = {};
  for (const [id, e] of Object.entries(dict.words)) for (const ch of new Set(e.w || id))
    if (hasKanji(ch)) (D.kanjiWords[ch] ||= []).push(id);
  D.units = course.blocks.flatMap(b => b.units.map(u => ({ ...u, block: b.id, blockTitle: b.title })));
  return D;
}

export const word = id => D.dict.words[id] || null;
export const bank = gid => json("banks/index.json").then(ix => ix.banks.includes(gid) ? json(`banks/${gid}.json`) : null).catch(() => null);
export const unitFile = n => { const u = D.units.find(x => x.n === n); return u?.file ? json(u.file) : Promise.resolve(null); };
export const libText = id => { const t = D.library.find(x => x.id === id); return t ? json(t.file) : Promise.resolve(null); };

export const POS = {
  "n": "сущ.", "v1": "глагол ichidan", "v5": "глагол godan", "vk": "глагол 来る", "vs": "глагол する",
  "n,vs": "сущ. / する-глагол", "adj-i": "い-прил.", "adj-na": "な-прил.", "adv": "наречие", "conj": "союз",
  "pron": "местоимение", "propn": "имя собств.", "col": "коллокация", "phrase": "фраза", "exp": "выражение",
};
export const REG = { colloq: "разговорное", polite: "вежливое", keigo: "кэйго", formal: "официальное", written: "книжное", slang: "сленг" };
