"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "@xterm/xterm/css/xterm.css";
import { Machine } from "../src/machine";
import { V86Adapter } from "../src/emulator/v86-adapter";
import type { MachineState } from "../src/emulator/types";
import {
  CATEGORY_LABELS,
  EXAMPLES,
  type ExampleCategory,
} from "../src/examples";
import { MidiParser, MidiRouter } from "../src/midi";

const IMAGE = {
  kernelUrl: "/machine/bzImage",
  cmdline: "console=ttyS0 rdinit=/sbin/yorishiro-init",
  memoryBytes: 128 * 1024 * 1024,
} as const;

const READY_MARKER = "yorishiro> ";
const BOOT_TIMEOUT_MS = 120_000;

const CATEGORY_ORDER: readonly ExampleCategory[] = [
  "machine",
  "scheme",
  "supervision",
  "midi",
  "chaos",
];

function statusLabel(state: MachineState): string {
  switch (state.kind) {
    case "idle":
      return "asleep";
    case "loading": {
      if (state.progress !== null && state.progress.totalBytes !== null) {
        const pct = Math.min(
          100,
          Math.round(
            (state.progress.loadedBytes / state.progress.totalBytes) * 100,
          ),
        );
        return `summoning the vessel — ${String(pct)}%`;
      }
      return "summoning the vessel";
    }
    case "booting":
      return "the spirit is descending";
    case "ready":
      return "inhabited — Scheme is PID 1";
    case "failed":
      return "the vessel is empty";
  }
}

function StatusBadge({ state }: { state: MachineState }): ReactNode {
  return (
    <span className="status" data-kind={state.kind} role="status">
      <span className="dot" aria-hidden />
      {statusLabel(state)}
    </span>
  );
}

function BootVeil({ state }: { state: MachineState }): ReactNode {
  if (state.kind === "ready" || state.kind === "booting") {
    return null;
  }
  const pct =
    state.kind === "loading" &&
    state.progress !== null &&
    state.progress.totalBytes !== null
      ? Math.min(
          100,
          (state.progress.loadedBytes / state.progress.totalBytes) * 100,
        )
      : null;
  return (
    <div className="veil">
      <div className="sigil" aria-hidden>
        依
      </div>
      {state.kind === "failed" ? (
        <>
          <p className="veil-title">the spirit did not descend</p>
          <p className="veil-sub">{state.reason}</p>
          <button
            type="button"
            className="retry"
            onClick={() => {
              window.location.reload();
            }}
          >
            summon again
          </button>
        </>
      ) : (
        <>
          <p className="veil-title">summoning the vessel</p>
          <p className="veil-sub">
            downloading a complete Linux universe — kernel, userland and a
            Scheme interpreter destined to become PID 1
          </p>
          {pct !== null ? (
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${String(pct)}%` }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MachineConsole(): ReactNode {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);
  const machineRef = useRef<Machine | null>(null);
  const focusRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<MachineState>({ kind: "idle" });
  const [midiSink, setMidiSink] = useState("built-in synth");

  useEffect(() => {
    const termEl = termRef.current;
    const stageEl = stageRef.current;
    if (termEl === null || stageEl === null) {
      return;
    }
    const lifecycle = { disposed: false };
    const cleanupRef: { current: (() => void) | null } = { current: null };

    void (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (lifecycle.disposed) {
        return;
      }

      const terminal = new Terminal({
        cursorBlink: true,
        convertEol: false,
        fontFamily:
          'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 14,
        lineHeight: 1.25,
        theme: {
          background: "#0c0c13",
          foreground: "#d9d7cf",
          cursor: "#b18af8",
          cursorAccent: "#0c0c13",
          selectionBackground: "rgba(177, 138, 248, 0.3)",
        },
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(termEl);
      fit.fit();

      const observer = new ResizeObserver(() => {
        fit.fit();
      });
      observer.observe(stageEl);

      const machine = new Machine(new V86Adapter(), {
        readyMarker: READY_MARKER,
        bootTimeoutMs: BOOT_TIMEOUT_MS,
      });
      machineRef.current = machine;
      focusRef.current = () => {
        terminal.focus();
      };
      machine.onOutput((text) => {
        terminal.write(text);
      });
      machine.onState((next) => {
        setState(next);
        if (next.kind === "ready") {
          terminal.focus();
        }
      });
      terminal.onData((data) => {
        machine.sendInput(data);
      });

      const midiParser = new MidiParser();
      const midiRouter = new MidiRouter();
      const unsubscribeSink = midiRouter.onSinkChange(setMidiSink);
      const unsubscribeMidi = machine.onMidiByte((byte) => {
        for (const message of midiParser.feed(byte)) {
          midiRouter.handle(message);
        }
      });

      cleanupRef.current = () => {
        unsubscribeMidi();
        unsubscribeSink();
        observer.disconnect();
        machine.dispose();
        terminal.dispose();
        machineRef.current = null;
        focusRef.current = null;
      };

      await machine.boot(IMAGE);
    })();

    return () => {
      lifecycle.disposed = true;
      cleanupRef.current?.();
    };
  }, []);

  const ready = state.kind === "ready";

  return (
    <div className="shell">
      <header className="masthead">
        <h1 className="wordmark">
          yorishiro <span className="kanji">依代</span>
        </h1>
        <p className="tagline">a LISP machine in your browser</p>
        <span className="status midi-chip" title="MIDI messages from /dev/ttyS1 play here">
          <span aria-hidden>♪</span> {midiSink}
        </span>
        <StatusBadge state={state} />
      </header>

      <div className="deck">
        <section
          className="stage"
          ref={stageRef}
          aria-label="Machine console"
        >
          <div className="term" ref={termRef} />
          <BootVeil state={state} />
        </section>

        <aside className="rail" aria-label="Scheme examples">
          <p className="rail-hint">
            {ready
              ? "Click to run inside the machine."
              : "Examples awaken once the machine is inhabited."}
          </p>
          {CATEGORY_ORDER.map((category) => (
            <section key={category}>
              <h2>{CATEGORY_LABELS[category]}</h2>
              {EXAMPLES.filter((e) => e.category === category).map(
                (example) => (
                  <button
                    key={example.id}
                    type="button"
                    className="example"
                    disabled={!ready}
                    onClick={() => {
                      machineRef.current?.sendInput(`${example.code}\n`);
                      focusRef.current?.();
                    }}
                  >
                    <span className="example-title">{example.title}</span>
                    <span className="example-blurb">{example.blurb}</span>
                    <code className="example-code">
                      {example.code.replaceAll("\n", " ")}
                    </code>
                  </button>
                ),
              )}
            </section>
          ))}
        </aside>
      </div>

      <footer className="colophon">
        <span>
          <strong>how:</strong> Buildroot-built Linux · Gauche Scheme as PID 1
          · v86 Wasm x86 emulator, all in this tab
        </span>
        <span>
          <strong>why:</strong> if Nerves can make Linux speak Elixir, a page
          can make it speak Scheme
        </span>
      </footer>
    </div>
  );
}
