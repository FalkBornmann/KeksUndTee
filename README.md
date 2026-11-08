# Keks und Tee · Vom Keks zum Krümel

Interaktive 2D-Lehrsimulation im [Werkzeugdeck](https://werkzeugdeck.pages.dev/#theoretische-spielereien).

**[Anwendung öffnen](https://werkzeugdeck.pages.dev/tools/keks-und-tee/)**

Sechs illustrative Speisendatensätze, Milch und Tee, Winkel und Eintauchtiefe, vier zeitgesteuerte Phasen, Sättigungs- und Festigkeitskarte, optionaler erster Modellbruch, Zeitregler, CSV- und PNG-Export. Alle Materialwerte sind Lehrannahmen und veränderbar. Keine validierten Lebensmittel- oder Bruchvorhersagen.

## Lokal starten

Statische Dateien über einen lokalen HTTP-Server ausliefern. `file://` unterstützt den Modul-Web-Worker nicht zuverlässig. Keine Installation und kein Build für die veröffentlichte Anwendung nötig; keine externen Laufzeitbibliotheken.

Tests: `npm test` mit Node.js >= 20.

## Modell

Konservatives Finite-Volumen-Verfahren für `dS/dt = div(D(S) grad(S))`, expliziter stabilitätsbeschränkter Euler-Schritt. Benetzte Randflächen erhalten S=1, übrige Ränder sind flussfrei. Nach Herausziehen bleibt die Gesamtflüssigkeitsmasse erhalten. Dritte Dimension: gleichförmige Extrusion ohne Fluss durch Vorder-/Rückseite. Keine Gravitation im Transport, Verdunstung, Drainage oder Quellung.

Heuristisches Aufweichen anhand zeitintegrierter Zusatzsättigung; vereinfachter eingespannter Balken unter Eigengewicht, Flüssigkeitsgewicht und Auftrieb. Erster Bruch beendet die Physik. Fallanimation ist illustrativ. Modellgleichungen, Numerik, Konvergenzkriterium, Datenannahmen und Quellen stehen ausführlich in der Anwendung.

## Dateien

- `model.js`: reine Modellrechnung, auch unter Node testbar.
- `worker.js`: Berechnung in einem Web Worker.
- `app.js`: Bedienung, Canvas-Darstellung, Wiedergabe, Exporte.
- `index.html`, `style.css`: Oberfläche, Theorie, Nutzungshinweise.
- `tests/model.test.mjs`: Phasen, Sättigungsgrenzen, Massenerhaltung, Gittervergleich, Winkel, Bruch und Parameterprüfung.

Cloudflare Pages liefert die Dateien aus. Eingaben bleiben im Browser; keine KI zur Laufzeit, Tracker oder externen Bibliotheken. Code und Texte wurden mit KI-Unterstützung erstellt. Privates Projekt in Entwicklung. Es gelten die gesetzlichen Haftungsregelungen.


## Werkzeugdeck-Katalog
Dieses Repository enthält ausschließlich das Tool. Fachgebiete, Navigation, veröffentlichter Versionsstand und gemeinsame Auslieferung werden im [Werkzeugdeck-Katalog](https://github.com/FalkBornmann/Werkzeugdeck) gepflegt.
Online: https://werkzeugdeck.pages.dev/tools/keks-und-tee/

## Grafikexport
Die erzeugten Diagramme und Grafiken lassen sich als PNG und als echte SVG-Vektorgrafik speichern. SVG enthält skalierbare Linien, Flächen und Text. Beide Formate übernehmen den gewählten Darstellungszustand; Exporte entstehen lokal im Browser.

## Zeitsteuerung
Bei aktivem Simulationsverlauf läuft die Zeitsteuerung am unteren Bildschirmrand mit. Derselbe Regler steuert alle Grafiken. Die vorhandenen Wiedergabe- und Positionsfunktionen sind auch beim Betrachten weiter unten liegender Diagramme erreichbar. Die Leiste passt sich Mobilgeräten an und lässt sich mit Tastatur und Touch bedienen.
