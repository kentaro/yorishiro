import { describe, expect, it } from "vitest";
import { MarkerWatcher, SerialDecoder } from "./serial";

describe("SerialDecoder", () => {
  it("decodes ASCII byte by byte", () => {
    const d = new SerialDecoder();
    let out = "";
    for (const c of "hi") {
      out += d.push(c.charCodeAt(0));
    }
    expect(out).toBe("hi");
  });

  it("reassembles multi-byte UTF-8 split across pushes", () => {
    const d = new SerialDecoder();
    const bytes = new TextEncoder().encode("λ依");
    let out = "";
    for (const b of bytes) {
      out += d.push(b);
    }
    expect(out).toBe("λ依");
  });
});

describe("MarkerWatcher", () => {
  it("fires when the marker arrives in one chunk", () => {
    const w = new MarkerWatcher("yorishiro> ");
    expect(w.feed("boot log\nyorishiro> ")).toBe(true);
  });

  it("fires when the marker is split across chunks", () => {
    const w = new MarkerWatcher("yorishiro> ");
    expect(w.feed("yorish")).toBe(false);
    expect(w.feed("iro> ")).toBe(true);
  });

  it("handles overlapping false starts", () => {
    const w = new MarkerWatcher("aab");
    expect(w.feed("aaab")).toBe(true);
  });

  it("fires only once", () => {
    const w = new MarkerWatcher("x");
    expect(w.feed("x")).toBe(true);
    expect(w.feed("x")).toBe(false);
  });

  it("rejects an empty marker", () => {
    expect(() => new MarkerWatcher("")).toThrow();
  });
});
