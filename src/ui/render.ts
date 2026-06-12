import type { ParsedToken } from "../notes/types";
import type { FingeringResult } from "../fingering/types";
import { lookupFingering } from "../fingering/lookup";
import type { OcarinaTypeId } from "../fingering/types";

export interface TabItem {
  token: ParsedToken;
  result: FingeringResult | null;
}

/** Looks up fingering results for every successfully-parsed token in a sequence. */
export function buildTabItems(tokens: ParsedToken[], ocarinaTypeId: OcarinaTypeId): TabItem[] {
  return tokens.map((token) => ({
    token,
    result: token.note ? lookupFingering(token.note, ocarinaTypeId) : null,
  }));
}

/** Renders a sequence of tab items (diagram + label, or error/marker) into the given container. */
export function renderTab(container: HTMLElement, items: TabItem[]): void {
  container.innerHTML = "";

  if (items.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "tab-placeholder";
    placeholder.textContent = "Enter a note name to see its fingering diagram.";
    container.appendChild(placeholder);
    return;
  }

  for (const item of items) {
    container.appendChild(renderItem(item));
  }
}

function renderItem(item: TabItem): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "tab-cell";

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
    const img = document.createElement("img");
    img.className = "tab-cell__image";
    img.src = result.entry.image;
    img.alt = `Fingering diagram for ${result.entry.label}`;
    cell.appendChild(img);

    const label = document.createElement("p");
    label.className = "tab-cell__label";
    label.textContent = result.entry.label;
    cell.appendChild(label);
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
