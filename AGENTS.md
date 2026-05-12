# AGENTS.md — H-Budget

## Quick facts

- **Vanilla JS PWA** — No build step, no package.json, no npm, no tests, no linter.
- **No dev server needed** — Open `index.html` in a browser. Everything is static.
- **All amounts in cents (integers)** — `parseEURInput`/`formatEUR` handle DE locale input/output. Never use floats for money.
- **German locale** — UI strings, `Intl` formatters (`de-DE`), and comments are in German. `EUR` currency.
- **Strict CSP** — `connect-src 'none'`, no external scripts, no external API calls from the frontend.

## Architecture

- **State**: Single mutable `state` object in `src/state.js`. Persisted to `localStorage` under key `budget.v1`. Schema versioning via `migrateState()` (currently v2).
- **Views**: 5 tabs — `entry`, `overview`, `history`, `recurring`, `settings`. Each has a render function in `src/views/<name>.js`.
- **Routing**: Simple tab-based. `setTab()` in `src/render.js` clears the view container and calls the active view's render.
- **Data queries**: `src/queries.js` — pot budgets, monthly spend, filtered transactions.
- **Recurring**: `src/recurring.js` — `instantiateRecurring()` backfills missed recurring transactions on load.
- **Theme**: `data-theme` attribute on `<html>`. Dark/light/system in `src/theme.js`.
- **Service worker**: Cache-first (`sw.js`), versioned (`budget-v5`). Pre-caches all app files listed in `ASSETS`. No update prompt — skips waiting on install.

## WAT framework note

`CLAUDE.md` describes the WAT framework (Workflows/Agents/Tools). `workflows/` and `tools/` directories are expected but currently empty. API keys go in `.env` (gitignored). No Google OAuth currently configured.
