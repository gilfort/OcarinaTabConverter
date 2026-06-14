import { formatNote } from "../notes/format";
import { NOTE_LENGTH_UNITS, REST_LENGTH_CODES, type NoteLength, type NoteLengthOverride } from "../notes/length";
import type { Note } from "../notes/types";
import { toAbsoluteSemitone } from "../fingering/normalize";
import type { OcarinaType } from "../fingering/types";
import type { MidiNoteEvent, MidiTrack } from "./types";

/** Chromatic spellings (sharps only) for each semitone, index 0-11. Matches fingering/normalize. */
const CHROMATIC_SPELLING: ReadonlyArray<{ pitchClass: Note["pitchClass"]; accidental: "sharp" | null }> = [
  { pitchClass: "C", accidental: null },
  { pitchClass: "C", accidental: "sharp" },
  { pitchClass: "D", accidental: null },
  { pitchClass: "D", accidental: "sharp" },
  { pitchClass: "E", accidental: null },
  { pitchClass: "F", accidental: null },
  { pitchClass: "F", accidental: "sharp" },
  { pitchClass: "G", accidental: null },
  { pitchClass: "G", accidental: "sharp" },
  { pitchClass: "A", accidental: null },
  { pitchClass: "A", accidental: "sharp" },
  { pitchClass: "B", accidental: null },
];

/** Reverse of REST_LENGTH_CODES: maps a note length to its rest-token suffix digit. */
const REST_LENGTH_TOKENS: Record<NoteLength, string> = Object.fromEntries(
  Object.entries(REST_LENGTH_CODES).map(([code, length]) => [length, code])
) as Record<NoteLength, string>;

/** A note name or rest token derived from a MIDI track, ready to feed into the note input. */
export interface ConvertedToken {
  raw: string;
  lengthOverride: NoteLengthOverride;
}

/** Converts a MIDI note number (0-127, where 60 = C4) to a `Note`. */
export function midiPitchToNote(pitch: number): Note {
  const octave = Math.floor(pitch / 12) - 1;
  const spelling = CHROMATIC_SPELLING[((pitch % 12) + 12) % 12];
  return { pitchClass: spelling.pitchClass, accidental: spelling.accidental, octave };
}

const NOTE_LENGTH_BY_UNITS: ReadonlyArray<{ length: NoteLength; units: number }> = (
  Object.entries(NOTE_LENGTH_UNITS) as [NoteLength, number][]
).map(([length, units]) => ({ length, units }));

/**
 * Rounds a tick duration to the nearest supported note length (eighth/quarter/half/whole),
 * comparing on a log scale so e.g. a dotted-eighth rounds to the nearer of eighth/quarter.
 */
export function ticksToNoteLength(durationTicks: number, ticksPerQuarter: number): NoteLength {
  const units = Math.max(durationTicks, 1) / ticksPerQuarter;
  const logUnits = Math.log2(units);

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

/**
 * Computes the lowest MIDI note number playable by any supported ocarina type,
 * used to pick a sensible note out of a MIDI chord (see `convertTrackToTokens`).
 */
export function computeGlobalMinMidiPitch(ocarinaTypes: readonly OcarinaType[]): number {
  const semitones = ocarinaTypes.map((type) => toAbsoluteSemitone(type.range.min));
  // Absolute semitone 0 = C0, which is MIDI note 12.
  return Math.min(...semitones) + 12;
}

/** Smallest gap (in note-length units) worth representing as a rest, rather than ignored as legato. */
const MIN_REST_UNITS = NOTE_LENGTH_UNITS.eighth / 2;

/**
 * Converts a MIDI track's note events into an ordered list of note/rest tokens
 * suitable for the note input field, with per-note length overrides derived
 * from each note's MIDI duration.
 *
 * Notes that start at the same tick (chords) are collapsed to a single note,
 * since the ocarina is monophonic: the lowest pitch is preferred, but if it
 * falls below `globalMinMidiPitch` the next-higher pitch in the chord is tried
 * (and so on), so a bass note doesn't needlessly push the whole chord
 * out of range.
 */
export function convertTrackToTokens(
  track: MidiTrack,
  ticksPerQuarter: number,
  globalMinMidiPitch: number
): ConvertedToken[] {
  const groups = new Map<number, MidiNoteEvent[]>();
  for (const event of track.events) {
    const group = groups.get(event.startTick);
    if (group) {
      group.push(event);
    } else {
      groups.set(event.startTick, [event]);
    }
  }

  const startTicks = [...groups.keys()].sort((a, b) => a - b);
  const tokens: ConvertedToken[] = [];

  startTicks.forEach((startTick, index) => {
    const chord = [...groups.get(startTick)!].sort((a, b) => a.pitch - b.pitch);
    const winner = chord.find((event) => event.pitch >= globalMinMidiPitch) ?? chord[chord.length - 1];

    const noteLength = ticksToNoteLength(winner.durationTicks, ticksPerQuarter);
    tokens.push({ raw: formatNote(midiPitchToNote(winner.pitch)), lengthOverride: noteLength });

    const nextStartTick = startTicks[index + 1];
    if (nextStartTick === undefined) {
      return;
    }

    const gapTicks = nextStartTick - (winner.startTick + winner.durationTicks);
    const gapUnits = gapTicks / ticksPerQuarter;
    if (gapUnits >= MIN_REST_UNITS) {
      const restLength = ticksToNoteLength(gapTicks, ticksPerQuarter);
      tokens.push({ raw: `R${REST_LENGTH_TOKENS[restLength]}`, lengthOverride: "default" });
    }
  });

  return tokens;
}
