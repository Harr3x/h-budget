import { state, saveState, uid, DEFAULT_STATE, migrateState, setState, POT_COLORS } from '../state.js';
import { formatEUR, escapeHtml, escapeAttr, parseEURInput } from '../formatters.js';
import { todayIso } from '../date-utils.js';
import { potById, potBudgetCents, categoryById } from '../queries.js';
import { applyTheme } from '../theme.js';
import { toast, openSheet, closeSheet } from '../toast.js';
import { render } from '../render.js';

export function renderSettings(root) {
  root.innerHTML = `
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
    setState(DEFAULT_STATE());
    saveState();
    toast('Daten zurückgesetzt');
    render();
  });
}

export function openPotEditSheet(potId) {
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

export function deletePot(potId) {
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

export function openCategoryEditSheet(catId) {
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

export function deleteCategory(catId) {
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

export function exportData() {
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

export function validateImport(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'Kein gültiges Objekt';
  if (!Array.isArray(parsed.pots) || parsed.pots.length === 0)
    return 'Töpfe fehlen oder leer';
  if (!Array.isArray(parsed.transactions)) return 'Transaktionen fehlen';
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0)
    return 'Kategorien fehlen oder leer';
  for (const p of parsed.pots) {
    if (!p.id || !p.name) return 'Topf ohne id/name gefunden';
  }
  for (const c of parsed.categories) {
    if (!c.id || !c.name || !c.potId) return 'Kategorie ohne id/name/potId gefunden';
  }
  for (const t of parsed.transactions) {
    if (!t.id || !t.date || typeof t.amountCents !== 'number')
      return 'Transaktion ohne id/date/amountCents gefunden';
  }
  return null;
}

export function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const err = validateImport(parsed);
      if (err) { toast('Ungültige Datei: ' + err); return; }
      if (!confirm('Aktuelle Daten ÜBERSCHREIBEN mit Import?')) return;
      const def = DEFAULT_STATE();
      setState({ ...def, ...migrateState(parsed) });
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
