import type { FingeringChartEntry, OcarinaType } from "./types";

function entry(pitchClass: FingeringChartEntry["note"]["pitchClass"], accidental: "sharp" | null, octave: number): FingeringChartEntry {
  const suffix = accidental === "sharp" ? "_sharp" : "";
  const label = accidental === "sharp" ? `${pitchClass}${octave}#` : `${pitchClass}${octave}`;
  return {
    note: { pitchClass, accidental, octave },
    image: `/tabs/12hole_${pitchClass}${octave}${suffix}.png`,
    label,
  };
}

/**
 * Fingering chart for the 12-hole ocarina, covering the full chromatic
 * range A3-F5 (filename octave; sounds one octave higher, A4-F6).
 */
export const chart12Hole: FingeringChartEntry[] = [
  entry("A", null, 3),
  entry("A", "sharp", 3),
  entry("B", null, 3),
  entry("C", null, 4),
  entry("C", "sharp", 4),
  entry("D", null, 4),
  entry("D", "sharp", 4),
  entry("E", null, 4),
  entry("F", null, 4),
  entry("F", "sharp", 4),
  entry("G", null, 4),
  entry("G", "sharp", 4),
  entry("A", null, 4),
  entry("A", "sharp", 4),
  entry("B", null, 4),
  entry("C", null, 5),
  entry("C", "sharp", 5),
  entry("D", null, 5),
  entry("D", "sharp", 5),
  entry("E", null, 5),
  entry("F", null, 5),
];

export const ocarinaType12Hole: OcarinaType = {
  id: "12hole",
  displayName: "12-Hole Ocarina",
  range: {
    min: { pitchClass: "A", accidental: null, octave: 3 },
    max: { pitchClass: "F", accidental: null, octave: 5 },
  },
  chamberCount: 1,
};
