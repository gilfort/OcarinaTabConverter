import { supportedOcarinaTypes } from "../fingering/lookup";
import type { OcarinaTypeId } from "../fingering/types";
import { NOTE_LENGTHS, type NoteLengthOverride } from "../notes/length";

const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  title: string;
  ocarinaType: OcarinaTypeId;
  notes: string;
  lengthOverrides: NoteLengthOverride[];
}

export interface SaveParseError {
  error: string;
}

export function isSaveParseError(value: SaveData | SaveParseError): value is SaveParseError {
  return "error" in value;
}

/** Serializes a piece's data to a JSON text file. */
export function serializeSaveData(data: Omit<SaveData, "version">): string {
  const save: SaveData = { version: SAVE_VERSION, ...data };
  return JSON.stringify(save, null, 2);
}

function isValidLengthOverride(value: unknown): value is NoteLengthOverride {
  return value === "default" || (NOTE_LENGTHS as readonly string[]).includes(value as string);
}

/** Parses a saved piece's JSON text, validating its shape before use. */
export function parseSaveData(text: string): SaveData | SaveParseError {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "File is not valid JSON." };
  }

  if (typeof json !== "object" || json === null) {
    return { error: "File does not contain a saved piece." };
  }

  const data = json as Record<string, unknown>;

  if (typeof data.title !== "string") {
    return { error: "File is missing a title." };
  }

  if (
    typeof data.ocarinaType !== "string" ||
    !supportedOcarinaTypes.some((type) => type.id === data.ocarinaType)
  ) {
    return { error: "File has an unrecognized ocarina type." };
  }

  if (typeof data.notes !== "string") {
    return { error: "File is missing note data." };
  }

  if (!Array.isArray(data.lengthOverrides) || !data.lengthOverrides.every(isValidLengthOverride)) {
    return { error: "File has invalid note length data." };
  }

  return {
    version: SAVE_VERSION,
    title: data.title,
    ocarinaType: data.ocarinaType as OcarinaTypeId,
    notes: data.notes,
    lengthOverrides: data.lengthOverrides as NoteLengthOverride[],
  };
}

/** Triggers a browser download of the given text content as a file. */
export function downloadSaveFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
