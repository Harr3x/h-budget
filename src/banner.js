import { state, saveState } from './state.js';
import { todayYearMonth } from './date-utils.js';

export function maybeShowMonthBanner() {
  const ym = todayYearMonth();
  if (state.lastReminderShownYearMonth === ym) return;
  const banner = document.getElementById('reminder-banner');
  banner.classList.remove('hidden');
  document.getElementById('reminder-dismiss').addEventListener('click', () => {
    state.lastReminderShownYearMonth = ym;
    saveState();
    banner.classList.add('hidden');
  }, { once: true });
}
