import "./style.css";
import { formatNormalizedNote } from "./fingering/normalize";
import { lookupFingering, supportedOcarinaTypes } from "./fingering/lookup";
import type { OcarinaTypeId } from "./fingering/types";
import type { ExportFormat } from "./export/exporter";
import { shiftNoteIntoRange } from "./export/octaveShift";
import { parseNotes } from "./notes/parser";
import type { Note } from "./notes/types";
import { buildTabItems, renderTab, type TabItem } from "./ui/render";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>Ocarina Tab Converter</h1>
  <div id="supported-types">
    <span class="supported-types__label">Supported ocarinas:</span>
    ${supportedOcarinaTypes
      .map(
        (type) =>
          `<span class="supported-types__item">${type.displayName} (${formatNormalizedNote(
            type.range.min
          )}–${formatNormalizedNote(type.range.max)})</span>`
      )
      .join("")}
  </div>
  <label for="ocarina-type">Ocarina type</label>
  <select id="ocarina-type">
    ${supportedOcarinaTypes
      .map((type) => `<option value="${type.id}">${type.displayName}</option>`)
      .join("")}
  </select>
  <div id="note-input-row">
    <input id="note-input" type="text" placeholder="e.g. C4 D4 E4" autocomplete="off" />
    <button id="clear-button" type="button">Clear</button>
  </div>
  <div id="tab-output" class="tab-output"></div>
  <div id="export-row">
    <label for="export-format">Export as</label>
    <select id="export-format">
      <option value="pdf">PDF</option>
      <option value="png">Image (PNG)</option>
    </select>
    <button id="export-button" type="button" disabled>Export</button>
  </div>
  <div id="export-capture" class="tab-output" aria-hidden="true"></div>
  <dialog id="export-warning-dialog">
    <p>
      Your tab includes notes marked as out of range for this ocarina. Choose how to handle them
      before exporting.
    </p>
    <div class="export-warning__actions">
      <button id="export-shift-button" type="button">Shift by an octave</button>
      <button id="export-strip-button" type="button">Remove from export</button>
      <button id="export-cancel-button" type="button">Cancel</button>
    </div>
  </dialog>
`;

const typeSelect = app.querySelector<HTMLSelectElement>("#ocarina-type")!;
const input = app.querySelector<HTMLInputElement>("#note-input")!;
const output = app.querySelector<HTMLDivElement>("#tab-output")!;
const clearButton = app.querySelector<HTMLButtonElement>("#clear-button")!;
const exportFormatSelect = app.querySelector<HTMLSelectElement>("#export-format")!;
const exportButton = app.querySelector<HTMLButtonElement>("#export-button")!;
const exportCapture = app.querySelector<HTMLDivElement>("#export-capture")!;
const exportWarningDialog = app.querySelector<HTMLDialogElement>("#export-warning-dialog")!;
const exportShiftButton = app.querySelector<HTMLButtonElement>("#export-shift-button")!;
const exportStripButton = app.querySelector<HTMLButtonElement>("#export-strip-button")!;
const exportCancelButton = app.querySelector<HTMLButtonElement>("#export-cancel-button")!;

const VALIDATION_DEBOUNCE_MS = 200;
const OCARINA_TYPE_STORAGE_KEY = "ocarinaType";

const storedOcarinaType = localStorage.getItem(OCARINA_TYPE_STORAGE_KEY);
if (storedOcarinaType && supportedOcarinaTypes.some((type) => type.id === storedOcarinaType)) {
  typeSelect.value = storedOcarinaType;
}

let currentItems: TabItem[] = [];

function update(): void {
  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  const { tokens } = parseNotes(input.value);
  currentItems = buildTabItems(tokens, ocarinaTypeId);
  renderTab(output, currentItems);
  exportButton.disabled = !currentItems.some((item) => item.result?.status === "found");
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(update, VALIDATION_DEBOUNCE_MS);
});
typeSelect.addEventListener("change", () => {
  localStorage.setItem(OCARINA_TYPE_STORAGE_KEY, typeSelect.value);
  update();
});
clearButton.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  input.value = "";
  update();
  input.focus();
});

/** Formats a note back to its text form, e.g. "A3" or "C#5", for display after an octave shift. */
function formatNote(note: Note): string {
  const accidental = note.accidental === "sharp" ? "#" : note.accidental === "flat" ? "b" : "";
  return `${note.pitchClass}${accidental}${note.octave}`;
}

/** Asks the user how to handle out-of-range notes before exporting, via the warning dialog. */
function askOutOfRangeChoice(): Promise<"shift" | "strip" | "cancel"> {
  return new Promise((resolve) => {
    const cleanup = () => {
      exportShiftButton.removeEventListener("click", onShift);
      exportStripButton.removeEventListener("click", onStrip);
      exportWarningDialog.removeEventListener("close", onClose);
    };
    const onShift = () => {
      cleanup();
      exportWarningDialog.close();
      resolve("shift");
    };
    const onStrip = () => {
      cleanup();
      exportWarningDialog.close();
      resolve("strip");
    };
    const onClose = () => {
      cleanup();
      resolve("cancel");
    };

    exportShiftButton.addEventListener("click", onShift);
    exportStripButton.addEventListener("click", onStrip);
    exportWarningDialog.addEventListener("close", onClose);
    exportWarningDialog.showModal();
  });
}

exportCancelButton.addEventListener("click", () => {
  exportWarningDialog.close();
});

/** Resolves out-of-range items per the user's choice, shifting them an octave or dropping them. */
function resolveOutOfRangeItems(items: TabItem[], choice: "shift" | "strip", ocarinaTypeId: OcarinaTypeId): TabItem[] {
  return items.flatMap((item) => {
    if (item.result?.status !== "out-of-range") {
      return [item];
    }
    if (choice === "strip") {
      return [];
    }

    const shifted = item.token.note ? shiftNoteIntoRange(item.token.note, ocarinaTypeId) : null;
    if (!shifted) {
      return [];
    }

    return [
      {
        token: { ...item.token, note: shifted, raw: formatNote(shifted) },
        result: lookupFingering(shifted, ocarinaTypeId),
      },
    ];
  });
}

exportButton.addEventListener("click", async () => {
  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  let exportItems = currentItems;

  if (currentItems.some((item) => item.result?.status === "out-of-range")) {
    const choice = await askOutOfRangeChoice();
    if (choice === "cancel") {
      return;
    }
    exportItems = resolveOutOfRangeItems(currentItems, choice, ocarinaTypeId);
  }

  exportButton.disabled = true;
  try {
    const { exportElement } = await import("./export/exporter");
    exportCapture.style.width = `${output.offsetWidth}px`;
    renderTab(exportCapture, exportItems);
    await exportElement(exportCapture, exportFormatSelect.value as ExportFormat, "ocarina-tab");
  } finally {
    exportCapture.innerHTML = "";
    exportButton.disabled = !currentItems.some((item) => item.result?.status === "found");
  }
});

update();
