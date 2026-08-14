# yorishiro (依代) — artist statement (working draft)

_Target: Prix Ars Electronica 2027, Digital Musics & Sound Art (MIDI
performance foregrounded), or 2028 Interactive Art+. Written concept-first
per the Prix submission format: artistic concept → form of interaction →
technical realization, within 2,000 characters._

## Statement

Does software have a place where its soul sits?

In Shinto practice, a _yorishiro_ (依代) is an object prepared so that a
spirit may descend into it and dwell there — a stone, a tree, a mirror.
This work prepares such a vessel: a complete, real Linux machine — kernel,
device drivers, filesystems, entropy pool — conjured inside a web browser
tab by a WebAssembly x86 emulator. Then it invites a spirit in. The spirit
is Lisp.

On every Unix machine a single process, PID 1, is the seat of life. It is
born first, adopts every orphaned process, and its death is the death of
the machine. In yorishiro that seat is held not by an init daemon but by a
Scheme interpreter. The visitor speaks to the machine in parenthesized
incantations, and each expression is evaluated by the very process that
keeps the machine alive: reading the kernel's memory like scripture,
forking mortal children and reaping them, rewriting its own prompt while
it runs. Emulation, here, is not preservation. It is a séance.

The machine's second serial port is a MIDI jack — MIDI has been a serial
protocol since 1983. Kernel entropy can be read as melody; scales are
lists; the visitor livecodes the machine into song in the lineage of
fluxus and the algorave. Or they write one byte to /proc/sysrq-trigger and
watch their universe die — to be reborn on reload, identical, as if no
time had passed.

Lisp was invented in 1958, Linux in 1991; in 1999 the Prix Ars Electronica
gave Linux itself a Golden Nica as a work of collective authorship. This
work lets the older spirit take the younger machine as its vessel, and
asks what animism means when the kami is a programming language and the
shrine is a browser tab.

## Interaction

Single web page. The boot is staged as a summoning: the download of the
20-30 MB universe, the kernel log streaming like a recited lineage, and
the moment the REPL prompt appears — the vessel inhabited. From then on
every keystroke reaches PID 1's reader. A catalog of one-click
incantations (machine introspection, supervision rituals, MIDI music,
chaos) lowers the threshold for visitors who do not write Scheme.

Planned exhibition forms: (1) the web page itself; (2) a livecoded MIDI
performance driving hardware synthesizers through the machine's serial
jack (Digital Musics & Sound Art); (3) a kiosk installation — a small
shrine-like enclosure with a CRT — for physical festival display.

## Technical realization

Buildroot builds a minimal 32-bit x86 Linux whose init is a Gauche Scheme
program (mounting pseudo-filesystems, reaping zombies via SIGCHLD,
handling signals, serving the REPL on ttyS0 and MIDI on ttyS1). The v86
emulator (Wasm) boots the resulting bzImage entirely client-side; a strict
TypeScript application stages the ritual, renders the console via
xterm.js, and routes ttyS1 bytes to Web MIDI devices or a built-in
synthesizer. The same firmware boots on physical hardware. Everything is
open source.

## Notes for future submission

- Prix categories rotate biennially: Digital Musics & Sound Art and
  Artificial Life & Intelligence expected in 2027 (open call ~January);
  Interactive Art+ expected in 2028. Works must be created or
  significantly updated within 2 years of the deadline — record update
  dates.
- Required materials: ~3 min video documentation, high-res photos,
  <=2,000-char description (concept / interaction / technique), portrait +
  bio. S+T+ARTS Prize can be applied to in parallel.
- Jury language to connect with: entanglement, re-animation, reclaiming;
  see Nosukaay (Golden Nica 2024, machine deity) and Organism + Excitable
  Chaos (Golden Nica 2025, a re-animated organ) as adjacent precedents.
