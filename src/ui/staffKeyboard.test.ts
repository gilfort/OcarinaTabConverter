import { describe, expect, it } from "vitest";
import { BLACK_KEYS, DEFAULT_OCTAVE, WHITE_KEYS, clampOctave, resolveKeyNote } from "./staffKeyboard";

describe("resolveKeyNote", () => {
  const expectedWhiteNotes = ["C", "D", "E", "F", "G", "A", "B", "C"];

  WHITE_KEYS.forEach((key, column) => {
    it(`maps white key "${key}" to its diatonic note at the default octave`, () => {
      const note = resolveKeyNote(key, DEFAULT_OCTAVE);
      expect(note?.pitchClass).toBe(expectedWhiteNotes[column]);
      expect(note?.accidental).toBeNull();
      expect(note?.octave).toBe(column === 7 ? DEFAULT_OCTAVE + 1 : DEFAULT_OCTAVE);
    });
  });

  BLACK_KEYS.forEach((key, column) => {
    it(`maps black key "${key}" to the sharp of its column's white key`, () => {
      const note = resolveKeyNote(key, DEFAULT_OCTAVE);
      const naturalEquivalent = resolveKeyNote(WHITE_KEYS[column], DEFAULT_OCTAVE)!;
      expect(note).not.toBeNull();
      if (naturalEquivalent.pitchClass === "E" || naturalEquivalent.pitchClass === "B") {
        // E# and B# canonicalize to F and C, so the "sharp" is actually the next natural note.
        expect(note?.accidental).toBeNull();
      } else {
        expect(note?.accidental).toBe("sharp");
      }
    });
  });

  it("returns the flat instead of the natural when Ctrl is held on a white key", () => {
    const plain = resolveKeyNote("a", DEFAULT_OCTAVE);
    const flat = resolveKeyNote("a", DEFAULT_OCTAVE, { ctrlKey: true, metaKey: false });
    expect(plain?.accidental).toBeNull();
    expect(flat).not.toEqual(plain);
  });

  it("returns the flat when Cmd (metaKey) is held", () => {
    const flat = resolveKeyNote("a", DEFAULT_OCTAVE, { ctrlKey: false, metaKey: true });
    expect(flat).not.toBeNull();
  });

  it("shifts the resolved note by a full octave (7 diatonic steps) when the octave changes", () => {
    const lower = resolveKeyNote("a", DEFAULT_OCTAVE)!;
    const upper = resolveKeyNote("a", DEFAULT_OCTAVE + 1)!;
    expect(upper.pitchClass).toBe(lower.pitchClass);
    expect(upper.octave).toBe(lower.octave + 1);
  });

  it("returns null for an unmapped key", () => {
    expect(resolveKeyNote("x", DEFAULT_OCTAVE)).toBeNull();
    expect(resolveKeyNote("5", DEFAULT_OCTAVE)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(resolveKeyNote("A", DEFAULT_OCTAVE)).toEqual(resolveKeyNote("a", DEFAULT_OCTAVE));
  });
});

describe("clampOctave", () => {
  it("clamps below the minimum", () => {
    expect(clampOctave(0)).toBe(2);
  });

  it("clamps above the maximum", () => {
    expect(clampOctave(10)).toBe(6);
  });

  it("leaves in-range values unchanged", () => {
    expect(clampOctave(4)).toBe(4);
  });
});
