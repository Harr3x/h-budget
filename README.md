# Budget

Schnelle Ausgaben-Erfassung mit Topf-Übersicht — eine installierbare PWA.

**Live:** https://<user>.github.io/h-budget/

## Installieren
Auf dem Handy im Browser öffnen → "Zum Startbildschirm hinzufügen". Die App läuft danach offline.

## Tech
Vanilla JS, localStorage, Service Worker, kein Build-Step.

## Lokale Entwicklung
```
python -m http.server 8000
```
Dann http://localhost:8000 öffnen.

## Deploy
Push auf `main` → GitHub Pages baut automatisch neu. **Wichtig:** Bei jedem Release `CACHE_VERSION` in `sw.js` hochzählen (`budget-v1` → `budget-v2` → ...), sonst sehen bestehende Nutzer die alte Version.
