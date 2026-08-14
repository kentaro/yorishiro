/**
 * Emulator abstraction. UI code depends on this interface only; the
 * concrete Wasm emulator (v86 today) is wired in behind it, so it can be
 * replaced without touching the rest of the app.
 */

export interface MachineImage {
  /** URL of a bootable bzImage with an embedded initramfs. */
  readonly kernelUrl: string;
  /** Kernel command line. */
  readonly cmdline: string;
  /** Guest RAM in bytes. */
  readonly memoryBytes: number;
}

export interface DownloadProgress {
  readonly loadedBytes: number;
  /** null when the server did not send a length. */
  readonly totalBytes: number | null;
}

export interface EmulatorAdapter {
  /** Start the guest. Resolves once the emulator is running (not booted). */
  start(image: MachineImage): Promise<void>;
  /** Send bytes to the guest serial console. */
  sendSerial(data: string): void;
  /** Subscribe to guest serial output. Returns an unsubscribe function. */
  onSerialByte(listener: (byte: number) => void): () => void;
  /**
   * Subscribe to the guest's second serial port (/dev/ttyS1), which the
   * machine treats as its MIDI out jack. Returns an unsubscribe function.
   */
  onMidiByte(listener: (byte: number) => void): () => void;
  /** Subscribe to image download progress. Returns an unsubscribe function. */
  onDownloadProgress(listener: (progress: DownloadProgress) => void): () => void;
  /**
   * Subscribe to fatal emulator crashes (e.g. the guest executing an
   * instruction the emulator cannot handle). Returns an unsubscribe
   * function.
   */
  onCrash(listener: (reason: string) => void): () => void;
  /** Tear down the emulator and release resources. */
  dispose(): void;
}

/** Lifecycle of the machine, as a discriminated union. */
export type MachineState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly progress: DownloadProgress | null }
  | { readonly kind: "booting" }
  | { readonly kind: "ready" }
  | { readonly kind: "failed"; readonly reason: string };

export type MachineStateListener = (state: MachineState) => void;
