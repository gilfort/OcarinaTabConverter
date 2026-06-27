import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { isMusicXmlParseError, type ParsedMusicXml } from "./types";
import { parseMusicXmlFile } from "./parser";

/** Wraps a `<score-partwise>` body in a minimal valid MusicXML document. */
function scorePartwise(partList: string, parts: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>${partList}</part-list>
  ${parts}
</score-partwise>`;
}

/** Packs a MusicXML string into a `.mxl` archive (container.xml + the document) as an ArrayBuffer. */
function toMxl(xml: string, rootPath = "score.xml"): ArrayBuffer {
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="${rootPath}"/></rootfiles></container>`;
  const zipped = zipSync({
    "META-INF/container.xml": strToU8(container),
    [rootPath]: strToU8(xml),
  });
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

function expectOk(result: ReturnType<typeof parseMusicXmlFile>): ParsedMusicXml {
  if (isMusicXmlParseError(result)) throw new Error(`expected success, got error: ${result.error}`);
  return result;
}

describe("parseMusicXmlFile", () => {
  it("parses a simple single-voice melody with pitches and a rest", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>Melody</part-name></score-part>`,
      `<part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
          <note><rest/><duration>1</duration><voice>1</voice></note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
        </measure>
      </part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    expect(result.voices).toHaveLength(1);
    expect(result.voices[0].label).toBe("Melody – Voice 1");
    expect(result.voices[0].events).toEqual([
      { kind: "note", data: { note: { pitchClass: "C", accidental: null, octave: 4 }, units: 1, tieStart: false, tieStop: false } },
      { kind: "note", data: { note: null, units: 1, tieStart: false, tieStop: false } },
      { kind: "note", data: { note: { pitchClass: "D", accidental: null, octave: 4 }, units: 1, tieStart: false, tieStop: false } },
    ]);
  });

  it("maps sharp and flat alters to accidentals", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
        <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    const notes = result.voices[0].events.map((e) => (e.kind === "note" ? e.data.note : null));
    expect(notes).toEqual([
      { pitchClass: "F", accidental: "sharp", octave: 4 },
      { pitchClass: "B", accidental: "flat", octave: 4 },
    ]);
  });

  it("rejects an unsupported double-sharp/double-flat alter", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>F</step><alter>2</alter><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = parseMusicXmlFile(toMxl(xml));
    expect(isMusicXmlParseError(result) && result.error).toMatch(/alter/i);
  });

  it("maps <key><fifths> to a key signature", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions><key><fifths>-2</fifths></key></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    expect(result.keySignature).toEqual({ B: "flat", E: "flat" });
  });

  it("rounds a note's duration to the nearest supported length via divisions", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>4</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    const note = result.voices[0].events[0];
    expect(note.kind === "note" && note.data.units).toBe(2);
  });

  it("maps repeat barlines and first/second endings to RepeatMarker tokens around the right measures", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <barline location="left"><repeat direction="forward"/></barline>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
        </measure>
        <measure number="2">
          <barline location="left"><ending number="1" type="start"/></barline>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
          <barline location="right"><repeat direction="backward"/></barline>
        </measure>
        <measure number="3">
          <barline location="left"><ending number="2" type="start"/></barline>
          <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
        </measure>
      </part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    const kinds = result.voices[0].events.map((e) => (e.kind === "marker" ? e.marker : e.kind === "note" ? e.data.note?.pitchClass ?? "rest" : "?"));
    expect(kinds).toEqual(["repeatStart", "C", "voltaOne", "D", "repeatEnd", "voltaTwo", "E"]);
  });

  it("rejects an ending number other than 1 or 2", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <barline location="left"><ending number="3" type="start"/></barline>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = parseMusicXmlFile(toMxl(xml));
    expect(isMusicXmlParseError(result) && result.error).toMatch(/ending/i);
  });

  it("separates multiple voices within a single part into distinct entries", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>Piano</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice></note>
        <backup><duration>1</duration></backup>
        <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><voice>2</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    expect(result.voices.map((v) => v.label)).toEqual(["Piano – Voice 1", "Piano – Voice 2"]);
  });

  it("separates multiple parts into distinct entries", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>Flute</part-name></score-part><score-part id="P2"><part-name>Oboe</part-name></score-part>`,
      `<part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>
      <part id="P2"><measure number="1">
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    expect(result.voices.map((v) => v.label)).toEqual(["Flute – Voice 1", "Oboe – Voice 1"]);
  });

  it("rejects chords", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
        <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );

    const result = parseMusicXmlFile(toMxl(xml));
    expect(isMusicXmlParseError(result) && result.error).toMatch(/chord/i);
  });

  it("rejects grace notes", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><grace/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice></note>
      </measure></part>`
    );

    const result = parseMusicXmlFile(toMxl(xml));
    expect(isMusicXmlParseError(result) && result.error).toMatch(/grace/i);
  });

  it("rejects tuplets", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice>
          <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        </note>
      </measure></part>`
    );

    const result = parseMusicXmlFile(toMxl(xml));
    expect(isMusicXmlParseError(result) && result.error).toMatch(/tuplet/i);
  });

  it("marks tie start/stop on note events without merging them at parse time", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="start"/><voice>1</voice></note>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/><voice>1</voice></note>
      </measure></part>`
    );

    const result = expectOk(parseMusicXmlFile(toMxl(xml)));
    expect(result.voices[0].events).toEqual([
      { kind: "note", data: { note: { pitchClass: "C", accidental: null, octave: 4 }, units: 1, tieStart: true, tieStop: false } },
      { kind: "note", data: { note: { pitchClass: "C", accidental: null, octave: 4 }, units: 1, tieStart: false, tieStop: true } },
    ]);
  });

  it("falls back to treating a non-zip buffer as plain MusicXML text", () => {
    const xml = scorePartwise(
      `<score-part id="P1"><part-name>P</part-name></score-part>`,
      `<part id="P1"><measure number="1">
        <attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      </measure></part>`
    );
    const bytes = strToU8(xml);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const result = expectOk(parseMusicXmlFile(buffer));
    expect(result.voices).toHaveLength(1);
  });

  it("returns an error for an empty or unreadable file", () => {
    const result = parseMusicXmlFile(new ArrayBuffer(0));
    expect(isMusicXmlParseError(result)).toBe(true);
  });
});
