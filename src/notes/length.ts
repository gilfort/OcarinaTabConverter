export type NoteLength = "eighth" | "quarter" | "half" | "whole";

/** A per-note length choice, where "default" inherits the globally selected default length. */
export type NoteLengthOverride = NoteLength | "default";

/** Width of each note's tab image/dash, expressed in quarter-note units. */
export const NOTE_LENGTH_UNITS: Record<NoteLength, number> = {
  eighth: 0.5,
  quarter: 1,
  half: 2,
  whole: 4,
};

export const NOTE_LENGTH_LABELS: Record<NoteLength, string> = {
  eighth: "Eighth",
  quarter: "Quarter",
  half: "Half",
  whole: "Whole",
};

export const NOTE_LENGTHS: readonly NoteLength[] = ["eighth", "quarter", "half", "whole"];

export const DEFAULT_NOTE_LENGTH: NoteLength = "quarter";

/** Resolves an override to a concrete length, falling back to the global default. */
export function resolveNoteLength(override: NoteLengthOverride, defaultLength: NoteLength): NoteLength {
  return override === "default" ? defaultLength : override;
}
