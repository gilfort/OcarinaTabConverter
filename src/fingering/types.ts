import type { Note } from "../notes/types";

export type OcarinaTypeId = "12hole" | "double";

export type Chamber = "left" | "right";

export interface OcarinaType {
  id: OcarinaTypeId;
  displayName: string;
  /** Inclusive playable range, expressed as normalized chart keys. */
  range: {
    min: NormalizedNote;
    max: NormalizedNote;
  };
  /** Number of separate chambers a player blows into (1 for 12-hole, 2 for double). */
  chamberCount: number;
}

/** A note normalized to the chromatic spelling used by the fingering chart (sharps only, no flats). */
export interface NormalizedNote {
  pitchClass: Note["pitchClass"];
  accidental: "sharp" | null;
  octave: number;
}

export interface FingeringChartEntry {
  note: NormalizedNote;
  /** Path to the diagram image, relative to the app root (e.g. "/tabs/12hole_C4.png"). */
  image: string;
  /** Human-readable label for the note, e.g. "C4" or "C#4". */
  label: string;
  /** Which chamber plays this note, for multi-chamber instruments (e.g. double ocarina). */
  chamber?: Chamber;
}

export type FingeringResult =
  | { status: "found"; note: Note; entry: FingeringChartEntry }
  | { status: "out-of-range"; note: Note }
  | { status: "unsupported"; note: Note };
