import { NOTE_LENGTH_UNITS, resolveNoteLength, type NoteLength } from "../notes/length";
import { toAbsoluteSemitone } from "../fingering/normalize";
import { notesEqual, type Note } from "../notes/types";
import type { TabItem } from "../ui/render";

/** Resolution used when exporting, independent of any imported file's own resolution. */
export const EXPORT_TICKS_PER_QUARTER = 480;
/** Fixed tempo for exported files, matching the in-app playback tempo. */
export const EXPORT_BPM = 120;

const ACOUSTIC_GRAND_PIANO_PROGRAM = 0;
const MIDI_CHANNEL = 0;
const NOTE_VELOCITY = 96;

const NOTE_ON_STATUS = 0x90 | MIDI_CHANNEL;
const NOTE_OFF_STATUS = 0x80 | MIDI_CHANNEL;
const PROGRAM_CHANGE_STATUS = 0xc0 | MIDI_CHANNEL;

const META_EVENT = 0xff;
const META_SET_TEMPO = 0x51;
const META_END_OF_TRACK = 0x2f;

/** Converts a `Note` to its MIDI pitch number (0-127, where 60 = C4). Reverse of `midiPitchToNote`. */
export function noteToMidiPitch(note: Note): number {
  return toAbsoluteSemitone(note) + 12;
}

/** Converts a `NoteLength` to a tick duration at the given resolution. Reverse of `ticksToNoteLength`. */
export function noteLengthToTicks(length: NoteLength, ticksPerQuarter: number): number {
  return Math.round(NOTE_LENGTH_UNITS[length] * ticksPerQuarter);
}

class ByteWriter {
  private bytes: number[] = [];

  writeByte(byte: number): void {
    this.bytes.push(byte & 0xff);
  }

  writeBytes(bytes: ArrayLike<number>): void {
    for (let i = 0; i < bytes.length; i++) {
      this.writeByte(bytes[i]);
    }
  }

  writeUint16(value: number): void {
    this.writeByte((value >> 8) & 0xff);
    this.writeByte(value & 0xff);
  }

  writeUint32(value: number): void {
    this.writeByte((value >>> 24) & 0xff);
    this.writeByte((value >>> 16) & 0xff);
    this.writeByte((value >>> 8) & 0xff);
    this.writeByte(value & 0xff);
  }

  writeString(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.writeByte(text.charCodeAt(i));
    }
  }

  /** Writes a MIDI variable-length quantity (big-endian, 7 bits per byte, MSB = continuation). */
  writeVarLength(value: number): void {
    const groups: number[] = [value & 0x7f];
    let remaining = Math.floor(value / 128);
    while (remaining > 0) {
      groups.unshift((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }
    this.writeBytes(groups);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** A note on/off or meta event at an absolute tick, ready to be delta-encoded into a track. */
interface MidiWireEvent {
  tick: number;
  /** Breaks ties when multiple events share a tick (lower sorts first), e.g. note-off before note-on. */
  order: number;
  bytes: readonly number[];
}

function durationTicksFor(item: TabItem, defaultNoteLength: NoteLength, ticksPerQuarter: number): number {
  const length = resolveNoteLength(item.lengthOverride, item.token.rest ?? defaultNoteLength);
  return noteLengthToTicks(length, ticksPerQuarter);
}

/** Whether `item` is a note that resolved to a fingering and so gets a MIDI note event. */
function isPlayableNote(item: TabItem): item is TabItem & { token: { note: Note } } {
  return item.token.note !== null && item.result?.status === "found";
}

/**
 * Converts a tab's items into MIDI note on/off events at fixed resolution. Mirrors
 * `buildPlaybackSchedule`'s skip/rest/note rules: line breaks and valid markers take no
 * time, rests become silent gaps, and anything unplayable (errors, out-of-range,
 * unsupported, malformed markers) is silence at the default note length.
 *
 * Notes are otherwise back-to-back with no gap between note-off and the next note-on, which
 * already matches a tie/legato pair's "no gap" requirement for two different pitches. The one
 * special case is a tie pair sharing the same pitch (e.g. "C4-C4"): it's written as a single
 * note-on/note-off spanning both durations, with no note-off/note-on in between.
 */
function buildNoteEvents(
  items: readonly TabItem[],
  defaultNoteLength: NoteLength,
  ticksPerQuarter: number
): MidiWireEvent[] {
  const events: MidiWireEvent[] = [];
  let tick = 0;
  let i = 0;

  while (i < items.length) {
    const item = items[i];

    if (item.token.lineBreak || (item.token.marker && !item.token.error)) {
      i++;
      continue;
    }

    const duration = durationTicksFor(item, defaultNoteLength, ticksPerQuarter);
    const next = items[i + 1];
    const isTiedSamePitch =
      item.token.tie === "start" &&
      next?.token.tie === "end" &&
      isPlayableNote(item) &&
      isPlayableNote(next) &&
      notesEqual(item.token.note, next.token.note);

    if (isTiedSamePitch) {
      const nextDuration = durationTicksFor(next, defaultNoteLength, ticksPerQuarter);
      const pitch = noteToMidiPitch(item.token.note);
      events.push({ tick, order: 1, bytes: [NOTE_ON_STATUS, pitch, NOTE_VELOCITY] });
      events.push({ tick: tick + duration + nextDuration, order: 0, bytes: [NOTE_OFF_STATUS, pitch, 0] });
      tick += duration + nextDuration;
      i += 2;
      continue;
    }

    if (isPlayableNote(item)) {
      const pitch = noteToMidiPitch(item.token.note);
      events.push({ tick, order: 1, bytes: [NOTE_ON_STATUS, pitch, NOTE_VELOCITY] });
      events.push({ tick: tick + duration, order: 0, bytes: [NOTE_OFF_STATUS, pitch, 0] });
    }

    tick += duration;
    i++;
  }

  return events;
}

/** Serializes absolute-tick events into a delta-encoded MTrk chunk's body, ending with an end-of-track meta event. */
function serializeTrackEvents(events: readonly MidiWireEvent[]): Uint8Array {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const writer = new ByteWriter();
  let lastTick = 0;

  for (const event of sorted) {
    writer.writeVarLength(event.tick - lastTick);
    writer.writeBytes(event.bytes);
    lastTick = event.tick;
  }

  writer.writeVarLength(0);
  writer.writeBytes([META_EVENT, META_END_OF_TRACK, 0x00]);
  return writer.toBytes();
}

/**
 * Builds a Standard MIDI File (format 0, single track) from a tab's note sequence, at a fixed
 * tempo (120 BPM) and instrument (Acoustic Grand Piano). Out-of-range handling is the caller's
 * responsibility (resolve via the export warning dialog before calling this, as with PDF/PNG).
 */
export function buildMidiFile(items: readonly TabItem[], defaultNoteLength: NoteLength): Uint8Array {
  const ticksPerQuarter = EXPORT_TICKS_PER_QUARTER;
  const microsecondsPerQuarter = Math.round(60_000_000 / EXPORT_BPM);

  const setupEvents: MidiWireEvent[] = [
    {
      tick: 0,
      order: -2,
      bytes: [
        META_EVENT,
        META_SET_TEMPO,
        0x03,
        (microsecondsPerQuarter >> 16) & 0xff,
        (microsecondsPerQuarter >> 8) & 0xff,
        microsecondsPerQuarter & 0xff,
      ],
    },
    { tick: 0, order: -1, bytes: [PROGRAM_CHANGE_STATUS, ACOUSTIC_GRAND_PIANO_PROGRAM] },
  ];

  const trackBody = serializeTrackEvents([...setupEvents, ...buildNoteEvents(items, defaultNoteLength, ticksPerQuarter)]);

  const header = new ByteWriter();
  header.writeString("MThd");
  header.writeUint32(6);
  header.writeUint16(0); // format 0: single track
  header.writeUint16(1); // one track
  header.writeUint16(ticksPerQuarter);

  const track = new ByteWriter();
  track.writeString("MTrk");
  track.writeUint32(trackBody.length);
  track.writeBytes(trackBody);

  const headerBytes = header.toBytes();
  const trackBytes = track.toBytes();
  const file = new Uint8Array(headerBytes.length + trackBytes.length);
  file.set(headerBytes, 0);
  file.set(trackBytes, headerBytes.length);
  return file;
}

/** Triggers a browser download of the given bytes as a .mid file. */
export function downloadMidiFile(filename: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
