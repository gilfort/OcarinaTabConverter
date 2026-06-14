import type { OcarinaTypeId } from "../fingering/types";

const FALLBACK_TITLE = "untitled";

/** Converts a title into a filename-safe slug, replacing whitespace and invalid characters with underscores. */
function slugifyTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return FALLBACK_TITLE;
  }

  return trimmed
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "_");
}

/** Formats a date as DD-MM-YYYY. */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Builds the export filename (without extension): `<songtitle>_ocarina_<type>_<DD-MM-YYYY>`. */
export function buildExportFilename(title: string, ocarinaTypeId: OcarinaTypeId, date: Date = new Date()): string {
  return `${slugifyTitle(title)}_ocarina_${ocarinaTypeId}_${formatDate(date)}`;
}
