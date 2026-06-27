import { describe, expect, it } from "vitest";
import { parseNotes } from "./parser";

describe("parseNotes", () => {
  it("parses a valid note name", () => {
    const result = parseNotes("C4");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toMatchObject({
      raw: "C4",
      note: { pitchClass: "C", accidental: null, octave: 4 },
      error: null,
    });
  });

  it("parses sharps and flats", () => {
    const result = parseNotes("C#4 Db4");
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "C", accidental: "sharp", octave: 4 });
    expect(result.tokens[1].note).toMatchObject({ pitchClass: "D", accidental: "flat", octave: 4 });
  });

  it("parses a sequence separated by spaces and commas", () => {
    const result = parseNotes("C4, D4 E4");
    expect(result.tokens.map((t) => t.raw)).toEqual(["C4", "D4", "E4"]);
    expect(result.tokens.every((t) => t.note !== null)).toBe(true);
  });

  it("defaults to octave 4 when no octave is given", () => {
    const result = parseNotes("C");
    expect(result.tokens[0]).toMatchObject({
      raw: "C",
      note: { pitchClass: "C", accidental: null, octave: 4 },
      error: null,
    });
  });

  it("defaults to octave 4 for a sharp/flat note with no octave", () => {
    const result = parseNotes("C# Db");
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "C", accidental: "sharp", octave: 4 });
    expect(result.tokens[1].note).toMatchObject({ pitchClass: "D", accidental: "flat", octave: 4 });
  });

  it("reports an error for an invalid note token", () => {
    const result = parseNotes("H4");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].note).toBeNull();
    expect(result.tokens[0].error).toMatch(/not a valid note name/);
  });

  it("returns no tokens for empty input", () => {
    const result = parseNotes("   ");
    expect(result.tokens).toHaveLength(0);
  });

  it("parses rest tokens with explicit lengths", () => {
    const result = parseNotes("R1 R2 R4 R8");
    expect(result.tokens.map((t) => t.rest)).toEqual(["whole", "half", "quarter", "eighth"]);
    expect(result.tokens.every((t) => t.note === null && t.error === null)).toBe(true);
  });

  it("parses a bare 'R' rest as the default note length", () => {
    const result = parseNotes("R");
    expect(result.tokens[0]).toMatchObject({ note: null, rest: "quarter", error: null });
  });

  it("is case-insensitive for rest tokens", () => {
    const result = parseNotes("r4");
    expect(result.tokens[0]).toMatchObject({ rest: "quarter", error: null });
  });

  it("reports an error for a rest with an unsupported length suffix", () => {
    const result = parseNotes("R3");
    expect(result.tokens[0].rest).toBeNull();
    expect(result.tokens[0].error).toMatch(/not a valid rest/);
  });

  it("parses notes and rests together in sequence", () => {
    const result = parseNotes("C4 R4 D4");
    expect(result.tokens.map((t) => (t.rest ? `rest:${t.rest}` : t.note?.pitchClass))).toEqual([
      "C",
      "rest:quarter",
      "D",
    ]);
  });

  it("parses a '|' token as a line break, not a note or rest", () => {
    const result = parseNotes("C4 | D4");
    expect(result.tokens.map((t) => t.lineBreak)).toEqual([false, true, false]);
    expect(result.tokens[1]).toMatchObject({ note: null, rest: null, error: null, lineBreak: true });
  });

  it("sets lineBreak to false on notes and rests", () => {
    const result = parseNotes("C4 R4");
    expect(result.tokens.every((t) => t.lineBreak === false)).toBe(true);
  });
});

describe("parseNotes with a tie/legato pair", () => {
  it("splits 'C4-D4' into two tokens marked as tie start/end", () => {
    const result = parseNotes("C4-D4");
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0]).toMatchObject({ raw: "C4", tie: "start", error: null });
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "C", octave: 4 });
    expect(result.tokens[1]).toMatchObject({ raw: "D4", tie: "end", error: null });
    expect(result.tokens[1].note).toMatchObject({ pitchClass: "D", octave: 4 });
  });

  it("gives each tied note its own index and sourceIndex", () => {
    const result = parseNotes("C4-D4");
    expect(result.tokens[0].index).toBe(0);
    expect(result.tokens[1].index).toBe(1);
    expect(result.tokens[0].sourceIndex).toBe(0);
    expect(result.tokens[1].sourceIndex).toBe(1);
  });

  it("supports a tied pair with the same pitch, e.g. 'C4-C4'", () => {
    const result = parseNotes("C4-C4");
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "C", octave: 4 });
    expect(result.tokens[1].note).toMatchObject({ pitchClass: "C", octave: 4 });
  });

  it("keeps ties and untied notes in correct order within a sequence", () => {
    const result = parseNotes("C4 D4-E4 F4");
    expect(result.tokens.map((t) => [t.raw, t.tie])).toEqual([
      ["C4", null],
      ["D4", "start"],
      ["E4", "end"],
      ["F4", null],
    ]);
  });

  it("supports notes without an explicit octave on either side", () => {
    const result = parseNotes("C-D");
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "C", octave: 4 });
    expect(result.tokens[1].note).toMatchObject({ pitchClass: "D", octave: 4 });
  });

  it("reports a clear parse error for an invalid note on either side, with no silent fallback", () => {
    const result = parseNotes("C4-H4");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].note).toBeNull();
    expect(result.tokens[0].tie).toBeNull();
    expect(result.tokens[0].error).toMatch(/not a valid note name/);
  });

  it("reports a clear parse error when a rest is involved, with no silent fallback", () => {
    const result = parseNotes("R4-C4");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].note).toBeNull();
    expect(result.tokens[0].rest).toBeNull();
    expect(result.tokens[0].error).not.toBeNull();
  });

  it("no longer supports negative octaves, since '-' is now reserved for ties", () => {
    const result = parseNotes("C-1");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].note).toBeNull();
    expect(result.tokens[0].tie).toBeNull();
    expect(result.tokens[0].error).toMatch(/not a valid note name/);
  });
});

describe("parseNotes with a key signature", () => {
  it("applies the key signature's accidental to a note with no explicit accidental", () => {
    const result = parseNotes("F4", { F: "sharp" });
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "F", accidental: "sharp", octave: 4 });
  });

  it("leaves notes for other pitch classes unaffected", () => {
    const result = parseNotes("G4", { F: "sharp" });
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "G", accidental: null, octave: 4 });
  });

  it("lets an explicit accidental override the key signature", () => {
    const result = parseNotes("Fb4", { F: "sharp" });
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "F", accidental: "flat", octave: 4 });
  });

  it("lets an explicit natural ('n') cancel the key signature's accidental", () => {
    const result = parseNotes("Fn4", { F: "sharp" });
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "F", accidental: null, octave: 4 });
  });

  it("is unaffected by a key signature when none is given", () => {
    const result = parseNotes("F4");
    expect(result.tokens[0].note).toMatchObject({ pitchClass: "F", accidental: null, octave: 4 });
  });
});
