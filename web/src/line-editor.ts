/**
 * A readline for the machine's console.
 *
 * The guest tty runs with echo disabled, so the browser owns line editing
 * entirely. This gives zero-latency editing and a full set of Emacs/arrow
 * key bindings that a dumb serial line could never provide:
 *
 *   Left / Ctrl-B     cursor left        Right / Ctrl-F    cursor right
 *   Home / Ctrl-A     start of line      End  / Ctrl-E     end of line
 *   Up   / Ctrl-P     previous history   Down / Ctrl-N     next history
 *   Backspace         delete before      Delete / Ctrl-D   delete under
 *   Ctrl-U            kill to start      Ctrl-K            kill to end
 *
 * The editor maintains a buffer and a cursor index, and emits the minimal
 * terminal control bytes (backspaces, rewrites) to keep the on-screen line
 * in sync.
 */

export interface EditorEffect {
  /** Bytes to write to the local terminal (echo, cursor moves, erasures). */
  readonly echo: string;
  /** A completed line to send to the guest, or null. */
  readonly submit: string | null;
}

function back(n: number): string {
  return n > 0 ? "\b".repeat(n) : "";
}

export class LineEditor {
  private buffer = "";
  private cursor = 0;
  private readonly history: string[] = [];
  private historyIndex: number | null = null;
  private draft = "";

  feed(data: string): EditorEffect {
    let echo = "";
    let submit: string | null = null;
    let i = 0;
    while (i < data.length) {
      const ch = data[i] ?? "";
      if (ch === "\x1b") {
        const consumed = this.handleEscape(data, i);
        echo += consumed.echo;
        i += consumed.length;
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        echo += "\r\n";
        submit = (submit ?? "") + this.buffer + "\n";
        this.commitHistory();
      } else if (ch === "\x7f" || ch === "\b") {
        echo += this.backspace();
      } else if (ch === "\x04") {
        echo += this.deleteForward();
      } else if (ch === "\x01") {
        echo += this.moveHome();
      } else if (ch === "\x05") {
        echo += this.moveEnd();
      } else if (ch === "\x02") {
        echo += this.moveLeft();
      } else if (ch === "\x06") {
        echo += this.moveRight();
      } else if (ch === "\x10") {
        echo += this.recall(-1);
      } else if (ch === "\x0e") {
        echo += this.recall(1);
      } else if (ch === "\x15") {
        echo += this.killToStart();
      } else if (ch === "\x0b") {
        echo += this.killToEnd();
      } else if (ch >= " ") {
        echo += this.insert(ch);
      }
      i += 1;
    }
    return { echo, submit };
  }

  /** Inject a complete program from the example catalog: echo + submit. */
  paste(code: string): EditorEffect {
    const flat = code.replaceAll(/\s*\n\s*/g, " ");
    const clearing = this.clearLine();
    this.remember(flat);
    this.buffer = "";
    this.cursor = 0;
    this.historyIndex = null;
    return {
      echo: `${clearing}${code.replaceAll("\n", "\r\n")}\r\n`,
      submit: `${code}\n`,
    };
  }

  // --- editing primitives ------------------------------------------------

  private insert(ch: string): string {
    const tail = this.buffer.slice(this.cursor);
    this.buffer = this.buffer.slice(0, this.cursor) + ch + tail;
    this.cursor += 1;
    // Write the new char and the shifted tail, then step back over the tail.
    return ch + tail + back(tail.length);
  }

  private backspace(): string {
    if (this.cursor === 0) {
      return "";
    }
    const tail = this.buffer.slice(this.cursor);
    this.buffer = this.buffer.slice(0, this.cursor - 1) + tail;
    this.cursor -= 1;
    return "\b" + tail + " " + back(tail.length + 1);
  }

  private deleteForward(): string {
    if (this.cursor >= this.buffer.length) {
      return "";
    }
    const tail = this.buffer.slice(this.cursor + 1);
    this.buffer = this.buffer.slice(0, this.cursor) + tail;
    return tail + " " + back(tail.length + 1);
  }

  private moveLeft(): string {
    if (this.cursor === 0) {
      return "";
    }
    this.cursor -= 1;
    return "\b";
  }

  private moveRight(): string {
    if (this.cursor >= this.buffer.length) {
      return "";
    }
    const ch = this.buffer[this.cursor] ?? "";
    this.cursor += 1;
    return ch;
  }

  private moveHome(): string {
    const echo = back(this.cursor);
    this.cursor = 0;
    return echo;
  }

  private moveEnd(): string {
    const echo = this.buffer.slice(this.cursor);
    this.cursor = this.buffer.length;
    return echo;
  }

  private killToStart(): string {
    if (this.cursor === 0) {
      return "";
    }
    const removed = this.cursor;
    const tail = this.buffer.slice(this.cursor);
    this.buffer = tail;
    this.cursor = 0;
    // Step to start, rewrite the tail, blank the vacated columns, return.
    return back(removed) + tail + " ".repeat(removed) + back(tail.length + removed);
  }

  private killToEnd(): string {
    const removed = this.buffer.length - this.cursor;
    if (removed === 0) {
      return "";
    }
    this.buffer = this.buffer.slice(0, this.cursor);
    return " ".repeat(removed) + back(removed);
  }

  // --- history -----------------------------------------------------------

  private recall(direction: -1 | 1): string {
    if (this.history.length === 0) {
      return "";
    }
    if (this.historyIndex === null) {
      if (direction === 1) {
        return "";
      }
      this.draft = this.buffer;
      this.historyIndex = this.history.length - 1;
      return this.replaceLine(this.history[this.historyIndex] ?? "");
    }
    const next = this.historyIndex + direction;
    if (next < 0) {
      return "";
    }
    if (next >= this.history.length) {
      this.historyIndex = null;
      return this.replaceLine(this.draft);
    }
    this.historyIndex = next;
    return this.replaceLine(this.history[this.historyIndex] ?? "");
  }

  private replaceLine(next: string): string {
    const clearing = this.clearLine();
    this.buffer = next;
    this.cursor = next.length;
    return clearing + next;
  }

  /** Move to end of line, then erase it entirely, leaving the cursor at col 0. */
  private clearLine(): string {
    const toEnd = this.buffer.slice(this.cursor);
    return toEnd + "\b \b".repeat(this.buffer.length);
  }

  private commitHistory(): void {
    this.remember(this.buffer);
    this.buffer = "";
    this.cursor = 0;
    this.historyIndex = null;
  }

  private remember(line: string): void {
    if (line.trim().length === 0) {
      return;
    }
    if (this.history[this.history.length - 1] !== line) {
      this.history.push(line);
    }
  }

  // --- escape sequences --------------------------------------------------

  private handleEscape(
    data: string,
    start: number,
  ): { echo: string; length: number } {
    const rest = data.slice(start);
    const ESC = "";
    // CSI sequences: ESC [ ... final. Handle the ones a terminal sends for
    // arrows, home/end and the delete key.
    const csi = new RegExp(`^${ESC}\\[(?:(\\d+)~|([A-H~]))`).exec(rest);
    if (csi !== null) {
      const length = csi[0].length;
      const num = csi[1];
      const letter = csi[2];
      if (num === "3") {
        return { echo: this.deleteForward(), length };
      }
      switch (letter) {
        case "A":
          return { echo: this.recall(-1), length };
        case "B":
          return { echo: this.recall(1), length };
        case "C":
          return { echo: this.moveRight(), length };
        case "D":
          return { echo: this.moveLeft(), length };
        case "H":
          return { echo: this.moveHome(), length };
        case "F":
          return { echo: this.moveEnd(), length };
        default:
          return { echo: "", length };
      }
    }
    // ESC O x — the "application cursor" variants of Home/End some terminals send.
    const ss3 = new RegExp(`^${ESC}O([A-H])`).exec(rest);
    if (ss3 !== null) {
      const letter = ss3[1];
      const length = ss3[0].length;
      if (letter === "H") {
        return { echo: this.moveHome(), length };
      }
      if (letter === "F") {
        return { echo: this.moveEnd(), length };
      }
      return { echo: "", length };
    }
    // Bare ESC or an unrecognized sequence: swallow the ESC only.
    return { echo: "", length: 1 };
  }
}
