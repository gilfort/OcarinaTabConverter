import type { ParsedToken } from "./types";

/**
 * Expands `|: ... :|` repeat barlines and `[1`/`[2` volta endings into the literal
 * played-back token sequence, keeping the original marker tokens inline at the points
 * where they occur so the tab can still show the repeat/volta symbols as written.
 * Malformed markers (unmatched, orphaned, or nested) are left in place with `.error` set.
 */
export function expandRepeats(tokens: ParsedToken[]): ParsedToken[] {
  const result: ParsedToken[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.marker === "repeatEnd" || token.marker === "voltaOne" || token.marker === "voltaTwo") {
      result.push({ ...token, error: `"${token.raw}" has no matching "|:"` });
      i++;
      continue;
    }

    if (token.marker !== "repeatStart") {
      result.push(token);
      i++;
      continue;
    }

    let endIndex = -1;
    let nested = false;
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].marker === "repeatStart") {
        nested = true;
        break;
      }
      if (tokens[j].marker === "repeatEnd") {
        endIndex = j;
        break;
      }
    }

    if (endIndex === -1) {
      const message = nested
        ? `"${token.raw}" cannot contain a nested "|:"`
        : `"${token.raw}" has no matching ":|"`;
      result.push({ ...token, error: message });
      i++;
      continue;
    }

    const inner = tokens.slice(i + 1, endIndex);
    const voltaOneIndex = inner.findIndex((t) => t.marker === "voltaOne");
    const common = voltaOneIndex === -1 ? inner : inner.slice(0, voltaOneIndex);
    const ending1 = voltaOneIndex === -1 ? [] : inner.slice(voltaOneIndex + 1);

    let ending2: ParsedToken[] = [];
    let voltaTwoToken: ParsedToken | null = null;
    let next = endIndex + 1;
    if (tokens[next]?.marker === "voltaTwo") {
      voltaTwoToken = tokens[next];
      next++;
      while (next < tokens.length && tokens[next].marker === null) {
        ending2.push(tokens[next]);
        next++;
      }
    }

    result.push(token, ...common);
    if (voltaOneIndex !== -1) {
      result.push(inner[voltaOneIndex], ...ending1);
    }
    result.push(tokens[endIndex], ...common);
    if (voltaTwoToken) {
      result.push(voltaTwoToken, ...ending2);
    }

    i = next;
  }

  return result.map((token, index) => (token.index === index ? token : { ...token, index }));
}
