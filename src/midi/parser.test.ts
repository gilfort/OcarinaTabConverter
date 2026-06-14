import { describe, expect, it } from "vitest";
import { isMidiParseError, parseMidiFile } from "./parser";

/** Builds a MThd header chunk: format 1, the given track count, and ticks-per-quarter division. */
function header(numTracks: number, ticksPerQuarter: number): number[] {
  return [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // length = 6
    0x00, 0x01, // format 1
    (numTracks >> 8) & 0xff, numTracks & 0xff,
    (ticksPerQuarter >> 8) & 0xff, ticksPerQuarter & 0xff,
  ];
}

/** Wraps track event bytes in an MTrk chunk, appending an end-of-track meta event. */
function track(events: number[]): number[] {
  const data = [...events, 0x00, 0xff, 0x2f, 0x00]; // delta 0, end of track
  const length = data.length;
  return [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff,
    ...data,
  ];
}

function toBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/** Track-name meta event: 0xFF 0x03 <len> <ascii bytes>. */
function trackName(name: string): number[] {
  const bytes = [...name].map((c) => c.charCodeAt(0));
  return [0x00, 0xff, 0x03, bytes.length, ...bytes];
}

describe("parseMidiFile", () => {
  it("rejects a file without an MThd header", () => {
    const result = parseMidiFile(toBuffer([0x00, 0x01, 0x02, 0x03]));
    expect(isMidiParseError(result)).toBe(true);
  });

  it("rejects SMPTE time division", () => {
    const bytes = [...header(1, 0), ...track([])];
    bytes[12] = 0xe0; // set the SMPTE flag bit on the division's high byte
    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(true);
    if (isMidiParseError(result)) {
      expect(result.error).toMatch(/SMPTE/);
    }
  });

  it("parses a single note-on/note-off pair", () => {
    const bytes = [
      ...header(1, 96),
      ...track([
        0x00, 0x90, 60, 100, // delta 0, Note On C4, velocity 100
        0x60, 0x80, 60, 0, // delta 96, Note Off C4
      ]),
    ];

    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(false);
    if (isMidiParseError(result)) return;

    expect(result.ticksPerQuarter).toBe(96);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].events).toEqual([{ pitch: 60, startTick: 0, durationTicks: 96 }]);
  });

  it("treats note-on with velocity 0 as note-off", () => {
    const bytes = [
      ...header(1, 96),
      ...track([
        0x00, 0x90, 60, 100,
        0x60, 0x90, 60, 0, // note on, velocity 0 = note off
      ]),
    ];

    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(false);
    if (isMidiParseError(result)) return;
    expect(result.tracks[0].events).toEqual([{ pitch: 60, startTick: 0, durationTicks: 96 }]);
  });

  it("supports running status for consecutive channel messages", () => {
    const bytes = [
      ...header(1, 96),
      ...track([
        0x00, 0x90, 60, 100, // Note On C4
        0x30, 60, 0, // running status: Note On (implied) C4 off, delta 48
        0x00, 62, 100, // running status: Note On D4, delta 0
        0x60, 62, 0, // running status: Note On D4 off, delta 96
      ]),
    ];

    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(false);
    if (isMidiParseError(result)) return;
    expect(result.tracks[0].events).toEqual([
      { pitch: 60, startTick: 0, durationTicks: 48 },
      { pitch: 62, startTick: 48, durationTicks: 96 },
    ]);
  });

  it("captures track names from meta events", () => {
    const bytes = [
      ...header(2, 96),
      ...track([...trackName("Melody"), 0x00, 0x90, 60, 100, 0x60, 0x80, 60, 0]),
      ...track([...trackName("Bass"), 0x00, 0x90, 48, 100, 0x60, 0x80, 48, 0]),
    ];

    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(false);
    if (isMidiParseError(result)) return;
    expect(result.tracks.map((t) => t.name)).toEqual(["Melody", "Bass"]);
  });

  it("leaves a still-active note open at end-of-track closed at the final tick", () => {
    const bytes = [
      ...header(1, 96),
      ...track([0x00, 0x90, 60, 100]), // note never explicitly turned off
    ];

    const result = parseMidiFile(toBuffer(bytes));
    expect(isMidiParseError(result)).toBe(false);
    if (isMidiParseError(result)) return;
    expect(result.tracks[0].events).toEqual([{ pitch: 60, startTick: 0, durationTicks: 1 }]);
  });
});
