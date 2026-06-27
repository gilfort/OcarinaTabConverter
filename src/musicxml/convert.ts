import { formatNote } from "../notes/format";
import { REST_LENGTH_TOKENS, roundToNoteLength } from "../notes/length";
import { notesEqual, type Note, type RepeatMarker } from "../notes/types";
import type { ConvertedToken, MusicXmlEvent, MusicXmlNoteEvent } from "./types";

const MARKER_RAW: Record<RepeatMarker, string> = {
  repeatStart: "|:",
  repeatEnd: ":|",
  voltaOne: "[1",
  voltaTwo: "[2",
};

function sameTiedPitch(a: Note | null, b: Note | null): boolean {
  return a !== null && b !== null && notesEqual(a, b);
}

/**
 * Converts one voice's event stream into note/rest/marker tokens for the note input field.
 * Tied notes (same pitch, linked by `<tie>`) are merged into a single token with their
 * combined duration rounded to the nearest supported note length, rather than reproduced as
 * an app-native tie pair — this keeps the import a direct one-event-per-played-note mapping.
 */
export function convertVoiceToTokens(events: MusicXmlEvent[]): ConvertedToken[] {
  const tokens: ConvertedToken[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];

    if (event.kind === "marker") {
      tokens.push({ raw: MARKER_RAW[event.marker], lengthOverride: "default" });
      i++;
      continue;
    }

    let last: MusicXmlNoteEvent = event.data;
    let totalUnits = last.units;
    let next = i + 1;
    while (last.tieStart) {
      const candidate = events[next];
      if (!candidate || candidate.kind !== "note" || !sameTiedPitch(last.note, candidate.data.note)) break;
      last = candidate.data;
      totalUnits += last.units;
      next++;
    }

    const length = roundToNoteLength(totalUnits);
    if (event.data.note === null) {
      tokens.push({ raw: `R${REST_LENGTH_TOKENS[length]}`, lengthOverride: "default" });
    } else {
      tokens.push({ raw: formatNote(event.data.note), lengthOverride: length });
    }
    i = next;
  }

  return tokens;
}
