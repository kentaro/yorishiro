import type {
  EmulatorAdapter,
  MachineImage,
  MachineState,
  MachineStateListener,
} from "./emulator/types";
import { MarkerWatcher, SerialDecoder } from "./serial";

export interface MachineOptions {
  /** Serial text that proves the Scheme REPL is up. */
  readonly readyMarker: string;
  /** Give up if the marker has not appeared within this time. */
  readonly bootTimeoutMs: number;
}

/**
 * Owns the machine lifecycle: idle -> loading -> booting -> ready, with a
 * watchdog that moves to `failed` if the REPL prompt never shows up.
 * Terminal I/O is exposed as decoded-text callbacks.
 */
export class Machine {
  private state: MachineState = { kind: "idle" };
  private readonly stateListeners = new Set<MachineStateListener>();
  private readonly outputListeners = new Set<(text: string) => void>();
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeSerial: (() => void) | null = null;
  private unsubscribeProgress: (() => void) | null = null;

  constructor(
    private readonly adapter: EmulatorAdapter,
    private readonly options: MachineOptions,
  ) {}

  getState(): MachineState {
    return this.state;
  }

  onState(listener: MachineStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onOutput(listener: (text: string) => void): () => void {
    this.outputListeners.add(listener);
    return () => {
      this.outputListeners.delete(listener);
    };
  }

  /** Raw bytes from the machine's MIDI jack (second serial port). */
  onMidiByte(listener: (byte: number) => void): () => void {
    return this.adapter.onMidiByte(listener);
  }

  sendInput(data: string): void {
    if (this.state.kind === "booting" || this.state.kind === "ready") {
      this.adapter.sendSerial(data);
    }
  }

  async boot(image: MachineImage): Promise<void> {
    if (this.state.kind !== "idle" && this.state.kind !== "failed") {
      throw new Error(`cannot boot from state ${this.state.kind}`);
    }
    this.setState({ kind: "loading", progress: null });
    this.unsubscribeProgress = this.adapter.onDownloadProgress((progress) => {
      if (this.state.kind === "loading") {
        this.setState({ kind: "loading", progress });
      }
    });

    const decoder = new SerialDecoder();
    const watcher = new MarkerWatcher(this.options.readyMarker);
    this.unsubscribeSerial = this.adapter.onSerialByte((byte) => {
      const text = decoder.push(byte);
      if (text.length === 0) {
        return;
      }
      for (const listener of this.outputListeners) {
        listener(text);
      }
      if (watcher.feed(text) && this.state.kind === "booting") {
        this.clearWatchdog();
        this.setState({ kind: "ready" });
      }
    });

    try {
      await this.adapter.start(image);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : "emulator failed to start");
      return;
    }

    this.setState({ kind: "booting" });
    this.watchdog = setTimeout(() => {
      this.fail(
        `REPL prompt did not appear within ${String(this.options.bootTimeoutMs)}ms`,
      );
    }, this.options.bootTimeoutMs);
  }

  dispose(): void {
    this.clearWatchdog();
    if (this.unsubscribeSerial !== null) {
      this.unsubscribeSerial();
      this.unsubscribeSerial = null;
    }
    if (this.unsubscribeProgress !== null) {
      this.unsubscribeProgress();
      this.unsubscribeProgress = null;
    }
    this.adapter.dispose();
    this.setState({ kind: "idle" });
  }

  private fail(reason: string): void {
    this.clearWatchdog();
    this.setState({ kind: "failed", reason });
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  private setState(next: MachineState): void {
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }
}
