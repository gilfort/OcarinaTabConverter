import { describe, expect, it } from "vitest";
import { chartDouble } from "./chartDouble";
import { lookupFingering } from "./lookup";

describe("lookupFingering (double ocarina)", () => {
  it("finds a chart entry for a note on the left chamber", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 4 }, "double");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.entry.label).toBe("C4");
      expect(result.entry.image).toBe("/tabs/double_C4.png");
      expect(result.entry.chamber).toBe("left");
    }
  });

  it("finds a chart entry for a note on the right chamber", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: null, octave: 5 }, "double");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.entry.label).toBe("C5");
      expect(result.entry.image).toBe("/tabs/double_C5.png");
      expect(result.entry.chamber).toBe("right");
    }
  });

  it("normalizes enharmonic spellings to the same chart entry", () => {
    const sharp = lookupFingering({ pitchClass: "C", accidental: "sharp", octave: 4 }, "double");
    const flat = lookupFingering({ pitchClass: "D", accidental: "flat", octave: 4 }, "double");
    expect(sharp.status).toBe("found");
    expect(flat.status).toBe("found");
    if (sharp.status === "found" && flat.status === "found") {
      expect(sharp.entry).toEqual(flat.entry);
    }
  });

  it("reports out-of-range for notes below the playable range", () => {
    const result = lookupFingering({ pitchClass: "G", accidental: null, octave: 3 }, "double");
    expect(result.status).toBe("out-of-range");
  });

  it("reports out-of-range for notes above the playable range", () => {
    const result = lookupFingering({ pitchClass: "C", accidental: "sharp", octave: 6 }, "double");
    expect(result.status).toBe("out-of-range");
  });

  it("finds a chart entry with a chamber assignment for every note across the full A3-C6 range", () => {
    for (const chartEntry of chartDouble) {
      const result = lookupFingering(chartEntry.note, "double");
      expect(result.status).toBe("found");
      if (result.status === "found") {
        expect(result.entry).toEqual(chartEntry);
        expect(["left", "right"]).toContain(result.entry.chamber);
      }
    }
  });
});
