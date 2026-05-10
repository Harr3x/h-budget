import { state, saveState, uid } from './state.js';
import { todayIso, todayYearMonth, yearMonthOf, nextYearMonth, isoForYmDay } from './date-utils.js';

export function instantiateRecurring() {
  const todayIsoStr = todayIso();
  const currentYm = todayYearMonth();
  let changed = false;

  for (const rec of state.recurring) {
    if (!rec.startYearMonth) continue;
    let ym = rec.startYearMonth;
    while (ym <= currentYm) {
      if (rec.endYearMonth && ym > rec.endYearMonth) break;

      const existing = state.transactions.find(t => t.recurringId === rec.id && yearMonthOf(t.date) === ym);
      if (!existing) {
        const dateStr = isoForYmDay(ym, rec.dayOfMonth || 1);
        const eligible = (ym < currentYm) || (ym === currentYm && dateStr <= todayIsoStr);
        if (eligible) {
          state.transactions.push({
            id: uid(),
            date: dateStr,
            amountCents: rec.amountCents,
            categoryId: rec.categoryId,
            note: rec.note || '',
            recurringId: rec.id,
          });
          rec.lastInstantiatedYearMonth = ym;
          changed = true;
        }
      }
      ym = nextYearMonth(ym);
    }
  }
  if (changed) saveState();
}
