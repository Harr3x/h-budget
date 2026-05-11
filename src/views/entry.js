import { state, saveState, uid } from '../state.js';
import { parseEURInput, formatEUR, escapeHtml, escapeAttr } from '../formatters.js';
import { todayIso, yearMonthOf } from '../date-utils.js';
import { potById, categoryById } from '../queries.js';
import { toast, openSheet, closeSheet } from '../toast.js';
import { instantiateRecurring } from '../recurring.js';
import { render } from '../render.js';

export let entryDraft = {
  amountStr: '',
  categoryId: null,
  note: '',
  date: todayIso(),
  recurring: false,
};

export function resetEntryDraft() {
  entryDraft = { amountStr: '', categoryId: null, note: '', date: todayIso(), recurring: false };
}

export function renderEntry(root) {
  const cents = parseEURInput(entryDraft.amountStr);
  const preview = cents != null ? formatEUR(cents) : '—';

  const potOrder = new Map(state.pots.map((p, i) => [p.id, i]));
  const sortedCats = state.categories
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const pa = potOrder.has(a.c.potId) ? potOrder.get(a.c.potId) : Infinity;
      const pb = potOrder.has(b.c.potId) ? potOrder.get(b.c.potId) : Infinity;
      if (pa !== pb) return pa - pb;
      return a.i - b.i;
    })
    .map(x => x.c);

  const canSave = cents != null && !!entryDraft.categoryId;

  root.innerHTML = `
    <div class="entry-sticky">
      <div class="entry-amount">
        <input id="amount-input" type="text" inputmode="decimal" autocomplete="off"
               enterkeyhint="done"
               placeholder="0,00" value="${escapeAttr(entryDraft.amountStr)}">
        <span class="currency">€</span>
        <button class="save-check ${canSave ? 'active' : ''}" id="save-btn" ${canSave ? '' : 'disabled'} aria-label="Speichern">✓</button>
      </div>
      <div class="entry-preview" id="entry-preview">${cents == null ? (entryDraft.amountStr ? 'ungültig' : '&nbsp;') : preview}</div>
    </div>

    <div class="cat-grid" id="cat-grid">
      ${sortedCats.map(c => {
        const pot = potById(c.potId);
        const color = pot ? pot.color : '#888888';
        const sel = entryDraft.categoryId === c.id;
        const bg = sel ? color + '55' : color + '22';
        const bd = sel ? color : color + '44';
        return `<button class="cat-chip ${sel ? 'selected' : ''}" data-cat="${c.id}" style="background:${bg};border-color:${bd};">
          <span>${escapeHtml(c.name)}</span>
        </button>`;
      }).join('')}
      <button class="cat-chip add" id="cat-add">+ Neu</button>
    </div>

    <div class="options-row">
      <input id="note-input" type="text" placeholder="📝 Notiz" value="${escapeAttr(entryDraft.note)}" aria-label="Notiz">
      <input id="date-input" type="date" value="${entryDraft.date}" aria-label="Datum">
      <button class="recur-pill ${entryDraft.recurring ? 'on' : ''}" id="recur-toggle" aria-label="Wiederkehrend" aria-pressed="${entryDraft.recurring}">🔁</button>
    </div>
  `;

  const amtInput = root.querySelector('#amount-input');
  const previewEl = root.querySelector('#entry-preview');
  const saveBtn = root.querySelector('#save-btn');

  amtInput.addEventListener('input', e => {
    entryDraft.amountStr = e.target.value;
    const c = parseEURInput(entryDraft.amountStr);
    previewEl.innerHTML = c != null ? formatEUR(c) : (entryDraft.amountStr ? 'ungültig' : '&nbsp;');
    const ok = c != null && !!entryDraft.categoryId;
    saveBtn.disabled = !ok;
    saveBtn.classList.toggle('active', ok);
  });
  amtInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); amtInput.blur(); }
  });
  amtInput.focus();

  root.querySelector('#cat-grid').addEventListener('click', e => {
    const chip = e.target.closest('.cat-chip[data-cat]');
    if (!chip) return;
    entryDraft.categoryId = chip.dataset.cat;
    render();
    const a = document.getElementById('amount-input');
    if (a && !entryDraft.amountStr) a.focus();
  });

  root.querySelector('#cat-add').addEventListener('click', openNewCategorySheet);

  root.querySelector('#note-input').addEventListener('input', e => {
    entryDraft.note = e.target.value;
  });
  root.querySelector('#date-input').addEventListener('change', e => {
    entryDraft.date = e.target.value;
  });
  root.querySelector('#recur-toggle').addEventListener('click', () => {
    entryDraft.recurring = !entryDraft.recurring;
    render();
  });

  saveBtn.addEventListener('click', saveEntry);
}

export function saveEntry() {
  const cents = parseEURInput(entryDraft.amountStr);
  if (cents == null || !entryDraft.categoryId) return;

  const cat = categoryById(entryDraft.categoryId);

  if (entryDraft.recurring) {
    const startYm = yearMonthOf(entryDraft.date);
    const dayOfMonth = parseInt(entryDraft.date.slice(-2), 10);
    openRecurringSetupSheet({
      amountCents: cents,
      categoryId: entryDraft.categoryId,
      note: entryDraft.note,
      dayOfMonth,
      startYearMonth: startYm,
    });
    return;
  }

  state.transactions.push({
    id: uid(),
    date: entryDraft.date,
    amountCents: cents,
    categoryId: entryDraft.categoryId,
    note: entryDraft.note || '',
    recurringId: null,
  });
  saveState();
  toast(`✓ ${formatEUR(cents)} · ${cat ? cat.name : ''}`);
  entryDraft = { amountStr: '', categoryId: null, note: '', date: todayIso(), recurring: false };
  render();
}

export function openRecurringSetupSheet(prefill) {
  const html = `
    <h2>Wiederkehrend einrichten</h2>
    <div class="field">
      <label>Tag im Monat</label>
      <input id="rec-day" type="number" min="1" max="31" value="${prefill.dayOfMonth}">
    </div>
    <div class="field">
      <label>Ab Monat</label>
      <input id="rec-start" type="month" value="${prefill.startYearMonth}">
    </div>
    <div class="field">
      <label>Bis Monat (optional)</label>
      <input id="rec-end" type="month" value="">
    </div>
    <div class="actions-row">
      <button class="btn-secondary" id="rec-cancel">Abbrechen</button>
      <button class="btn-primary" id="rec-save" style="margin-top:0">Anlegen</button>
    </div>
  `;
  openSheet(html, sheet => {
    sheet.querySelector('#rec-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#rec-save').addEventListener('click', () => {
      const day = parseInt(sheet.querySelector('#rec-day').value, 10) || prefill.dayOfMonth;
      const start = sheet.querySelector('#rec-start').value || prefill.startYearMonth;
      const end = sheet.querySelector('#rec-end').value || null;
      const recId = uid();
      state.recurring.push({
        id: recId,
        amountCents: prefill.amountCents,
        categoryId: prefill.categoryId,
        note: prefill.note || '',
        dayOfMonth: Math.min(31, Math.max(1, day)),
        startYearMonth: start,
        endYearMonth: end,
        lastInstantiatedYearMonth: null,
      });
      saveState();
      instantiateRecurring();
      const cat = categoryById(prefill.categoryId);
      toast(`🔁 Fixkosten · ${cat ? cat.name : ''}`);
      entryDraft = { amountStr: '', categoryId: null, note: '', date: todayIso(), recurring: false };
      closeSheet();
      render();
    });
  });
}

export function openNewCategorySheet() {
  const html = `
    <h2>Neue Kategorie</h2>
    <div class="field">
      <label>Name</label>
      <input id="new-cat-name" type="text" placeholder="z. B. Drogerie">
    </div>
    <div class="field">
      <label>Topf</label>
      <select id="new-cat-pot">
        ${state.pots.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="actions-row">
      <button class="btn-secondary" id="cat-cancel">Abbrechen</button>
      <button class="btn-primary" id="cat-save" style="margin-top:0">Anlegen</button>
    </div>
  `;
  openSheet(html, sheet => {
    sheet.querySelector('#new-cat-name').focus();
    sheet.querySelector('#cat-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#cat-save').addEventListener('click', () => {
      const name = sheet.querySelector('#new-cat-name').value.trim();
      const potId = sheet.querySelector('#new-cat-pot').value;
      if (!name) return;
      const id = uid();
      state.categories.push({ id, name, potId });
      saveState();
      entryDraft.categoryId = id;
      closeSheet();
      render();
    });
  });
}
