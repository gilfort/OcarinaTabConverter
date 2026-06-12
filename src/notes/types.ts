export type PitchClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Accidental = "sharp" | "flat";

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
  /** Set when `note` is null, describing why the token could not be parsed. */
  error: string | null;
}

export interface ParseResult {
  tokens: ParsedToken[];
}
