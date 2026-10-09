# Insta-Studio – JFG Rothsee Süd

Vorlagen für Instagram-Posts (1080 × 1350). Die Spieldaten kommen automatisch vom BFV.

- **Deckblatt**: Spielfoto + Paarung + Ergebnis. Erstes Bild für einen Spielbericht oder eine Vorschau.
- **Spieltag**: alle Spiele der Jugenden einer Woche, als **Vorschau** (Uhrzeiten) oder als **Ergebnisse** (grün/gelb/rot).

## Benutzen

1. Seite öffnen: `https://roelzer.github.io/jfg/`
2. Vorlage wählen, Foto auswählen und mit dem Finger zurechtschieben
3. Spiel aus der BFV-Liste auswählen. Die Felder füllen sich von selbst und lassen sich trotzdem ändern.
4. **Teilen** öffnet am Handy direkt das Teilen-Menü (Instagram). **Herunterladen** speichert das PNG.

Tipp: Am Handy im Browser „Zum Startbildschirm hinzufügen“, dann verhält sich die Seite wie eine App.

## Woher kommen die Daten?

Die GitHub Action `.github/workflows/update.yml` läuft alle 3 Stunden, am Wochenende stündlich.
Sie holt über das öffentliche BFV-Widget-API die Spiele aller Mannschaften aus `teams.json`
und schreibt sie nach `data/spiele.json`. Vereinslogos landen in `logos/`.
Von Hand anstoßen: *Actions → BFV-Daten aktualisieren → Run workflow*.

### Mannschaft hinzufügen oder umbenennen

Die Mannschafts-ID steht in der BFV-Adresse:
`bfv.de/mannschaften/jfg-rothsee-sued/`**`0182T5L5T8000000VV0AG80NVTL7UGGC`**

In `teams.json` eintragen. Mit `label` lässt sich die Altersklasse festlegen, falls der BFV sie nicht liefert:

```json
{ "id": "0182T5L5T8000000VV0AG80NVTL7UGGC", "label": "U15" }
```

### Eigenes Vereinslogo

Unter *Einstellungen → Vereinslogo ersetzen* hochladen (gilt für dieses Gerät).
Für alle Geräte: die Datei als `assets/logo.png` ins Repo legen.

## Einmalig einrichten

*Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.*
