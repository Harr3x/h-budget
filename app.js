// ============================================================================
// Budget App — Vanilla JS PWA
// Daten in localStorage, Beträge intern als Cent (Integer).
// ============================================================================

const STORAGE_KEY = 'budget.v1';
const POT_COLORS = [
  '#5dd39e', '#6ea8fe', '#ffd166', '#ef476f',
  '#a78bfa', '#fb923c', '#22d3ee', '#f472b6',
];

const DEFAULT_STATE = () => ({
  income: 300000,
  pots: [
    { id: 'essentials', name: 'Essentials', color: '#5dd39e', percent: 50, monthlyAmountCents: null },
    { id: 'growth',     name: 'Growth',     color: '#6ea8fe', percent: 10, monthlyAmountCents: null },
    { id: 'rewards',    name: 'Rewards',    color: '#ffd166', percent: 30, monthlyAmountCents: null },
    { id: 'saving',     name: 'Saving',     color: '#a78bfa', percent: 10, monthlyAmountCents: null },
  ],
  categories: [
    { id: 'lebensmittel', name: 'Lebensmittel', potId: 'essentials' },
    { id: 'tanken',       name: 'Tanken',       potId: 'essentials' },
    { id: 'miete',        name: 'Miete',        potId: 'essentials' },
    { id: 'strom',        name: 'Strom',        potId: 'essentials' },
    { id: 'abo',          name: 'Abo',          potId: 'essentials' },
    { id: 'investment',   name: 'Investment',   potId: 'growth' },
    { id: 'bildung',      name: 'Bildung',      potId: 'growth' },
    { id: 'restaurant',   name: 'Restaurant',   potId: 'rewards' },
    { id: 'unterhaltung', name: 'Unterhaltung', potId: 'rewards' },
    { id: 'kleidung',     name: 'Kleidung',     potId: 'rewards' },
    { id: 'notgroschen',  name: 'Notgroschen',  potId: 'saving' },
  ],
  transactions: [],
  recurring: [],
  lastReminderShownYearMonth: null,
  theme: 'system',
});

// ---- State + Storage -------------------------------------------------------

let state = loadState();
let activeTab = 'entry';

// In-memory ephemeral form state for Eingabe (survives tab switches in same session)
let entryDraft = {
  amountStr: '',
  categoryId: null,
  note: '',
  date: todayIso(),
  recurring: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    // shallow merge with defaults to tolerate older versions missing keys
    const def = DEFAULT_STATE();
    return { ...def, ...parsed };
  } catch (e) {
    console.error('loadState failed, using defaults', e);
    return DEFAULT_STATE();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Format & Parse --------------------------------------------------------

const eurFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat('de-DE');
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const dayFmt   = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'long' });

function formatEUR(cents) {
  return eurFmt.format((cents || 0) / 100);
}
function formatDateIso(iso) {
  return dateFmt.format(new Date(iso + 'T00:00:00'));
}
function formatYearMonth(ym) {
  return monthFmt.format(new Date(ym + '-01T00:00:00'));
}
function formatDayHeader(iso) {
  return dayFmt.format(new Date(iso + 'T00:00:00'));
}

// Parses German-style number string into cents (Integer) or null if invalid.
// Accepts: "12,50", "1.234,56", "1234,56", "12.50", "1.234", "12", "0,5"
function parseEURInput(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/\s/g, '').replace(/€/g, '').trim();
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;

  let cleaned;
  if (s.includes(',')) {
    cleaned = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    if (parts.length === 1) {
      cleaned = s;
    } else {
      const last = parts[parts.length - 1];
      if (last.length === 3) {
        // looks like thousands grouping
        cleaned = parts.join('');
      } else if (last.length === 1 || last.length === 2) {
        cleaned = parts.slice(0, -1).join('') + '.' + last;
      } else {
        return null;
      }
    }
  }
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

// ---- Date helpers ----------------------------------------------------------

function todayIso() {
  const d = new Date();
  return isoFromDate(d);
}
function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayYearMonth() {
  return todayIso().slice(0, 7);
}
function yearMonthOf(iso) {
  return iso.slice(0, 7);
}
function nextYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
function prevYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}
function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function isoForYmDay(ym, day) {
  const last = lastDayOfMonth(ym);
  const d = Math.min(day, last);
  return `${ym}-${String(d).padStart(2, '0')}`;
}

// ---- Lookups ---------------------------------------------------------------

function potById(id) { return state.pots.find(p => p.id === id); }
function categoryById(id) { return state.categories.find(c => c.id === id); }
function potOfCategory(catId) {
  const c = categoryById(catId);
  return c ? potById(c.potId) : null;
}
function potBudgetCents(pot) {
  if (pot.monthlyAmountCents != null) return pot.monthlyAmountCents;
  return Math.round((state.income * (pot.percent || 0)) / 100);
}

function txsForMonth(ym) {
  return state.transactions.filter(t => yearMonthOf(t.date) === ym);
}
function spentInPotForMonth(potId, ym) {
  let sum = 0;
  for (const t of txsForMonth(ym)) {
    const c = categoryById(t.categoryId);
    if (c && c.potId === potId) sum += t.amountCents;
  }
  return sum;
}
function spentInCategoryForMonth(catId, ym) {
  let sum = 0;
  for (const t of txsForMonth(ym)) {
    if (t.categoryId === catId) sum += t.amountCents;
  }
  return sum;
}

// ---- Recurring instantiation ----------------------------------------------

function instantiateRecurring() {
  const today = new Date();
  const todayIsoStr = todayIso();
  const currentYm = todayYearMonth();
  let changed = false;

  for (const rec of state.recurring) {
    if (!rec.startYearMonth) continue;
    let ym = rec.startYearMonth;
    while (ym <= currentYm) {
      if (rec.endYearMonth && ym > rec.endYearMonth) break;

      // Already instantiated for this month?
      const existing = state.transactions.find(t => t.recurringId === rec.id && yearMonthOf(t.date) === ym);
      if (!existing) {
        const dateStr = isoForYmDay(ym, rec.dayOfMonth || 1);
        // For the current month, only instantiate if date <= today
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

// ---- Toast & Sheet ---------------------------------------------------------

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}

function openSheet(html, onMount) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.id = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" onclick="event.stopPropagation()">${html}</div>`;
  bg.addEventListener('click', closeSheet);
  document.body.appendChild(bg);
  if (onMount) onMount(bg.querySelector('.sheet'));
}
function closeSheet() {
  const bg = document.getElementById('sheet-bg');
  if (bg) bg.remove();
}

// ---- Render router --------------------------------------------------------

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  render();
}

function render() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  if      (activeTab === 'entry')     renderEntry(view);
  else if (activeTab === 'overview')  renderOverview(view);
  else if (activeTab === 'history')   renderHistory(view);
  else if (activeTab === 'recurring') renderRecurring(view);
  else if (activeTab === 'settings')  renderSettings(view);
}

// ---- View: Eingabe --------------------------------------------------------

function renderEntry(root) {
  const cents = parseEURInput(entryDraft.amountStr);
  const preview = cents != null ? formatEUR(cents) : '—';

  // Sort categories: by usage frequency (desc) then alphabetic
  const usage = new Map();
  for (const t of state.transactions) {
    usage.set(t.categoryId, (usage.get(t.categoryId) || 0) + 1);
  }
  const sortedCats = [...state.categories].sort((a, b) => {
    const ua = usage.get(a.id) || 0;
    const ub = usage.get(b.id) || 0;
    if (ub !== ua) return ub - ua;
    return a.name.localeCompare(b.name, 'de');
  });

  root.innerHTML = `
    <h1>Neue Ausgabe</h1>

    <div class="entry-amount">
      <input id="amount-input" type="text" inputmode="decimal" autocomplete="off"
             placeholder="0,00" value="${escapeAttr(entryDraft.amountStr)}">
      <span class="currency">€</span>
    </div>
    <div style="text-align:center; color:var(--fg-faint); font-size:13px; margin-top:-8px; margin-bottom:14px;">
      ${cents != null ? preview : (entryDraft.amountStr ? 'ungültig' : ' ')}
    </div>

    <div class="field">
      <label>Kategorie</label>
      <div class="cat-grid" id="cat-grid">
        ${sortedCats.map(c => {
          const pot = potById(c.potId);
          const sel = entryDraft.categoryId === c.id ? 'selected' : '';
          return `<button class="cat-chip ${sel}" data-cat="${c.id}">
            <span class="dot" style="background:${pot ? pot.color : '#888'}"></span>
            <span>${escapeHtml(c.name)}</span>
            <span class="pot-label">${pot ? escapeHtml(pot.name) : ''}</span>
          </button>`;
        }).join('')}
        <button class="cat-chip add" id="cat-add">+ Neue Kategorie</button>
      </div>
    </div>

    <div class="field">
      <label>Notiz (optional)</label>
      <input id="note-input" type="text" placeholder="z. B. Shell A2"
             value="${escapeAttr(entryDraft.note)}">
    </div>

    <div class="field">
      <label>Datum</label>
      <input id="date-input" type="date" value="${entryDraft.date}">
    </div>

    <div class="toggle-row ${entryDraft.recurring ? 'on' : ''}" id="recur-toggle">
      <div class="check">${entryDraft.recurring ? '✓' : ''}</div>
      <div class="label">
        <div>Wiederkehrend</div>
        <div class="hint">Automatisch jeden Monat eintragen</div>
      </div>
    </div>

    <button class="btn-primary" id="save-btn" ${cents == null || !entryDraft.categoryId ? 'disabled' : ''}>
      Speichern
    </button>
  `;

  const amtInput = root.querySelector('#amount-input');
  amtInput.addEventListener('input', e => {
    entryDraft.amountStr = e.target.value;
    // re-render only the preview + button state without losing focus
    const c = parseEURInput(entryDraft.amountStr);
    root.querySelector('.entry-amount + div').textContent =
      c != null ? formatEUR(c) : (entryDraft.amountStr ? 'ungültig' : ' ');
    root.querySelector('#save-btn').disabled = (c == null || !entryDraft.categoryId);
  });
  amtInput.focus();

  root.querySelectorAll('.cat-chip[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      entryDraft.categoryId = btn.dataset.cat;
      render();
      // refocus amount field if empty
      const a = document.getElementById('amount-input');
      if (a && !entryDraft.amountStr) a.focus();
    });
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

  root.querySelector('#save-btn').addEventListener('click', saveEntry);
}

function saveEntry() {
  const cents = parseEURInput(entryDraft.amountStr);
  if (cents == null || !entryDraft.categoryId) return;

  const cat = categoryById(entryDraft.categoryId);

  if (entryDraft.recurring) {
    // open sheet to confirm dayOfMonth + start month
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
  // reset draft (but keep date as today)
  entryDraft = { amountStr: '', categoryId: null, note: '', date: todayIso(), recurring: false };
  render();
}

function openRecurringSetupSheet(prefill) {
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

function openNewCategorySheet() {
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

// ---- View: Übersicht ------------------------------------------------------

let overviewMonth = todayYearMonth();

function renderOverview(root) {
  const ym = overviewMonth;
  const monthTotal = txsForMonth(ym).reduce((s, t) => s + t.amountCents, 0);

  const prev = prevYearMonth(ym);
  const next = nextYearMonth(ym);
  const isCurrent = (ym === todayYearMonth());

  root.innerHTML = `
    <h1>Übersicht</h1>
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

// ---- View: Verlauf --------------------------------------------------------

function renderHistory(root) {
  const txs = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if (txs.length === 0) {
    root.innerHTML = `<h1>Verlauf</h1><div class="empty">Noch keine Transaktionen.</div>`;
    return;
  }
  // Group by date
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

  root.innerHTML = `<h1>Verlauf</h1>${groupHtml}`;

  root.querySelectorAll('.tx').forEach(el => {
    el.addEventListener('click', () => openTxEditSheet(el.dataset.tx));
  });
}

function openTxEditSheet(txId) {
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

// ---- View: Recurring ------------------------------------------------------

function renderRecurring(root) {
  if (state.recurring.length === 0) {
    root.innerHTML = `
      <h1>Fixkosten</h1>
      <div class="empty">Noch keine wiederkehrenden Transaktionen.<br>
      Beim Eintragen einer neuen Ausgabe kannst du sie als wiederkehrend markieren.</div>
    `;
    return;
  }

  const ym = todayYearMonth();
  const activeRecs = state.recurring.filter(r => !r.endYearMonth || r.endYearMonth >= ym);
  const monthlyTotal = activeRecs.reduce((s, r) => s + r.amountCents, 0);

  // Per-pot breakdown
  const perPot = new Map();
  for (const r of activeRecs) {
    const cat = categoryById(r.categoryId);
    if (!cat) continue;
    perPot.set(cat.potId, (perPot.get(cat.potId) || 0) + r.amountCents);
  }

  root.innerHTML = `
    <h1>Fixkosten</h1>
    <div class="month-total">
      <div class="label">Aktive Fixkosten / Monat</div>
      <div class="amount">${formatEUR(monthlyTotal)}</div>
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

function openRecurringEditSheet(recId) {
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
        // unlink txs so they remain as standalone entries
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

// ---- View: Einstellungen --------------------------------------------------

function renderSettings(root) {
  root.innerHTML = `
    <h1>Einstellungen</h1>

    <div class="settings-section">
      <h2>Erscheinungsbild</h2>
      <div class="theme-switch">
        <button data-theme-set="system" class="${state.theme === 'system' ? 'active' : ''}">System</button>
        <button data-theme-set="light"  class="${state.theme === 'light'  ? 'active' : ''}">Hell</button>
        <button data-theme-set="dark"   class="${state.theme === 'dark'   ? 'active' : ''}">Dunkel</button>
      </div>
    </div>

    <div class="settings-section">
      <h2>Monatliches Netto-Einkommen</h2>
      <div class="row">
        <input id="income-input" type="text" inputmode="decimal"
               value="${(state.income/100).toString().replace('.', ',')}">
        <button class="btn-secondary" id="income-save" style="flex:0; padding:12px 16px;">Speichern</button>
      </div>
      <div style="font-size:12px; color:var(--fg-faint); margin-top:6px;">
        Wird genutzt für Topf-Budgets, die in % definiert sind.
      </div>
    </div>

    <div class="settings-section">
      <h2>Töpfe</h2>
      ${state.pots.map(p => {
        const budget = potBudgetCents(p);
        return `
          <div class="list-row" data-pot="${p.id}">
            <span class="dot" style="background:${p.color}"></span>
            <div style="flex:1;">
              <div class="name">${escapeHtml(p.name)}</div>
              <div class="meta">
                ${p.monthlyAmountCents != null ? formatEUR(p.monthlyAmountCents) : (p.percent + '% = ' + formatEUR(budget))}
              </div>
            </div>
            <div class="actions">
              <button class="icon-btn" data-edit-pot="${p.id}">✎</button>
              ${state.pots.length > 1 ? `<button class="icon-btn" data-del-pot="${p.id}">🗑</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}
      <button class="btn-secondary" id="pot-add" style="width:100%; margin-top:10px;">+ Neuen Topf</button>
    </div>

    <div class="settings-section">
      <h2>Kategorien</h2>
      ${state.categories.map(c => {
        const p = potById(c.potId);
        return `
          <div class="list-row" data-cat="${c.id}">
            <span class="dot" style="background:${p ? p.color : '#888'}"></span>
            <div style="flex:1;">
              <div class="name">${escapeHtml(c.name)}</div>
              <div class="meta">${p ? escapeHtml(p.name) : '—'}</div>
            </div>
            <div class="actions">
              <button class="icon-btn" data-edit-cat="${c.id}">✎</button>
              <button class="icon-btn" data-del-cat="${c.id}">🗑</button>
            </div>
          </div>
        `;
      }).join('')}
      <button class="btn-secondary" id="cat-add" style="width:100%; margin-top:10px;">+ Neue Kategorie</button>
    </div>

    <div class="settings-section">
      <h2>Daten</h2>
      <div class="row" style="gap:8px;">
        <button class="btn-secondary" id="export-btn">⬇ Exportieren</button>
        <button class="btn-secondary" id="import-btn">⬆ Importieren</button>
      </div>
      <input type="file" id="import-file" accept="application/json" class="hidden">
      <button class="btn-danger" id="reset-btn" style="width:100%; margin-top:10px;">Alle Daten löschen</button>
    </div>

    <div style="text-align:center; color:var(--fg-faint); font-size:11px; margin-top:20px;">
      Daten werden nur lokal auf diesem Gerät gespeichert.
    </div>
  `;

  root.querySelectorAll('[data-theme-set]').forEach(b => {
    b.addEventListener('click', () => {
      state.theme = b.dataset.themeSet;
      saveState();
      applyTheme();
      render();
    });
  });

  root.querySelector('#income-save').addEventListener('click', () => {
    const cents = parseEURInput(root.querySelector('#income-input').value);
    if (cents == null) { toast('Ungültiger Betrag'); return; }
    state.income = cents;
    saveState();
    toast('Einkommen gespeichert');
    render();
  });

  root.querySelectorAll('[data-edit-pot]').forEach(b => {
    b.addEventListener('click', () => openPotEditSheet(b.dataset.editPot));
  });
  root.querySelectorAll('[data-del-pot]').forEach(b => {
    b.addEventListener('click', () => deletePot(b.dataset.delPot));
  });
  root.querySelector('#pot-add').addEventListener('click', () => openPotEditSheet(null));

  root.querySelectorAll('[data-edit-cat]').forEach(b => {
    b.addEventListener('click', () => openCategoryEditSheet(b.dataset.editCat));
  });
  root.querySelectorAll('[data-del-cat]').forEach(b => {
    b.addEventListener('click', () => deleteCategory(b.dataset.delCat));
  });
  root.querySelector('#cat-add').addEventListener('click', () => openCategoryEditSheet(null));

  root.querySelector('#export-btn').addEventListener('click', exportData);
  root.querySelector('#import-btn').addEventListener('click', () => root.querySelector('#import-file').click());
  root.querySelector('#import-file').addEventListener('change', importData);
  root.querySelector('#reset-btn').addEventListener('click', () => {
    if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if (!confirm('Letzte Warnung: alle Transaktionen, Töpfe, Kategorien und Fixkosten werden gelöscht.')) return;
    state = DEFAULT_STATE();
    saveState();
    toast('Daten zurückgesetzt');
    render();
  });
}

function openPotEditSheet(potId) {
  const isNew = !potId;
  const pot = isNew
    ? { id: uid(), name: '', color: POT_COLORS[state.pots.length % POT_COLORS.length], percent: 0, monthlyAmountCents: null }
    : { ...potById(potId) };

  const useFixed = pot.monthlyAmountCents != null;

  const html = `
    <h2>${isNew ? 'Neuer Topf' : 'Topf bearbeiten'}</h2>
    <div class="field">
      <label>Name</label>
      <input id="pot-name" type="text" value="${escapeAttr(pot.name)}" placeholder="z. B. Reisen">
    </div>
    <div class="field">
      <label>Farbe</label>
      <div class="color-swatch" id="pot-colors">
        ${POT_COLORS.map(c => `<button data-color="${c}" style="background:${c}" class="${c === pot.color ? 'active' : ''}"></button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>Budget-Typ</label>
      <div class="row" style="gap:8px;">
        <button class="btn-secondary" id="bt-percent" style="${!useFixed ? 'border-color:var(--accent);color:var(--fg);' : ''}">% vom Einkommen</button>
        <button class="btn-secondary" id="bt-fixed" style="${useFixed ? 'border-color:var(--accent);color:var(--fg);' : ''}">Fixer Betrag</button>
      </div>
    </div>
    <div class="field" id="pct-field" ${useFixed ? 'style="display:none"' : ''}>
      <label>Prozent</label>
      <input id="pot-percent" type="number" min="0" max="100" step="1" value="${pot.percent || 0}">
    </div>
    <div class="field" id="fix-field" ${!useFixed ? 'style="display:none"' : ''}>
      <label>Monatlicher Betrag</label>
      <input id="pot-fixed" type="text" inputmode="decimal" value="${pot.monthlyAmountCents != null ? (pot.monthlyAmountCents/100).toString().replace('.', ',') : ''}">
    </div>
    <div class="actions-row">
      <button class="btn-secondary" id="pot-cancel">Abbrechen</button>
      <button class="btn-primary" id="pot-save" style="margin-top:0">Speichern</button>
    </div>
  `;
  openSheet(html, sheet => {
    let mode = useFixed ? 'fixed' : 'percent';
    sheet.querySelectorAll('#pot-colors button').forEach(b => {
      b.addEventListener('click', () => {
        sheet.querySelectorAll('#pot-colors button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    sheet.querySelector('#bt-percent').addEventListener('click', () => {
      mode = 'percent';
      sheet.querySelector('#pct-field').style.display = '';
      sheet.querySelector('#fix-field').style.display = 'none';
      sheet.querySelector('#bt-percent').style.cssText = 'border-color:var(--accent);color:var(--fg);';
      sheet.querySelector('#bt-fixed').style.cssText = '';
    });
    sheet.querySelector('#bt-fixed').addEventListener('click', () => {
      mode = 'fixed';
      sheet.querySelector('#pct-field').style.display = 'none';
      sheet.querySelector('#fix-field').style.display = '';
      sheet.querySelector('#bt-fixed').style.cssText = 'border-color:var(--accent);color:var(--fg);';
      sheet.querySelector('#bt-percent').style.cssText = '';
    });
    sheet.querySelector('#pot-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#pot-save').addEventListener('click', () => {
      const name = sheet.querySelector('#pot-name').value.trim();
      if (!name) { toast('Name fehlt'); return; }
      const color = sheet.querySelector('#pot-colors button.active')?.dataset.color || pot.color;
      const result = { ...pot, name, color };
      if (mode === 'percent') {
        result.percent = Math.max(0, Math.min(100, parseFloat(sheet.querySelector('#pot-percent').value) || 0));
        result.monthlyAmountCents = null;
      } else {
        const c = parseEURInput(sheet.querySelector('#pot-fixed').value);
        if (c == null) { toast('Ungültiger Betrag'); return; }
        result.monthlyAmountCents = c;
        result.percent = null;
      }
      if (isNew) {
        state.pots.push(result);
      } else {
        const i = state.pots.findIndex(p => p.id === pot.id);
        state.pots[i] = result;
      }
      saveState();
      closeSheet();
      render();
    });
  });
}

function deletePot(potId) {
  if (state.pots.length <= 1) { toast('Mindestens ein Topf nötig'); return; }
  const cats = state.categories.filter(c => c.potId === potId);
  if (cats.length > 0) {
    toast(`Topf hat noch ${cats.length} Kategorien — erst leeren/umziehen`);
    return;
  }
  if (!confirm('Topf wirklich löschen?')) return;
  state.pots = state.pots.filter(p => p.id !== potId);
  saveState();
  render();
}

function openCategoryEditSheet(catId) {
  const isNew = !catId;
  const cat = isNew
    ? { id: uid(), name: '', potId: state.pots[0]?.id }
    : { ...categoryById(catId) };

  const html = `
    <h2>${isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</h2>
    <div class="field">
      <label>Name</label>
      <input id="cat-name" type="text" value="${escapeAttr(cat.name)}" placeholder="z. B. Drogerie">
    </div>
    <div class="field">
      <label>Topf</label>
      <select id="cat-pot">
        ${state.pots.map(p => `<option value="${p.id}" ${p.id === cat.potId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="actions-row">
      <button class="btn-secondary" id="cat-cancel">Abbrechen</button>
      <button class="btn-primary" id="cat-save" style="margin-top:0">Speichern</button>
    </div>
  `;
  openSheet(html, sheet => {
    sheet.querySelector('#cat-name').focus();
    sheet.querySelector('#cat-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#cat-save').addEventListener('click', () => {
      const name = sheet.querySelector('#cat-name').value.trim();
      const potId = sheet.querySelector('#cat-pot').value;
      if (!name) { toast('Name fehlt'); return; }
      const result = { ...cat, name, potId };
      if (isNew) {
        state.categories.push(result);
      } else {
        const i = state.categories.findIndex(c => c.id === cat.id);
        state.categories[i] = result;
      }
      saveState();
      closeSheet();
      render();
    });
  });
}

function deleteCategory(catId) {
  const used = state.transactions.some(t => t.categoryId === catId)
    || state.recurring.some(r => r.categoryId === catId);
  if (used) {
    if (!confirm('Diese Kategorie wird noch verwendet. Trotzdem löschen?\nBetroffene Transaktionen behalten den Kategorie-Namen nicht — sie werden als "—" angezeigt.')) return;
  } else if (!confirm('Kategorie löschen?')) {
    return;
  }
  state.categories = state.categories.filter(c => c.id !== catId);
  saveState();
  render();
}

// ---- Export / Import ------------------------------------------------------

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup heruntergeladen');
}

function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.pots) || !Array.isArray(parsed.transactions)) {
        toast('Ungültige Datei');
        return;
      }
      if (!confirm('Aktuelle Daten ÜBERSCHREIBEN mit Import?')) return;
      const def = DEFAULT_STATE();
      state = { ...def, ...parsed };
      saveState();
      toast('Import erfolgreich');
      render();
    } catch (err) {
      toast('Fehler: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ---- HTML escaping --------------------------------------------------------

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

// ---- Monthly reminder banner ----------------------------------------------

function maybeShowMonthBanner() {
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

// ---- Theme ----------------------------------------------------------------

const THEME_COLORS = { dark: '#1a1a1a', light: '#f7f8fa' };

function resolvedTheme() {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[t]);
}

// ---- Init -----------------------------------------------------------------

function init() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme();
  });

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });

  instantiateRecurring();
  setTab('entry');
  maybeShowMonthBanner();

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW reg failed', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
