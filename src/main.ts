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
import { renderStaff } from "./ui/staff";
import { formatKeySignatureSummary, renderKeySignaturePicker } from "./ui/keySignature";
import type { Accidental, KeySignature, Note, PitchClass } from "./notes/types";
import { isMidiParseError, parseMidiFile } from "./midi/parser";
import { computeGlobalMinMidiPitch, convertTrackToTokens } from "./midi/convert";
import type { MidiTrack } from "./midi/types";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div id="app-header">
    <button id="menu-toggle" type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-drawer" aria-label="Open menu">☰</button>
    <h1>Ocarina Tab Converter</h1>
    <span id="menu-summary" class="menu-summary"></span>
  </div>
  <div id="menu-overlay" class="menu-overlay" hidden></div>
  <aside id="menu-drawer" class="menu-drawer" hidden aria-label="Settings menu">
    <button id="menu-close" type="button" class="menu-close" aria-label="Close menu">×</button>
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
    <div id="save-load-row">
      <button id="save-button" type="button">Save</button>
      <label for="load-file-input" id="load-button" class="button-label">Load</label>
      <input id="load-file-input" type="file" accept=".txt" hidden />
    </div>
    <div id="load-drop-zone" class="midi-drop-zone">Drop a saved .txt file here to load</div>
    <p id="load-error" class="midi-error" hidden></p>
    <div id="export-row">
      <label for="export-format">Export as</label>
      <select id="export-format">
        <option value="pdf">PDF</option>
        <option value="png">Image (PNG)</option>
      </select>
      <button id="export-button" type="button" disabled>Export</button>
    </div>
  </aside>
  <div id="title-input-row">
    <label for="title-input">Title</label>
    <input id="title-input" type="text" placeholder="Untitled" autocomplete="off" />
  </div>
  <div id="key-signature-row">
    <button id="key-signature-toggle" type="button" aria-expanded="false">Key signature</button>
    <span id="key-signature-summary"></span>
  </div>
  <div id="key-signature-container" class="key-signature-picker" hidden></div>
  <div id="note-input-row">
    <input id="note-input" type="text" placeholder="e.g. C4 D4 R4 E4" autocomplete="off" />
    <button id="clear-button" type="button">Clear</button>
    <button id="staff-toggle" type="button" aria-expanded="false">Staff input</button>
  </div>
  <div id="staff-input-container" class="staff-input" hidden>
    <div id="staff-toolbar">
      <button id="staff-new-line-button" type="button">New line</button>
    </div>
    <div id="staff-svg-container"></div>
  </div>
  <div id="tab-output" class="tab-output"></div>
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

const menuToggle = app.querySelector<HTMLButtonElement>("#menu-toggle")!;
const menuClose = app.querySelector<HTMLButtonElement>("#menu-close")!;
const menuDrawer = app.querySelector<HTMLDivElement>("#menu-drawer")!;
const menuOverlay = app.querySelector<HTMLDivElement>("#menu-overlay")!;
const menuSummary = app.querySelector<HTMLSpanElement>("#menu-summary")!;
const typeSelect = app.querySelector<HTMLSelectElement>("#ocarina-type")!;
const defaultLengthSelect = app.querySelector<HTMLSelectElement>("#default-note-length")!;
const titleInput = app.querySelector<HTMLInputElement>("#title-input")!;
const keySignatureToggle = app.querySelector<HTMLButtonElement>("#key-signature-toggle")!;
const keySignatureContainer = app.querySelector<HTMLDivElement>("#key-signature-container")!;
const keySignatureSummary = app.querySelector<HTMLSpanElement>("#key-signature-summary")!;
const input = app.querySelector<HTMLInputElement>("#note-input")!;
const output = app.querySelector<HTMLDivElement>("#tab-output")!;
const clearButton = app.querySelector<HTMLButtonElement>("#clear-button")!;
const staffToggle = app.querySelector<HTMLButtonElement>("#staff-toggle")!;
const staffContainer = app.querySelector<HTMLDivElement>("#staff-input-container")!;
const staffSvgContainer = app.querySelector<HTMLDivElement>("#staff-svg-container")!;
const staffNewLineButton = app.querySelector<HTMLButtonElement>("#staff-new-line-button")!;
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
const saveButton = app.querySelector<HTMLButtonElement>("#save-button")!;
const loadFileInput = app.querySelector<HTMLInputElement>("#load-file-input")!;
const loadDropZone = app.querySelector<HTMLDivElement>("#load-drop-zone")!;
const loadError = app.querySelector<HTMLParagraphElement>("#load-error")!;

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
let keySignature: KeySignature = {};

/** Returns the visible, tabbable elements inside the drawer, for the focus trap. */
function getDrawerFocusable(): HTMLElement[] {
  return Array.from(
    menuDrawer.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden"));
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeMenu();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = getDrawerFocusable();
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openMenu(): void {
  menuDrawer.hidden = false;
  menuOverlay.hidden = false;
  menuToggle.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", onMenuKeydown);
  getDrawerFocusable()[0]?.focus();
}

function closeMenu(): void {
  if (menuDrawer.hidden) {
    return;
  }
  menuDrawer.hidden = true;
  menuOverlay.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  document.removeEventListener("keydown", onMenuKeydown);
  menuToggle.focus();
}

/** Updates the header badge summarizing the current ocarina type and default note length. */
function updateMenuSummary(): void {
  const type = supportedOcarinaTypes.find((candidate) => candidate.id === typeSelect.value);
  const lengthLabel = NOTE_LENGTH_LABELS[defaultLengthSelect.value as NoteLength];
  menuSummary.textContent = type ? `${type.displayName}, ${lengthLabel}` : "";
}

menuToggle.addEventListener("click", () => {
  if (menuDrawer.hidden) {
    openMenu();
  } else {
    closeMenu();
  }
});
menuClose.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", closeMenu);

/** Refreshes the key signature summary text and picker (if open). */
function renderKeySignatureUI(): void {
  const summary = formatKeySignatureSummary(keySignature);
  keySignatureSummary.textContent = summary;
  if (!keySignatureContainer.hidden) {
    renderKeySignaturePicker(keySignatureContainer, keySignature, { onToggle: handleKeySignatureToggle });
  }
}

/** Updates the key signature when a letter is toggled in the picker, then re-parses the notes. */
function handleKeySignatureToggle(pitchClass: PitchClass, accidental: Accidental | null): void {
  if (accidental === null) {
    delete keySignature[pitchClass];
  } else {
    keySignature[pitchClass] = accidental;
  }
  renderKeySignatureUI();
  update();
}

function defaultNoteLength(): NoteLength {
  return defaultLengthSelect.value as NoteLength;
}

function onLengthChange(index: number, value: NoteLengthOverride): void {
  currentItems[index].lengthOverride = value;
  rerender();
}

function rerender(): void {
  renderTab(output, currentItems, defaultNoteLength(), { interactive: true, onLengthChange }, titleInput.value);
  if (!staffContainer.hidden) {
    renderStaff(staffSvgContainer, currentItems, { onNoteClick: handleStaffNoteClick }, keySignature);
  }
}

/** Appends a note picked on the clickable staff to the text input and re-parses. */
function handleStaffNoteClick(note: Note, displayAsFlat: boolean): void {
  const text = formatNote(note);
  const trimmed = input.value.trim();
  input.value = trimmed.length > 0 ? `${trimmed} ${text}` : text;
  update();
  if (displayAsFlat) {
    const lastItem = currentItems[currentItems.length - 1];
    if (lastItem) {
      lastItem.flatDisplay = true;
      renderStaff(staffSvgContainer, currentItems, { onNoteClick: handleStaffNoteClick }, keySignature);
    }
  }
  input.focus();
}

/** Inserts a "|" line-break token at the note input's cursor position, padding with spaces as needed. */
function insertLineBreakAtCursor(): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const spaceBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const spaceAfter = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const insertion = `${spaceBefore}|${spaceAfter}`;
  input.value = `${before}${insertion}${after}`;
  const cursor = start + insertion.length;
  input.setSelectionRange(cursor, cursor);
  update();
  input.focus();
}

function update(): void {
  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  const { tokens } = parseNotes(input.value, keySignature);
  const previousOverrides = currentItems.map((item) => item.lengthOverride);
  const previousFlatDisplay = currentItems.map((item) => item.flatDisplay);
  currentItems = buildTabItems(tokens, ocarinaTypeId);
  currentItems.forEach((item, index) => {
    if (previousOverrides[index] !== undefined) {
      item.lengthOverride = previousOverrides[index];
    }
    if (previousFlatDisplay[index]) {
      item.flatDisplay = true;
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
  updateMenuSummary();
});
defaultLengthSelect.addEventListener("change", () => {
  localStorage.setItem(DEFAULT_NOTE_LENGTH_STORAGE_KEY, defaultLengthSelect.value);
  rerender();
  updateMenuSummary();
});
titleInput.addEventListener("input", () => {
  rerender();
});
clearButton.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  input.value = "";
  update();
  input.focus();
});
keySignatureToggle.addEventListener("click", () => {
  const expanded = keySignatureToggle.getAttribute("aria-expanded") === "true";
  keySignatureContainer.hidden = expanded;
  keySignatureToggle.setAttribute("aria-expanded", String(!expanded));
  if (!expanded) {
    renderKeySignaturePicker(keySignatureContainer, keySignature, { onToggle: handleKeySignatureToggle });
  }
});
staffToggle.addEventListener("click", () => {
  const expanded = staffToggle.getAttribute("aria-expanded") === "true";
  staffContainer.hidden = expanded;
  staffToggle.setAttribute("aria-expanded", String(!expanded));
  if (!expanded) {
    renderStaff(staffSvgContainer, currentItems, { onNoteClick: handleStaffNoteClick }, keySignature);
  }
});
staffNewLineButton.addEventListener("click", insertLineBreakAtCursor);

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
    const { buildExportFilename } = await import("./export/filename");
    exportCapture.style.width = `${output.offsetWidth}px`;
    renderTab(exportCapture, exportItems, defaultNoteLength(), { interactive: false }, titleInput.value);
    const filename = buildExportFilename(titleInput.value, ocarinaTypeId);
    await exportElement(exportCapture, exportFormatSelect.value as ExportFormat, filename);
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

function showLoadError(message: string): void {
  loadError.textContent = message;
  loadError.hidden = false;
}

function clearLoadError(): void {
  loadError.hidden = true;
}

saveButton.addEventListener("click", async () => {
  const { buildExportFilename } = await import("./export/filename");
  const { serializeSaveData, downloadSaveFile } = await import("./save/io");

  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  const content = serializeSaveData({
    title: titleInput.value,
    ocarinaType: ocarinaTypeId,
    notes: input.value,
    lengthOverrides: currentItems.map((item) => item.lengthOverride),
    keySignature,
  });
  const filename = `${buildExportFilename(titleInput.value, ocarinaTypeId)}.txt`;
  downloadSaveFile(filename, content);
  closeMenu();
});

/** Restores a saved piece's title, ocarina type, notes, and per-note length overrides into the app. */
async function handleSaveFile(file: File): Promise<void> {
  clearLoadError();

  const text = await file.text();
  const { isSaveParseError, parseSaveData } = await import("./save/io");
  const result = parseSaveData(text);
  if (isSaveParseError(result)) {
    showLoadError(result.error);
    return;
  }

  titleInput.value = result.title;
  typeSelect.value = result.ocarinaType;
  localStorage.setItem(OCARINA_TYPE_STORAGE_KEY, typeSelect.value);
  keySignature = result.keySignature;
  renderKeySignatureUI();
  input.value = result.notes;
  update();
  result.lengthOverrides.forEach((override, index) => {
    if (currentItems[index]) {
      currentItems[index].lengthOverride = override;
    }
  });
  rerender();
  updateMenuSummary();
  closeMenu();
}

loadFileInput.addEventListener("change", () => {
  const file = loadFileInput.files?.[0];
  if (file) {
    void handleSaveFile(file);
  }
  loadFileInput.value = "";
});

loadDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  loadDropZone.classList.add("midi-drop-zone--active");
});
loadDropZone.addEventListener("dragleave", () => {
  loadDropZone.classList.remove("midi-drop-zone--active");
});
loadDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  loadDropZone.classList.remove("midi-drop-zone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void handleSaveFile(file);
  }
});

renderKeySignatureUI();
updateMenuSummary();
update();
