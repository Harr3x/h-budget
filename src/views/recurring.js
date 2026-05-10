import { state, saveState } from '../state.js';
import { formatEUR, formatDateIso, formatYearMonth, escapeHtml, escapeAttr, parseEURInput } from '../formatters.js';
import { todayYearMonth, todayIso, nextYearMonth, isoForYmDay } from '../date-utils.js';
import { categoryById, potById } from '../queries.js';
import { renderPotPieSVG } from '../charts.js';
import { toast, openSheet, closeSheet } from '../toast.js';
import { render } from '../render.js';

export function renderRecurring(root) {
  if (state.recurring.length === 0) {
    root.innerHTML = `
      <div class="empty">Noch keine wiederkehrenden Transaktionen.<br>
      Beim Eintragen einer neuen Ausgabe kannst du sie als wiederkehrend markieren.</div>
    `;
    return;
  }

  const ym = todayYearMonth();
  const activeRecs = state.recurring.filter(r => !r.endYearMonth || r.endYearMonth >= ym);
  const monthlyTotal = activeRecs.reduce((s, r) => s + r.amountCents, 0);

  const perPot = new Map();
  for (const r of activeRecs) {
    const cat = categoryById(r.categoryId);
    if (!cat) continue;
    perPot.set(cat.potId, (perPot.get(cat.potId) || 0) + r.amountCents);
  }

  root.innerHTML = `
    <div class="month-total">
      <div class="label">Aktive Fixkosten / Monat</div>
      <div class="amount">${formatEUR(monthlyTotal)}</div>
      ${monthlyTotal > 0 ? `<div class="pot-pie">${renderPotPieSVG([...perPot.entries()].map(([pid, sum]) => ({ value: sum, color: (potById(pid) || {}).color || '#888' })))}</div>` : ''}
      <div style="margin-top:10px; font-size:13px; color:var(--fg-dim); display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
        ${[...perPot.entries()].map(([pid, sum]) => {
          const p = potById(pid);
          return `<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${p ? p.color : '#888'}; margin-right:5px;"></span>${p ? escapeHtml(p.name) : '?'}: ${formatEUR(sum)}</span>`;
        }).join('')}
      </div>
    </div>

    ${state.recurring.map(r => {
      const cat = categoryById(r.categoryId);
      const pot = cat ? potById(cat.potId) : null;
      const ended = r.endYearMonth && r.endYearMonth < ym;
      const nextYm = ended ? null : (todayIso().slice(-2) >= String(r.dayOfMonth).padStart(2, '0') ? nextYearMonth(ym) : ym);
      const nextDate = nextYm ? isoForYmDay(nextYm, r.dayOfMonth) : null;
      return `
        <div class="rec ${ended ? 'ended' : ''}" data-rec="${r.id}">
          <div class="top">
            <span class="dot" style="background:${pot ? pot.color : '#888'}"></span>
            <span class="name">${cat ? escapeHtml(cat.name) : '—'}${r.note ? ' · ' + escapeHtml(r.note) : ''}</span>
            <span class="amount">${formatEUR(r.amountCents)}</span>
          </div>
          <div class="meta">
            Tag ${r.dayOfMonth} im Monat
            ${ended ? '· beendet' : (nextDate ? '· nächste am ' + formatDateIso(nextDate) : '')}
            ${r.endYearMonth ? '· bis ' + formatYearMonth(r.endYearMonth) : ''}
          </div>
        </div>
      `;
    }).join('')}
  `;

  root.querySelectorAll('.rec').forEach(el => {
    el.addEventListener('click', () => openRecurringEditSheet(el.dataset.rec));
  });
}

export function openRecurringEditSheet(recId) {
  const rec = state.recurring.find(r => r.id === recId);
  if (!rec) return;
  const html = `
    <h2>Fixkosten bearbeiten</h2>
    <div class="field">
      <label>Betrag</label>
      <input id="rec-amount" type="text" inputmode="decimal" value="${(rec.amountCents/100).toString().replace('.', ',')}">
    </div>
    <div class="field">
      <label>Kategorie</label>
      <select id="rec-cat">
        ${state.categories.map(c => `<option value="${c.id}" ${c.id === rec.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Tag im Monat</label>
      <input id="rec-day" type="number" min="1" max="31" value="${rec.dayOfMonth}">
    </div>
    <div class="field">
      <label>Notiz</label>
      <input id="rec-note" type="text" value="${escapeAttr(rec.note || '')}">
    </div>
    <div class="field">
      <label>Bis Monat (optional, leer = unbegrenzt)</label>
      <input id="rec-end" type="month" value="${rec.endYearMonth || ''}">
    </div>
    <div class="actions-row">
      <button class="btn-danger" id="rec-del">Löschen</button>
      <button class="btn-primary" id="rec-save" style="margin-top:0">Speichern</button>
    </div>
    <button class="btn-secondary" id="rec-cancel" style="width:100%; margin-top:8px;">Abbrechen</button>
  `;
  openSheet(html, sheet => {
    sheet.querySelector('#rec-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#rec-del').addEventListener('click', () => {
      const alsoTxs = confirm('Fixkosten löschen.\n\nOK = inklusive aller bisher erzeugten Transaktionen löschen.\nAbbrechen = nur Template löschen, Transaktionen behalten.');
      state.recurring = state.recurring.filter(r => r.id !== recId);
      if (alsoTxs) {
        state.transactions = state.transactions.filter(t => t.recurringId !== recId);
      } else {
        state.transactions.forEach(t => { if (t.recurringId === recId) t.recurringId = null; });
      }
      saveState();
      closeSheet();
      render();
    });
    sheet.querySelector('#rec-save').addEventListener('click', () => {
      const cents = parseEURInput(sheet.querySelector('#rec-amount').value);
      if (cents == null) { toast('Ungültiger Betrag'); return; }
      rec.amountCents = cents;
      rec.categoryId = sheet.querySelector('#rec-cat').value;
      rec.dayOfMonth = Math.min(31, Math.max(1, parseInt(sheet.querySelector('#rec-day').value, 10) || rec.dayOfMonth));
      rec.note = sheet.querySelector('#rec-note').value;
      rec.endYearMonth = sheet.querySelector('#rec-end').value || null;
      saveState();
      closeSheet();
      render();
    });
  });
}
