# Review: PRD & Issues — OcarinaTabConverter

**Datum:** 2026-06-12
**Geprüft:** [Issue #1 (PRD)](https://github.com/gilfort/OcarinaTabConverter/issues/1) + Issues #2–#11
**Repo-Stand:** Leer (nur LICENSE), kein Code vorhanden.

---

## 1. Plausibilität der Issue-Struktur

**Gesamturteil: solide, agent-tauglich geschnitten.**

- Abhängigkeitsgraph korrekt: #2 (Walking Skeleton) → #3 (Sequenz-Rendering) → #4 (Validierung) → #5 (Double Ocarina); #6, #7, #9, #10, #11 hängen an #3 bzw. #2; #8 an #5.
- Alle Issues sind vertikale Slices mit prüfbaren Acceptance Criteria, die sich sauber auf PRD-User-Stories zurückführen lassen.
- #5 trägt bewusst kein `ready-for-agent`-Label (HITL-Checkpoint für Fingering-Chart-Review) — konsistent.

### Lücken: PRD-Stories ohne Issue

| Story | Inhalt | Problem |
|-------|--------|---------|
| 25 | App funktioniert offline nach erstem Laden | Braucht Service Worker / keine CDN-Abhängigkeiten. Kein Issue trackt das. |
| 26 | Unterstützte Ocarina-Typen vorab sichtbar | Nur implizit über Selector (#5) abgedeckt. |
| 27 | „Not yet supported"-Meldung bei z. B. 4-Loch | **Widersprüchlich:** Der Selector listet nur unterstützte Typen — ein nicht unterstützter Typ ist nie auswählbar. Story ist tot oder das Selector-Design müsste geändert werden. |
| — | Deployment/Hosting | Web-App ohne Deploy-Slice. Kein Issue. |

---

## 2. Risiken, die sonst untergehen

### R1 — Asset-Workstream existiert nicht als Issue (höchstes Risiko)
Das PRD nennt die Diagramm-Bilder selbst den „long pole" und verweist auf offene Lizenzfragen — aber kein Issue trackt die Erstellung. Voller 12-Loch-Umfang plus Double Ocarina (beide Kammern) bedeutet 60+ Einzelbilder. Ohne eigenes Tracking bleibt das Projekt auf Platzhaltern stehen, während alle Code-Issues „fertig" sind.

### R2 — „Full documented playable range" ist undefiniert
Welche 12-Loch-Ocarina? Alto C (typisch A4–F6, mit Subholes) verhält sich anders als Soprano G. Issue #3 verlangt Tests über die „full range" — ohne festgelegte Range ist das Kriterium nicht prüfbar. Versteckte Ambiguität, die erst beim Implementieren auffällt.

### R3 — Enharmonik nicht spezifiziert
Der Parser akzeptiert laut #3 sowohl `C#4` als auch `Db4`. Der Chart-Lookup muss enharmonisch normalisieren (Db4 = C#4), sonst fehlen Einträge je nach Schreibweise. Steht weder im PRD noch in einem Issue.

### R4 — Double-Ocarina-Chart ohne Referenzquelle
Issue #5 sagt selbst: Fingering variiert je Hersteller/Modell. Der HITL-Review-Checkpoint ist gut, aber es ist keine Quelle (konkretes Instrument/Hersteller-Chart) benannt — der Review prüft damit gegen nichts Konkretes.

### R5 — Export auf Mobile (Risiko-Interaktion #9/#10 × #11)
DOM-to-image/PDF-Capture bei langen Sequenzen auf mobilen Geräten: große Canvas sprengt Memory-Limits (v. a. mobile Safari). Renderer und Exporter sind laut PRD bewusst **nicht** unit-getestet — das Risiko trifft genau die ungetestete Stelle.

### R6 — Out-of-Range-Noten im Export unspezifiziert
Export ist aktiv, sobald *eine* gültige Note existiert — der Tab kann aber Out-of-Range-Marker enthalten. Ob diese mit exportiert, ausgelassen oder anders dargestellt werden, ist nirgends definiert.

---

## 3. Optimierungspotential

### O1 — Größter Hebel: SVG statt vorgefertigter Bilder
Die Chart-Daten enthalten laut PRD bereits das `hole pattern`. Diagramme daraus programmatisch als SVG generieren statt PNGs zu pflegen:

- **Asset-Workstream (= long pole, R1) entfällt komplett**
- Lizenzfrage entfällt
- Neue Ocarina-Typen = nur Daten, keine neuen Bilder
- Legende (#7) nutzt dieselben Symbol-Komponenten gratis
- PDF-Export (#9) wird vektorbasiert → bessere Druckqualität, entschärft zugleich das Memory-Problem (R5)

### O2 — Range + Enharmonik vor Agent-Start festnageln
Konkrete Range (z. B. „Alto C 12-Loch: A4–F6") und Enharmonik-Normalisierung in die Acceptance Criteria von #3 aufnehmen, **bevor** ein Agent loslegt. Behebt R2 und R3 mit einer Zeile pro Issue.

### O3 — Stories 25–27 entscheiden
Entweder als Issues anlegen (Offline/PWA, Typen-Übersicht) oder explizit aus dem PRD streichen. Aktuell sind sie stille Lücken, die bei einer „PRD erfüllt?"-Prüfung durchrutschen.

### O4 — #9 und #10 zusammenlegen
PDF- und Bild-Export sind fast identische Issues. Als ein Issue mit gemeinsamem Export-Modul schneiden spart doppelte Infrastruktur und doppelte Capture-Logik.

### O5 — Referenzquellen ins PRD
Für beide Fingering-Charts ein konkretes Hersteller-Chart verlinken. Macht den HITL-Review in #5 überhaupt erst prüfbar (behebt R4).

---

## Fazit

Issue-Struktur und Slicing sind gut — die Hauptgefahren liegen **außerhalb** der Issues: Asset-Erstellung, Range-Definition, Offline-Story. Der SVG-Ansatz (O1) eliminiert das größte Einzelrisiko und vereinfacht drei weitere Issues nebenbei.
