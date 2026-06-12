import type { Note } from "../notes/types";
import type { NormalizedNote } from "./types";

const NATURAL_SEMITONES: Record<Note["pitchClass"], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Chromatic spellings (sharps only) for each semitone, index 0-11. */
const CHROMATIC_SPELLING: ReadonlyArray<{ pitchClass: NormalizedNote["pitchClass"]; accidental: "sharp" | null }> = [
  { pitchClass: "C", accidental: null },
  { pitchClass: "C", accidental: "sharp" },
  { pitchClass: "D", accidental: null },
  { pitchClass: "D", accidental: "sharp" },
  { pitchClass: "E", accidental: null },
  { pitchClass: "F", accidental: null },
  { pitchClass: "F", accidental: "sharp" },
  { pitchClass: "G", accidental: null },
  { pitchClass: "G", accidental: "sharp" },
  { pitchClass: "A", accidental: null },
  { pitchClass: "A", accidental: "sharp" },
  { pitchClass: "B", accidental: null },
];

/** Converts a note to an absolute semitone number (C0 = 0), accounting for sharps/flats. */
export function toAbsoluteSemitone(note: Note | NormalizedNote): number {
  const accidentalOffset = note.accidental === "sharp" ? 1 : note.accidental === "flat" ? -1 : 0;
  return note.octave * 12 + NATURAL_SEMITONES[note.pitchClass] + accidentalOffset;
}

/**
 * Normalizes a note to its chromatic chart spelling (sharps only, no flats),
 * so enharmonically equivalent spellings (e.g. C#4 and Db4) resolve to the
 * same fingering chart entry.
 */
export function normalizeNote(note: Note): NormalizedNote {
  const absSemitone = toAbsoluteSemitone(note);
  const octave = Math.floor(absSemitone / 12);
  const index = ((absSemitone % 12) + 12) % 12;
  const spelling = CHROMATIC_SPELLING[index];
  return { pitchClass: spelling.pitchClass, accidental: spelling.accidental, octave };
}

export function normalizedNotesEqual(a: NormalizedNote, b: NormalizedNote): boolean {
  return a.pitchClass === b.pitchClass && a.accidental === b.accidental && a.octave === b.octave;
}
