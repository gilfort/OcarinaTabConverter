import { describe, expect, it } from "vitest";
import type { Note } from "../notes/types";
import { convertVoiceToTokens } from "./convert";
import type { MusicXmlEvent } from "./types";

function note(note: Note | null, units: number, tieStart = false, tieStop = false): MusicXmlEvent {
  return { kind: "note", data: { note, units, tieStart, tieStop } };
}

const C4: Note = { pitchClass: "C", accidental: null, octave: 4 };
const D4: Note = { pitchClass: "D", accidental: null, octave: 4 };

describe("convertVoiceToTokens", () => {
  it("converts plain notes and rests with rounded lengths", () => {
    expect(convertVoiceToTokens([note(C4, 1), note(null, 2), note(D4, 4)])).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "R2", lengthOverride: "default" },
      { raw: "D4", lengthOverride: "whole" },
    ]);
  });

  it("merges a tied pair of same-pitch notes into one token with combined duration", () => {
    const tokens = convertVoiceToTokens([note(C4, 1, true, false), note(C4, 1, false, true)]);
    expect(tokens).toEqual([{ raw: "C4", lengthOverride: "half" }]);
  });

  it("merges a chain of more than two tied notes", () => {
    const tokens = convertVoiceToTokens([
      note(C4, 1, true, false),
      note(C4, 1, true, true),
      note(C4, 1, false, true),
    ]);
    expect(tokens).toEqual([{ raw: "C4", lengthOverride: "whole" }]);
  });

  it("does not merge a tie-start into a note of a different pitch", () => {
    const tokens = convertVoiceToTokens([note(C4, 1, true, false), note(D4, 1, false, true)]);
    expect(tokens).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: "D4", lengthOverride: "quarter" },
    ]);
  });

  it("passes marker tokens through unchanged", () => {
    const tokens = convertVoiceToTokens([
      { kind: "marker", marker: "repeatStart" },
      note(C4, 1),
      { kind: "marker", marker: "voltaOne" },
      note(D4, 1),
      { kind: "marker", marker: "repeatEnd" },
      { kind: "marker", marker: "voltaTwo" },
    ]);
    expect(tokens.map((t) => t.raw)).toEqual(["|:", "C4", "[1", "D4", ":|", "[2"]);
  });

  it("does not merge a tie across an intervening marker", () => {
    const tokens = convertVoiceToTokens([
      note(C4, 1, true, false),
      { kind: "marker", marker: "repeatEnd" },
      note(C4, 1, false, true),
    ]);
    expect(tokens).toEqual([
      { raw: "C4", lengthOverride: "quarter" },
      { raw: ":|", lengthOverride: "default" },
      { raw: "C4", lengthOverride: "quarter" },
    ]);
  });
});
