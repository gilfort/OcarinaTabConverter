import type { Accidental, Note, ParseResult, ParsedToken, PitchClass } from "./types";
import { DEFAULT_NOTE_LENGTH, REST_LENGTH_CODES, type NoteLength } from "./length";

const NOTE_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)?$/;
const REST_PATTERN = /^[Rr](\d+)?$/;

const PITCH_CLASSES: readonly PitchClass[] = ["A", "B", "C", "D", "E", "F", "G"];

/** Octave assumed when a note is entered without one, e.g. "C" or "C#". */
const DEFAULT_OCTAVE = 4;

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
      octave: octaveText !== undefined ? Number.parseInt(octaveText, 10) : DEFAULT_OCTAVE,
    },
    error: null,
  };
}

/**
 * Parses a single rest token (e.g. "R", "R4", "R8") into a `NoteLength`.
 * `match` must be the result of a successful `REST_PATTERN` exec.
 * Returns an error message if the length suffix is not recognized.
 */
function parseRestToken(
  raw: string,
  match: RegExpExecArray
): { rest: NoteLength | null; error: string | null } {
  const [, lengthCode] = match;
  if (lengthCode === undefined) {
    return { rest: DEFAULT_NOTE_LENGTH, error: null };
  }

  const length = REST_LENGTH_CODES[lengthCode];
  if (!length) {
    return { rest: null, error: `"${raw}" is not a valid rest (expected R, R1, R2, R4, or R8)` };
  }

  return { rest: length, error: null };
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
    const restMatch = REST_PATTERN.exec(raw.trim());
    if (restMatch) {
      const { rest, error } = parseRestToken(raw, restMatch);
      return { raw, index, note: null, rest, error };
    }

    const { note, error } = parseNoteToken(raw);
    return { raw, index, note, rest: null, error };
  });

  return { tokens };
}
