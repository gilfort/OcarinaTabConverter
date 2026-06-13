import type { Note } from "../notes/types";
import { lookupFingering, supportedOcarinaTypes } from "../fingering/lookup";
import { toAbsoluteSemitone } from "../fingering/normalize";
import type { OcarinaTypeId } from "../fingering/types";

/**
 * Shifts an out-of-range note by one octave toward the instrument's playable
 * range (up if it's below the range, down if it's above), then re-checks
 * whether the shifted note is playable.
 *
 * Returns the shifted note if it is now in range and supported, or `null` if
 * the note was already in range, the ocarina type is unknown, or shifting by
 * one octave isn't enough to bring it into range.
 */
export function shiftNoteIntoRange(note: Note, ocarinaTypeId: OcarinaTypeId): Note | null {
  const type = supportedOcarinaTypes.find((candidate) => candidate.id === ocarinaTypeId);
  if (!type) {
    return null;
  }

  const semitone = toAbsoluteSemitone(note);
  const minSemitone = toAbsoluteSemitone(type.range.min);
  const maxSemitone = toAbsoluteSemitone(type.range.max);

  const direction = semitone < minSemitone ? 1 : semitone > maxSemitone ? -1 : 0;
  if (direction === 0) {
    return null;
  }

  const shifted: Note = { ...note, octave: note.octave + direction };
  return lookupFingering(shifted, ocarinaTypeId).status === "found" ? shifted : null;
}
