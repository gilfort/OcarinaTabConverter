import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMusicXmlFile } from "./parser";
import { isMusicXmlParseError } from "./types";

/**
 * Smoke test against a real Audiveris OMR export (scanned sheet music -> .mxl), to catch
 * real-world tool quirks that hand-written synthetic fixtures wouldn't. This particular
 * sample contains a chord, which is out of scope (see issue discussion) -- so the expected
 * outcome here is a clear, specific parse error rather than a successful import.
 */
describe("parseMusicXmlFile (real Audiveris export)", () => {
  it("reads the archive and reports the chord it can't represent", () => {
    const buffer = readFileSync(join(__dirname, "fixtures/sample.mxl"));
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const result = parseMusicXmlFile(arrayBuffer);

    expect(isMusicXmlParseError(result) && result.error).toMatch(/chord/i);
  });
});
