import type { Note, PitchClass } from "../notes/types";
import { normalizeNote } from "../fingering/normalize";
import type { TabItem } from "./render";

const NATURAL_ORDER: readonly PitchClass[] = ["C", "D", "E", "F", "G", "A", "B"];

/** Diatonic index (relative to C0) of E4, the bottom line of a treble staff — used as step 0. */
const E4_INDEX = 4 * 7 + NATURAL_ORDER.indexOf("E");

const LINE_SPACING = 12;
const HALF_STEP = LINE_SPACING / 2;

/** Drawable range: A3 (lowest) to C6 (highest), expressed as diatonic steps from E4. */
export const STEP_MIN = -4;
export const STEP_MAX = 12;

/** Steps of the five treble-staff lines (E4, G4, B4, D5, F5). */
const STAFF_BOTTOM_STEP = 0;
const STAFF_TOP_STEP = 8;

const NOTE_SPACING = 29;
const CLEF_WIDTH = 53;
const LEFT_MARGIN = 14;
const NOTEHEAD_RX = 5.4;
const NOTEHEAD_RY = 3.84;
const TOP_PADDING = HALF_STEP + 5;
const SVG_HEIGHT = (STEP_MAX - STEP_MIN) * HALF_STEP + TOP_PADDING * 2;

/** Diatonic index (relative to C0) of a natural-pitch reference for `note`, ignoring its accidental. */
function diatonicIndex(note: Pick<Note, "pitchClass" | "octave">): number {
  return note.octave * 7 + NATURAL_ORDER.indexOf(note.pitchClass);
}

/** The staff step (line/space position) a note is drawn on. Sharps share their natural's step. */
export function noteToStep(note: Pick<Note, "pitchClass" | "octave">): number {
  return diatonicIndex(note) - E4_INDEX;
}

/** The natural note (no accidental) drawn at a given staff step. */
export function stepToNaturalNote(step: number): Note {
  const totalIndex = step + E4_INDEX;
  const octave = Math.floor(totalIndex / 7);
  const pitchClass = NATURAL_ORDER[((totalIndex % 7) + 7) % 7];
  return { pitchClass, accidental: null, octave };
}

/** The flat of a staff step's natural note, respelled with a sharp (e.g. step "D" -> "Db" -> "C#"). */
export function stepToFlattedNote(step: number): Note {
  const natural = stepToNaturalNote(step);
  const normalized = normalizeNote({ ...natural, accidental: "flat" });
  return { pitchClass: normalized.pitchClass, accidental: normalized.accidental, octave: normalized.octave };
}

/** The sharp of a staff step's natural note (e.g. step "D" -> "D#"; step "E" -> "E#" -> "F"). */
export function stepToSharpedNote(step: number): Note {
  const natural = stepToNaturalNote(step);
  const normalized = normalizeNote({ ...natural, accidental: "sharp" });
  return { pitchClass: normalized.pitchClass, accidental: normalized.accidental, octave: normalized.octave };
}

/** Picks the note for a staff step based on which modifier key (if any) is held during the click. */
function stepToNote(step: number, event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">): Note {
  if (event.ctrlKey || event.metaKey) return stepToFlattedNote(step);
  if (event.shiftKey) return stepToSharpedNote(step);
  return stepToNaturalNote(step);
}

function stepToY(step: number): number {
  return (STEP_MAX - step) * HALF_STEP + TOP_PADDING;
}

/** Converts a y coordinate (in SVG viewBox units) to the nearest staff step, clamped to the drawable range. */
export function yToStep(y: number): number {
  const step = Math.round(STEP_MAX - (y - TOP_PADDING) / HALF_STEP);
  return Math.min(STEP_MAX, Math.max(STEP_MIN, step));
}

export interface StaffOptions {
  /** Called when the user clicks the staff to add a note. `displayAsFlat` reflects the Ctrl/Cmd modifier. */
  onNoteClick: (note: Note, displayAsFlat: boolean) => void;
}

function staffLine(x1: number, x2: number, step: number, className: string): string {
  const y = stepToY(step);
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="${className}" />`;
}

/**
 * Markup for a placed note. When `flatDisplay` is set (the note was placed with Ctrl/Cmd), it's
 * drawn one step higher with a ♭ instead of at its sharp's natural step with a ♯ — e.g. a stored
 * "C#5" with `flatDisplay` is drawn as "D♭5" on the D5 line, matching how it was placed.
 */
function noteGlyph(note: Note, x: number, flatDisplay = false): string {
  const step = flatDisplay ? noteToStep(note) + 1 : noteToStep(note);
  const y = stepToY(step);
  const symbol = flatDisplay ? "♭" : note.accidental === "sharp" ? "♯" : null;
  const accidental = symbol ? `<text x="${x - 12}" y="${y + 4}" class="staff-input__accidental">${symbol}</text>` : "";
  return `${accidental}<ellipse cx="${x}" cy="${y}" rx="${NOTEHEAD_RX}" ry="${NOTEHEAD_RY}" class="staff-input__notehead" />`;
}

/**
 * Markup for the hover preview at `step`, showing `accidental` (♯ for Shift, ♭ for Ctrl/Cmd, or
 * none for a plain click) directly at that position — even when the note it would actually add
 * (e.g. Db -> C#) is drawn elsewhere, so the preview matches where the user is pointing.
 */
function previewGlyph(step: number, accidental: "♯" | "♭" | null, x: number): string {
  const y = stepToY(step);
  const accidentalMarkup = accidental
    ? `<text x="${x - 12}" y="${y + 4}" class="staff-input__accidental staff-input__preview-glyph">${accidental}</text>`
    : "";
  return `${accidentalMarkup}<ellipse cx="${x}" cy="${y}" rx="${NOTEHEAD_RX}" ry="${NOTEHEAD_RY}" class="staff-input__notehead staff-input__preview-glyph" />`;
}

/** The accidental a hover preview should show for the given modifier keys. */
function previewAccidental(event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">): "♯" | "♭" | null {
  if (event.ctrlKey || event.metaKey) return "♭";
  if (event.shiftKey) return "♯";
  return null;
}

/** Converts a mouse event's position into a staff step, relative to `svg`'s rendered bounding box. */
function eventToStep(event: MouseEvent, svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect();
  const relativeY = ((event.clientY - rect.top) / rect.height) * SVG_HEIGHT;
  return yToStep(relativeY);
}

/**
 * Renders a clickable treble staff (A3-C6) into `container`. The current note sequence (from `items`)
 * is drawn on the staff, and clicking anywhere on it adds a note via `options.onNoteClick`:
 * plain click adds the natural note at that position, Shift adds its sharp, and Ctrl/Cmd adds its
 * flat — flats are always respelled as sharps (e.g. Db -> C#) since flats aren't used elsewhere.
 */
export function renderStaff(container: HTMLElement, items: TabItem[], options: StaffOptions): void {
  const notes = items
    .filter((item): item is TabItem & { token: { note: Note } } => item.token.note !== null)
    .map((item) => ({ note: item.token.note, flatDisplay: item.flatDisplay ?? false }));
  const width = CLEF_WIDTH + LEFT_MARGIN * 2 + notes.length * NOTE_SPACING;

  const lines: string[] = [];
  for (let step = STAFF_BOTTOM_STEP; step <= STAFF_TOP_STEP; step += 2) {
    lines.push(staffLine(0, width, step, "staff-input__line"));
  }
  for (let step = STAFF_TOP_STEP + 2; step <= STEP_MAX; step += 2) {
    lines.push(staffLine(CLEF_WIDTH, width, step, "staff-input__ledger"));
  }
  for (let step = STAFF_BOTTOM_STEP - 2; step >= STEP_MIN; step -= 2) {
    lines.push(staffLine(CLEF_WIDTH, width, step, "staff-input__ledger"));
  }

  const clefY = stepToY(2) + 19;
  const clef = `<text x="4" y="${clefY}" class="staff-input__clef">\u{1D11E}</text>`;

  const noteGlyphs = notes
    .map(({ note, flatDisplay }, index) => noteGlyph(note, CLEF_WIDTH + LEFT_MARGIN + index * NOTE_SPACING, flatDisplay))
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${SVG_HEIGHT}" class="staff-input__svg" role="img" aria-label="Clickable staff for adding notes">
      ${lines.join("")}
      ${clef}
      ${noteGlyphs}
      <rect x="0" y="0" width="${width}" height="${SVG_HEIGHT}" class="staff-input__overlay" />
    </svg>
  `;

  const svg = container.querySelector<SVGSVGElement>("svg")!;
  const overlay = container.querySelector<SVGRectElement>(".staff-input__overlay")!;
  const previewX = CLEF_WIDTH + LEFT_MARGIN + notes.length * NOTE_SPACING;
  let previewGroup: SVGGElement | null = null;

  overlay.addEventListener("mousemove", (event) => {
    const step = eventToStep(event, svg);
    if (!previewGroup) {
      previewGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      previewGroup.setAttribute("class", "staff-input__preview");
      svg.appendChild(previewGroup);
    }
    previewGroup.innerHTML = previewGlyph(step, previewAccidental(event), previewX);
  });
  overlay.addEventListener("mouseleave", () => {
    previewGroup?.remove();
    previewGroup = null;
  });

  overlay.addEventListener("click", (event) => {
    const step = eventToStep(event, svg);
    options.onNoteClick(stepToNote(step, event), event.ctrlKey || event.metaKey);
  });
}
