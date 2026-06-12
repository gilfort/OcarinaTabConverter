import "./style.css";
import { parseNotes } from "./notes/parser";
import { buildTabItems, renderTab } from "./ui/render";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <h1>Ocarina Tab Converter</h1>
  <input id="note-input" type="text" placeholder="e.g. C4" autocomplete="off" />
  <div id="tab-output"></div>
`;

const input = app.querySelector<HTMLInputElement>("#note-input")!;
const output = app.querySelector<HTMLDivElement>("#tab-output")!;

const OCARINA_TYPE = "12hole" as const;

function update(): void {
  const { tokens } = parseNotes(input.value);
  const items = buildTabItems(tokens, OCARINA_TYPE);
  renderTab(output, items);
}

input.addEventListener("input", update);
update();
