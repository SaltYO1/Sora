/* Прогресс — локально в IndexedDB (база "sora").
   items   — элементы знания, добавленные в изучение: {id:"w:傘"|"g:noni"|"k:傘", kind, ref, decks[], added}
   cards   — карточки с расписанием FSRS (наполняет движок, задача 3): {id:"w:傘|ru-jp", item, type, due, ...}
   reviews — журнал ответов: {card, at, grade, ...}
   gaps    — «Мои пробелы»: {at, ru, jp, note, item?}
   kv      — настройки и прочее: {k, v}
   Если IndexedDB недоступна (приватный режим, превью) — работаем в памяти. */

const NAME = "sora", VERSION = 1;
const STORES = {
  items: { keyPath: "id", idx: [["kind", "kind"]] },
  cards: { keyPath: "id", idx: [["item", "item"], ["due", "due"]] },
  reviews: { keyPath: "n", auto: true, idx: [["card", "card"], ["at", "at"]] },
  gaps: { keyPath: "n", auto: true, idx: [["at", "at"]] },
  kv: { keyPath: "k" },
};

let dbp = null, mem = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    let req;
    try { req = indexedDB.open(NAME, VERSION); } catch { return res(null); }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, s] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const st = db.createObjectStore(name, { keyPath: s.keyPath, autoIncrement: !!s.auto });
        for (const [n, k] of s.idx || []) st.createIndex(n, k);
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
    req.onblocked = () => res(null);
  }).then(db => {
    if (!db) mem = Object.fromEntries(Object.keys(STORES).map(k => [k, new Map()]));
    return db;
  });
  return dbp;
}

const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function tx(store, mode, fn) {
  const db = await open();
  if (!db) return fn(null);
  const t = db.transaction(store, mode);
  return wrap(fn(t.objectStore(store)));
}

let autoN = 1;
export const db = {
  persistent: async () => !!(await open()),
  get: (s, key) => tx(s, "readonly", st => st ? st.get(key) : mem[s].get(key)),
  all: (s) => tx(s, "readonly", st => st ? st.getAll() : [...mem[s].values()]),
  count: (s) => tx(s, "readonly", st => st ? st.count() : mem[s].size),
  put: (s, val) => tx(s, "readwrite", st => {
    if (st) return st.put(val);
    const kp = STORES[s].keyPath;
    if (STORES[s].auto && val[kp] == null) val = { ...val, [kp]: autoN++ };
    mem[s].set(val[kp], val); return val[kp];
  }),
  del: (s, key) => tx(s, "readwrite", st => st ? st.delete(key) : mem[s].delete(key)),

  async getKV(k, def = null) { const r = await this.get("kv", k); return r ? r.v : def; },
  setKV(k, v) { return this.put("kv", { k, v }); },

  /* Добавить элемент знания в изучение. Повторное добавление дописывает колоду. */
  async addItem(kind, ref, deck) {
    const id = `${kind[0]}:${ref}`;
    const cur = await this.get("items", id);
    const decks = new Set(cur?.decks || []); if (deck) decks.add(deck);
    await this.put("items", { ...(cur || {}), id, kind, ref, decks: [...decks], added: cur?.added || Date.now(), suspended: false });
    return id;
  },
  hasItem: async (kind, ref) => { const i = await db.get("items", `${kind[0]}:${ref}`); return !!i && !i.suspended; },
  /* "none" | "active" | "paused" */
  itemState: async (kind, ref) => { const i = await db.get("items", `${kind[0]}:${ref}`); return !i ? "none" : i.suspended ? "paused" : "active"; },

  /* Экспорт/импорт всего прогресса одним JSON: элементы, карточки, журнал, пробелы, прохождение юнитов, черновики, настройки. */
  async exportAll() {
    const out = { app: "sora-n3", schema: VERSION, at: new Date().toISOString() };
    for (const s of Object.keys(STORES)) out[s] = await this.all(s);
    return out;
  },
  async importAll(data) {
    if (data?.app !== "sora-n3") throw new Error("Это не файл прогресса Sora");
    for (const s of Object.keys(STORES)) for (const row of data[s] || []) await this.put(s, row);
  },
};
