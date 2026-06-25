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

  it("renders an eighth note with the eighth class, an active fast marker, and no dashes", () => {
    const cell = renderSingleNote("eighth");

    expect(cell.classList.contains("tab-cell--eighth")).toBe(true);
    expect(cell.querySelector(".tab-cell__fast-marker--active")).not.toBeNull();
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(0);
  });

  it("renders an inactive fast marker (reserving space) for non-eighth notes", () => {
    const cell = renderSingleNote("quarter");

    expect(cell.querySelector(".tab-cell__fast-marker")).not.toBeNull();
    expect(cell.querySelector(".tab-cell__fast-marker--active")).toBeNull();
  });

  it("includes the eighth-note line marker in the legend", () => {
    const cell = renderSingleNote("quarter");
    const legend = cell.parentElement!.querySelector(".tab-legend")!;

    expect(legend.querySelector(".tab-legend__symbol--eighth")).not.toBeNull();
    expect(legend.textContent).toMatch(/eighth note/i);
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

describe("renderTab rests", () => {
  function renderRest(input: string) {
    const { tokens } = parseNotes(input);
    const items = buildTabItems(tokens, "12hole");

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: false });
    return container.querySelector(".tab-cell")!;
  }

  it("renders a rest with its glyph and length class instead of a fingering diagram", () => {
    const cell = renderRest("R4");

    expect(cell.classList.contains("tab-cell--rest")).toBe(true);
    expect(cell.classList.contains("tab-cell--quarter")).toBe(true);
    expect(cell.querySelector(".tab-cell__rest")).not.toBeNull();
    expect(cell.querySelector(".tab-cell__image")).toBeNull();
    expect(cell.querySelector(".tab-cell__length")).toBeNull();
  });

  it("renders a half rest with one dash extension", () => {
    const cell = renderRest("R2");

    expect(cell.classList.contains("tab-cell--half")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(1);
  });

  it("renders a whole rest with three dash extensions", () => {
    const cell = renderRest("R1");

    expect(cell.classList.contains("tab-cell--whole")).toBe(true);
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(3);
  });

  it("renders an eighth rest with the eighth class, an active fast marker, and no dashes", () => {
    const cell = renderRest("R8");

    expect(cell.classList.contains("tab-cell--eighth")).toBe(true);
    expect(cell.querySelector(".tab-cell__fast-marker--active")).not.toBeNull();
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(0);
  });

  it("labels the rest with its length", () => {
    const cell = renderRest("R4");

    expect(cell.querySelector(".tab-cell__label")?.textContent).toBe("Quarter rest");
  });

  it("shows a length select for rests when interactive, defaulting to the parsed length", () => {
    const { tokens } = parseNotes("R4");
    const items = buildTabItems(tokens, "12hole");

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: true });
    const cell = container.querySelector(".tab-cell")!;

    const select = cell.querySelector<HTMLSelectElement>(".tab-cell__length");
    expect(select).not.toBeNull();
    expect(select!.value).toBe("default");
  });

  it("changes the rendered rest length when its length override is set", () => {
    const { tokens } = parseNotes("R4");
    const items = buildTabItems(tokens, "12hole");
    items[0].lengthOverride = "whole";

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: false });
    const cell = container.querySelector(".tab-cell")!;

    expect(cell.classList.contains("tab-cell--whole")).toBe(true);
    expect(cell.querySelector(".tab-cell__label")?.textContent).toBe("Whole rest");
    expect(cell.querySelectorAll(".tab-cell__dash")).toHaveLength(3);
  });
});

describe("renderTab line breaks", () => {
  it("renders a line-break token as a full-width break, not a tab cell", () => {
    const { tokens } = parseNotes("C4 | D4");
    const items = buildTabItems(tokens, "12hole");

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: false });

    expect(container.querySelectorAll(".tab-cell")).toHaveLength(2);
    expect(container.querySelectorAll(".tab-output__line-break")).toHaveLength(1);
  });

  it("places the line break between the two note cells in document order", () => {
    const { tokens } = parseNotes("C4 | D4");
    const items = buildTabItems(tokens, "12hole");

    const container = document.createElement("div");
    renderTab(container, items, "quarter", { interactive: false });

    const childClasses = Array.from(container.children).map((child) => child.className);
    expect(childClasses[0]).toContain("tab-cell");
    expect(childClasses[1]).toBe("tab-output__line-break");
    expect(childClasses[2]).toContain("tab-cell");
  });

  it("does not give a line-break token a fingering result", () => {
    const { tokens } = parseNotes("|");
    const [item] = buildTabItems(tokens, "12hole");

    expect(item.token.lineBreak).toBe(true);
    expect(item.result).toBeNull();
  });
});
