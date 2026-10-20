/* Облегчённый FSRS (формулы FSRS-4.5, параметры по умолчанию). Чистые функции, работают и в node.
   Карточка: {state:"new"|"learning"|"review"|"relearning", s, d, due, last, reps, lapses}
   Оценки: 1 Снова · 2 Трудно · 3 Хорошо · 4 Легко. Целевая вероятность вспомнить — 90 %. */

export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367,
  1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RETENTION = 0.9;
export const DAY = 864e5, MIN = 6e4;
export const RELEARN_DELAY = 10 * MIN;   // «Снова» — вернётся в этой же сессии
const MAX_IVL = 3650;
const FIRST_STEP = { 2: 1, 3: 2, 4: 4 };

const clampD = d => Math.min(10, Math.max(1, d));
const initS = g => W[g - 1];
const initD = g => clampD(W[4] - (g - 3) * W[5]);
export const retrievability = (elapsedDays, s) => Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
const nextIvl = s => Math.min(MAX_IVL, Math.max(1, Math.round(s / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1))));

function nextD(d, g) {
  const d1 = d - W[6] * (g - 3);
  return clampD(W[7] * initD(4) + (1 - W[7]) * d1);
}
function recallS(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}
function forgetS(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

function fuzz(days, rnd) {
  if (days < 3) return days;
  const f = Math.max(1, Math.round(days * 0.05));
  return days - f + Math.floor(rnd() * (2 * f + 1));
}

/* Новое состояние карточки после оценки g в момент now. rnd — для разброса интервалов (тестам можно подменить). */
export function review(card, g, now = Date.now(), rnd = Math.random) {
  const c = { ...card, reps: (card.reps || 0) + 1, lapses: card.lapses || 0 };
  if (!card.state || card.state === "new" || card.s == null) {
    c.s = initS(g); c.d = initD(g);
  } else {
    const elapsed = Math.max(0, (now - (card.last || now)) / DAY);
    const r = retrievability(elapsed, card.s);
    c.d = nextD(card.d, g);
    c.s = g === 1 ? forgetS(card.d, card.s, r) : recallS(card.d, card.s, r, g);
  }
  c.last = now;
  if (g === 1) {
    if (card.state === "review") c.lapses++;
    c.state = card.state === "review" || card.state === "relearning" ? "relearning" : "learning";
    c.due = now + RELEARN_DELAY;
    c.ivl = 0;
  } else {
    c.state = "review";
    c.ivl = fuzz(nextIvl(c.s), rnd);
    // первый шаг для ещё не выученных: Трудно 1 д, Хорошо 2 д, Легко 4 д
    if (!card.state || card.state === "new" || card.state === "learning") c.ivl = Math.min(c.ivl, FIRST_STEP[g]);
    c.due = now + c.ivl * DAY;
  }
  return c;
}

/* Что будет при каждой оценке — для подписей на кнопках. */
export function preview(card, now = Date.now()) {
  return [1, 2, 3, 4].map(g => review(card, g, now, () => 0.5));
}

export function fmtIvl(c) {
  if (c.ivl === 0) return "10 мин";
  const d = c.ivl;
  if (d < 30) return `${d} д`;
  if (d < 365) return `${Math.round(d / 30)} мес`;
  return `${(d / 365).toFixed(1).replace(".0", "")} г`;
}
