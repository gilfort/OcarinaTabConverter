import type { Chamber, FingeringChartEntry, OcarinaType } from "./types";

function entry(
  pitchClass: FingeringChartEntry["note"]["pitchClass"],
  accidental: "sharp" | null,
  octave: number,
  chamber: Chamber,
): FingeringChartEntry {
  const suffix = accidental === "sharp" ? "_sharp" : "";
  const label = accidental === "sharp" ? `${pitchClass}${octave}#` : `${pitchClass}${octave}`;
  return {
    note: { pitchClass, accidental, octave },
    image: `/tabs/double_${pitchClass}${octave}${suffix}.png`,
    label,
    chamber,
  };
}

/**
 * Fingering chart for the double ocarina, covering the full chromatic
 * range A3-C6 across two chambers.
 *
 * NOTE: the left/right chamber split below (A3-A#4 on the left chamber,
 * B4-C6 on the right chamber) is a placeholder default and needs HITL
 * review/confirmation against a real double ocarina fingering chart
 * before this is considered final (see issue #5).
 */
export const chartDouble: FingeringChartEntry[] = [
  entry("A", null, 3, "left"),
  entry("A", "sharp", 3, "left"),
  entry("B", null, 3, "left"),
  entry("C", null, 4, "left"),
  entry("C", "sharp", 4, "left"),
  entry("D", null, 4, "left"),
  entry("D", "sharp", 4, "left"),
  entry("E", null, 4, "left"),
  entry("F", null, 4, "left"),
  entry("F", "sharp", 4, "left"),
  entry("G", null, 4, "left"),
  entry("G", "sharp", 4, "left"),
  entry("A", null, 4, "left"),
  entry("A", "sharp", 4, "left"),
  entry("B", null, 4, "right"),
  entry("C", null, 5, "right"),
  entry("C", "sharp", 5, "right"),
  entry("D", null, 5, "right"),
  entry("D", "sharp", 5, "right"),
  entry("E", null, 5, "right"),
  entry("F", null, 5, "right"),
  entry("F", "sharp", 5, "right"),
  entry("G", null, 5, "right"),
  entry("G", "sharp", 5, "right"),
  entry("A", null, 5, "right"),
  entry("A", "sharp", 5, "right"),
  entry("B", null, 5, "right"),
  entry("C", null, 6, "right"),
];

export const ocarinaTypeDouble: OcarinaType = {
  id: "double",
  displayName: "Double Ocarina",
  range: {
    min: { pitchClass: "A", accidental: null, octave: 3 },
    max: { pitchClass: "C", accidental: null, octave: 6 },
  },
  chamberCount: 2,
};
