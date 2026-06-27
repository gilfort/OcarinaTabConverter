import type { KeySignature, PitchClass } from "../notes/types";

/** Order in which sharps are added as `<fifths>` increases (F C G D A E B). */
const SHARP_ORDER: readonly PitchClass[] = ["F", "C", "G", "D", "A", "E", "B"];
/** Order in which flats are added as `<fifths>` decreases (B E A D G C F). */
const FLAT_ORDER: readonly PitchClass[] = ["B", "E", "A", "D", "G", "C", "F"];

/** Converts a MusicXML `<key><fifths>` value into the app's `KeySignature` shape. */
export function fifthsToKeySignature(fifths: number): KeySignature {
  const keySignature: KeySignature = {};
  if (fifths > 0) {
    for (const pitchClass of SHARP_ORDER.slice(0, fifths)) {
      keySignature[pitchClass] = "sharp";
    }
  } else if (fifths < 0) {
    for (const pitchClass of FLAT_ORDER.slice(0, -fifths)) {
      keySignature[pitchClass] = "flat";
    }
  }
  return keySignature;
}
