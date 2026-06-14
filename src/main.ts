import "./style.css";
import { formatNormalizedNote } from "./fingering/normalize";
import { lookupFingering, supportedOcarinaTypes } from "./fingering/lookup";
import type { OcarinaTypeId } from "./fingering/types";
import type { ExportFormat } from "./export/exporter";
import { shiftNoteIntoRange } from "./export/octaveShift";
import { parseNotes } from "./notes/parser";
import { formatNote } from "./notes/format";
import {
  DEFAULT_NOTE_LENGTH,
  NOTE_LENGTHS,
  NOTE_LENGTH_LABELS,
  type NoteLength,
  type NoteLengthOverride,
} from "./notes/length";
import { buildTabItems, renderTab, type TabItem } from "./ui/render";
import { isMidiParseError, parseMidiFile } from "./midi/parser";
import { computeGlobalMinMidiPitch, convertTrackToTokens } from "./midi/convert";
import type { MidiTrack } from "./midi/types";

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
  <div id="settings-row">
    <label for="default-note-length">Default note length</label>
    <select id="default-note-length">
      ${NOTE_LENGTHS.map(
        (length) =>
          `<option value="${length}"${length === DEFAULT_NOTE_LENGTH ? " selected" : ""}>${NOTE_LENGTH_LABELS[length]}</option>`
      ).join("")}
    </select>
  </div>
  <div id="midi-import-row">
    <label for="midi-file-input">Import MIDI</label>
    <input id="midi-file-input" type="file" accept=".mid,.midi" />
    <select id="midi-track-select" hidden></select>
  </div>
  <div id="midi-drop-zone" class="midi-drop-zone">Drop a .mid/.midi file here to import notes</div>
  <p id="midi-error" class="midi-error" hidden></p>
  <div id="note-input-row">
    <input id="note-input" type="text" placeholder="e.g. C4 D4 R4 E4" autocomplete="off" />
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
const defaultLengthSelect = app.querySelector<HTMLSelectElement>("#default-note-length")!;
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
const midiFileInput = app.querySelector<HTMLInputElement>("#midi-file-input")!;
const midiDropZone = app.querySelector<HTMLDivElement>("#midi-drop-zone")!;
const midiTrackSelect = app.querySelector<HTMLSelectElement>("#midi-track-select")!;
const midiError = app.querySelector<HTMLParagraphElement>("#midi-error")!;

const VALIDATION_DEBOUNCE_MS = 200;
const OCARINA_TYPE_STORAGE_KEY = "ocarinaType";
const DEFAULT_NOTE_LENGTH_STORAGE_KEY = "defaultNoteLength";

const storedOcarinaType = localStorage.getItem(OCARINA_TYPE_STORAGE_KEY);
if (storedOcarinaType && supportedOcarinaTypes.some((type) => type.id === storedOcarinaType)) {
  typeSelect.value = storedOcarinaType;
}

const storedDefaultNoteLength = localStorage.getItem(DEFAULT_NOTE_LENGTH_STORAGE_KEY);
if (storedDefaultNoteLength && (NOTE_LENGTHS as readonly string[]).includes(storedDefaultNoteLength)) {
  defaultLengthSelect.value = storedDefaultNoteLength;
}

let currentItems: TabItem[] = [];

function defaultNoteLength(): NoteLength {
  return defaultLengthSelect.value as NoteLength;
}

function onLengthChange(index: number, value: NoteLengthOverride): void {
  currentItems[index].lengthOverride = value;
  rerender();
}

function rerender(): void {
  renderTab(output, currentItems, defaultNoteLength(), { interactive: true, onLengthChange });
}

function update(): void {
  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  const { tokens } = parseNotes(input.value);
  const previousOverrides = currentItems.map((item) => item.lengthOverride);
  currentItems = buildTabItems(tokens, ocarinaTypeId);
  currentItems.forEach((item, index) => {
    if (previousOverrides[index] !== undefined) {
      item.lengthOverride = previousOverrides[index];
    }
  });
  rerender();
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
defaultLengthSelect.addEventListener("change", () => {
  localStorage.setItem(DEFAULT_NOTE_LENGTH_STORAGE_KEY, defaultLengthSelect.value);
  rerender();
});
clearButton.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  input.value = "";
  update();
  input.focus();
});

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
        ...item,
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
    renderTab(exportCapture, exportItems, defaultNoteLength(), { interactive: false });
    await exportElement(exportCapture, exportFormatSelect.value as ExportFormat, "ocarina-tab");
  } finally {
    exportCapture.innerHTML = "";
    exportButton.disabled = !currentItems.some((item) => item.result?.status === "found");
  }
});

const globalMinMidiPitch = computeGlobalMinMidiPitch(supportedOcarinaTypes);
let midiTicksPerQuarter = 0;
let midiTracksWithNotes: MidiTrack[] = [];

function showMidiError(message: string): void {
  midiError.textContent = message;
  midiError.hidden = false;
}

function clearMidiState(): void {
  midiError.hidden = true;
  midiTrackSelect.hidden = true;
  midiTrackSelect.innerHTML = "";
  midiTracksWithNotes = [];
}

/** Populates the note input from a MIDI track, applying per-note length overrides derived from its durations. */
function importMidiTrack(track: MidiTrack): void {
  const tokens = convertTrackToTokens(track, midiTicksPerQuarter, globalMinMidiPitch);
  input.value = tokens.map((token) => token.raw).join(" ");
  update();
  tokens.forEach((token, index) => {
    if (currentItems[index]) {
      currentItems[index].lengthOverride = token.lengthOverride;
    }
  });
  rerender();
}

async function handleMidiFile(file: File): Promise<void> {
  clearMidiState();

  const buffer = await file.arrayBuffer();
  const result = parseMidiFile(buffer);
  if (isMidiParseError(result)) {
    showMidiError(result.error);
    return;
  }

  midiTicksPerQuarter = result.ticksPerQuarter;
  midiTracksWithNotes = result.tracks.filter((track) => track.events.length > 0);

  if (midiTracksWithNotes.length === 0) {
    showMidiError("No notes found in this MIDI file.");
    return;
  }

  if (midiTracksWithNotes.length > 1) {
    midiTracksWithNotes.forEach((track, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = track.name || `Track ${index + 1}`;
      midiTrackSelect.appendChild(option);
    });
    midiTrackSelect.hidden = false;
  }

  importMidiTrack(midiTracksWithNotes[0]);
}

midiFileInput.addEventListener("change", () => {
  const file = midiFileInput.files?.[0];
  if (file) {
    void handleMidiFile(file);
  }
});

midiTrackSelect.addEventListener("change", () => {
  const track = midiTracksWithNotes[Number(midiTrackSelect.value)];
  if (track) {
    importMidiTrack(track);
  }
});

midiDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  midiDropZone.classList.add("midi-drop-zone--active");
});
midiDropZone.addEventListener("dragleave", () => {
  midiDropZone.classList.remove("midi-drop-zone--active");
});
midiDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  midiDropZone.classList.remove("midi-drop-zone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void handleMidiFile(file);
  }
});

update();
