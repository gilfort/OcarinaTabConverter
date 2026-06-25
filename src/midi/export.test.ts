import { describe, expect, it } from "vitest";
import { parseNotes } from "../notes/parser";
import { buildTabItems, type TabItem } from "../ui/render";
import { convertTrackToTokens, midiPitchToNote } from "./convert";
import { isMidiParseError, parseMidiFile } from "./parser";
import { buildMidiFile, downloadMidiFile, EXPORT_TICKS_PER_QUARTER, noteLengthToTicks, noteToMidiPitch } from "./export";

function itemsFor(input: string, lengthOverrides: Record<number, TabItem["lengthOverride"]> = {}): TabItem[] {
  const { tokens } = parseNotes(input);
  const items = buildTabItems(tokens, "12hole");
  Object.entries(lengthOverrides).forEach(([index, value]) => {
    items[Number(index)].lengthOverride = value;
  });
  return items;
}

/** Parses a built MIDI file's single track back into note/rest tokens, for round-trip assertions. */
function roundTrip(bytes: Uint8Array) {
  const result = parseMidiFile(bytes.buffer);
  if (isMidiParseError(result)) {
    throw new Error(result.error);
  }
  const [track] = result.tracks;
  return convertTrackToTokens(track, result.ticksPerQuarter, 0);
}

describe("noteToMidiPitch", () => {
  it("is the reverse of midiPitchToNote", () => {
    expect(noteToMidiPitch({ pitchClass: "C", accidental: null, octave: 4 })).toBe(60);
    expect(midiPitchToNote(noteToMidiPitch({ pitchClass: "F", accidental: "sharp", octave: 5 }))).toEqual({
      pitchClass: "F",
      accidental: "sharp",
      octave: 5,
    });
  });
});

describe("noteLengthToTicks", () => {
  it("scales by note-length units at the given resolution", () => {
    expect(noteLengthToTicks("quarter", 480)).toBe(480);
    expect(noteLengthToTicks("eighth", 480)).toBe(240);
    expect(noteLengthToTicks("half", 480)).toBe(960);
    expect(noteLengthToTicks("whole", 480)).toBe(1920);
  });
});

describe("buildMidiFile", () => {
  it("round-trips a simple melody through parseMidiFile", () => {
    const items = itemsFor("C4 D4 E4");
    const bytes = buildMidiFile(items, "quarter");
    expect(roundTrip(bytes)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "D4", lengthOverride: "quarter" },
      { raw: "E4", lengthOverride: "quarter" },
    ]);
  });

  it("starts with a valid MThd/MTrk header", () => {
    const bytes = buildMidiFile(itemsFor("C4"), "quarter");
    const text = String.fromCharCode(...bytes.slice(0, 4));
    expect(text).toBe("MThd");
    expect(bytes.length).toBeGreaterThan(14);
  });

  it("represents a rest as a silent gap, not a note event", () => {
    const items = itemsFor("C4 R4 D4");
    const bytes = buildMidiFile(items, "quarter");
    expect(roundTrip(bytes)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "R4", lengthOverride: "default" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("applies a per-note length override to that note's duration", () => {
    const items = itemsFor("C4 D4", { 0: "whole" });
    const bytes = buildMidiFile(items, "quarter");
    expect(roundTrip(bytes)).toEqual([
      { raw: "C4", lengthOverride: "whole" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("treats an invalid token as a silent gap at the default length, with no note event", () => {
    const items = itemsFor("C4 notanote D4");
    const bytes = buildMidiFile(items, "quarter");
    expect(roundTrip(bytes)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "R4", lengthOverride: "default" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("uses the fixed export resolution regardless of caller state", () => {
    expect(EXPORT_TICKS_PER_QUARTER).toBe(480);
  });
});

describe("downloadMidiFile", () => {
  it("is exported as a function", () => {
    expect(typeof downloadMidiFile).toBe("function");
  });
});
