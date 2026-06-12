import type { Accidental, Note, ParseResult, ParsedToken, PitchClass } from "./types";

const NOTE_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)$/;

const PITCH_CLASSES: readonly PitchClass[] = ["A", "B", "C", "D", "E", "F", "G"];

function toAccidental(symbol: string): Accidental | null {
  if (symbol === "#") return "sharp";
  if (symbol === "b") return "flat";
  return null;
}

/**
 * Parses a single note token (e.g. "C4", "C#4", "Db4") into a `Note`.
 * Returns an error message if the token is not a valid note name.
 */
export function parseNoteToken(raw: string): { note: Note | null; error: string | null } {
  const trimmed = raw.trim();
  const match = NOTE_PATTERN.exec(trimmed);
  if (!match) {
    return { note: null, error: `"${raw}" is not a valid note name (expected e.g. "C4" or "C#4")` };
  }

  const [, letter, accidentalSymbol, octaveText] = match;
  const pitchClass = letter.toUpperCase() as PitchClass;
  if (!PITCH_CLASSES.includes(pitchClass)) {
    return { note: null, error: `"${raw}" has an unknown pitch class "${letter}"` };
  }

  return {
    note: {
      pitchClass,
      accidental: toAccidental(accidentalSymbol),
      octave: Number.parseInt(octaveText, 10),
    },
    error: null,
  };
}

/**
 * Parses a sequence of note names separated by whitespace and/or commas
 * (e.g. "C4, D4 E4") into an ordered list of tokens. Each token carries
 * either a parsed `Note` or an error message, preserving input order so
 * invalid tokens can be flagged without dropping valid neighbors.
 */
export function parseNotes(input: string): ParseResult {
  const rawTokens = input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const tokens: ParsedToken[] = rawTokens.map((raw, index) => {
    const { note, error } = parseNoteToken(raw);
    return { raw, index, note, error };
  });

  return { tokens };
}
