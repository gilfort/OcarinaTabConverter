import { describe, expect, it } from "vitest";
import { STEP_MAX, STEP_MIN, noteToStep, stepToFlattedNote, stepToNaturalNote, stepToSharpedNote, yToStep } from "./staff";

describe("noteToStep", () => {
  it("places E4 on the bottom staff line (step 0)", () => {
    expect(noteToStep({ pitchClass: "E", octave: 4 })).toBe(0);
  });

  it("places F5 on the top staff line (step 8)", () => {
    expect(noteToStep({ pitchClass: "F", octave: 5 })).toBe(8);
  });

  it("places A3 and C6 at the edges of the drawable range", () => {
    expect(noteToStep({ pitchClass: "A", octave: 3 })).toBe(STEP_MIN);
    expect(noteToStep({ pitchClass: "C", octave: 6 })).toBe(STEP_MAX);
  });
});

describe("stepToNaturalNote", () => {
  it("round-trips with noteToStep for natural notes", () => {
    expect(stepToNaturalNote(0)).toEqual({ pitchClass: "E", accidental: null, octave: 4 });
    expect(stepToNaturalNote(STEP_MIN)).toEqual({ pitchClass: "A", accidental: null, octave: 3 });
    expect(stepToNaturalNote(STEP_MAX)).toEqual({ pitchClass: "C", accidental: null, octave: 6 });
  });
});

describe("stepToFlattedNote", () => {
  it("respells a non-white-key flat as a sharp on the note below", () => {
    // D4's flat (Db4) is enharmonic to C#4.
    const dStep = noteToStep({ pitchClass: "D", octave: 4 });
    expect(stepToFlattedNote(dStep)).toEqual({ pitchClass: "C", accidental: "sharp", octave: 4 });
  });

  it("respells Cb as the natural note below (B), with no sharp", () => {
    const cStep = noteToStep({ pitchClass: "C", octave: 4 });
    expect(stepToFlattedNote(cStep)).toEqual({ pitchClass: "B", accidental: null, octave: 3 });
  });

  it("respells Fb as the natural note below (E), with no sharp", () => {
    const fStep = noteToStep({ pitchClass: "F", octave: 4 });
    expect(stepToFlattedNote(fStep)).toEqual({ pitchClass: "E", accidental: null, octave: 4 });
  });
});

describe("stepToSharpedNote", () => {
  it("sharpens a natural note that has a black-key sharp", () => {
    const dStep = noteToStep({ pitchClass: "D", octave: 4 });
    expect(stepToSharpedNote(dStep)).toEqual({ pitchClass: "D", accidental: "sharp", octave: 4 });
  });

  it("respells E# as the natural note above (F), with no sharp", () => {
    const eStep = noteToStep({ pitchClass: "E", octave: 4 });
    expect(stepToSharpedNote(eStep)).toEqual({ pitchClass: "F", accidental: null, octave: 4 });
  });

  it("respells B# as the natural note above (C), rolling over to the next octave", () => {
    const bStep = noteToStep({ pitchClass: "B", octave: 4 });
    expect(stepToSharpedNote(bStep)).toEqual({ pitchClass: "C", accidental: null, octave: 5 });
  });
});

describe("yToStep", () => {
  it("clamps to the drawable range", () => {
    expect(yToStep(-1000)).toBe(STEP_MAX);
    expect(yToStep(1000)).toBe(STEP_MIN);
  });

  it("rounds to the nearest step", () => {
    // HALF_STEP is 6px and TOP_PADDING is 11px, so y=83 lands exactly on step 0.
    expect(yToStep(83)).toBe(0);
    expect(yToStep(81)).toBe(0);
    expect(yToStep(88)).toBe(-1);
  });
});
