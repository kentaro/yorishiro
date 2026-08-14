/**
 * MIDI plumbing for the machine's second serial port.
 *
 * The guest writes raw MIDI bytes to /dev/ttyS1 (MIDI has been a serial
 * protocol since 1983). This module parses that byte stream — including
 * running status — and routes the messages to a real Web MIDI output when
 * one exists, or to a small built-in WebAudio synthesizer otherwise.
 */

export interface MidiMessage {
  readonly status: number;
  readonly data1: number;
  readonly data2: number;
}

const REALTIME_MIN = 0xf8;
const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;

function dataLengthFor(status: number): number {
  const kind = status & 0xf0;
  return kind === 0xc0 || kind === 0xd0 ? 1 : 2;
}

/** Incremental MIDI byte-stream parser with running-status support. */
export class MidiParser {
  private status: number | null = null;
  private pending: number[] = [];
  private inSysex = false;

  feed(byte: number): MidiMessage[] {
    if (byte >= REALTIME_MIN) {
      return []; // realtime messages: ignore, do not disturb running status
    }
    if (this.inSysex) {
      if (byte === SYSEX_END) {
        this.inSysex = false;
      }
      return [];
    }
    if (byte >= 0x80) {
      if (byte === SYSEX_START) {
        this.inSysex = true;
        this.status = null;
      } else if (byte >= 0xf0) {
        this.status = null; // other system common: unsupported, resync
      } else {
        this.status = byte;
      }
      this.pending = [];
      return [];
    }
    if (this.status === null) {
      return []; // stray data byte
    }
    this.pending.push(byte);
    if (this.pending.length < dataLengthFor(this.status)) {
      return [];
    }
    const [data1, data2] = [this.pending[0] ?? 0, this.pending[1] ?? 0];
    this.pending = []; // running status: keep this.status
    return [{ status: this.status, data1, data2 }];
  }
}

export interface MidiSink {
  readonly name: string;
  send(message: MidiMessage): void;
}

interface SynthVoice {
  readonly oscillators: readonly OscillatorNode[];
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
}

/**
 * The built-in instrument: a dark analog-style polysynth — two detuned
 * sawtooths plus a sub-oscillator through a resonant lowpass with an
 * envelope sweep, into a feedback delay. Audible on any machine without a
 * MIDI device, and worthy of the vessel.
 */
export class SynthSink implements MidiSink {
  readonly name = "built-in synth";
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private readonly voices = new Map<number, SynthVoice>();

  private context(): { ctx: AudioContext; bus: GainNode } | null {
    if (this.ctx === null) {
      if (typeof AudioContext === "undefined") {
        return null;
      }
      const ctx = new AudioContext();
      const bus = ctx.createGain();
      bus.gain.value = 0.9;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;

      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.27;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;

      bus.connect(compressor);
      bus.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.bus = bus;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.bus === null ? null : { ctx: this.ctx, bus: this.bus };
  }

  send(message: MidiMessage): void {
    const kind = message.status & 0xf0;
    if (kind === 0x90 && message.data2 > 0) {
      this.noteOn(message.data1, message.data2);
    } else if (kind === 0x80 || (kind === 0x90 && message.data2 === 0)) {
      this.noteOff(message.data1);
    }
  }

  private noteOn(note: number, velocity: number): void {
    const audio = this.context();
    if (audio === null) {
      return;
    }
    this.noteOff(note);
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const freq = 440 * Math.pow(2, (note - 69) / 12);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(Math.min(freq * 9, 9000), now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(freq * 2.2, 300),
      now + 0.28,
    );

    const gain = ctx.createGain();
    const peak = (velocity / 127) * 0.16;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(peak * 0.65, now + 0.25);

    const detunes: readonly (readonly [OscillatorType, number, number])[] = [
      ["sawtooth", 0, -7],
      ["sawtooth", 0, 7],
      ["sine", -12, 0],
    ];
    const oscillators = detunes.map(([type, semitones, cents]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * Math.pow(2, semitones / 12);
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(now);
      return osc;
    });

    filter.connect(gain);
    gain.connect(bus);
    this.voices.set(note, { oscillators, gain, filter });
  }

  private noteOff(note: number): void {
    const ctx = this.ctx;
    const voice = this.voices.get(note);
    if (ctx === null || voice === undefined) {
      return;
    }
    this.voices.delete(note);
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    for (const osc of voice.oscillators) {
      osc.stop(now + 0.45);
    }
  }
}

/** Sends to the first available Web MIDI output. */
export class WebMidiSink implements MidiSink {
  private constructor(
    readonly name: string,
    private readonly output: MIDIOutput,
  ) {}

  static async detect(): Promise<WebMidiSink | null> {
    if (!("requestMIDIAccess" in navigator)) {
      return null;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      for (const output of access.outputs.values()) {
        return new WebMidiSink(output.name ?? "MIDI device", output);
      }
      return null;
    } catch {
      return null;
    }
  }

  send(message: MidiMessage): void {
    const bytes =
      dataLengthFor(message.status) === 1
        ? [message.status, message.data1]
        : [message.status, message.data1, message.data2];
    try {
      this.output.send(bytes);
    } catch {
      // A vanished device must never take the machine down.
    }
  }
}

/**
 * Routes messages to a real MIDI device when present, falling back to the
 * built-in synth. Detection runs once, on the first message.
 */
export class MidiRouter {
  private sink: MidiSink;
  private detection: Promise<void> | null = null;
  private readonly listeners = new Set<(sinkName: string) => void>();

  constructor() {
    this.sink = new SynthSink();
  }

  get sinkName(): string {
    return this.sink.name;
  }

  onSinkChange(listener: (sinkName: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  handle(message: MidiMessage): void {
    this.detection ??= WebMidiSink.detect().then((webMidi) => {
      if (webMidi !== null) {
        this.sink = webMidi;
        for (const listener of this.listeners) {
          listener(this.sink.name);
        }
      }
    });
    this.sink.send(message);
  }
}
