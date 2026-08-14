import { describe, expect, it } from "vitest";
import { MidiParser, type MidiMessage } from "./midi";

function feedAll(parser: MidiParser, bytes: readonly number[]): MidiMessage[] {
  const out: MidiMessage[] = [];
  for (const b of bytes) {
    out.push(...parser.feed(b));
  }
  return out;
}

describe("MidiParser", () => {
  it("parses a note-on message", () => {
    const p = new MidiParser();
    expect(feedAll(p, [0x90, 60, 100])).toEqual([
      { status: 0x90, data1: 60, data2: 100 },
    ]);
  });

  it("supports running status", () => {
    const p = new MidiParser();
    const messages = feedAll(p, [0x90, 60, 100, 64, 100, 67, 100]);
    expect(messages).toEqual([
      { status: 0x90, data1: 60, data2: 100 },
      { status: 0x90, data1: 64, data2: 100 },
      { status: 0x90, data1: 67, data2: 100 },
    ]);
  });

  it("parses two-byte messages (program change)", () => {
    const p = new MidiParser();
    expect(feedAll(p, [0xc0, 5])).toEqual([
      { status: 0xc0, data1: 5, data2: 0 },
    ]);
  });

  it("ignores realtime bytes without breaking a message in flight", () => {
    const p = new MidiParser();
    const messages = feedAll(p, [0x90, 60, 0xf8, 100]);
    expect(messages).toEqual([{ status: 0x90, data1: 60, data2: 100 }]);
  });

  it("skips sysex payloads entirely", () => {
    const p = new MidiParser();
    const messages = feedAll(p, [0xf0, 1, 2, 3, 0xf7, 0x80, 60, 0]);
    expect(messages).toEqual([{ status: 0x80, data1: 60, data2: 0 }]);
  });

  it("drops stray data bytes before any status", () => {
    const p = new MidiParser();
    expect(feedAll(p, [10, 20, 30])).toEqual([]);
  });
});
