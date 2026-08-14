/**
 * Incremental UTF-8 decoder for the guest serial stream.
 *
 * The emulator delivers serial output one byte at a time; multi-byte UTF-8
 * sequences can therefore be split across callbacks. TextDecoder in
 * streaming mode handles the reassembly.
 */
export class SerialDecoder {
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });
  private readonly buf = new Uint8Array(1);

  /** Decode one incoming byte; returns "" until a code point completes. */
  push(byte: number): string {
    this.buf[0] = byte & 0xff;
    return this.decoder.decode(this.buf, { stream: true });
  }
}

/**
 * Watches the serial stream for a marker string (e.g. the REPL prompt),
 * tolerating arbitrary chunk boundaries.
 */
export class MarkerWatcher {
  private tail = "";
  private done = false;

  constructor(private readonly marker: string) {
    if (marker.length === 0) {
      throw new Error("marker must be non-empty");
    }
  }

  /** Feed decoded text; returns true (once) when the marker has appeared. */
  feed(text: string): boolean {
    if (this.done) {
      return false;
    }
    // Sliding window: keep just enough of the previous chunk to detect a
    // marker straddling the boundary. Simple and immune to the overlap
    // pitfalls of hand-rolled incremental matching.
    this.tail += text;
    if (this.tail.includes(this.marker)) {
      this.done = true;
      this.tail = "";
      return true;
    }
    const keep = this.marker.length - 1;
    this.tail = keep > 0 ? this.tail.slice(-keep) : "";
    return false;
  }
}
