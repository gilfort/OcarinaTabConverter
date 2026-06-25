import type { Note } from "../notes/types";
import type { NoteLengthOverride } from "../notes/length";
import { octaveBaseStep, stepToFlattedNote, stepToNaturalNote, stepToSharpedNote } from "./staff";

/**
 * Piano-style "musical typing" key mapping for the staff input, adapted from GarageBand's
 * layout for a QWERTZ keyboard (the home row is unaffected; the upper row swaps Y/Z to match
 * QWERTZ's physical key positions). Columns line up: each black key sits directly above the
 * white key sharing its column, rather than GarageBand's gapped/offset layout, so the mapping
 * doubles as "this column's note" (white) vs. "this column's sharp" (black):
 *
 * ```
 * black (sharp): Q  W  E  R  T  Z  U  I
 * white (nat.) : A  S  D  F  G  H  J  K
 * column step  : 0  1  2  3  4  5  6  7   (relative to the current octave's C)
 * note (oct N) : C  D  E  F  G  A  B  C(N+1)
 * ```
 *
 * Holding Ctrl/Cmd while pressing a white key gives its flat instead, mirroring the existing
 * staff click modifiers (plain = natural, Shift = sharp, Ctrl/Cmd = flat) — the black row is
 * effectively a shortcut for Shift+white-key.
 */
export const WHITE_KEYS: readonly string[] = ["a", "s", "d", "f", "g", "h", "j", "k"];
export const BLACK_KEYS: readonly string[] = ["q", "w", "e", "r", "t", "z", "u", "i"];

/** Maps length-selector keys "1"-"5" to the same order as the existing length <select> options. */
export const LENGTH_KEYS: Readonly<Record<string, NoteLengthOverride>> = {
  "1": "default",
  "2": "eighth",
  "3": "quarter",
  "4": "half",
  "5": "whole",
};

export const OCTAVE_UP_KEYS: readonly string[] = ["PageUp", "+"];
export const OCTAVE_DOWN_KEYS: readonly string[] = ["PageDown", "-"];

export const MIN_OCTAVE = 2;
export const MAX_OCTAVE = 6;
export const DEFAULT_OCTAVE = 4;

/** Clamps an octave shift to the supported range. */
export function clampOctave(octave: number): number {
  return Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, octave));
}

/**
 * Resolves a pressed key (lowercased) to the note it places at the given octave, or `null` if
 * the key isn't mapped. `modifiers.ctrlKey`/`metaKey` give a white key's flat instead of its
 * natural, matching the staff's Ctrl/Cmd-click behavior.
 */
export function resolveKeyNote(
  key: string,
  octave: number,
  modifiers: { ctrlKey: boolean; metaKey: boolean } = { ctrlKey: false, metaKey: false }
): Note | null {
  const lowerKey = key.toLowerCase();
  const baseStep = octaveBaseStep(octave);

  const whiteColumn = WHITE_KEYS.indexOf(lowerKey);
  if (whiteColumn !== -1) {
    const step = baseStep + whiteColumn;
    return modifiers.ctrlKey || modifiers.metaKey ? stepToFlattedNote(step) : stepToNaturalNote(step);
  }

  const blackColumn = BLACK_KEYS.indexOf(lowerKey);
  if (blackColumn !== -1) {
    return stepToSharpedNote(baseStep + blackColumn);
  }

  return null;
}
