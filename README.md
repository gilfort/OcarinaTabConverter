# 🎵 Ocarina Tab Converter

> Type or click notes, get instant ocarina fingering tabs — with playback, MIDI import, and export to PDF or PNG.

A small, fast, **no-backend** web app: enter notes as text or on a clickable staff, pick your ocarina, and get a fingering-diagram tab you can play back, save, and export.

---

## ✨ Features at a glance

| | Feature | What it does |
|---|---|---|
| 🎼 | **Text note input** | Type `C4 D4 R4 E4` — letters, accidentals (`#`/`b`/`n`), octave numbers, and rests (`R`, `R2`, `R4`, `R8`) |
| 🖱️ | **Clickable staff** | Click directly on a treble staff to place notes; `Shift` = sharp, `Ctrl`/`Cmd` = flat |
| ⌨️ | **Piano-style keyboard shortcuts** | QWERTZ "musical typing" layout for the staff — type notes, shift octaves, set lengths, all without a mouse |
| 🪈 | **Two ocarina types** | 12-hole and double-chamber ocarina, each with their own fingering chart and playable range |
| 🎚️ | **Per-note length** | Override any note's length (eighth/quarter/half/whole) independently of the global default |
| 🔁 | **Repeats & voltas** | `|: ... :|` repeat barlines and `[1` / `[2` alternate endings, expanded automatically for playback/export |
| 🎶 | **Ties & legato** | `C4-C4` for a held tone, `C4-D4` for legato — no audible gap or retrigger between the pair |
| ↩️ | **Manual line breaks** | Insert `|` to force a new line in the rendered tab |
| 🎹 | **Key signatures** | Pick sharps/flats per pitch class; unmarked notes inherit the signature automatically |
| ▶️ | **Web Audio playback** | Play / Pause / Stop the entered sequence, synthesized in the browser |
| 📥 | **MIDI import** | Drop a `.mid`/`.midi` file and have its notes (with durations) converted straight into the tab |
| 💾 | **Save & load** | Export your work as a `.txt` project file and reload it later |
| 🖨️ | **PDF / PNG export** | Render the tab as a polished, printable document or image |
| ⚠️ | **Out-of-range handling** | Notes outside the instrument's range are flagged, with one-click octave-shift or removal before export |

---

## 🎤 Note input syntax

```
C4 D4 E4 F4 G4 A4 B4 C5
```

| Token | Meaning |
|---|---|
| `C4`, `D#4`, `Eb4` | Note name + optional accidental (`#` sharp, `b` flat, `n` force natural) + octave |
| `C` (no octave) | Defaults to octave 4 |
| `R`, `R2`, `R4`, `R8` | Rest (whole / half / quarter / eighth) |
| `C4-D4` | Tie/legato pair — `C4-C4` is one continuous tone, `C4-D4` is two notes with no gap between them |
| `\|` | Manual line break in the rendered tab |
| `\|:` … `:\|` | Repeat block |
| `[1` / `[2` | First/second-ending (volta) markers inside a repeat |

Separate tokens with spaces or commas — both `C4 D4` and `C4, D4` work.

---

## ⌨️ Staff keyboard shortcuts

Open **Staff input**, click into the staff to focus it, then play it like a piano:

```
black (sharp): Q  W  E  R  T  Z  U  I
white (nat.) : A  S  D  F  G  H  J  K
note         : C  D  E  F  G  A  B  C (next octave)
```

| Key(s) | Action |
|---|---|
| `A` `S` `D` `F` `G` `H` `J` `K` | Place the natural note for that column |
| `Q` `W` `E` `R` `T` `Z` `U` `I` | Place the sharp directly above the matching white key |
| `Ctrl` / `Cmd` + white key | Place the flat instead of the natural |
| `←` / `→` | Move the insertion cursor without placing a note |
| `Backspace` / `Delete` | Remove the note before / at the cursor |
| `1`–`5` | Set the length for the **next** note placed (Default, Eighth, Quarter, Half, Whole) |
| `PageUp` / `PageDown` (or `+` / `-`) | Shift the keyboard's octave up or down |

Click **⌨ Keys** to toggle an on-screen legend showing the current mapping, octave, and pending length.

---

## 🪈 Supported ocarinas

- **12-Hole Ocarina** — standard 12-hole fingering chart
- **Double-Chamber Ocarina** — extended range across two chambers

Each type has its own playable range; notes outside it are marked "out of range," and you'll be offered the choice to shift them an octave or drop them when exporting.

---

## 🎛️ Other controls

- **Title** — names the piece (used in the export filename and printed on the tab)
- **Key signature** — toggle sharps/flats per letter; affects how plain note names are interpreted
- **Default note length** — the length used when a note has no per-note override
- **New line** — inserts a `|` line break at the cursor in the text input
- **Play / Pause / Stop** — Web Audio playback of the current sequence
- **Save / Load** — round-trip your title, ocarina type, notes, key signature, and length overrides via a `.txt` file
- **Import MIDI** — drag-and-drop or pick a `.mid`/`.midi` file; multi-track files let you choose which track to import
- **Export** — render to **PDF** or **PNG**, with a dialog to resolve out-of-range notes first

---

## 🛠️ Development

```bash
npm install      # install dependencies
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm test         # run the vitest suite
```

Built with **TypeScript** + **Vite**, no UI framework — plain DOM rendering, [`html2canvas`](https://github.com/niklasvh/html2canvas) + [`jsPDF`](https://github.com/parallax/jsPDF) for export.
