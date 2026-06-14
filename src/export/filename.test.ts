import { describe, expect, it } from "vitest";
import { buildExportFilename } from "./filename";

describe("buildExportFilename", () => {
  it("builds a filename from title, ocarina type, and date", () => {
    expect(buildExportFilename("mysong", "12hole", new Date(2026, 5, 14))).toBe(
      "mysong_ocarina_12hole_14-06-2026"
    );
  });

  it("falls back to 'untitled' for an empty title", () => {
    expect(buildExportFilename("", "double", new Date(2026, 5, 14))).toBe(
      "untitled_ocarina_double_14-06-2026"
    );
  });

  it("falls back to 'untitled' for a whitespace-only title", () => {
    expect(buildExportFilename("   ", "12hole", new Date(2026, 5, 14))).toBe(
      "untitled_ocarina_12hole_14-06-2026"
    );
  });

  it("replaces whitespace and invalid filename characters with underscores", () => {
    expect(buildExportFilename('My Song: "Best" / Take 1?', "12hole", new Date(2026, 5, 14))).toBe(
      "My_Song___Best____Take_1__ocarina_12hole_14-06-2026"
    );
  });

  it("pads single-digit day and month values", () => {
    expect(buildExportFilename("song", "12hole", new Date(2026, 0, 2))).toBe(
      "song_ocarina_12hole_02-01-2026"
    );
  });
});
