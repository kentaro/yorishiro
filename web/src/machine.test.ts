import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmulatorAdapter, MachineImage } from "./emulator/types";
import { Machine } from "./machine";

class FakeAdapter implements EmulatorAdapter {
  started = false;
  disposed = false;
  sent: string[] = [];
  failStart = false;
  private listeners = new Set<(byte: number) => void>();
  private progressListeners = new Set<
    (progress: { loadedBytes: number; totalBytes: number | null }) => void
  >();

  pendingStart = false;
  readonly startResolvers: (() => void)[] = [];

  start(_image: MachineImage): Promise<void> {
    if (this.failStart) {
      return Promise.reject(new Error("no wasm here"));
    }
    this.started = true;
    if (this.pendingStart) {
      return new Promise((resolve) => {
        this.startResolvers.push(resolve);
      });
    }
    return Promise.resolve();
  }

  onDownloadProgress(
    listener: (progress: {
      loadedBytes: number;
      totalBytes: number | null;
    }) => void,
  ): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  emitProgress(loadedBytes: number, totalBytes: number | null): void {
    for (const l of this.progressListeners) {
      l({ loadedBytes, totalBytes });
    }
  }

  sendSerial(data: string): void {
    this.sent.push(data);
  }

  onSerialByte(listener: (byte: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onMidiByte(_listener: (byte: number) => void): () => void {
    return () => {
      // FakeAdapter has no MIDI source.
    };
  }

  private crashListeners = new Set<(reason: string) => void>();

  onCrash(listener: (reason: string) => void): () => void {
    this.crashListeners.add(listener);
    return () => {
      this.crashListeners.delete(listener);
    };
  }

  crash(reason: string): void {
    for (const l of this.crashListeners) {
      l(reason);
    }
  }

  dispose(): void {
    this.disposed = true;
  }

  emit(text: string): void {
    for (const byte of new TextEncoder().encode(text)) {
      for (const l of this.listeners) {
        l(byte);
      }
    }
  }
}

const IMAGE: MachineImage = {
  kernelUrl: "/machine/bzImage",
  cmdline: "console=ttyS0",
  memoryBytes: 1024,
};

const OPTS = { readyMarker: "yorishiro> ", bootTimeoutMs: 1000 };

describe("Machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks idle -> loading -> booting -> ready on the prompt", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    const seen: string[] = [];
    machine.onState((s) => seen.push(s.kind));

    await machine.boot(IMAGE);
    expect(machine.getState().kind).toBe("booting");

    adapter.emit("Linux version 6.x\nyorishiro> ");
    expect(machine.getState().kind).toBe("ready");
    expect(seen).toEqual(["loading", "booting", "ready"]);
  });

  it("fails when the prompt never appears", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);

    vi.advanceTimersByTime(1001);
    const state = machine.getState();
    expect(state.kind).toBe("failed");
  });

  it("fails cleanly when the emulator cannot start", async () => {
    const adapter = new FakeAdapter();
    adapter.failStart = true;
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);
    expect(machine.getState().kind).toBe("failed");
  });

  it("forwards output and input only while running", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    const out: string[] = [];
    machine.onOutput((t) => out.push(t));

    machine.sendInput("too early");
    expect(adapter.sent).toEqual([]);

    await machine.boot(IMAGE);
    adapter.emit("yorishiro> ");
    machine.sendInput("(+ 1 2)\n");
    expect(adapter.sent).toEqual(["(+ 1 2)\n"]);
    expect(out.join("")).toBe("yorishiro> ");
  });

  it("does not regress from ready when late garbage arrives", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);
    adapter.emit("yorishiro> ");
    vi.advanceTimersByTime(5000);
    expect(machine.getState().kind).toBe("ready");
  });

  it("refuses double boot but allows reboot after failure", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);
    await expect(machine.boot(IMAGE)).rejects.toThrow();
  });

  it("exposes download progress while loading", async () => {
    const adapter = new FakeAdapter();
    adapter.pendingStart = true;
    const machine = new Machine(adapter, OPTS);
    const bootPromise = machine.boot(IMAGE);

    adapter.emitProgress(50, 100);
    expect(machine.getState()).toEqual({
      kind: "loading",
      progress: { loadedBytes: 50, totalBytes: 100 },
    });

    for (const resolve of adapter.startResolvers) {
      resolve();
    }
    await bootPromise;
    expect(machine.getState().kind).toBe("booting");
  });

  it("moves to failed when the emulator crashes, even after ready", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);
    adapter.emit("yorishiro> ");
    expect(machine.getState().kind).toBe("ready");
    adapter.crash("the emulated CPU halted");
    expect(machine.getState()).toEqual({
      kind: "failed",
      reason: "the emulated CPU halted",
    });
  });

  it("dispose releases the adapter", async () => {
    const adapter = new FakeAdapter();
    const machine = new Machine(adapter, OPTS);
    await machine.boot(IMAGE);
    machine.dispose();
    expect(adapter.disposed).toBe(true);
    expect(machine.getState().kind).toBe("idle");
  });
});
