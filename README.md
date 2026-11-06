# Szachy Czarodziejów 3D

Pełne szachy 3D w przeglądarce, w klimacie świata czarodziejów: kamienne figury stoją
w zamkowej sali z zaczarowanym, gwieździstym sklepieniem i lewitującymi świecami.
**Każdy ruch to zaklęcie**, a po nim odpala się animacja.

## Animacje po ruchu

- **Ruch:** pod figurą pojawia się runiczny magiczny krąg. Figura unosi się, świeci, leci łukiem
  i zostawia za sobą smugę iskier (złotych dla białych, szmaragdowych dla czarnych). Ląduje
  z falą uderzeniową, kurzem i lekkim wstrząsem kamery.
- **Bicie:** atakująca figura wystrzeliwuje pocisk zaklęcia z błyskawicą. Trafiona figura drży
  i **rozpada się na kamienne odłamki**, które odbijają się od planszy i spadają z cokołu.
- **Roszada:** król i wieża lewitują i przelatują jednocześnie.
- **Promocja:** w słupie światła pionek znika w spirali iskier i odradza się jako nowa figura.
- **Szach / mat:** wokół króla pulsuje czerwona aura. Przy macie król się przewraca i rozsypuje.
- **Kamera kinowa:** w trakcie każdego zaklęcia kamera najeżdża z boku na akcję, a potem wraca.
- Na ekranie pojawia się inkantacja (np. *„Lapis Frangitur!”*), a efekty dźwiękowe
  generuje Web Audio.

## Funkcje

- Pełne zasady szachów (roszada, bicie w przelocie, promocja, pat, remisy), oparte na `chess.js`.
- Tryb **Gracz vs Komputer** z trzema poziomami. AI to negamax z alfa-betą w Web Workerze.
- Tryb **Dwóch graczy** na jednym urządzeniu.
- Cofanie ruchu, obrót widoku, księga ruchów (notacja SAN).
- Przełączniki: kamera kinowa, szybkie animacje, dźwięk.
- Działa na komputerze i telefonie (sterowanie dotykiem, panel wysuwany na małych ekranach).

## Uruchomienie

Gra używa modułów ES, więc trzeba ją otworzyć przez serwer HTTP, a nie przez `file://`:

```bash
python3 -m http.server 8000
# następnie otwórz http://localhost:8000
```

Można ją też opublikować na GitHub Pages bez kroku budowania. Wszystkie biblioteki są
dołączone w katalogu `vendor/`.

## Sterowanie

- Kliknij figurę, a potem podświetlone pole. Czerwone pierścienie oznaczają bicie.
- Przeciągnięcie myszą lub palcem obraca kamerę, kółko lub szczypanie przybliża.

## Struktura

| Plik | Zawartość |
| --- | --- |
| `js/main.js` | logika gry, sekwencje animacji ruchu, kamera, UI |
| `js/effects.js` | cząsteczki, odłamki, fale uderzeniowe, magiczne kręgi, pociski zaklęć |
| `js/pieces.js` | proceduralne modele figur (LatheGeometry / Extrude) |
| `js/environment.js` | sala zamkowa, świece, sklepienie z gwiazdami, światła |
| `js/board.js` | szachownica i znaczniki pól |
| `js/textures.js` | tekstury generowane na canvasie (marmur, kamień, runy) |
| `js/audio.js` | syntezowane efekty dźwiękowe |
| `js/ai-worker.js` | silnik komputera |

Biblioteki: [three.js](https://threejs.org) r160 (MIT), [chess.js](https://github.com/jhlywa/chess.js) 1.0.0 (BSD-2).
Licencje są w `vendor/`.

Projekt fanowski inspirowany klimatem czarodziejskich szachów. Wszystkie modele, tekstury
i dźwięki są generowane proceduralnie.
