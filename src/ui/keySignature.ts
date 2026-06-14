import type { Accidental, KeySignature, PitchClass } from "../notes/types";

/** Pitch classes in the order shown in the key signature picker. */
export const KEY_SIGNATURE_PITCH_CLASSES: readonly PitchClass[] = ["C", "D", "E", "F", "G", "A", "B"];

export interface KeySignaturePickerOptions {
  /** Called when a letter's accidental is changed by clicking it. `null` means natural (no accidental). */
  onToggle: (pitchClass: PitchClass, accidental: Accidental | null) => void;
}

/** Cycles a pitch class's accidental: natural -> sharp -> flat -> natural. */
export function nextAccidental(current: Accidental | null): Accidental | null {
  if (current === null) return "sharp";
  if (current === "sharp") return "flat";
  return null;
}

/**
 * Renders a row of clickable letter buttons (C-B) for setting a piece's key signature.
 * Each button shows its current accidental (♮/♯/♭) and cycles through natural -> sharp ->
 * flat on click, applying that accidental to every note with that letter and no explicit
 * "#"/"b"/"n" in the note input.
 */
export function renderKeySignaturePicker(
  container: HTMLElement,
  keySignature: KeySignature,
  options: KeySignaturePickerOptions
): void {
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "key-signature-picker__list";

  for (const pitchClass of KEY_SIGNATURE_PITCH_CLASSES) {
    const current = keySignature[pitchClass] ?? null;
    const symbol = current === "sharp" ? "♯" : current === "flat" ? "♭" : "♮";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "key-signature-picker__note";
    const stateLabel = current === "sharp" ? "sharp" : current === "flat" ? "flat" : "natural";
    button.setAttribute("aria-label", `${pitchClass} is ${stateLabel}. Click to change.`);

    const accidentalEl = document.createElement("span");
    accidentalEl.className = "key-signature-picker__accidental";
    accidentalEl.textContent = symbol;

    const letterEl = document.createElement("span");
    letterEl.className = "key-signature-picker__letter";
    letterEl.textContent = pitchClass;

    button.append(accidentalEl, letterEl);
    button.addEventListener("click", () => {
      options.onToggle(pitchClass, nextAccidental(current));
    });

    list.appendChild(button);
  }

  container.appendChild(list);
}

/** Builds a short summary of a key signature, e.g. "♯ F C, ♭ B", or "" if empty. */
export function formatKeySignatureSummary(keySignature: KeySignature): string {
  const sharps = KEY_SIGNATURE_PITCH_CLASSES.filter((pc) => keySignature[pc] === "sharp");
  const flats = KEY_SIGNATURE_PITCH_CLASSES.filter((pc) => keySignature[pc] === "flat");

  const parts: string[] = [];
  if (sharps.length > 0) parts.push(`♯ ${sharps.join(" ")}`);
  if (flats.length > 0) parts.push(`♭ ${flats.join(" ")}`);
  return parts.join(", ");
}
