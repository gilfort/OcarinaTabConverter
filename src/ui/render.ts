import type { ParsedToken } from "../notes/types";
import type { FingeringResult } from "../fingering/types";
import { lookupFingering } from "../fingering/lookup";
import type { OcarinaTypeId } from "../fingering/types";
import {
  NOTE_LENGTHS,
  NOTE_LENGTH_LABELS,
  NOTE_LENGTH_UNITS,
  resolveNoteLength,
  type NoteLength,
  type NoteLengthOverride,
} from "../notes/length";
import { REST_GLYPHS } from "../notes/restGlyphs";

export interface TabItem {
  token: ParsedToken;
  result: FingeringResult | null;
  /** "default" inherits the globally selected default note length. */
  lengthOverride: NoteLengthOverride;
}

export interface RenderTabOptions {
  /** When true, render per-note length selectors (omit for export captures). */
  interactive: boolean;
  onLengthChange?: (index: number, value: NoteLengthOverride) => void;
}

/** Looks up fingering results for every successfully-parsed token in a sequence. */
export function buildTabItems(tokens: ParsedToken[], ocarinaTypeId: OcarinaTypeId): TabItem[] {
  return tokens.map((token) => ({
    token,
    result: token.note ? lookupFingering(token.note, ocarinaTypeId) : null,
    lengthOverride: "default",
  }));
}

/** Renders a sequence of tab items (diagram + label, or error/marker) into the given container. */
export function renderTab(
  container: HTMLElement,
  items: TabItem[],
  defaultNoteLength: NoteLength,
  options: RenderTabOptions
): void {
  container.innerHTML = "";

  if (items.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "tab-placeholder";
    placeholder.textContent = "Enter a note name to see its fingering diagram.";
    container.appendChild(placeholder);
    return;
  }

  items.forEach((item, index) => {
    container.appendChild(renderItem(item, index, defaultNoteLength, options));
  });

  if (items.some((item) => item.result?.status === "found")) {
    container.appendChild(renderLegend());
  }
}

/** Builds the per-note length override selector shown below each found note. */
function renderLengthSelect(
  value: NoteLengthOverride,
  index: number,
  onLengthChange: RenderTabOptions["onLengthChange"]
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "tab-cell__length";
  select.setAttribute("aria-label", "Note length");

  const defaultOption = document.createElement("option");
  defaultOption.value = "default";
  defaultOption.textContent = "Default";
  select.appendChild(defaultOption);

  for (const length of NOTE_LENGTHS) {
    const option = document.createElement("option");
    option.value = length;
    option.textContent = NOTE_LENGTH_LABELS[length];
    select.appendChild(option);
  }

  select.value = value;
  select.addEventListener("change", () => {
    onLengthChange?.(index, select.value as NoteLengthOverride);
  });

  return select;
}

/** Builds the legend explaining the hole symbols used in fingering diagrams. */
function renderLegend(): HTMLElement {
  const legend = document.createElement("div");
  legend.className = "tab-legend";

  for (const [symbolClass, text] of [
    ["tab-legend__symbol--covered", "Covered hole"],
    ["tab-legend__symbol--open", "Open hole"],
  ] as const) {
    const item = document.createElement("div");
    item.className = "tab-legend__item";

    const symbol = document.createElement("span");
    symbol.className = `tab-legend__symbol ${symbolClass}`;

    const label = document.createElement("span");
    label.textContent = text;

    item.append(symbol, label);
    legend.appendChild(item);
  }

  return legend;
}

function renderItem(
  item: TabItem,
  index: number,
  defaultNoteLength: NoteLength,
  options: RenderTabOptions
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "tab-cell";

  if (item.token.rest) {
    const length = resolveNoteLength(item.lengthOverride, item.token.rest);
    cell.classList.add("tab-cell--rest", `tab-cell--${length}`);

    const visual = document.createElement("div");
    visual.className = "tab-cell__visual";

    const symbol = document.createElement("span");
    symbol.className = "tab-cell__rest";
    symbol.innerHTML = REST_GLYPHS[length];
    visual.appendChild(symbol);

    const dashCount = NOTE_LENGTH_UNITS[length] - 1;
    for (let i = 0; i < dashCount; i++) {
      const dash = document.createElement("span");
      dash.className = "tab-cell__dash";
      visual.appendChild(dash);
    }

    cell.appendChild(visual);

    const label = document.createElement("p");
    label.className = "tab-cell__label";
    label.textContent = `${NOTE_LENGTH_LABELS[length]} rest`;
    cell.appendChild(label);

    if (options.interactive) {
      cell.appendChild(renderLengthSelect(item.lengthOverride, index, options.onLengthChange));
    }

    return cell;
  }

  if (item.token.error || !item.result) {
    cell.classList.add("tab-cell--error");
    const message = document.createElement("p");
    message.className = "tab-cell__message";
    message.textContent = item.token.error ?? "Unknown note";
    cell.appendChild(message);
    return cell;
  }

  const { result } = item;

  if (result.status === "found") {
    const length = resolveNoteLength(item.lengthOverride, defaultNoteLength);
    cell.classList.add(`tab-cell--${length}`);

    const visual = document.createElement("div");
    visual.className = "tab-cell__visual";

    const img = document.createElement("img");
    img.className = "tab-cell__image";
    img.src = result.entry.image;
    img.alt = `Fingering diagram for ${result.entry.label}`;
    visual.appendChild(img);

    const dashCount = NOTE_LENGTH_UNITS[length] - 1;
    for (let i = 0; i < dashCount; i++) {
      const dash = document.createElement("span");
      dash.className = "tab-cell__dash";
      visual.appendChild(dash);
    }

    cell.appendChild(visual);

    const label = document.createElement("p");
    label.className = "tab-cell__label";
    label.textContent = result.entry.label;
    cell.appendChild(label);

    if (options.interactive) {
      cell.appendChild(renderLengthSelect(item.lengthOverride, index, options.onLengthChange));
    }

    return cell;
  }

  cell.classList.add("tab-cell--" + result.status);
  const message = document.createElement("p");
  message.className = "tab-cell__message";
  message.textContent =
    result.status === "out-of-range"
      ? `${item.token.raw} is out of range`
      : `${item.token.raw} is not supported`;
  cell.appendChild(message);
  return cell;
}
