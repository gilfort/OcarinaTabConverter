import type { NoteLength } from "./length";

export type PitchClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Accidental = "sharp" | "flat";

/** Maps pitch classes that are always sharp/flat for a piece, applied to notes with no explicit accidental. */
export type KeySignature = Partial<Record<PitchClass, Accidental>>;

export interface Note {
  pitchClass: PitchClass;
  accidental: Accidental | null;
  octave: number;
}

/** True when two notes have the same pitch class, accidental, and octave. */
export function notesEqual(a: Note, b: Note): boolean {
  return a.pitchClass === b.pitchClass && a.accidental === b.accidental && a.octave === b.octave;
}

/**
 * A note's role within a tie/legato pair (e.g. "C4-D4"): "start" is the first note,
 * "end" is the second. `null` means the note isn't part of a tie.
 */
export type TieRole = "start" | "end";

/** A repeat-barline or alternate-ending ("volta") marker token, e.g. "|:" or "[1". */
export type RepeatMarker = "repeatStart" | "repeatEnd" | "voltaOne" | "voltaTwo";

export interface ParsedToken {
  /** The raw text of this token as entered by the user. */
  raw: string;
  /** Index of this token within the parsed sequence. */
  index: number;
  /**
   * Index of the originally-written token this one came from, before repeat expansion.
   * Equal to `index` for unexpanded tokens; shared by every duplicate produced by a
   * `|: ... :|` repeat, so a length-override change on one copy can propagate to all of them.
   */
  sourceIndex: number;
  note: Note | null;
  /** Set when this token is a rest (e.g. "R4"), giving its duration. */
  rest: NoteLength | null;
  /** Set when `note` and `rest` are null, describing why the token could not be parsed. */
  error: string | null;
  /** Set when this token is a manual line break ("|"), forcing the next item onto a new row. */
  lineBreak: boolean;
  /** Set when this token is a repeat barline or volta marker ("|:", ":|", "[1", "[2"). */
  marker: RepeatMarker | null;
  /** Set when this note is one half of a tie/legato pair entered as e.g. "C4-D4". */
  tie: TieRole | null;
}

export interface ParseResult {
  tokens: ParsedToken[];
}
