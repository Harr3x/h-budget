import { renderEntry } from './views/entry.js';
import { renderOverview } from './views/overview.js';
import { renderHistory } from './views/history.js';
import { renderRecurring } from './views/recurring.js';
import { renderSettings } from './views/settings.js';
import { escapeHtml } from './formatters.js';

export let activeTab = 'entry';

export function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  render();
}

export function render() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const titles = { entry: 'Neue Ausgabe', overview: 'Übersicht', history: 'Verlauf', recurring: 'Fixkosten', settings: 'Einstellungen' };
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = titles[activeTab] || '';
  try {
    if      (activeTab === 'entry')     renderEntry(view);
    else if (activeTab === 'overview')  renderOverview(view);
    else if (activeTab === 'history')   renderHistory(view);
    else if (activeTab === 'recurring') renderRecurring(view);
    else if (activeTab === 'settings')  renderSettings(view);
  } catch (err) {
    console.error('render() failed for tab', activeTab, err);
    view.innerHTML = `<div class="empty">Fehler beim Laden der Ansicht.<br><small>${escapeHtml(err.message)}</small></div>`;
  }
}
