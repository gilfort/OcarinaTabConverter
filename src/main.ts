import "./style.css";
import { supportedOcarinaTypes } from "./fingering/lookup";
import type { OcarinaTypeId } from "./fingering/types";
import { parseNotes } from "./notes/parser";
import { buildTabItems, renderTab } from "./ui/render";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>Ocarina Tab Converter</h1>
  <label for="ocarina-type">Ocarina type</label>
  <select id="ocarina-type">
    ${supportedOcarinaTypes
      .map((type) => `<option value="${type.id}">${type.displayName}</option>`)
      .join("")}
  </select>
  <input id="note-input" type="text" placeholder="e.g. C4" autocomplete="off" />
  <div id="tab-output"></div>
`;

const typeSelect = app.querySelector<HTMLSelectElement>("#ocarina-type")!;
const input = app.querySelector<HTMLInputElement>("#note-input")!;
const output = app.querySelector<HTMLDivElement>("#tab-output")!;

const VALIDATION_DEBOUNCE_MS = 200;

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
typeSelect.addEventListener("change", update);
update();
