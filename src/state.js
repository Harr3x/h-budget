export const STORAGE_KEY = 'budget.v1';
export const SCHEMA_VERSION = 2;
export const POT_COLORS = [
  '#5dd39e', '#6ea8fe', '#ffd166', '#ef476f',
  '#a78bfa', '#fb923c', '#22d3ee', '#f472b6',
];

export const DEFAULT_STATE = () => ({
  schemaVersion: SCHEMA_VERSION,
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

export function migrateState(raw) {
  const v = raw.schemaVersion || 1;

  // v1 → v2: pots may lack monthlyAmountCents, categories may lack creation-order index
  if (v < 2) {
    raw.pots = (raw.pots || []).map(p => ({
      monthlyAmountCents: null,
      percent: 0,
      ...p,
    }));
    raw.categories = (raw.categories || []).map(c => ({
      potId: raw.pots[0]?.id ?? '',
      ...c,
    }));
    raw.recurring = (raw.recurring || []).map(r => ({
      endYearMonth: null,
      lastInstantiatedYearMonth: null,
      note: '',
      ...r,
    }));
    raw.transactions = (raw.transactions || []).map(t => ({
      recurringId: null,
      note: '',
      ...t,
    }));
    raw.schemaVersion = 2;
  }

  return raw;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    let parsed = JSON.parse(raw);
    parsed = migrateState(parsed);
    const def = DEFAULT_STATE();
    return { ...def, ...parsed, schemaVersion: SCHEMA_VERSION };
  } catch (e) {
    console.error('loadState failed, using defaults', e);
    return DEFAULT_STATE();
  }
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function setState(newState) {
  state = newState;
}

export let state = DEFAULT_STATE();

// Initialize from localStorage after all functions are defined
state = loadState();
