# yorishiro — project rules

## What this is

Browser-based LISP machine: Buildroot-built minimal Linux with Gauche Scheme
as PID 1, booted in a Wasm x86 emulator on a web page. Nerves-style
construction, language swapped to Scheme.

## Layout

- `firmware/` — Buildroot BR2_EXTERNAL tree (defconfig, kernel config,
  Gauche package, rootfs overlay with the Scheme init).
- `web/` — TypeScript (strict) web app. Emulator is behind an adapter
  interface (`web/src/emulator/types.ts`); never call emulator APIs
  directly from UI code.

## Commands

- Firmware build (Docker required; colima on this Mac):
  `firmware/build.sh` (long-running; run in background).
- Web: `npm --prefix web install`, `npm --prefix web run dev`,
  `npm --prefix web run check` (typecheck + lint + test). Run `check`
  before every commit.

## Hard rules

- Code, comments, test data: English only. No Japanese strings in code.
- TypeScript: no `any`, no non-null assertions (`!`), no `as` casts except
  in the single emulator adapter file that wraps the untyped emulator API.
- The firmware image is read-only by design; runtime state goes to a
  separate writable partition (when we add one). Do not add writable paths
  to the rootfs.
- Do not commit Buildroot output (`firmware/output/`, `*.img`, `*.iso`,
  `dl/`); they are gitignored.
