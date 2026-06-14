import { describe, expect, it } from "vitest";
import { supportedOcarinaTypes } from "../fingering/lookup";
import {
  computeGlobalMinMidiPitch,
  convertTrackToTokens,
  midiPitchToNote,
  ticksToNoteLength,
} from "./convert";
import type { MidiTrack } from "./types";

const TICKS_PER_QUARTER = 96;

describe("midiPitchToNote", () => {
  it("maps MIDI 60 to C4", () => {
    expect(midiPitchToNote(60)).toEqual({ pitchClass: "C", accidental: null, octave: 4 });
  });

  it("maps a sharp pitch class", () => {
    expect(midiPitchToNote(61)).toEqual({ pitchClass: "C", accidental: "sharp", octave: 4 });
  });

  it("maps across octave boundaries", () => {
    expect(midiPitchToNote(69)).toEqual({ pitchClass: "A", accidental: null, octave: 4 });
    expect(midiPitchToNote(57)).toEqual({ pitchClass: "A", accidental: null, octave: 3 });
  });
});

describe("ticksToNoteLength", () => {
  it("rounds exact durations to the matching note length", () => {
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 0.5, TICKS_PER_QUARTER)).toBe("eighth");
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 1, TICKS_PER_QUARTER)).toBe("quarter");
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 2, TICKS_PER_QUARTER)).toBe("half");
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 4, TICKS_PER_QUARTER)).toBe("whole");
  });

  it("rounds very short durations up to the shortest supported length", () => {
    expect(ticksToNoteLength(1, TICKS_PER_QUARTER)).toBe("eighth");
  });

  it("rounds very long durations down to the longest supported length", () => {
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 16, TICKS_PER_QUARTER)).toBe("whole");
  });

  it("rounds a dotted-quarter to the nearer of quarter/half on a log scale", () => {
    // log2(1.5) ~= 0.585, closer to log2(2)=1 (distance 0.415) than log2(1)=0 (distance 0.585) -> half.
    expect(ticksToNoteLength(TICKS_PER_QUARTER * 1.5, TICKS_PER_QUARTER)).toBe("half");
  });
});

describe("computeGlobalMinMidiPitch", () => {
  it("matches the lowest range minimum across supported ocarina types (A3 = MIDI 57)", () => {
    expect(computeGlobalMinMidiPitch(supportedOcarinaTypes)).toBe(57);
  });
});

const GLOBAL_MIN_MIDI_PITCH = 57; // A3

function makeTrack(events: MidiTrack["events"]): MidiTrack {
  return { name: null, events };
}

describe("convertTrackToTokens", () => {
  it("converts a simple back-to-back melody with no rests", () => {
    const track = makeTrack([
      { pitch: 60, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // C4 quarter
      { pitch: 62, startTick: TICKS_PER_QUARTER, durationTicks: TICKS_PER_QUARTER }, // D4 quarter
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("inserts a rest for a gap between notes", () => {
    const track = makeTrack([
      { pitch: 60, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // C4 quarter, ends at 96
      { pitch: 62, startTick: TICKS_PER_QUARTER * 2, durationTicks: TICKS_PER_QUARTER }, // D4 starts at 192
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "R4", lengthOverride: "default" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("ignores tiny gaps caused by legato playing", () => {
    const track = makeTrack([
      { pitch: 60, startTick: 0, durationTicks: TICKS_PER_QUARTER - 2 },
      { pitch: 62, startTick: TICKS_PER_QUARTER, durationTicks: TICKS_PER_QUARTER }, // 2-tick gap
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("picks the lowest pitch of a chord when it is in range", () => {
    const track = makeTrack([
      { pitch: 60, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // C4
      { pitch: 64, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // E4
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
    ]);
  });

  it("skips to the next-higher chord note when the lowest is below the global minimum", () => {
    const track = makeTrack([
      { pitch: 55, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // G3, below A3 minimum
      { pitch: 60, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // C4, in range
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
    ]);
  });

  it("falls back to the highest chord note when none are in range", () => {
    const track = makeTrack([
      { pitch: 50, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // D3
      { pitch: 53, startTick: 0, durationTicks: TICKS_PER_QUARTER }, // F3
    ]);

    expect(convertTrackToTokens(track, TICKS_PER_QUARTER, GLOBAL_MIN_MIDI_PITCH)).toEqual([
      { raw: "F3", lengthOverride: "quarter" },
    ]);
  });
});
