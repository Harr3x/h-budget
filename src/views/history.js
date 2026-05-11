import { state, saveState } from '../state.js';
import { formatEUR, formatDateIso, formatDayHeader, escapeHtml, escapeAttr, parseEURInput } from '../formatters.js';
import { yearMonthOf } from '../date-utils.js';
import { categoryById, potById, txsForMonth, monthlyTotalsForLastN } from '../queries.js';
import { toast, openSheet, closeSheet } from '../toast.js';
import { render } from '../render.js';
import { renderHistoryBarChart } from '../charts.js';

export function renderHistory(root) {
  const txs = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if (txs.length === 0) {
    root.innerHTML = `<div class="empty">Noch keine Transaktionen.</div>`;
    return;
  }

  const months = monthlyTotalsForLastN(6);
  const current = months[months.length - 1];
  const closed = months.filter(m => !m.isCurrent);
  const closedNonZero = closed.filter(m => m.total > 0);
  const avg = closedNonZero.length >= 2
    ? Math.round(closed.reduce((s, m) => s + m.total, 0) / closed.length)
    : null;
  const chartSvg = renderHistoryBarChart();
  const chartHtml = chartSvg ? `
    <div class="history-chart">
      ${chartSvg}
      <div class="history-chart-meta">
        <span>${avg != null ? 'Ø ' + formatEUR(avg) : ' '}</span>
        <span>aktuell ${formatEUR(current.total)}</span>
      </div>
    </div>
  ` : '';
  const groups = new Map();
  for (const t of txs) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }

  const groupHtml = [...groups.entries()].map(([date, items]) => {
    const dayTotal = items.reduce((s, t) => s + t.amountCents, 0);
    return `
      <div class="day-group">
        <h3>${formatDayHeader(date)} · ${formatEUR(dayTotal)}</h3>
        ${items.map(t => {
          const cat = categoryById(t.categoryId);
          const pot = cat ? potById(cat.potId) : null;
          return `
            <div class="tx" data-tx="${t.id}">
              <span class="dot" style="background:${pot ? pot.color : '#888'}"></span>
              <div class="info">
                <div class="cat">${cat ? escapeHtml(cat.name) : '—'} ${t.recurringId ? '<span class="recur-icon">🔁</span>' : ''}</div>
                ${t.note ? `<div class="note">${escapeHtml(t.note)}</div>` : ''}
              </div>
              <div class="amount">${formatEUR(t.amountCents)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');

  root.innerHTML = chartHtml + groupHtml;

  root.addEventListener('click', e => {
    const tx = e.target.closest('.tx');
    if (tx) openTxEditSheet(tx.dataset.tx);
  });
}

export function openTxEditSheet(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;
  const html = `
    <h2>Transaktion</h2>
    <div class="field">
      <label>Betrag</label>
      <input id="tx-amount" type="text" inputmode="decimal" value="${(tx.amountCents/100).toString().replace('.', ',')}">
    </div>
    <div class="field">
      <label>Kategorie</label>
      <select id="tx-cat">
        ${state.categories.map(c => {
          const pot = potById(c.potId);
          return `<option value="${c.id}" ${c.id === tx.categoryId ? 'selected' : ''}>${escapeHtml(c.name)} (${pot ? escapeHtml(pot.name) : ''})</option>`;
        }).join('')}
      </select>
    </div>
    <div class="field">
      <label>Datum</label>
      <input id="tx-date" type="date" value="${tx.date}">
    </div>
    <div class="field">
      <label>Notiz</label>
      <input id="tx-note" type="text" value="${escapeAttr(tx.note || '')}">
    </div>
    ${tx.recurringId ? '<div style="color:var(--fg-faint); font-size:12px; margin-bottom:8px;">🔁 Aus Fixkosten erzeugt</div>' : ''}
    <div class="actions-row">
      <button class="btn-danger" id="tx-del">Löschen</button>
      <button class="btn-primary" id="tx-save" style="margin-top:0">Speichern</button>
    </div>
    <button class="btn-secondary" id="tx-cancel" style="width:100%; margin-top:8px;">Abbrechen</button>
  `;
  openSheet(html, sheet => {
    sheet.querySelector('#tx-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#tx-del').addEventListener('click', () => {
      if (!confirm('Transaktion löschen?')) return;
      state.transactions = state.transactions.filter(t => t.id !== txId);
      saveState();
      closeSheet();
      render();
    });
    sheet.querySelector('#tx-save').addEventListener('click', () => {
      const cents = parseEURInput(sheet.querySelector('#tx-amount').value);
      if (cents == null) { toast('Ungültiger Betrag'); return; }
      tx.amountCents = cents;
      tx.categoryId = sheet.querySelector('#tx-cat').value;
      tx.date = sheet.querySelector('#tx-date').value || tx.date;
      tx.note = sheet.querySelector('#tx-note').value;
      saveState();
      closeSheet();
      render();
    });
  });
}
