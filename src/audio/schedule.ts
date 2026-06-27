import { NOTE_LENGTH_UNITS, resolveNoteLength, type NoteLength } from "../notes/length";
import { toAbsoluteSemitone } from "../fingering/normalize";
import { notesEqual, type Note } from "../notes/types";
import type { TabItem } from "../ui/render";

/** Fixed playback tempo, consistent with MIDI export's default. */
export const DEFAULT_BPM = 120;

const SECONDS_PER_MINUTE = 60;

/** Fixed silence inserted before a note's end so consecutive notes sound distinct, not one tone. */
const NOTE_GAP_SECONDS = 0.01;

/** A note's gap, clamped so it never eats more than half the note's own duration. */
function gapFor(duration: number): number {
  return Math.min(NOTE_GAP_SECONDS, duration / 2);
}

/** Whether `item` is a note that resolved to a fingering and so actually sounds. */
function isPlayableNote(item: TabItem): item is TabItem & { token: { note: Note } } {
  return item.token.note !== null && item.result?.status === "found";
}

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
 * Line breaks and valid repeat/volta markers take no time. Rests are silence for their
 * resolved length. Notes that resolved to a fingering ("found") sound at their pitch;
 * everything else unplayable (parse errors, out-of-range, unsupported, malformed markers)
 * is silence at the default note length, matching how those tokens have no per-note length
 * selector.
 *
 * Every playable note loses a fixed 10ms of its end to silence, so consecutive same-pitch
 * notes are heard as distinct attacks rather than one held tone (clamped to at most half the
 * note's own duration). The exception is a tie/legato pair (e.g. "C4-D4"): the boundary
 * between its two notes never gets a gap, and if both notes share the same pitch they're
 * scheduled as a single continuous tone with no retrigger in between.
 */
export function buildPlaybackSchedule(
  items: readonly TabItem[],
  defaultNoteLength: NoteLength,
  bpm: number = DEFAULT_BPM
): PlaybackEvent[] {
  const secondsPerQuarter = SECONDS_PER_MINUTE / bpm;
  const events: PlaybackEvent[] = [];
  let time = 0;
  let i = 0;

  /** A playable note's raw (un-gapped) duration in seconds, honoring its length override. */
  function noteDuration(item: TabItem): number {
    const length = resolveNoteLength(item.lengthOverride, defaultNoteLength);
    return NOTE_LENGTH_UNITS[length] * secondsPerQuarter;
  }

  while (i < items.length) {
    const item = items[i];

    if (item.token.lineBreak || (item.token.marker && !item.token.error)) {
      i++;
      continue;
    }

    if (item.token.rest) {
      const length = resolveNoteLength(item.lengthOverride, item.token.rest);
      const duration = NOTE_LENGTH_UNITS[length] * secondsPerQuarter;
      events.push({ startTime: time, duration, frequency: null });
      time += duration;
      i++;
      continue;
    }

    const next = items[i + 1];
    const isTiePair =
      item.token.tie === "start" && next?.token.tie === "end" && isPlayableNote(item) && isPlayableNote(next);

    if (isTiePair) {
      const firstDuration = noteDuration(item);
      const secondDuration = noteDuration(next);

      if (notesEqual(item.token.note, next.token.note)) {
        const total = firstDuration + secondDuration;
        const gap = gapFor(total);
        events.push({ startTime: time, duration: total - gap, frequency: noteToFrequency(item.token.note) });
        time += total;
        i += 2;
        continue;
      }

      const secondGap = gapFor(secondDuration);
      events.push({ startTime: time, duration: firstDuration, frequency: noteToFrequency(item.token.note) });
      events.push({
        startTime: time + firstDuration,
        duration: secondDuration - secondGap,
        frequency: noteToFrequency(next.token.note),
      });
      time += firstDuration + secondDuration;
      i += 2;
      continue;
    }

    if (isPlayableNote(item)) {
      const duration = noteDuration(item);
      const gap = gapFor(duration);
      events.push({ startTime: time, duration: duration - gap, frequency: noteToFrequency(item.token.note) });
      time += duration;
      i++;
      continue;
    }

    const duration = NOTE_LENGTH_UNITS[defaultNoteLength] * secondsPerQuarter;
    events.push({ startTime: time, duration, frequency: null });
    time += duration;
    i++;
  }

  return events;
}
