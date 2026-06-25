import type { Accidental, KeySignature, Note, ParseResult, ParsedToken, PitchClass, RepeatMarker } from "./types";
import { DEFAULT_NOTE_LENGTH, REST_LENGTH_CODES, type NoteLength } from "./length";

const NOTE_PATTERN = /^([A-Ga-g])([#bnN]?)(-?\d+)?$/;
const REST_PATTERN = /^[Rr](\d+)?$/;
const LINE_BREAK_TOKEN = "|";

const MARKER_TOKENS: Readonly<Record<string, RepeatMarker>> = {
  "|:": "repeatStart",
  ":|": "repeatEnd",
  "[1": "voltaOne",
  "[2": "voltaTwo",
};

const PITCH_CLASSES: readonly PitchClass[] = ["A", "B", "C", "D", "E", "F", "G"];

/** Octave assumed when a note is entered without one, e.g. "C" or "C#". */
const DEFAULT_OCTAVE = 4;

/** An explicit accidental symbol from input text: "#"/"b" set an accidental, "n"/"N" forces natural. */
type AccidentalSymbol = Accidental | "natural" | null;

function toAccidentalSymbol(symbol: string): AccidentalSymbol {
  if (symbol === "#") return "sharp";
  if (symbol === "b") return "flat";
  if (symbol === "n" || symbol === "N") return "natural";
  return null;
}

/**
 * Parses a single note token (e.g. "C4", "C#4", "Db4", "Cn4") into a `Note`.
 * A token with no accidental symbol takes its accidental from `keySignature` (if given), while
 * an explicit "#"/"b" overrides it and "n"/"N" forces the note natural regardless of the key
 * signature. Returns an error message if the token is not a valid note name.
 */
export function parseNoteToken(
  raw: string,
  keySignature?: KeySignature
): { note: Note | null; error: string | null } {
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

  const symbol = toAccidentalSymbol(accidentalSymbol);
  const accidental: Accidental | null =
    symbol === "natural" ? null : symbol !== null ? symbol : keySignature?.[pitchClass] ?? null;

  return {
    note: {
      pitchClass,
      accidental,
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
 *
 * `keySignature`, if given, supplies the default accidental for notes
 * entered without an explicit "#"/"b"/"n".
 */
/** Splits raw input text into whitespace/comma-separated token strings, in order. */
export function splitRawTokens(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function parseNotes(input: string, keySignature?: KeySignature): ParseResult {
  const rawTokens = splitRawTokens(input);

  const tokens: ParsedToken[] = rawTokens.map((raw, index) => {
    if (raw.trim() === LINE_BREAK_TOKEN) {
      return { raw, index, sourceIndex: index, note: null, rest: null, error: null, lineBreak: true, marker: null };
    }

    const marker = MARKER_TOKENS[raw.trim()];
    if (marker) {
      return { raw, index, sourceIndex: index, note: null, rest: null, error: null, lineBreak: false, marker };
    }

    const restMatch = REST_PATTERN.exec(raw.trim());
    if (restMatch) {
      const { rest, error } = parseRestToken(raw, restMatch);
      return { raw, index, sourceIndex: index, note: null, rest, error, lineBreak: false, marker: null };
    }

    const { note, error } = parseNoteToken(raw, keySignature);
    return { raw, index, sourceIndex: index, note, rest: null, error, lineBreak: false, marker: null };
  });

  return { tokens };
}
