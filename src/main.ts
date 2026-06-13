import "./style.css";
import { formatNormalizedNote } from "./fingering/normalize";
import { supportedOcarinaTypes } from "./fingering/lookup";
import type { OcarinaTypeId } from "./fingering/types";
import { parseNotes } from "./notes/parser";
import { buildTabItems, renderTab } from "./ui/render";

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
  <div id="tab-output"></div>
`;

const typeSelect = app.querySelector<HTMLSelectElement>("#ocarina-type")!;
const input = app.querySelector<HTMLInputElement>("#note-input")!;
const output = app.querySelector<HTMLDivElement>("#tab-output")!;
const clearButton = app.querySelector<HTMLButtonElement>("#clear-button")!;

const VALIDATION_DEBOUNCE_MS = 200;
const OCARINA_TYPE_STORAGE_KEY = "ocarinaType";

const storedOcarinaType = localStorage.getItem(OCARINA_TYPE_STORAGE_KEY);
if (storedOcarinaType && supportedOcarinaTypes.some((type) => type.id === storedOcarinaType)) {
  typeSelect.value = storedOcarinaType;
}

function update(): void {
  const ocarinaTypeId = typeSelect.value as OcarinaTypeId;
  const { tokens } = parseNotes(input.value);
  const items = buildTabItems(tokens, ocarinaTypeId);
  renderTab(output, items);
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
update();
