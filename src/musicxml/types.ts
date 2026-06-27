import type { KeySignature, Note, RepeatMarker } from "../notes/types";
import type { NoteLengthOverride } from "../notes/length";

/** A note name or rest token derived from a MusicXML voice, ready to feed into the note input. */
export interface ConvertedToken {
  raw: string;
  lengthOverride: NoteLengthOverride;
}

/** A single pitched or rest event within one voice, in document order. */
export interface MusicXmlNoteEvent {
  /** `null` for a rest. */
  note: Note | null;
  /** Duration in quarter-note units (already divided by the part's current `<divisions>`). */
  units: number;
  tieStart: boolean;
  tieStop: boolean;
}

export type MusicXmlEvent = { kind: "note"; data: MusicXmlNoteEvent } | { kind: "marker"; marker: RepeatMarker };

/** One importable part/voice combination, identified the way it'll be shown in the picker. */
export interface MusicXmlVoice {
  partId: string;
  partName: string | null;
  voice: string;
  label: string;
  events: MusicXmlEvent[];
}

export interface ParsedMusicXml {
  voices: MusicXmlVoice[];
  /** Key signature taken from the first `<key>` encountered, if any. */
  keySignature: KeySignature;
}

export interface MusicXmlParseError {
  error: string;
}

export function isMusicXmlParseError(
  result: ParsedMusicXml | MusicXmlParseError
): result is MusicXmlParseError {
  return "error" in result;
}
