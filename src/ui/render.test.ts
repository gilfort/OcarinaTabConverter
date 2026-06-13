import { describe, expect, it } from "vitest";
import { parseNotes } from "../notes/parser";
import { buildTabItems } from "./render";

describe("buildTabItems", () => {
  it("flags an invalid token with its error message, without a fingering result", () => {
    const { tokens } = parseNotes("H4");
    const [item] = buildTabItems(tokens, "12hole");

    expect(item.token.error).toMatch(/not a valid note name/);
    expect(item.result).toBeNull();
  });

  it("flags a valid note outside the playable range as out-of-range", () => {
    const { tokens } = parseNotes("C1");
    const [item] = buildTabItems(tokens, "12hole");

    expect(item.token.error).toBeNull();
    expect(item.result?.status).toBe("out-of-range");
  });

  it("distinguishes invalid tokens from out-of-range notes within the same sequence", () => {
    const { tokens } = parseNotes("H4, C1, C4");
    const items = buildTabItems(tokens, "12hole");

    expect(items[0].token.error).toMatch(/not a valid note name/);
    expect(items[0].result).toBeNull();

    expect(items[1].token.error).toBeNull();
    expect(items[1].result?.status).toBe("out-of-range");

    expect(items[2].token.error).toBeNull();
    expect(items[2].result?.status).toBe("found");
  });

  it("keeps invalid and out-of-range tokens in the sequence in input order", () => {
    const { tokens } = parseNotes("C4, H4, C1");
    const items = buildTabItems(tokens, "12hole");

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.token.raw)).toEqual(["C4", "H4", "C1"]);
  });
});
