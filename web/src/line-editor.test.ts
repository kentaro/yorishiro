import { describe, expect, it } from "vitest";
import { LineEditor } from "./line-editor";

/** Replay an editor's echo stream into a flat "visible line + cursor" model. */
class Screen {
  chars: string[] = [];
  cursor = 0;

  apply(echo: string): void {
    let i = 0;
    while (i < echo.length) {
      const ch = echo[i] ?? "";
      if (ch === "\b") {
        if (this.cursor > 0) this.cursor -= 1;
      } else if (ch === "\r") {
        // ignore for single-line model
      } else if (ch === "\n") {
        this.chars = [];
        this.cursor = 0;
      } else {
        this.chars[this.cursor] = ch;
        this.cursor += 1;
      }
      i += 1;
    }
  }

  get line(): string {
    return this.chars.join("").replace(/ +$/, "");
  }
}

function type(ed: LineEditor, screen: Screen, data: string): string | null {
  const eff = ed.feed(data);
  screen.apply(eff.echo);
  return eff.submit;
}

describe("LineEditor basics", () => {
  it("echoes printable input and submits on Enter", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "(+ 1 2)");
    expect(s.line).toBe("(+ 1 2)");
    expect(type(ed, s, "\r")).toBe("(+ 1 2)\n");
  });

  it("backspace deletes before the cursor", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "ab");
    type(ed, s, "\x7f");
    expect(s.line).toBe("a");
    expect(type(ed, s, "\r")).toBe("a\n");
  });
});

describe("LineEditor cursor movement", () => {
  it("Left/Ctrl-B then insert edits mid-line", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "(f x)");
    type(ed, s, "\x1b[D"); // left, cursor before ')'
    type(ed, s, "\x1b[D"); // left, cursor before 'x'
    type(ed, s, "y ");
    expect(s.line).toBe("(f y x)");
    expect(type(ed, s, "\r")).toBe("(f y x)\n");
  });

  it("Ctrl-B and Ctrl-F move the cursor", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "abc");
    type(ed, s, "\x02\x02"); // back twice: cursor between a and b
    type(ed, s, "\x06"); // forward: cursor between b and c
    type(ed, s, "X");
    expect(s.line).toBe("abXc");
  });

  it("Ctrl-A / Ctrl-E jump to ends", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "world");
    type(ed, s, "\x01"); // home
    type(ed, s, "hello ");
    expect(s.line).toBe("hello world");
    type(ed, s, "\x05"); // end
    type(ed, s, "!");
    expect(s.line).toBe("hello world!");
  });

  it("Delete removes the char under the cursor", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "abc");
    type(ed, s, "\x01"); // home
    type(ed, s, "\x1b[3~"); // delete 'a'
    expect(s.line).toBe("bc");
  });

  it("backspace mid-line closes the gap", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "abcd");
    type(ed, s, "\x02\x02"); // cursor between b and c
    type(ed, s, "\x7f"); // delete 'b'
    expect(s.line).toBe("acd");
    type(ed, s, "\r");
  });
});

describe("LineEditor kill", () => {
  it("Ctrl-U kills from the cursor to the start", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "keep DROP");
    type(ed, s, "\x01"); // home
    type(ed, s, "\x05"); // end (no-op check)
    type(ed, s, "\x01"); // home again
    // move cursor to after "keep " (5 rights)
    type(ed, s, "\x06\x06\x06\x06\x06");
    type(ed, s, "\x15"); // kill to start
    expect(s.line).toBe("DROP");
  });

  it("Ctrl-K kills to the end of the line", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "keepDROP");
    type(ed, s, "\x02\x02\x02\x02"); // cursor before DROP
    type(ed, s, "\x0b"); // kill to end
    expect(s.line).toBe("keep");
  });
});

describe("LineEditor history", () => {
  it("recalls and re-submits a prior line", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "(one)\r");
    type(ed, s, "(two)\r");
    type(ed, s, "\x1b[A"); // up -> (two)
    expect(s.line).toBe("(two)");
    type(ed, s, "\x1b[A"); // up -> (one)
    expect(s.line).toBe("(one)");
    expect(type(ed, s, "\r")).toBe("(one)\n");
  });

  it("Ctrl-P / Ctrl-N walk history and restore the draft", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "(old)\r");
    type(ed, s, "(dra");
    type(ed, s, "\x10"); // Ctrl-P -> (old)
    expect(s.line).toBe("(old)");
    type(ed, s, "\x0e"); // Ctrl-N -> back to draft
    expect(s.line).toBe("(dra");
    type(ed, s, "ft)");
    expect(type(ed, s, "\r")).toBe("(draft)\n");
  });

  it("does not store blank or duplicate lines", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "\r");
    type(ed, s, "(x)\r");
    type(ed, s, "(x)\r");
    type(ed, s, "\x1b[A");
    expect(s.line).toBe("(x)");
    const eff = ed.feed("\x1b[A");
    expect(eff.echo).toBe("");
  });
});

describe("LineEditor paste", () => {
  it("clears the current line, echoes with CRLF and submits", () => {
    const ed = new LineEditor();
    const s = new Screen();
    type(ed, s, "junk");
    const eff = ed.paste("(begin\n  (x))");
    expect(eff.submit).toBe("(begin\n  (x))\n");
    s.apply(eff.echo);
    expect(s.line).toBe("");
    expect(ed.feed("\x1b[A").echo).toContain("(begin (x))");
  });
});
