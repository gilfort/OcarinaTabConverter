import type { NoteLength } from "./length";

/**
 * Inline SVG markup for standard music-notation rest glyphs, keyed by note length.
 * Uses a 3:2 viewBox to match the aspect ratio of the fingering diagram images (480x320).
 */
export const REST_GLYPHS: Record<NoteLength, string> = {
  whole: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <line x1="9" y1="15" x2="51" y2="15" stroke="currentColor" stroke-width="2" />
    <rect x="12" y="15" width="36" height="4" fill="currentColor" />
  </svg>`,
  half: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <line x1="9" y1="21" x2="51" y2="21" stroke="currentColor" stroke-width="2" />
    <rect x="12" y="17" width="36" height="4" fill="currentColor" />
  </svg>`,
  quarter: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <path d="M36 4 L19.5 13.5 Q37.5 16.5 21 21.5 Q40.5 24.5 24 29.5 L40.5 37" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`,
  eighth: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <circle cx="40.5" cy="11" r="4" fill="currentColor" />
    <line x1="37.5" y1="12" x2="19.5" y2="30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  </svg>`,
};
