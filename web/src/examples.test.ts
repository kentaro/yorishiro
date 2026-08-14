import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, EXAMPLES } from "./examples";

/**
 * Structural check that a code snippet is one or more complete
 * s-expressions: parentheses balance, never go negative, and string
 * literals are terminated. This keeps the catalog honest — a truncated
 * example would silently wedge the guest REPL mid-read.
 */
function isCompleteSexp(code: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of code) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0 && !inString;
}

describe("example catalog", () => {
  it("has a healthy number of examples", () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(20);
  });

  it("has unique ids", () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every category is labeled", () => {
    for (const example of EXAMPLES) {
      expect(CATEGORY_LABELS[example.category]).toBeTruthy();
    }
  });

  it("every example is a complete s-expression", () => {
    for (const example of EXAMPLES) {
      expect(isCompleteSexp(example.code), example.id).toBe(true);
    }
  });

  it("every example has a title and a blurb", () => {
    for (const example of EXAMPLES) {
      expect(example.title.length).toBeGreaterThan(0);
      expect(example.blurb.length).toBeGreaterThan(0);
    }
  });

  it("examples are single-line-sendable (no unterminated trailing input)", () => {
    for (const example of EXAMPLES) {
      expect(example.code.trim()).toBe(example.code);
    }
  });
});
