import { state, saveState } from '../state.js';
import { formatEUR, escapeHtml, formatYearMonth, parseEURInput } from '../formatters.js';
import { todayYearMonth, prevYearMonth, nextYearMonth } from '../date-utils.js';
import { potBudgetCents, spentInPotForMonth, spentInCategoryForMonth, txsForMonth, potById } from '../queries.js';
import { renderPotPieSVG, shiftColor } from '../charts.js';
import { openSheet, closeSheet, toast } from '../toast.js';
import { render } from '../render.js';

export let overviewMonth = todayYearMonth();
let overviewMode = 'pots'; // 'pots' | 'categories'

export function renderOverview(root) {
  const ym = overviewMonth;
  const monthTotal = txsForMonth(ym).reduce((s, t) => s + t.amountCents, 0);

  const prev = prevYearMonth(ym);
  const next = nextYearMonth(ym);
  const isCurrent = (ym === todayYearMonth());

  const overviewSlices = state.pots
    .map(p => ({ value: spentInPotForMonth(p.id, ym), color: p.color }))
    .filter(s => s.value > 0);
  const overviewPie = overviewSlices.length > 0
    ? `<div class="pot-pie">${renderPotPieSVG(overviewSlices)}</div>`
    : '';

  const catRows = state.categories
    .map(c => ({ c, pot: potById(c.potId), spent: spentInCategoryForMonth(c.id, ym) }))
    .filter(x => x.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const potTotals = new Map();
  for (const { pot, spent } of catRows) {
    const key = pot ? pot.id : '__none';
    potTotals.set(key, (potTotals.get(key) || 0) + spent);
  }
  const catPieRows = [...catRows].sort((a, b) => {
    const pa = potTotals.get(a.pot ? a.pot.id : '__none') || 0;
    const pb = potTotals.get(b.pot ? b.pot.id : '__none') || 0;
    return pb - pa || b.spent - a.spent;
  });
  const potCatCounts = new Map();
  for (const { pot } of catPieRows) {
    const key = pot ? pot.id : '__none';
    potCatCounts.set(key, (potCatCounts.get(key) || 0) + 1);
  }
  const potCatIndex = new Map();
  const catColorMap = new Map();
  for (const { c, pot } of catPieRows) {
    const key = pot ? pot.id : '__none';
    const total = potCatCounts.get(key);
    const idx = potCatIndex.get(key) || 0;
    potCatIndex.set(key, idx + 1);
    const factor = total > 1 ? -0.3 + (idx / (total - 1)) * 0.75 : 0;
    catColorMap.set(c.id, shiftColor(pot ? pot.color : '#888888', factor));
  }
  const catSlices = catPieRows.map(({ c, spent }) => ({ value: spent, color: catColorMap.get(c.id) }));
  const catPie = catSlices.length > 0 ? `<div class="pot-pie">${renderPotPieSVG(catSlices)}</div>` : '';

  const prevMonths = [];
  let pm = ym;
  for (let i = 0; i < 4; i++) { pm = prevYearMonth(pm); prevMonths.push(pm); }

  const maxCatSpent = monthTotal > 0 ? monthTotal : 1;
  const income = state.monthlyIncomes[ym] != null ? state.monthlyIncomes[ym] : state.income;
  const globalRemaining = income - monthTotal;

  root.innerHTML = `
    <div class="month-switch">
      <button id="month-prev">← ${formatYearMonth(prev)}</button>
      <button class="active">${formatYearMonth(ym)}</button>
      <button id="month-next" ${isCurrent ? 'disabled style="opacity:0.4"' : ''}>
        ${isCurrent ? '—' : formatYearMonth(next) + ' →'}
      </button>
    </div>

    <div class="view-toggle">
      <button class="toggle-btn ${overviewMode === 'pots' ? 'active' : ''}" data-mode="pots">Töpfe</button>
      <button class="toggle-btn ${overviewMode === 'categories' ? 'active' : ''}" data-mode="categories">Kategorien</button>
    </div>

    <div class="month-total">
      <div class="label">${globalRemaining < 0 ? 'über Budget' : 'noch übrig'}</div>
      <div class="amount${globalRemaining < 0 ? ' over' : ''}">${globalRemaining < 0 ? '−' : ''}${formatEUR(Math.abs(globalRemaining))}</div>
      ${overviewMode === 'categories' ? catPie : overviewPie}
      <div class="month-stats">
        <div class="month-income" id="month-income-btn">
          <span>Einkommen${state.monthlyIncomes[ym] != null ? '' : ' (Standard)'}  ✎</span>
          <span>${formatEUR(income)}</span>
        </div>
        <div class="month-spent">
          <span>Ausgaben</span>
          <span>${formatEUR(monthTotal)}</span>
        </div>
      </div>
    </div>

    ${overviewMode === 'categories' ? `

      ${catRows.length === 0
        ? '<div class="empty">Keine Ausgaben diesen Monat.</div>'
        : catRows.map(({ c, spent }) => {
            const prevAmounts = prevMonths.map(m => spentInCategoryForMonth(c.id, m)).filter(a => a > 0);
            const avgSpent = prevAmounts.length > 0 ? prevAmounts.reduce((s, a) => s + a, 0) / prevAmounts.length : 0;
            const delta = avgSpent > 0 ? Math.round(((spent - avgSpent) / avgSpent) * 100) : null;
            const deltaText = delta === null ? 'Neu'
              : Math.abs(delta) < 5 ? '≈ Ø'
              : delta > 0 ? `↑ +${delta}%`
              : `↓ ${delta}%`;
            const deltaClass = delta === null || Math.abs(delta) < 5 ? ''
              : delta > 0 ? 'over' : 'under';
            return `
            <div class="cat-row" style="--fill-pct:${Math.round((spent / maxCatSpent) * 100)}%; --cat-color:${catColorMap.get(c.id)}">
              <span class="name">${escapeHtml(c.name)}</span>
              <span class="amount">${formatEUR(spent)}</span>
              <span class="cat-pct">${monthTotal > 0 ? Math.round((spent / monthTotal) * 100) : 0}%</span>
            </div>`;
          }).join('')}
    ` : [...state.pots].sort((a, b) => potBudgetCents(b, ym) - potBudgetCents(a, ym)).map(pot => {
      const budget = potBudgetCents(pot, ym);
      const spent = spentInPotForMonth(pot.id, ym);
      const remaining = budget - spent;
      const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
      const over = remaining < 0;
      const cats = state.categories.filter(c => c.potId === pot.id);
      const catLines = cats
        .map(c => ({ c, s: spentInCategoryForMonth(c.id, ym) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s);

      return `
        <div class="pot" data-pot="${pot.id}">
          <div class="pot-head">
            <div class="top">
              <span class="dot" style="background:${pot.color}"></span>
              <span class="name">${escapeHtml(pot.name)}</span>
              <span class="chev">▾</span>
            </div>
            <div class="bar ${over ? 'over' : ''}">
              <div style="width:${pct}%; background:${pot.color}"></div>
            </div>
            <div class="nums ${over ? 'over' : ''}">
              <span class="left">${formatEUR(spent)} von ${formatEUR(budget)}</span>
              <span>${over ? '−' : ''}${formatEUR(Math.abs(remaining))} ${over ? 'über' : 'übrig'}</span>
            </div>
          </div>
          <div class="pot-body">
            ${catLines.length === 0
              ? '<div style="color:var(--fg-faint)">Keine Ausgaben</div>'
              : catLines.map(({ c, s }) => `
                  <div class="cat-line">
                    <span class="name">${escapeHtml(c.name)}</span>
                    <span>${formatEUR(s)}</span>
                  </div>`).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;

  root.querySelector('#month-income-btn').addEventListener('click', () => {
    const hasOverride = state.monthlyIncomes[ym] != null;
    const currentVal = hasOverride ? (state.monthlyIncomes[ym] / 100).toString().replace('.', ',') : '';
    openSheet(`
      <h2>Einkommen – ${formatYearMonth(ym)}</h2>
      <div class="field">
        <label>Betrag (leer = Standard verwenden)</label>
        <input id="income-month-input" type="text" inputmode="decimal" placeholder="${(state.income / 100).toString().replace('.', ',')} (Standard)" value="${currentVal}">
      </div>
      <div class="actions-row">
        <button class="btn-secondary" id="income-month-cancel">Abbrechen</button>
        <button class="btn-primary" id="income-month-save" style="margin-top:0">Speichern</button>
      </div>
    `, sheet => {
      sheet.querySelector('#income-month-cancel').addEventListener('click', closeSheet);
      sheet.querySelector('#income-month-save').addEventListener('click', () => {
        const raw = sheet.querySelector('#income-month-input').value.trim();
        if (raw === '') {
          delete state.monthlyIncomes[ym];
        } else {
          const cents = parseEURInput(raw);
          if (cents == null) { toast('Ungültiger Betrag'); return; }
          state.monthlyIncomes[ym] = cents;
        }
        saveState();
        closeSheet();
        render();
      });
    });
  });

  root.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overviewMode = btn.dataset.mode;
      renderOverview(root);
    });
  });


  root.querySelectorAll('.pot').forEach(el => {
    el.querySelector('.pot-head').addEventListener('click', () => {
      el.classList.toggle('open');
    });
  });
  root.querySelector('#month-prev').addEventListener('click', () => {
    overviewMonth = prev; render();
  });
  const nextBtn = root.querySelector('#month-next');
  if (!isCurrent) nextBtn.addEventListener('click', () => { overviewMonth = next; render(); });
}
