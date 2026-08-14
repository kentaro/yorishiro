import { describe, expect, it } from "vitest";
import { LineEditor } from "./line-editor";

describe("LineEditor", () => {
  it("echoes printable input and submits on Enter", () => {
    const ed = new LineEditor();
    expect(ed.feed("(+ 1 2)")).toEqual({ echo: "(+ 1 2)", submit: null });
    expect(ed.feed("\r")).toEqual({ echo: "\r\n", submit: "(+ 1 2)\n" });
  });

  it("backspace erases locally and from the buffer", () => {
    const ed = new LineEditor();
    ed.feed("ab");
    expect(ed.feed("\x7f").echo).toBe("\b \b");
    expect(ed.feed("\r").submit).toBe("a\n");
  });

  it("backspace on an empty line does nothing", () => {
    const ed = new LineEditor();
    expect(ed.feed("\x7f")).toEqual({ echo: "", submit: null });
  });

  it("Ctrl+U kills the whole line", () => {
    const ed = new LineEditor();
    ed.feed("abc");
    expect(ed.feed("\x15").echo).toBe("\b \b".repeat(3));
    expect(ed.feed("\r").submit).toBe("\n");
  });

  it("recalls history with the up arrow", () => {
    const ed = new LineEditor();
    ed.feed("(one)\r");
    ed.feed("(two)\r");
    const up = ed.feed("\x1b[A");
    expect(up.echo).toBe("(two)");
    const upAgain = ed.feed("\x1b[A");
    expect(upAgain.echo).toBe("\b \b".repeat(5) + "(one)");
    expect(ed.feed("\r").submit).toBe("(one)\n");
  });

  it("walks back down to the draft", () => {
    const ed = new LineEditor();
    ed.feed("(old)\r");
    ed.feed("(dra");
    ed.feed("\x1b[A");
    const down = ed.feed("\x1b[B");
    expect(down.echo).toBe("\b \b".repeat(5) + "(dra");
    expect(ed.feed("ft)\r").submit).toBe("(draft)\n");
  });

  it("does not push blank or duplicate lines into history", () => {
    const ed = new LineEditor();
    ed.feed("\r");
    ed.feed("(x)\r");
    ed.feed("(x)\r");
    expect(ed.feed("\x1b[A").echo).toBe("(x)");
    expect(ed.feed("\x1b[A").echo).toBe("");
  });

  it("paste echoes with CRLF, submits, and lands in history", () => {
    const ed = new LineEditor();
    const eff = ed.paste("(begin\n  (x))");
    expect(eff.echo).toBe("(begin\r\n  (x))\r\n");
    expect(eff.submit).toBe("(begin\n  (x))\n");
    expect(ed.feed("\x1b[A").echo).toBe("(begin (x))");
  });

  it("swallows unknown escape sequences", () => {
    const ed = new LineEditor();
    expect(ed.feed("\x1b[C")).toEqual({ echo: "", submit: null });
  });
});
