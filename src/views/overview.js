import { state } from '../state.js';
import { formatEUR, escapeHtml, formatYearMonth } from '../formatters.js';
import { todayYearMonth, prevYearMonth, nextYearMonth } from '../date-utils.js';
import { potBudgetCents, spentInPotForMonth, spentInCategoryForMonth, txsForMonth } from '../queries.js';
import { renderPotPieSVG } from '../charts.js';
import { render } from '../render.js';

export let overviewMonth = todayYearMonth();

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

  root.innerHTML = `
    <div class="month-switch">
      <button id="month-prev">← ${formatYearMonth(prev)}</button>
      <button class="active">${formatYearMonth(ym)}</button>
      <button id="month-next" ${isCurrent ? 'disabled style="opacity:0.4"' : ''}>
        ${isCurrent ? '—' : formatYearMonth(next) + ' →'}
      </button>
    </div>

    <div class="month-total">
      <div class="label">Diesen Monat ausgegeben</div>
      <div class="amount">${formatEUR(monthTotal)}</div>
      ${overviewPie}
    </div>

    ${state.pots.map(pot => {
      const budget = potBudgetCents(pot);
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
