import type { Note } from "../notes/types";
import { chart12Hole, ocarinaType12Hole } from "./chart12Hole";
import { chartDouble, ocarinaTypeDouble } from "./chartDouble";
import { normalizeNote, normalizedNotesEqual, toAbsoluteSemitone } from "./normalize";
import type { FingeringChartEntry, FingeringResult, OcarinaType, OcarinaTypeId } from "./types";

interface OcarinaDefinition {
  type: OcarinaType;
  chart: FingeringChartEntry[];
}

const REGISTRY: Record<OcarinaTypeId, OcarinaDefinition | undefined> = {
  "12hole": { type: ocarinaType12Hole, chart: chart12Hole },
  double: { type: ocarinaTypeDouble, chart: chartDouble },
};

export const supportedOcarinaTypes: OcarinaType[] = Object.values(REGISTRY)
  .filter((def): def is OcarinaDefinition => def !== undefined)
  .map((def) => def.type);

/**
 * Looks up the fingering chart entry for a parsed note on the given ocarina
 * type. Normalizes enharmonic spellings before lookup, then reports whether
 * the note is found, out of the instrument's playable range, or unsupported.
 */
export function lookupFingering(note: Note, ocarinaTypeId: OcarinaTypeId): FingeringResult {
  const definition = REGISTRY[ocarinaTypeId];
  if (!definition) {
    return { status: "unsupported", note };
  }

  const normalized = normalizeNote(note);
  const absSemitone = toAbsoluteSemitone(normalized);
  const minSemitone = toAbsoluteSemitone(definition.type.range.min);
  const maxSemitone = toAbsoluteSemitone(definition.type.range.max);

  if (absSemitone < minSemitone || absSemitone > maxSemitone) {
    return { status: "out-of-range", note };
  }

  const entry = definition.chart.find((candidate) => normalizedNotesEqual(candidate.note, normalized));
  if (!entry) {
    return { status: "unsupported", note };
  }

  return { status: "found", note, entry };
}
