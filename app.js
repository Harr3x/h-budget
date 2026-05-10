import { applyTheme } from './src/theme.js';
import { state } from './src/state.js';
import { instantiateRecurring } from './src/recurring.js';
import { setTab } from './src/render.js';
import { maybeShowMonthBanner } from './src/banner.js';

function init() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme();
  });

  document.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });

  instantiateRecurring();
  setTab('entry');
  maybeShowMonthBanner();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW reg failed', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
