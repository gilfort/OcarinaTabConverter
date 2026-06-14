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
});
