import "./style.css";
import { formatNormalizedNote } from "./fingering/normalize";
import { lookupFingering, supportedOcarinaTypes } from "./fingering/lookup";
import type { OcarinaTypeId } from "./fingering/types";
import type { ExportFormat } from "./export/exporter";
import { shiftNoteIntoRange } from "./export/octaveShift";
import { parseNotes, splitRawTokens } from "./notes/parser";
import { formatNote } from "./notes/format";
import {
  DEFAULT_OCTAVE,
  LENGTH_KEYS,
  OCTAVE_DOWN_KEYS,
  OCTAVE_UP_KEYS,
  WHITE_KEYS,
  BLACK_KEYS,
  clampOctave,
  resolveKeyNote,
} from "./ui/staffKeyboard";
import {
  DEFAULT_NOTE_LENGTH,
  NOTE_LENGTHS,
  NOTE_LENGTH_LABELS,
  type NoteLength,
  type NoteLengthOverride,
} from "./notes/length";
import { buildTabItems, expandTabItemsForPlayback, renderTab, type TabItem } from "./ui/render";
import { renderStaff } from "./ui/staff";
import { formatKeySignatureSummary, renderKeySignaturePicker } from "./ui/keySignature";
import type { Accidental, KeySignature, Note, PitchClass } from "./notes/types";
import { isMidiParseError, parseMidiFile } from "./midi/parser";
import { computeGlobalMinMidiPitch, convertTrackToTokens } from "./midi/convert";
import type { MidiTrack } from "./midi/types";
import { parseMusicXmlFile } from "./musicxml/parser";
import { convertVoiceToTokens } from "./musicxml/convert";
import { isMusicXmlParseError, type MusicXmlVoice } from "./musicxml/types";
import { buildPlaybackSchedule } from "./audio/schedule";
import { PlaybackController } from "./audio/player";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div id="top-bar" class="top-bar">
    <button id="menu-toggle" type="button" class="icon-button" aria-expanded="false" aria-controls="menu-drawer" aria-label="Open menu">☰</button>
    <h1 class="app-title"><span class="app-title__dot" aria-hidden="true">●</span>Ocarina Tab Converter</h1>
    <span id="status-pill" class="status-pill"></span>
    <div class="top-bar__actions">
      <button id="help-toggle" type="button" class="button button--ghost">Help</button>
    </div>
  </div>
  <div id="menu-overlay" class="menu-overlay" hidden></div>
  <aside id="menu-drawer" class="menu-drawer" hidden aria-label="Settings menu">
    <button id="menu-close" type="button" class="icon-button menu-close" aria-label="Close menu">×</button>

    <section class="drawer-group">
      <h2 class="drawer-group__title">Instrument</h2>
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
      <div id="key-signature-row">
        <button id="key-signature-toggle" type="button" aria-expanded="false">Key signature</button>
        <span id="key-signature-summary"></span>
      </div>
      <div id="key-signature-container" class="key-signature-picker" hidden></div>
    </section>

    <section class="drawer-group">
      <h2 class="drawer-group__title">File</h2>
      <div id="midi-import-row">
        <label for="midi-file-input">Import MIDI</label>
        <input id="midi-file-input" type="file" accept=".mid,.midi" />
        <select id="midi-track-select" hidden></select>
      </div>
      <div id="midi-drop-zone" class="drop-zone">Drop a .mid/.midi file here to import notes</div>
      <p id="midi-error" class="error-text" hidden></p>
      <div id="musicxml-import-row">
        <label for="musicxml-file-input">Import MusicXML</label>
        <input id="musicxml-file-input" type="file" accept=".mxl,.musicxml,.xml" />
        <select id="musicxml-voice-select" hidden></select>
      </div>
      <div id="musicxml-drop-zone" class="drop-zone">Drop a .mxl/.musicxml file here to import notes</div>
      <p id="musicxml-error" class="error-text" hidden></p>
      <div id="save-load-row">
        <button id="save-button" type="button">Save</button>
        <label for="load-file-input" id="load-button" class="button-label">Load</label>
        <input id="load-file-input" type="file" accept=".txt" hidden />
      </div>
      <div id="load-drop-zone" class="drop-zone">Drop a saved .txt file here to load</div>
      <p id="load-error" class="error-text" hidden></p>
      <div id="export-row">
        <label for="export-format">Export as</label>
        <select id="export-format">
          <option value="pdf">PDF</option>
          <option value="png">Image (PNG)</option>
          <option value="midi">MIDI</option>
        </select>
        <button id="export-button" type="button" class="button button--primary" disabled>Export</button>
      </div>
    </section>
  </aside>

  <main id="main-canvas">
    <div id="title-input-row">
      <label for="title-input">Title</label>
      <input id="title-input" type="text" placeholder="Untitled" autocomplete="off" />
    </div>

    <div id="main-toolbar" class="main-toolbar">
      <div id="input-mode-toggle" class="segmented" role="group" aria-label="Input mode">
        <button id="text-mode-button" type="button" class="segmented__option" aria-pressed="true">Text</button>
        <button id="staff-toggle" type="button" class="segmented__option" aria-pressed="false" aria-expanded="false">Staff</button>
      </div>
      <span id="input-mode-hint" class="toolbar-hint">Type note names like <code>C4</code>, or switch to Staff for piano-style input.</span>
      <div id="playback-row">
        <button id="play-button" type="button" disabled>▶ Play</button>
        <button id="pause-button" type="button" disabled>⏸ Pause</button>
        <button id="stop-button" type="button" disabled>⏹ Stop</button>
      </div>
    </div>

    <div id="note-input-card" class="note-input-card">
      <div id="note-input-row">
        <input id="note-input" type="text" placeholder="e.g. C4 D4 R4 E4" autocomplete="off" />
        <button id="clear-button" type="button">Clear</button>
      </div>
      <div id="note-hint-chips" class="hint-chips">
        <button type="button" class="hint-chip" data-insert="C4">C4</button>
        <button type="button" class="hint-chip" data-insert="D#4">D#4</button>
        <button type="button" class="hint-chip" data-insert="Eb4">Eb4</button>
        <button type="button" class="hint-chip" data-insert="R4">R4</button>
        <button type="button" class="hint-chip" data-insert="|">|</button>
        <button type="button" class="hint-chip" data-insert="|: :|">|: :|</button>
      </div>
      <div id="staff-input-container" class="staff-input" hidden>
        <div id="staff-toolbar">
          <button id="staff-new-line-button" type="button">New line</button>
          <button id="staff-keys-toggle" type="button" aria-expanded="false">⌨ Keys</button>
          <span class="toolbar-hint">Shift = sharp, Ctrl/Cmd = flat, A–K = piano keys</span>
        </div>
        <div id="staff-keyboard-legend" hidden></div>
        <div id="staff-svg-container" tabindex="0"></div>
      </div>
    </div>

    <div id="tab-output" class="tab-output"></div>
    <div id="export-capture" class="tab-output" aria-hidden="true"></div>
  </main>

  <dialog id="help-modal" class="help-modal">
    <div class="help-modal__header">
      <h2>Help</h2>
      <button id="help-close-button" type="button" class="icon-button" aria-label="Close help">×</button>
    </div>
    <section class="help-modal__section">
      <h3>Note syntax</h3>
      <table class="help-table">
        <tbody>
          <tr><td><code>C4</code>, <code>D#4</code>, <code>Eb4</code></td><td>Note name + optional accidental (<code>#</code> sharp, <code>b</code> flat, <code>n</code> force natural) + octave</td></tr>
          <tr><td><code>C</code> (no octave)</td><td>Defaults to octave 4</td></tr>
          <tr><td><code>R</code>, <code>R2</code>, <code>R4</code>, <code>R8</code></td><td>Rest (whole / half / quarter / eighth)</td></tr>
          <tr><td><code>C4-D4</code></td><td>Tie/legato pair: <code>C4-C4</code> sounds as one continuous tone, <code>C4-D4</code> as two notes with no gap between them</td></tr>
          <tr><td><code>|</code></td><td>Manual line break in the rendered tab</td></tr>
          <tr><td><code>|:</code> … <code>:|</code></td><td>Repeat block</td></tr>
          <tr><td><code>[1</code> / <code>[2</code></td><td>First/second-ending (volta) markers inside a repeat</td></tr>
        </tbody>
      </table>
      <p>Separate tokens with spaces or commas — both <code>C4 D4</code> and <code>C4, D4</code> work.</p>
    </section>
    <section class="help-modal__section">
      <h3>Staff keyboard shortcuts</h3>
      <table class="help-table">
        <tbody>
          <tr><td><code>A S D F G H J K</code></td><td>Place the natural note for that column</td></tr>
          <tr><td><code>Q W E R T Z U I</code></td><td>Place the sharp directly above the matching white key</td></tr>
          <tr><td><code>Ctrl</code>/<code>Cmd</code> + white key</td><td>Place the flat instead of the natural</td></tr>
          <tr><td><code>←</code> / <code>→</code></td><td>Move the insertion cursor without placing a note</td></tr>
          <tr><td><code>Backspace</code> / <code>Delete</code></td><td>Remove the note before / at the cursor</td></tr>
          <tr><td><code>1</code>–<code>5</code></td><td>Set the length for the next note placed</td></tr>
          <tr><td><code>PageUp</code> / <code>PageDown</code></td><td>Shift the keyboard's octave up or down</td></tr>
        </tbody>
      </table>
    </section>
  </dialog>

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
const statusPill = app.querySelector<HTMLSpanElement>("#status-pill")!;
const helpToggle = app.querySelector<HTMLButtonElement>("#help-toggle")!;
const helpModal = app.querySelector<HTMLDialogElement>("#help-modal")!;
const helpCloseButton = app.querySelector<HTMLButtonElement>("#help-close-button")!;
const textModeButton = app.querySelector<HTMLButtonElement>("#text-mode-button")!;
const noteHintChips = app.querySelector<HTMLDivElement>("#note-hint-chips")!;
const typeSelect = app.querySelector<HTMLSelectElement>("#ocarina-type")!;
const defaultLengthSelect = app.querySelector<HTMLSelectElement>("#default-note-length")!;
const playButton = app.querySelector<HTMLButtonElement>("#play-button")!;
const pauseButton = app.querySelector<HTMLButtonElement>("#pause-button")!;
const stopButton = app.querySelector<HTMLButtonElement>("#stop-button")!;
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
const staffKeysToggle = app.querySelector<HTMLButtonElement>("#staff-keys-toggle")!;
const staffKeyboardLegend = app.querySelector<HTMLDivElement>("#staff-keyboard-legend")!;
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
const musicXmlFileInput = app.querySelector<HTMLInputElement>("#musicxml-file-input")!;
const musicXmlDropZone = app.querySelector<HTMLDivElement>("#musicxml-drop-zone")!;
const musicXmlVoiceSelect = app.querySelector<HTMLSelectElement>("#musicxml-voice-select")!;
const musicXmlError = app.querySelector<HTMLParagraphElement>("#musicxml-error")!;
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
const playbackController = new PlaybackController();

let staffCursorIndex = 0;
let staffOctave: number = DEFAULT_OCTAVE;
let pendingLength: NoteLengthOverride = "default";

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

/** Updates the top-bar status pill summarizing the current ocarina type and default note length. */
function updateStatusPill(): void {
  const type = supportedOcarinaTypes.find((candidate) => candidate.id === typeSelect.value);
  const lengthLabel = NOTE_LENGTH_LABELS[defaultLengthSelect.value as NoteLength];
  statusPill.textContent = type ? `${type.displayName}, ${lengthLabel}` : "";
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

helpToggle.addEventListener("click", () => {
  helpModal.showModal();
});
helpCloseButton.addEventListener("click", () => {
  helpModal.close();
});

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

/** Reflects the playback controller's current state on the Play/Pause/Stop buttons. */
function updatePlaybackButtons(): void {
  const hasPlayableContent = currentItems.some((item) => item.token.rest || item.result?.status === "found");
  const state = playbackController.state;
  playButton.disabled = state === "playing" || (state === "stopped" && !hasPlayableContent);
  pauseButton.disabled = state !== "playing";
  stopButton.disabled = state === "stopped";
}

function stopPlayback(): void {
  playbackController.stop();
  updatePlaybackButtons();
}

playButton.addEventListener("click", () => {
  if (playbackController.state === "paused") {
    playbackController.resume();
  } else {
    const schedule = buildPlaybackSchedule(expandTabItemsForPlayback(currentItems), defaultNoteLength());
    playbackController.play(schedule, updatePlaybackButtons);
  }
  updatePlaybackButtons();
});
pauseButton.addEventListener("click", () => {
  playbackController.pause();
  updatePlaybackButtons();
});
stopButton.addEventListener("click", stopPlayback);

function onLengthChange(index: number, value: NoteLengthOverride): void {
  const sourceIndex = currentItems[index].token.sourceIndex;
  currentItems.forEach((item) => {
    if (item.token.sourceIndex === sourceIndex) {
      item.lengthOverride = value;
    }
  });
  rerender();
}

function rerender(): void {
  renderTab(output, currentItems, defaultNoteLength(), { interactive: true, onLengthChange }, titleInput.value);
  if (!staffContainer.hidden) {
    renderStaff(
      staffSvgContainer,
      currentItems,
      { onNoteClick: handleStaffNoteClick, cursorIndex: staffCursorIndex },
      keySignature
    );
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
      renderStaff(
        staffSvgContainer,
        currentItems,
        { onNoteClick: handleStaffNoteClick, cursorIndex: staffCursorIndex },
        keySignature
      );
    }
  }
  input.focus();
}

/** Updates the keyboard legend's text to reflect the current mapping, octave, and pending length. */
function renderStaffKeyboardLegend(): void {
  staffKeyboardLegend.innerHTML = `
    <div>black (sharp): ${BLACK_KEYS.join("  ")}</div>
    <div>white (nat.) : ${WHITE_KEYS.join("  ")}</div>
    <div>Octave: ${staffOctave} (PageUp/PageDown to shift)</div>
    <div>Length: ${lengthLabelFor(pendingLength)} (keys 1-5)</div>
  `;
}

function lengthLabelFor(value: NoteLengthOverride): string {
  if (value === "default") return "Default";
  return NOTE_LENGTH_LABELS[value];
}

/** Removes the raw token at `tokenIndex`, rejoins, and re-parses. */
function removeTokenAt(tokenIndex: number): void {
  const rawTokens = splitRawTokens(input.value);
  rawTokens.splice(tokenIndex, 1);
  input.value = rawTokens.join(" ");
  update();
}

/** Inserts `raw` as a new token at `tokenIndex`, rejoins, and re-parses. Returns the inserted item's index. */
function insertTokenAt(tokenIndex: number, raw: string): void {
  const rawTokens = splitRawTokens(input.value);
  rawTokens.splice(tokenIndex, 0, raw);
  input.value = rawTokens.join(" ");
  update();
}

/** Handles keyboard input while the staff SVG container is focused: note keys, length/octave keys, cursor movement. */
function handleStaffKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowLeft") {
    staffCursorIndex = Math.max(0, staffCursorIndex - 1);
    rerender();
    event.preventDefault();
    return;
  }
  if (event.key === "ArrowRight") {
    staffCursorIndex = Math.min(currentItems.length, staffCursorIndex + 1);
    rerender();
    event.preventDefault();
    return;
  }
  if (event.key === "Backspace") {
    if (staffCursorIndex > 0) {
      removeTokenAt(staffCursorIndex - 1);
      staffCursorIndex -= 1;
      rerender();
      staffSvgContainer.focus();
    }
    event.preventDefault();
    return;
  }
  if (event.key === "Delete") {
    if (staffCursorIndex < currentItems.length) {
      removeTokenAt(staffCursorIndex);
      rerender();
      staffSvgContainer.focus();
    }
    event.preventDefault();
    return;
  }
  if (OCTAVE_UP_KEYS.includes(event.key)) {
    staffOctave = clampOctave(staffOctave + 1);
    renderStaffKeyboardLegend();
    event.preventDefault();
    return;
  }
  if (OCTAVE_DOWN_KEYS.includes(event.key)) {
    staffOctave = clampOctave(staffOctave - 1);
    renderStaffKeyboardLegend();
    event.preventDefault();
    return;
  }
  if (event.key in LENGTH_KEYS) {
    pendingLength = LENGTH_KEYS[event.key];
    renderStaffKeyboardLegend();
    event.preventDefault();
    return;
  }

  const note = resolveKeyNote(event.key, staffOctave, { ctrlKey: event.ctrlKey, metaKey: event.metaKey });
  if (note) {
    const insertedIndex = staffCursorIndex;
    insertTokenAt(insertedIndex, formatNote(note));
    if (currentItems[insertedIndex] && pendingLength !== "default") {
      currentItems[insertedIndex].lengthOverride = pendingLength;
    }
    staffCursorIndex = insertedIndex + 1;
    rerender();
    staffSvgContainer.focus();
    event.preventDefault();
  }
}

/** Inserts `text` as a new token at the note input's cursor position, padding with spaces as needed. */
function insertTextAtCursor(text: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const spaceBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const spaceAfter = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const insertion = `${spaceBefore}${text}${spaceAfter}`;
  input.value = `${before}${insertion}${after}`;
  const cursor = start + insertion.length;
  input.setSelectionRange(cursor, cursor);
  update();
  input.focus();
}

function update(): void {
  stopPlayback();
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
  staffCursorIndex = Math.min(staffCursorIndex, currentItems.length);
  rerender();
  exportButton.disabled = !currentItems.some((item) => item.result?.status === "found");
  updatePlaybackButtons();
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(update, VALIDATION_DEBOUNCE_MS);
});
typeSelect.addEventListener("change", () => {
  localStorage.setItem(OCARINA_TYPE_STORAGE_KEY, typeSelect.value);
  update();
  updateStatusPill();
});
defaultLengthSelect.addEventListener("change", () => {
  localStorage.setItem(DEFAULT_NOTE_LENGTH_STORAGE_KEY, defaultLengthSelect.value);
  rerender();
  updateStatusPill();
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
  staffToggle.setAttribute("aria-pressed", String(!expanded));
  textModeButton.setAttribute("aria-pressed", String(expanded));
  if (!expanded) {
    staffCursorIndex = currentItems.length;
    renderStaff(
      staffSvgContainer,
      currentItems,
      { onNoteClick: handleStaffNoteClick, cursorIndex: staffCursorIndex },
      keySignature
    );
  }
});
textModeButton.addEventListener("click", () => {
  staffContainer.hidden = true;
  staffToggle.setAttribute("aria-expanded", "false");
  staffToggle.setAttribute("aria-pressed", "false");
  textModeButton.setAttribute("aria-pressed", "true");
  input.focus();
});
staffNewLineButton.addEventListener("click", () => insertTextAtCursor("|"));
noteHintChips.addEventListener("click", (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLButtonElement>(".hint-chip");
  if (chip?.dataset.insert) {
    insertTextAtCursor(chip.dataset.insert);
  }
});
staffKeysToggle.addEventListener("click", () => {
  const expanded = staffKeysToggle.getAttribute("aria-expanded") === "true";
  staffKeyboardLegend.hidden = expanded;
  staffKeysToggle.setAttribute("aria-expanded", String(!expanded));
  if (!expanded) {
    renderStaffKeyboardLegend();
  }
});
staffSvgContainer.addEventListener("keydown", handleStaffKeydown);

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
    const { buildExportFilename } = await import("./export/filename");
    const filename = buildExportFilename(titleInput.value, ocarinaTypeId);

    if (exportFormatSelect.value === "midi") {
      const { buildMidiFile, downloadMidiFile } = await import("./midi/export");
      downloadMidiFile(`${filename}.mid`, buildMidiFile(expandTabItemsForPlayback(exportItems), defaultNoteLength()));
    } else {
      const { exportElement } = await import("./export/exporter");
      exportCapture.style.width = `${output.offsetWidth}px`;
      renderTab(exportCapture, exportItems, defaultNoteLength(), { interactive: false }, titleInput.value);
      await exportElement(exportCapture, exportFormatSelect.value as ExportFormat, filename);
    }
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
  midiDropZone.classList.add("drop-zone--active");
});
midiDropZone.addEventListener("dragleave", () => {
  midiDropZone.classList.remove("drop-zone--active");
});
midiDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  midiDropZone.classList.remove("drop-zone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void handleMidiFile(file);
  }
});

let musicXmlVoices: MusicXmlVoice[] = [];

function showMusicXmlError(message: string): void {
  musicXmlError.textContent = message;
  musicXmlError.hidden = false;
}

function clearMusicXmlState(): void {
  musicXmlError.hidden = true;
  musicXmlVoiceSelect.hidden = true;
  musicXmlVoiceSelect.innerHTML = "";
  musicXmlVoices = [];
}

/** Populates the note input from a MusicXML voice, applying per-note length overrides derived from its durations. */
function importMusicXmlVoice(voice: MusicXmlVoice): void {
  const tokens = convertVoiceToTokens(voice.events);
  input.value = tokens.map((token) => token.raw).join(" ");
  update();
  tokens.forEach((token, index) => {
    if (currentItems[index]) {
      currentItems[index].lengthOverride = token.lengthOverride;
    }
  });
  rerender();
}

async function handleMusicXmlFile(file: File): Promise<void> {
  clearMusicXmlState();

  const buffer = await file.arrayBuffer();
  const result = parseMusicXmlFile(buffer);
  if (isMusicXmlParseError(result)) {
    showMusicXmlError(result.error);
    return;
  }

  musicXmlVoices = result.voices;
  keySignature = result.keySignature;
  renderKeySignatureUI();

  if (musicXmlVoices.length > 1) {
    musicXmlVoices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = voice.label;
      musicXmlVoiceSelect.appendChild(option);
    });
    musicXmlVoiceSelect.hidden = false;
  }

  importMusicXmlVoice(musicXmlVoices[0]);
}

musicXmlFileInput.addEventListener("change", () => {
  const file = musicXmlFileInput.files?.[0];
  if (file) {
    void handleMusicXmlFile(file);
  }
});

musicXmlVoiceSelect.addEventListener("change", () => {
  const voice = musicXmlVoices[Number(musicXmlVoiceSelect.value)];
  if (voice) {
    importMusicXmlVoice(voice);
  }
});

musicXmlDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  musicXmlDropZone.classList.add("drop-zone--active");
});
musicXmlDropZone.addEventListener("dragleave", () => {
  musicXmlDropZone.classList.remove("drop-zone--active");
});
musicXmlDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  musicXmlDropZone.classList.remove("drop-zone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void handleMusicXmlFile(file);
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
  updateStatusPill();
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
  loadDropZone.classList.add("drop-zone--active");
});
loadDropZone.addEventListener("dragleave", () => {
  loadDropZone.classList.remove("drop-zone--active");
});
loadDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  loadDropZone.classList.remove("drop-zone--active");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void handleSaveFile(file);
  }
});

renderKeySignatureUI();
updateStatusPill();
update();
