import { NOTE_LENGTH_UNITS, resolveNoteLength, type NoteLength } from "../notes/length";
import { toAbsoluteSemitone } from "../fingering/normalize";
import type { Note } from "../notes/types";
import type { TabItem } from "../ui/render";

/** Fixed playback tempo, consistent with MIDI export's default. */
export const DEFAULT_BPM = 120;

const SECONDS_PER_MINUTE = 60;

/** Concert pitch of A4, used as the reference for note-to-frequency conversion. */
const A4_FREQUENCY = 440;
const A4_SEMITONE = toAbsoluteSemitone({ pitchClass: "A", accidental: null, octave: 4 });

/** A single scheduled tone or silence, in seconds relative to playback start. */
export interface PlaybackEvent {
  startTime: number;
  duration: number;
  /** Frequency in Hz to sound, or `null` for silence (rest, unplayable note, or error). */
  frequency: number | null;
}

/** Converts a note to its frequency in Hz, using 12-tone equal temperament from A4 = 440Hz. */
export function noteToFrequency(note: Note): number {
  const semitonesFromA4 = toAbsoluteSemitone(note) - A4_SEMITONE;
  return A4_FREQUENCY * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Builds a timed sequence of tones/silences from a tab's items, at a fixed tempo.
 * Line breaks take no time. Rests are silence for their resolved length. Notes that
 * resolved to a fingering ("found") sound at their pitch; everything else unplayable
 * (parse errors, out-of-range, unsupported) is silence at the default note length,
 * matching how those tokens have no per-note length selector.
 */
export function buildPlaybackSchedule(
  items: readonly TabItem[],
  defaultNoteLength: NoteLength,
  bpm: number = DEFAULT_BPM
): PlaybackEvent[] {
  const secondsPerQuarter = SECONDS_PER_MINUTE / bpm;
  const events: PlaybackEvent[] = [];
  let time = 0;

  for (const item of items) {
    if (item.token.lineBreak) {
      continue;
    }

    if (item.token.rest) {
      const length = resolveNoteLength(item.lengthOverride, item.token.rest);
      const duration = NOTE_LENGTH_UNITS[length] * secondsPerQuarter;
      events.push({ startTime: time, duration, frequency: null });
      time += duration;
      continue;
    }

    if (item.token.note && item.result?.status === "found") {
      const length = resolveNoteLength(item.lengthOverride, defaultNoteLength);
      const duration = NOTE_LENGTH_UNITS[length] * secondsPerQuarter;
      events.push({ startTime: time, duration, frequency: noteToFrequency(item.token.note) });
      time += duration;
      continue;
    }

    const duration = NOTE_LENGTH_UNITS[defaultNoteLength] * secondsPerQuarter;
    events.push({ startTime: time, duration, frequency: null });
    time += duration;
  }

  return events;
}
