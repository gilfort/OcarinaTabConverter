import { describe, expect, it } from "vitest";
import { isSaveParseError, parseSaveData, serializeSaveData } from "./io";
import type { NoteLengthOverride } from "../notes/length";

describe("save/load round trip", () => {
  it("serializes and parses a piece back to the same data", () => {
    const data = {
      title: "My Song",
      ocarinaType: "12hole" as const,
      notes: "C4 D4 R4 E4",
      lengthOverrides: ["default", "eighth", "default", "half"] as NoteLengthOverride[],
    };

    const text = serializeSaveData(data);
    const result = parseSaveData(text);

    expect(isSaveParseError(result)).toBe(false);
    if (!isSaveParseError(result)) {
      expect(result.title).toBe(data.title);
      expect(result.ocarinaType).toBe(data.ocarinaType);
      expect(result.notes).toBe(data.notes);
      expect(result.lengthOverrides).toEqual(data.lengthOverrides);
    }
  });
});

describe("parseSaveData", () => {
  it("rejects invalid JSON", () => {
    const result = parseSaveData("not json");
    expect(isSaveParseError(result)).toBe(true);
  });

  it("rejects a JSON value that isn't an object", () => {
    const result = parseSaveData("42");
    expect(isSaveParseError(result)).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = parseSaveData(JSON.stringify({ ocarinaType: "12hole", notes: "C4", lengthOverrides: [] }));
    expect(isSaveParseError(result)).toBe(true);
  });

  it("rejects an unrecognized ocarina type", () => {
    const result = parseSaveData(
      JSON.stringify({ title: "x", ocarinaType: "triple", notes: "C4", lengthOverrides: [] })
    );
    expect(isSaveParseError(result)).toBe(true);
  });

  it("rejects invalid note length overrides", () => {
    const result = parseSaveData(
      JSON.stringify({ title: "x", ocarinaType: "12hole", notes: "C4", lengthOverrides: ["sixteenth"] })
    );
    expect(isSaveParseError(result)).toBe(true);
  });
});
