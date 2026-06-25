import { describe, expect, it } from "vitest";
import { parseNotes } from "../notes/parser";
import { buildTabItems } from "../ui/render";
import { buildPlaybackSchedule, noteToFrequency } from "./schedule";

describe("noteToFrequency", () => {
  it("returns 440Hz for A4", () => {
    expect(noteToFrequency({ pitchClass: "A", accidental: null, octave: 4 })).toBeCloseTo(440);
  });

  it("returns half the frequency one octave down", () => {
    expect(noteToFrequency({ pitchClass: "A", accidental: null, octave: 3 })).toBeCloseTo(220);
  });

  it("returns double the frequency one octave up", () => {
    expect(noteToFrequency({ pitchClass: "A", accidental: null, octave: 5 })).toBeCloseTo(880);
  });

  it("accounts for sharps", () => {
    const aSharp4 = noteToFrequency({ pitchClass: "A", accidental: "sharp", octave: 4 });
    const a4 = noteToFrequency({ pitchClass: "A", accidental: null, octave: 4 });
    expect(aSharp4).toBeCloseTo(a4 * Math.pow(2, 1 / 12));
  });
});

describe("buildPlaybackSchedule", () => {
  function schedule(input: string, defaultNoteLength: "eighth" | "quarter" | "half" | "whole" = "quarter") {
    const { tokens } = parseNotes(input);
    const items = buildTabItems(tokens, "12hole");
    return buildPlaybackSchedule(items, defaultNoteLength, 120);
  }

  it("schedules one event per found note, back to back at 120 BPM (0.5s per quarter)", () => {
    const events = schedule("C4 D4");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ startTime: 0, duration: 0.5 });
    expect(events[0].frequency).not.toBeNull();
    expect(events[1]).toMatchObject({ startTime: 0.5, duration: 0.5 });
  });

  it("schedules a rest as silence for its resolved length", () => {
    const events = schedule("C4 R2 D4");

    expect(events[1]).toMatchObject({ startTime: 0.5, duration: 1, frequency: null });
    expect(events[2]).toMatchObject({ startTime: 1.5, duration: 0.5 });
  });

  it("schedules an out-of-range note as silence at the default length, still taking time", () => {
    const events = schedule("C1");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ startTime: 0, duration: 0.5, frequency: null });
  });

  it("schedules an invalid token as silence at the default length", () => {
    const events = schedule("H4");

    expect(events).toHaveLength(1);
    expect(events[0].frequency).toBeNull();
  });

  it("skips line breaks entirely, taking no time", () => {
    const events = schedule("C4 | D4");

    expect(events).toHaveLength(2);
    expect(events[0].startTime).toBe(0);
    expect(events[1].startTime).toBe(0.5);
  });

  it("respects a per-note length override over the default", () => {
    const { tokens } = parseNotes("C4");
    const items = buildTabItems(tokens, "12hole");
    items[0].lengthOverride = "whole";

    const events = buildPlaybackSchedule(items, "quarter", 120);
    expect(events[0].duration).toBe(2);
  });

  it("scales durations with tempo", () => {
    const { tokens } = parseNotes("C4");
    const items = buildTabItems(tokens, "12hole");

    expect(buildPlaybackSchedule(items, "quarter", 60)[0].duration).toBe(1);
    expect(buildPlaybackSchedule(items, "quarter", 240)[0].duration).toBe(0.25);
  });

  it("returns no events for an empty sequence", () => {
    expect(schedule("")).toHaveLength(0);
  });
});
