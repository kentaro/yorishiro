# yorishiro

Scheme as PID 1 of a browser Linux: a Nerves-style minimal Linux whose PID 1 is
[Gauche Scheme](https://practical-scheme.net/gauche/), booted entirely inside
a WebAssembly x86 emulator.

"Yorishiro" (依代) is a Japanese word for an object that a spirit descends
into and inhabits. Here, the spirit is Lisp; the vessel is a web page.

## Architecture

```
+--------------------------------------------------+
|  Browser (TypeScript web app)                    |
|  +--------------------------------------------+  |
|  |  Wasm x86 emulator                         |  |
|  |  +--------------------------------------+  |  |
|  |  |  Linux kernel (custom, Buildroot)    |  |  |
|  |  |  +--------------------------------+  |  |  |
|  |  |  |  PID 1 = Gauche (gosh)         |  |  |  |
|  |  |  |  Scheme REPL on the console    |  |  |  |
|  |  |  +--------------------------------+  |  |  |
|  |  +--------------------------------------+  |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

Following the Nerves construction (Buildroot rootfs + language runtime as
PID 1), but language-agnostic in principle and Scheme in practice:

- `firmware/` — Buildroot external tree that produces the kernel + rootfs
  image. Gauche is built as a Buildroot package; `/sbin/init` is a Scheme
  program that mounts pseudo-filesystems, reaps zombies, handles signals,
  and starts a REPL on the console.
- `web/` — TypeScript web app (strict mode) that boots the image in a
  Wasm emulator and wires the guest serial console to an in-page terminal.

The same Buildroot artifact is intended to also boot on real hardware
(Raspberry Pi) and under QEMU for local development.

## Development

See `firmware/README.md` and `web/README.md`.
