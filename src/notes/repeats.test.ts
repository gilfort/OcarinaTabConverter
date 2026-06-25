import { describe, expect, it } from "vitest";
import { parseNotes } from "./parser";
import { expandRepeats } from "./repeats";

function expand(input: string) {
  const { tokens } = parseNotes(input);
  return expandRepeats(tokens);
}

function raws(tokens: ReturnType<typeof expand>): string[] {
  return tokens.map((t) => t.raw);
}

describe("expandRepeats", () => {
  it("duplicates a plain repeat block with no voltas", () => {
    const result = expand("C4 |: D4 E4 :| F4");
    expect(raws(result)).toEqual(["C4", "|:", "D4", "E4", ":|", "D4", "E4", "F4"]);
    expect(result.every((t) => t.error === null)).toBe(true);
  });

  it("expands a repeat with both volta endings", () => {
    const result = expand("|: C4 [1 D4 :| [2 E4 F4");
    expect(raws(result)).toEqual(["|:", "C4", "[1", "D4", ":|", "C4", "[2", "E4", "F4"]);
  });

  it("falls back to plain common section on the second pass with only [1", () => {
    const result = expand("|: C4 [1 D4 :| F4");
    expect(raws(result)).toEqual(["|:", "C4", "[1", "D4", ":|", "C4", "F4"]);
  });

  it("flags an unmatched repeat start", () => {
    const result = expand("C4 |: D4");
    const marker = result.find((t) => t.marker === "repeatStart");
    expect(marker?.error).toBe('"|:" has no matching ":|"');
  });

  it("flags an unmatched repeat end", () => {
    const result = expand("C4 :| D4");
    const marker = result.find((t) => t.marker === "repeatEnd");
    expect(marker?.error).toBe('":|" has no matching "|:"');
  });

  it("flags an orphaned [1", () => {
    const result = expand("C4 [1 D4");
    const marker = result.find((t) => t.marker === "voltaOne");
    expect(marker?.error).toBe('"[1" has no matching "|:"');
  });

  it("flags an orphaned [2", () => {
    const result = expand("C4 [2 D4");
    const marker = result.find((t) => t.marker === "voltaTwo");
    expect(marker?.error).toBe('"[2" has no matching "|:"');
  });

  it("flags a nested repeat start without crashing", () => {
    const result = expand("|: C4 |: D4 :| E4");
    const firstStart = result.find((t) => t.marker === "repeatStart");
    expect(firstStart?.error).toBe('"|:" cannot contain a nested "|:"');
  });

  it("renumbers indices for the expanded sequence", () => {
    const result = expand("C4 |: D4 E4 :| F4");
    result.forEach((token, i) => expect(token.index).toBe(i));
  });
});
