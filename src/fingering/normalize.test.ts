import { describe, expect, it } from "vitest";
import { formatNormalizedNote } from "./normalize";

describe("formatNormalizedNote", () => {
  it("formats a natural note", () => {
    expect(formatNormalizedNote({ pitchClass: "A", accidental: null, octave: 3 })).toBe("A3");
  });

  it("formats a sharp note", () => {
    expect(formatNormalizedNote({ pitchClass: "C", accidental: "sharp", octave: 5 })).toBe("C#5");
  });
});
