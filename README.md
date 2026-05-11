# H-Budget

Eine Budget App wie ich sie mir im App Store gewünscht hätte, aber nie gefunden habe.
Alle Budget Apps sind total überladen und haben viel zu viele unnötige Features die den Gebrauch unangenehm machen.

## Features

- Schnelle Transaktionseingabe: Betrag → Kategorie → Fertig!
- Töpfe: Budget prozentual aufteilen (z.B. 50% Fixkosten, 30% Freizeit, 10% Sparen)
- Monatsübersicht mit Kreisdiagramm pro Topf
- Verlauf: Monatliche Ausgaben als Balkendiagramm
- Wiederkehrende Ausgaben: Fixkosten einmal anlegen, werden automatisch gebucht
- Hell/Dunkel-Theme (System, Hell oder Dunkel)
- Monats-Erinnerung beim Monatswechsel
- Daten-Import/Export als JSON-Backup
- Läuft vollständig offline (PWA)

**Live:** https://Harr3x.github.io/h-budget/

## Installieren
Auf dem Handy im Browser öffnen → "Zum Startbildschirm hinzufügen". Die App läuft danach offline.

## Tech
Vanilla JS, localStorage, Service Worker, kein Build-Step.