/**
 * A small readline for the machine's console.
 *
 * The guest tty runs with echo disabled; the browser owns line editing.
 * This keeps editing latency at zero and gives the REPL history and kill
 * keys that the dumb serial line could never provide.
 *
 * Supported: printable input, Backspace, Enter, Ctrl+U (kill line),
 * Up/Down (history). Other escape sequences are swallowed.
 */

export interface EditorEffect {
  /** Text to write to the local terminal (echo, erasures). */
  readonly echo: string;
  /** A completed line to send to the guest, or null. */
  readonly submit: string | null;
}

const NO_EFFECT: EditorEffect = { echo: "", submit: null };

function erase(count: number): string {
  return "\b \b".repeat(count);
}

export class LineEditor {
  private buffer = "";
  private readonly history: string[] = [];
  private historyIndex: number | null = null;
  private draft = "";

  /** Feed raw terminal input (may contain escape sequences). */
  feed(data: string): EditorEffect {
    let echo = "";
    let submit: string | null = null;
    let i = 0;
    while (i < data.length) {
      const ch = data[i] ?? "";
      if (ch === "\x1b") {
        const seq = data.slice(i, i + 3);
        if (seq === "\x1b[A") {
          echo += this.recall(-1);
        } else if (seq === "\x1b[B") {
          echo += this.recall(1);
        }
        // Swallow the CSI sequence (final byte at i+2 for [A-D etc.).
        i += seq.startsWith("\x1b[") ? 3 : 1;
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        echo += "\r\n";
        submit = (submit ?? "") + this.buffer + "\n";
        this.remember(this.buffer);
        this.buffer = "";
        this.historyIndex = null;
      } else if (ch === "\x7f" || ch === "\b") {
        if (this.buffer.length > 0) {
          this.buffer = this.buffer.slice(0, -1);
          echo += erase(1);
        }
      } else if (ch === "\x15") {
        echo += erase(this.buffer.length);
        this.buffer = "";
      } else if (ch >= " " || ch === "\t") {
        this.buffer += ch;
        echo += ch;
      }
      i += 1;
    }
    return { echo, submit };
  }

  /** Inject a complete program (from the example catalog): echo + submit. */
  paste(code: string): EditorEffect {
    const flat = code.replaceAll(/\s*\n\s*/g, " ");
    this.remember(flat);
    const cleared = erase(this.buffer.length);
    this.buffer = "";
    this.historyIndex = null;
    return {
      echo: `${cleared}${code.replaceAll("\n", "\r\n")}\r\n`,
      submit: `${code}\n`,
    };
  }

  private remember(line: string): void {
    if (line.trim().length === 0) {
      return;
    }
    if (this.history[this.history.length - 1] !== line) {
      this.history.push(line);
    }
  }

  private recall(direction: -1 | 1): string {
    if (this.history.length === 0) {
      return "";
    }
    if (this.historyIndex === null) {
      if (direction === 1) {
        return NO_EFFECT.echo;
      }
      this.draft = this.buffer;
      this.historyIndex = this.history.length - 1;
    } else {
      const next = this.historyIndex + direction;
      if (next < 0) {
        return "";
      }
      if (next >= this.history.length) {
        // Walked past the newest entry: restore the draft.
        const echo = erase(this.buffer.length) + this.draft;
        this.buffer = this.draft;
        this.historyIndex = null;
        return echo;
      }
      this.historyIndex = next;
    }
    const entry = this.history[this.historyIndex] ?? "";
    const echo = erase(this.buffer.length) + entry;
    this.buffer = entry;
    return echo;
  }
}
