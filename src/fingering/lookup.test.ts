import { describe, expect, it } from "vitest";
import { lookupFingering } from "./lookup";

describe("lookupFingering", () => {
  it("finds a chart entry for a note within range", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 4 }, "12hole");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.entry.label).toBe("C4");
      expect(result.entry.image).toBe("/tabs/12hole_C4.png");
    }
  });

  it("normalizes enharmonic spellings to the same chart entry", () => {
    const sharp = lookupFingering({ pitchClass: "C", accidental: "sharp", octave: 4 }, "12hole");
    const flat = lookupFingering({ pitchClass: "D", accidental: "flat", octave: 4 }, "12hole");
    expect(sharp.status).toBe("found");
    expect(flat.status).toBe("found");
    if (sharp.status === "found" && flat.status === "found") {
      expect(sharp.entry).toEqual(flat.entry);
    }
  });

  it("reports out-of-range for notes below the playable range", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 1 }, "12hole");
    expect(result.status).toBe("out-of-range");
  });

  it("reports out-of-range for notes above the playable range", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 8 }, "12hole");
    expect(result.status).toBe("out-of-range");
  });

  it("reports unsupported for an unregistered ocarina type", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 4 }, "double");
    expect(result.status).toBe("unsupported");
  });
});
