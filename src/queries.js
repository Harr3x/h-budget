import { state } from './state.js';
import { yearMonthOf, todayYearMonth, prevYearMonth } from './date-utils.js';

export function potById(id) { return state.pots.find(p => p.id === id); }
export function categoryById(id) { return state.categories.find(c => c.id === id); }
export function potOfCategory(catId) {
  const c = categoryById(catId);
  return c ? potById(c.potId) : null;
}
export function potBudgetCents(pot) {
  if (pot.monthlyAmountCents != null) return pot.monthlyAmountCents;
  return Math.round((state.income * (pot.percent || 0)) / 100);
}

export function txsForMonth(ym) {
  return state.transactions.filter(t => yearMonthOf(t.date) === ym);
}
export function spentInPotForMonth(potId, ym) {
  let sum = 0;
  for (const t of txsForMonth(ym)) {
    const c = categoryById(t.categoryId);
    if (c && c.potId === potId) sum += t.amountCents;
  }
  return sum;
}
export function spentInCategoryForMonth(catId, ym) {
  let sum = 0;
  for (const t of txsForMonth(ym)) {
    if (t.categoryId === catId) sum += t.amountCents;
  }
  return sum;
}

export function monthlyTotalsForLastN(n) {
  const out = [];
  let ym = todayYearMonth();
  for (let i = 0; i < n; i++) {
    const total = txsForMonth(ym).reduce((s, t) => s + t.amountCents, 0);
    out.unshift({ ym, total, isCurrent: i === 0 });
    ym = prevYearMonth(ym);
  }
  return out;
}
