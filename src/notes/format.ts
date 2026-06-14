import type { Note } from "./types";

/** Formats a note back to its text form, e.g. "A3" or "C#5". */
export function formatNote(note: Note): string {
  const accidental = note.accidental === "sharp" ? "#" : note.accidental === "flat" ? "b" : "";
  return `${note.pitchClass}${accidental}${note.octave}`;
}
