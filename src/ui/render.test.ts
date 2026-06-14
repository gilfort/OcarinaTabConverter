import { describe, expect, it } from "vitest";
import { parseNotes } from "../notes/parser";
import { buildTabItems, renderTab } from "./render";

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

describe("renderTab note lengths", () => {
  function renderSingleNote(lengthOverride: "default" | "eighth" | "quarter" | "half" | "whole") {
    const { tokens } = parseNotes("C4");
    const items = buildTabItems(tokens, "12hole");
    items[0].lengthOverride = lengthOverride;

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: false });
    return container.querySelector(".tab-cell")!;
  }

  it("renders a quarter note with no dash extensions", () => {
    const cell = renderSingleNote("quarter");

    expect(cell.classList.contains("tab-cell--quarter")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(0);
  });

  it("renders a half note with one dash extension", () => {
    const cell = renderSingleNote("half");

    expect(cell.classList.contains("tab-cell--half")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(1);
  });

  it("renders a whole note with three dash extensions", () => {
    const cell = renderSingleNote("whole");

    expect(cell.classList.contains("tab-cell--whole")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(3);
  });

  it("renders an eighth note with the eighth-width class and no dashes", () => {
    const cell = renderSingleNote("eighth");

    expect(cell.classList.contains("tab-cell--eighth")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(0);
  });

  it("falls back to the default note length when override is 'default'", () => {
    const cell = renderSingleNote("default");

    expect(cell.classList.contains("tab-cell--quarter")).toBe(true);
  });

  it("only renders the per-note length select when interactive", () => {
    const { tokens } = parseNotes("C4");

    const interactiveItems = buildTabItems(tokens, "12hole");
    const interactiveContainer = document.createElement("div");
    renderTab(interactiveContainer, interactiveItems, "quarter", { interactive: true });
    expect(interactiveContainer.querySelector(".tab-cell__length")).not.toBeNull();

    const staticItems = buildTabItems(tokens, "12hole");
    const staticContainer = document.createElement("div");
    renderTab(staticContainer, staticItems, "quarter", { interactive: false });
    expect(staticContainer.querySelector(".tab-cell__length")).toBeNull();
  });
});
