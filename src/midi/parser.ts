import type { MidiNoteEvent, MidiParseError, MidiTrack, ParsedMidi } from "./types";

const HEADER_CHUNK_ID = "MThd";
const TRACK_CHUNK_ID = "MTrk";

const META_EVENT = 0xff;
const META_TRACK_NAME = 0x03;
const META_END_OF_TRACK = 0x2f;

const SYSEX_START = 0xf0;
const SYSEX_ESCAPE = 0xf7;

const NOTE_OFF = 0x8;
const NOTE_ON = 0x9;

/** Number of data bytes following each channel-message status (indexed by status >> 4). */
const CHANNEL_MESSAGE_DATA_BYTES: Record<number, number> = {
  0x8: 2, // Note Off
  0x9: 2, // Note On
  0xa: 2, // Polyphonic Key Pressure
  0xb: 2, // Control Change
  0xc: 1, // Program Change
  0xd: 1, // Channel Pressure
  0xe: 2, // Pitch Bend
};

class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readByte(): number {
    if (this.offset >= this.bytes.length) {
      throw new Error("Unexpected end of file");
    }
    return this.bytes[this.offset++];
  }

  peekByte(): number {
    if (this.offset >= this.bytes.length) {
      throw new Error("Unexpected end of file");
    }
    return this.bytes[this.offset];
  }

  readBytes(count: number): Uint8Array {
    if (this.offset + count > this.bytes.length) {
      throw new Error("Unexpected end of file");
    }
    const slice = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  readUint16(): number {
    const a = this.readByte();
    const b = this.readByte();
    return (a << 8) | b;
  }

  readUint32(): number {
    const a = this.readByte();
    const b = this.readByte();
    const c = this.readByte();
    const d = this.readByte();
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  }

  readString(length: number): string {
    return String.fromCharCode(...this.readBytes(length));
  }

  /** Reads a MIDI variable-length quantity (big-endian, 7 bits per byte, MSB = continuation). */
  readVarLength(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.readByte();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        return value;
      }
    }
    throw new Error("Variable-length quantity too long");
  }
}

/** Parses a single MTrk chunk into note events and an optional track name. */
function parseTrack(reader: ByteReader, length: number): MidiTrack {
  const trackEnd = reader.position + length;
  let tick = 0;
  let runningStatus: number | null = null;
  let name: string | null = null;
  const events: MidiNoteEvent[] = [];
  const active = new Map<number, number>();

  while (reader.position < trackEnd) {
    tick += reader.readVarLength();

    let status: number;
    if (reader.peekByte() < 0x80) {
      // Running status: this byte is the first data byte of a repeated channel message.
      if (runningStatus === null) {
        throw new Error("Running status used before any status byte");
      }
      status = runningStatus;
    } else {
      status = reader.readByte();
      runningStatus = status;
    }

    if (status === META_EVENT) {
      const type = reader.readByte();
      const metaLength = reader.readVarLength();
      const data = reader.readBytes(metaLength);
      if (type === META_TRACK_NAME) {
        name = String.fromCharCode(...data).trim() || null;
      } else if (type === META_END_OF_TRACK) {
        break;
      }
      continue;
    }

    if (status === SYSEX_START || status === SYSEX_ESCAPE) {
      const sysexLength = reader.readVarLength();
      reader.readBytes(sysexLength);
      continue;
    }

    const messageType = (status >> 4) & 0xf;
    const dataByteCount = CHANNEL_MESSAGE_DATA_BYTES[messageType];
    if (dataByteCount === undefined) {
      throw new Error(`Unsupported MIDI status byte 0x${status.toString(16)}`);
    }
    const data = reader.readBytes(dataByteCount);

    if (messageType === NOTE_ON || messageType === NOTE_OFF) {
      const pitch = data[0];
      const velocity = data[1];
      const isNoteOn = messageType === NOTE_ON && velocity > 0;

      if (isNoteOn) {
        if (active.has(pitch)) {
          // Re-trigger without an intervening note-off: close the previous one here.
          const startTick = active.get(pitch)!;
          events.push({ pitch, startTick, durationTicks: Math.max(1, tick - startTick) });
        }
        active.set(pitch, tick);
      } else if (active.has(pitch)) {
        const startTick = active.get(pitch)!;
        events.push({ pitch, startTick, durationTicks: Math.max(1, tick - startTick) });
        active.delete(pitch);
      }
    }
  }

  // Close any notes still active at end-of-track.
  for (const [pitch, startTick] of active) {
    events.push({ pitch, startTick, durationTicks: Math.max(1, tick - startTick) });
  }

  events.sort((a, b) => a.startTick - b.startTick);

  // Skip to the chunk's declared end in case of trailing/unparsed bytes.
  if (reader.position < trackEnd) {
    reader.readBytes(trackEnd - reader.position);
  }

  return { name, events };
}

/**
 * Parses a Standard MIDI File (SMF) from raw bytes into ticks-per-quarter and
 * a list of tracks with their note on/off events. Returns a `MidiParseError`
 * if the file is malformed or uses an unsupported time-division format.
 */
export function parseMidiFile(buffer: ArrayBuffer): ParsedMidi | MidiParseError {
  try {
    const reader = new ByteReader(new Uint8Array(buffer));

    const headerId = reader.readString(4);
    if (headerId !== HEADER_CHUNK_ID) {
      return { error: "Not a MIDI file (missing MThd header)" };
    }
    const headerLength = reader.readUint32();
    const headerStart = reader.position;
    reader.readUint16(); // format (0 = single track, 1 = multi-track, 2 = sequential)
    const numTracks = reader.readUint16();
    const division = reader.readUint16();
    // Skip any extra header bytes beyond the standard 6.
    reader.readBytes(Math.max(0, headerLength - (reader.position - headerStart)));

    if ((division & 0x8000) !== 0) {
      return { error: "SMPTE time division is not supported" };
    }
    const ticksPerQuarter = division;

    const tracks: MidiTrack[] = [];
    for (let i = 0; i < numTracks; i++) {
      if (reader.remaining < 8) {
        break;
      }
      const chunkId = reader.readString(4);
      const chunkLength = reader.readUint32();
      if (chunkId !== TRACK_CHUNK_ID) {
        reader.readBytes(chunkLength);
        continue;
      }
      tracks.push(parseTrack(reader, chunkLength));
    }

    return { ticksPerQuarter, tracks };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse MIDI file" };
  }
}

export function isMidiParseError(result: ParsedMidi | MidiParseError): result is MidiParseError {
  return "error" in result;
}
