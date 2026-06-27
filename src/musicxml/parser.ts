import { strFromU8, unzipSync } from "fflate";
import type { Accidental, KeySignature, Note, PitchClass, RepeatMarker } from "../notes/types";
import { fifthsToKeySignature } from "./keySignature";
import type { MusicXmlEvent, MusicXmlParseError, MusicXmlVoice, ParsedMusicXml } from "./types";

const PITCH_CLASSES: ReadonlySet<string> = new Set(["A", "B", "C", "D", "E", "F", "G"]);

function textOf(parent: Element, tagName: string): string | null {
  const child = parent.querySelector(`:scope > ${tagName}`);
  return child?.textContent?.trim() ?? null;
}

/** Extracts the MusicXML document string from a `.mxl` archive's bytes, or a plain `.xml`/`.musicxml` buffer. */
function extractMusicXmlSource(buffer: ArrayBuffer): { xml: string } | MusicXmlParseError {
  const bytes = new Uint8Array(buffer);

  // A `.mxl` file is a ZIP archive (starts with "PK"); anything else is treated as plain XML.
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return { xml: strFromU8(bytes) };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (err) {
    return { error: err instanceof Error ? `Could not read .mxl archive: ${err.message}` : "Could not read .mxl archive" };
  }

  const containerXml = files["META-INF/container.xml"];
  if (!containerXml) {
    const xmlEntries = Object.keys(files).filter((name) => /\.(musicxml|xml)$/i.test(name) && !name.startsWith("META-INF/"));
    if (xmlEntries.length === 1) {
      return { xml: strFromU8(files[xmlEntries[0]]) };
    }
    return { error: "This .mxl archive has no META-INF/container.xml and no single unambiguous MusicXML entry" };
  }

  const containerDoc = new DOMParser().parseFromString(strFromU8(containerXml), "application/xml");
  const rootfilePath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
  if (!rootfilePath || !files[rootfilePath]) {
    return { error: "META-INF/container.xml does not point to a valid MusicXML entry" };
  }

  return { xml: strFromU8(files[rootfilePath]) };
}

/** Reads a `<pitch>` element's step/alter/octave into a `Note`, or an error if it uses unsupported notation. */
function readPitch(pitchEl: Element): { note: Note } | MusicXmlParseError {
  const step = textOf(pitchEl, "step");
  const octaveText = textOf(pitchEl, "octave");
  if (!step || !PITCH_CLASSES.has(step) || octaveText === null) {
    return { error: "A <pitch> element is missing a valid <step> or <octave>" };
  }

  const alterText = textOf(pitchEl, "alter");
  const alter = alterText === null ? 0 : Number.parseFloat(alterText);
  let accidental: Accidental | null;
  if (alter === 0) accidental = null;
  else if (alter === 1) accidental = "sharp";
  else if (alter === -1) accidental = "flat";
  else return { error: `Unsupported accidental alter value "${alterText}" (only -1, 0, and 1 are supported)` };

  return {
    note: { pitchClass: step as PitchClass, accidental, octave: Number.parseInt(octaveText, 10) },
  };
}

/** Reads the repeat/volta markers implied by a `<barline>` element, split by which side of its measure they fall on. */
function readBarlineMarkers(barlineEl: Element): { before: RepeatMarker[]; after: RepeatMarker[] } | MusicXmlParseError {
  const location = barlineEl.getAttribute("location") ?? "right";
  const before: RepeatMarker[] = [];
  const after: RepeatMarker[] = [];

  const repeatDirection = barlineEl.querySelector(":scope > repeat")?.getAttribute("direction");
  if (repeatDirection === "forward") before.push("repeatStart");
  if (repeatDirection === "backward") after.push("repeatEnd");

  const endingEl = barlineEl.querySelector(":scope > ending");
  if (endingEl) {
    const number = endingEl.getAttribute("number");
    const type = endingEl.getAttribute("type");
    if (type === "start") {
      if (number === "1") (location === "left" ? before : after).push("voltaOne");
      else if (number === "2") (location === "left" ? before : after).push("voltaTwo");
      else return { error: `Only first/second endings (volta 1/2) are supported, found ending number "${number}"` };
    }
  }

  return { before, after };
}

/** Parses a single `<part>` element into its per-voice event streams. */
function parsePart(partEl: Element): { voices: Map<string, MusicXmlEvent[]>; keySignature: KeySignature | null } | MusicXmlParseError {
  const voices = new Map<string, MusicXmlEvent[]>();
  let divisions = 1;
  let keySignature: KeySignature | null = null;

  for (const measureEl of Array.from(partEl.children)) {
    if (measureEl.tagName !== "measure") continue;

    const attributesEl = measureEl.querySelector(":scope > attributes");
    const divisionsText = attributesEl ? textOf(attributesEl, "divisions") : null;
    if (divisionsText !== null) divisions = Number.parseFloat(divisionsText);
    if (keySignature === null) {
      const fifthsText = attributesEl?.querySelector(":scope > key > fifths")?.textContent?.trim() ?? null;
      if (fifthsText !== null) keySignature = fifthsToKeySignature(Number.parseInt(fifthsText, 10));
    }

    const beforeMarkers: RepeatMarker[] = [];
    const afterMarkers: RepeatMarker[] = [];
    for (const barlineEl of Array.from(measureEl.querySelectorAll(":scope > barline"))) {
      const markers = readBarlineMarkers(barlineEl);
      if ("error" in markers) return markers;
      beforeMarkers.push(...markers.before);
      afterMarkers.push(...markers.after);
    }

    const touchedVoices = new Set<string>();
    for (const noteEl of Array.from(measureEl.children)) {
      if (noteEl.tagName !== "note") continue;

      if (noteEl.querySelector(":scope > grace")) return { error: "Grace notes are not supported" };
      if (noteEl.querySelector(":scope > chord")) {
        return { error: "Chords (multiple simultaneous notes in one voice) are not supported" };
      }
      if (noteEl.querySelector(":scope > time-modification")) return { error: "Tuplets are not supported" };

      const durationText = textOf(noteEl, "duration");
      if (durationText === null) return { error: "A <note> is missing its <duration>" };
      const units = Number.parseFloat(durationText) / divisions;

      const voice = textOf(noteEl, "voice") ?? "1";
      let events = voices.get(voice);
      if (!events) {
        events = [];
        voices.set(voice, events);
      }

      if (!touchedVoices.has(voice)) {
        events.push(...beforeMarkers.map((marker) => ({ kind: "marker", marker } as const)));
        touchedVoices.add(voice);
      }

      const pitchEl = noteEl.querySelector(":scope > pitch");
      let note: Note | null = null;
      if (pitchEl) {
        const result = readPitch(pitchEl);
        if ("error" in result) return result;
        note = result.note;
      } else if (!noteEl.querySelector(":scope > rest")) {
        return { error: "A <note> has neither <pitch> nor <rest>" };
      }

      const tieStart = Array.from(noteEl.querySelectorAll(":scope > tie")).some((tie) => tie.getAttribute("type") === "start");
      const tieStop = Array.from(noteEl.querySelectorAll(":scope > tie")).some((tie) => tie.getAttribute("type") === "stop");

      events.push({ kind: "note", data: { note, units, tieStart, tieStop } });
    }

    for (const voice of touchedVoices) {
      voices.get(voice)!.push(...afterMarkers.map((marker) => ({ kind: "marker", marker } as const)));
    }
  }

  return { voices, keySignature };
}

/** Parses a `.mxl` (or plain `.xml`/`.musicxml`) file buffer into per-part/voice note sequences. */
export function parseMusicXmlFile(buffer: ArrayBuffer): ParsedMusicXml | MusicXmlParseError {
  const source = extractMusicXmlSource(buffer);
  if ("error" in source) return source;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(source.xml, "application/xml");
    if (doc.querySelector("parsererror")) return { error: "The file does not contain valid XML" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse MusicXML" };
  }

  const partNames = new Map<string, string | null>();
  for (const scorePartEl of Array.from(doc.querySelectorAll("part-list > score-part"))) {
    const id = scorePartEl.getAttribute("id");
    if (id) partNames.set(id, textOf(scorePartEl, "part-name"));
  }

  const partEls = Array.from(doc.querySelectorAll("score-partwise > part"));
  if (partEls.length === 0) return { error: "No <part> elements found (only score-partwise MusicXML is supported)" };

  const voices: MusicXmlVoice[] = [];
  let keySignature: KeySignature = {};
  let foundKeySignature = false;

  for (const [partIndex, partEl] of partEls.entries()) {
    const partId = partEl.getAttribute("id") ?? `P${partIndex + 1}`;
    const partName = partNames.get(partId) ?? null;
    const result = parsePart(partEl);
    if ("error" in result) return result;

    if (!foundKeySignature && result.keySignature) {
      keySignature = result.keySignature;
      foundKeySignature = true;
    }

    for (const [voice, events] of result.voices) {
      if (events.length === 0) continue;
      voices.push({
        partId,
        partName,
        voice,
        label: `${partName ?? `Part ${partIndex + 1}`} – Voice ${voice}`,
        events,
      });
    }
  }

  if (voices.length === 0) return { error: "No notes found in this file" };

  return { voices, keySignature };
}
