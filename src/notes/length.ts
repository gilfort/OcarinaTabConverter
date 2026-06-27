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

/** Maps a rest-length suffix digit (e.g. the "4" in "R4") to a NoteLength. */
export const REST_LENGTH_CODES: Record<string, NoteLength> = {
  "1": "whole",
  "2": "half",
  "4": "quarter",
  "8": "eighth",
};

/** Reverse of REST_LENGTH_CODES: maps a note length to its rest-token suffix digit. */
export const REST_LENGTH_TOKENS: Record<NoteLength, string> = Object.fromEntries(
  Object.entries(REST_LENGTH_CODES).map(([code, length]) => [length, code])
) as Record<NoteLength, string>;

/** Resolves an override to a concrete length, falling back to the global default. */
export function resolveNoteLength(override: NoteLengthOverride, defaultLength: NoteLength): NoteLength {
  return override === "default" ? defaultLength : override;
}

const NOTE_LENGTH_BY_UNITS: ReadonlyArray<{ length: NoteLength; units: number }> = (
  Object.entries(NOTE_LENGTH_UNITS) as [NoteLength, number][]
).map(([length, units]) => ({ length, units }));

/**
 * Rounds a duration, given in quarter-note units, to the nearest supported note length
 * (eighth/quarter/half/whole), comparing on a log scale so e.g. a dotted-eighth rounds
 * to the nearer of eighth/quarter.
 */
export function roundToNoteLength(units: number): NoteLength {
  const logUnits = Math.log2(Math.max(units, NOTE_LENGTH_UNITS.eighth / 4));

  let best = NOTE_LENGTH_BY_UNITS[0];
  let bestDistance = Infinity;
  for (const candidate of NOTE_LENGTH_BY_UNITS) {
    const distance = Math.abs(logUnits - Math.log2(candidate.units));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best.length;
}
