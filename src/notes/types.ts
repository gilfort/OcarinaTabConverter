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

export interface ParsedToken {
  /** The raw text of this token as entered by the user. */
  raw: string;
  /** Index of this token within the parsed sequence. */
  index: number;
  note: Note | null;
  /** Set when this token is a rest (e.g. "R4"), giving its duration. */
  rest: NoteLength | null;
  /** Set when `note` and `rest` are null, describing why the token could not be parsed. */
  error: string | null;
}

export interface ParseResult {
  tokens: ParsedToken[];
}
