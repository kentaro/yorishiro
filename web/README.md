# yorishiro web

TypeScript web app that boots the yorishiro firmware (bzImage with embedded
initramfs, Gauche as PID 1) in the v86 Wasm emulator and connects the guest
serial console to an xterm.js terminal.

## Design

- `src/emulator/types.ts` — the `EmulatorAdapter` interface and the
  `MachineState` discriminated union. UI code depends on these only.
- `src/emulator/v86-adapter.ts` — the single file that talks to v86.
- `src/machine.ts` — lifecycle state machine with a boot watchdog.
- `src/serial.ts` — streaming UTF-8 decoding and prompt detection.

## Commands

```
npm install
npm run dev      # local dev server (expects web/public/machine/bzImage)
npm run check    # typecheck + lint + tests
npm run build    # production build
```

The firmware image comes from `../firmware/build.sh`, which copies the
resulting bzImage into `public/machine/`.
