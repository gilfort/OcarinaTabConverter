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
import { expandRepeats } from "../notes/repeats";
import { REST_GLYPHS } from "../notes/restGlyphs";

export interface TabItem {
  token: ParsedToken;
  result: FingeringResult | null;
  /** "default" inherits the globally selected default note length. */
  lengthOverride: NoteLengthOverride;
  /** When true, the staff input displays this note's sharp as a flat on the position above. */
  flatDisplay?: boolean;
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

/**
 * Expands `items` (as displayed, with repeat/volta markers shown once like on a real sheet of
 * music) into the literal played sequence, for playback and MIDI export. Each duplicate copy of
 * a repeated note reuses its single displayed copy's fingering result and length override,
 * matched by the underlying token's `sourceIndex`.
 */
export function expandTabItemsForPlayback(items: TabItem[]): TabItem[] {
  const bySourceIndex = new Map<number, TabItem>();
  for (const item of items) {
    if (!bySourceIndex.has(item.token.sourceIndex)) {
      bySourceIndex.set(item.token.sourceIndex, item);
    }
  }

  return expandRepeats(items.map((item) => item.token)).map((token) => {
    const original = bySourceIndex.get(token.sourceIndex);
    return {
      token,
      result: original?.result ?? null,
      lengthOverride: original?.lengthOverride ?? "default",
      flatDisplay: original?.flatDisplay,
    };
  });
}

/** Renders a sequence of tab items (diagram + label, or error/marker) into the given container. */
export function renderTab(
  container: HTMLElement,
  items: TabItem[],
  defaultNoteLength: NoteLength,
  options: RenderTabOptions,
  title?: string
): void {
  container.innerHTML = "";

  if (title?.trim()) {
    const heading = document.createElement("h2");
    heading.className = "tab-output__title";
    heading.textContent = title.trim();
    container.appendChild(heading);
  }

  if (items.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "tab-placeholder";
    placeholder.textContent = "Enter a note name to see its fingering diagram.";
    container.appendChild(placeholder);
    return;
  }

  items.forEach((item, index) => {
    if (item.token.lineBreak) {
      container.appendChild(renderLineBreak());
      return;
    }
    if (item.token.marker && !item.token.error) {
      container.appendChild(renderMarkerCell(item));
      return;
    }
    container.appendChild(renderItem(item, index, defaultNoteLength, options));
  });

  if (items.some((item) => item.result?.status === "found")) {
    container.appendChild(renderLegend());
  }
}

/** A zero-height, full-width flex item that forces the next tab item onto a new row. */
function renderLineBreak(): HTMLElement {
  const lineBreak = document.createElement("div");
  lineBreak.className = "tab-output__line-break";
  return lineBreak;
}

const MARKER_CAPTIONS: Record<NonNullable<ParsedToken["marker"]>, string> = {
  repeatStart: "Repeat start",
  repeatEnd: "Repeat end",
  voltaOne: "1st ending",
  voltaTwo: "2nd ending",
};

/** Renders a repeat barline or volta marker as a compact, non-diagram cell. */
function renderMarkerCell(item: TabItem): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "tab-cell tab-cell--marker";

  const symbol = document.createElement("span");
  symbol.className = "tab-cell__marker-symbol";
  symbol.textContent = item.token.raw;
  cell.appendChild(symbol);

  const caption = document.createElement("p");
  caption.className = "tab-cell__label";
  caption.textContent = MARKER_CAPTIONS[item.token.marker!];
  cell.appendChild(caption);

  return cell;
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

  const eighthItem = document.createElement("div");
  eighthItem.className = "tab-legend__item";

  const eighthSymbol = document.createElement("span");
  eighthSymbol.className = "tab-legend__symbol tab-legend__symbol--eighth";

  const eighthLabel = document.createElement("span");
  eighthLabel.textContent = "Line above note: eighth note (play faster)";

  eighthItem.append(eighthSymbol, eighthLabel);
  legend.appendChild(eighthItem);

  return legend;
}

/**
 * Builds the line shown above a cell to indicate an eighth note/rest (played faster).
 * Always rendered (transparent when `active` is false) so every cell reserves the
 * same space above its diagram/rest, keeping images bottom-aligned across the row.
 */
function renderFastMarker(active: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "tab-cell__fast-marker";
  if (active) {
    marker.classList.add("tab-cell__fast-marker--active");
  }
  return marker;
}

function renderItem(
  item: TabItem,
  index: number,
  defaultNoteLength: NoteLength,
  options: RenderTabOptions
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "tab-cell";

  if (item.token.tie === "start") {
    cell.classList.add("tab-cell--tie-start");
  } else if (item.token.tie === "end") {
    cell.classList.add("tab-cell--tie-end");
  }

  if (item.token.rest) {
    const length = resolveNoteLength(item.lengthOverride, item.token.rest);
    cell.classList.add("tab-cell--rest", `tab-cell--${length}`);
    cell.appendChild(renderFastMarker(length === "eighth"));

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
    cell.appendChild(renderFastMarker(length === "eighth"));

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
