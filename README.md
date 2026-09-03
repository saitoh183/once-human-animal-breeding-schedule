# Once Human Animal Breeding Schedule

A dependency-free local tracker for Once Human breeding checks. Data is stored in the browser's `localStorage` — no account, backend, or mystery meat service required. Use **Export JSON** / **Import JSON** for portable backups or to replace the current browser data.

## Features

- Character, animal, and type pulldowns with **add / rename / remove** management.
- Seeded animal list based on the Once Human Ranching reference (and deliberately editable because live-service games enjoy changing lists).
- Trait selection: `TH` or `Perfect`.
- Date/time schedule, auto-growing notes, in-place editing.
- Sticky table headers; multi-select and individual removal both require confirmation.
- Dark, high-contrast responsive layout.

## Run

Open `index.html` in a modern browser. To serve locally:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Animal seed source

- [Once Human Wiki – Ranching](https://once-human.fandom.com/wiki/Ranching)
- [Official 1.2 Ranching update](https://www.oncehuman.game/news/update/20240925/40780_1183266.html)

The list manager is intentional: it lets you maintain the roster as the game changes or use your preferred naming.
