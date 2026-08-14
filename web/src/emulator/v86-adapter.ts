import type {
  DownloadProgress,
  EmulatorAdapter,
  MachineImage,
} from "./types";

/**
 * The single bridge between yorishiro and v86. All knowledge of v86's
 * untyped, script-tag-loaded, event-string-based API lives here and
 * nowhere else.
 *
 * The v86 runtime is served as plain static assets from /v86/ (copied out
 * of node_modules by scripts/copy-v86-assets.mjs), which keeps the loading
 * path independent of any bundler.
 */

const V86_SCRIPT_URL = "/v86/libv86.js";
const V86_WASM_URL = "/v86/v86.wasm";
const SEABIOS_URL = "/v86/seabios.bin";
const VGABIOS_URL = "/v86/vgabios.bin";

interface V86Instance {
  add_listener(event: string, listener: (data: unknown) => void): void;
  serial0_send(data: string): void;
  destroy(): Promise<void>;
}

type V86Constructor = new (options: Record<string, unknown>) => V86Instance;

function getGlobalV86(): V86Constructor | null {
  const value = (globalThis as unknown as Record<string, unknown>)["V86"];
  return typeof value === "function" ? (value as V86Constructor) : null;
}

function loadV86Script(): Promise<V86Constructor> {
  const existing = getGlobalV86();
  if (existing !== null) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = V86_SCRIPT_URL;
    script.onload = () => {
      const ctor = getGlobalV86();
      if (ctor !== null) {
        resolve(ctor);
      } else {
        reject(new Error("libv86.js loaded but window.V86 is missing"));
      }
    };
    script.onerror = () => {
      reject(new Error(`failed to load ${V86_SCRIPT_URL}`));
    };
    document.head.appendChild(script);
  });
}

function toDownloadProgress(data: unknown): DownloadProgress | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  const loaded = record["loaded"];
  const total = record["total"];
  if (typeof loaded !== "number") {
    return null;
  }
  return {
    loadedBytes: loaded,
    totalBytes: typeof total === "number" && total > 0 ? total : null,
  };
}

export class V86Adapter implements EmulatorAdapter {
  private emulator: V86Instance | null = null;
  private readonly serialListeners = new Set<(byte: number) => void>();
  private readonly midiListeners = new Set<(byte: number) => void>();
  private readonly progressListeners = new Set<
    (progress: DownloadProgress) => void
  >();
  private readonly crashListeners = new Set<(reason: string) => void>();
  private readonly windowErrorHandler = (event: ErrorEvent): void => {
    const message = typeof event.message === "string" ? event.message : "";
    if (/panicked|unreachable|RuntimeError/i.test(message)) {
      for (const listener of this.crashListeners) {
        listener("the emulated CPU halted and cannot continue");
      }
    }
  };

  async start(image: MachineImage): Promise<void> {
    if (this.emulator !== null) {
      throw new Error("emulator already started");
    }
    window.addEventListener("error", this.windowErrorHandler);
    const V86 = await loadV86Script();
    const emulator = new V86({
      wasm_path: V86_WASM_URL,
      memory_size: image.memoryBytes,
      vga_memory_size: 8 * 1024 * 1024,
      bios: { url: SEABIOS_URL },
      vga_bios: { url: VGABIOS_URL },
      bzimage: { url: image.kernelUrl },
      cmdline: image.cmdline,
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      // COM2 is the machine's MIDI jack; v86 only wires it on request.
      uart1: true,
    });
    emulator.add_listener("serial0-output-byte", (data: unknown) => {
      if (typeof data === "number") {
        for (const listener of this.serialListeners) {
          listener(data);
        }
      }
    });
    emulator.add_listener("serial1-output-byte", (data: unknown) => {
      if (typeof data === "number") {
        for (const listener of this.midiListeners) {
          listener(data);
        }
      }
    });
    emulator.add_listener("download-progress", (data: unknown) => {
      const progress = toDownloadProgress(data);
      if (progress !== null) {
        for (const listener of this.progressListeners) {
          listener(progress);
        }
      }
    });
    this.emulator = emulator;
    await new Promise<void>((resolve) => {
      emulator.add_listener("emulator-started", () => {
        resolve();
      });
    });
  }

  sendSerial(data: string): void {
    if (this.emulator === null) {
      throw new Error("emulator not started");
    }
    this.emulator.serial0_send(data);
  }

  onSerialByte(listener: (byte: number) => void): () => void {
    this.serialListeners.add(listener);
    return () => {
      this.serialListeners.delete(listener);
    };
  }

  onMidiByte(listener: (byte: number) => void): () => void {
    this.midiListeners.add(listener);
    return () => {
      this.midiListeners.delete(listener);
    };
  }

  onDownloadProgress(
    listener: (progress: DownloadProgress) => void,
  ): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  onCrash(listener: (reason: string) => void): () => void {
    this.crashListeners.add(listener);
    return () => {
      this.crashListeners.delete(listener);
    };
  }

  dispose(): void {
    const emulator = this.emulator;
    this.emulator = null;
    window.removeEventListener("error", this.windowErrorHandler);
    this.serialListeners.clear();
    this.midiListeners.clear();
    this.progressListeners.clear();
    this.crashListeners.clear();
    if (emulator !== null) {
      void emulator.destroy();
    }
  }
}
