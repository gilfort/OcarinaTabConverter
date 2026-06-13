import { describe, expect, it } from "vitest";
import { shiftNoteIntoRange } from "./octaveShift";

describe("shiftNoteIntoRange", () => {
  it("shifts a note below the range up by one octave", () => {
    const shifted = shiftNoteIntoRange({ pitchClass: "A", accidental: null, octave: 2 }, "12hole");
    expect(shifted).toEqual({ pitchClass: "A", accidental: null, octave: 3 });
  });

  it("shifts a note above the range down by one octave", () => {
    const shifted = shiftNoteIntoRange({ pitchClass: "G", accidental: null, octave: 5 }, "12hole");
    expect(shifted).toEqual({ pitchClass: "G", accidental: null, octave: 4 });
  });

  it("returns null for a note already in range", () => {
    const shifted = shiftNoteIntoRange({ pitchClass: "C", accidental: null, octave: 4 }, "12hole");
    expect(shifted).toBeNull();
  });

  it("returns null when shifting by one octave isn't enough", () => {
    const shifted = shiftNoteIntoRange({ pitchClass: "C", accidental: null, octave: 0 }, "12hole");
    expect(shifted).toBeNull();
  });
});
