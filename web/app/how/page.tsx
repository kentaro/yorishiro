import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "yorishiro — how it works",
  description:
    "The construction of a browser LISP machine: Buildroot, Gauche as " +
    "PID 1, the v86 Wasm emulator, and a serial-port MIDI jack — plus a " +
    "tutorial for programming the machine.",
};

const ARCHITECTURE = String.raw`
+----------------------------------------------------------+
|  your browser tab                                        |
|  +----------------------------------------------------+  |
|  |  v86 — x86 emulator compiled to WebAssembly        |  |
|  |  +----------------------------------------------+  |  |
|  |  |  Linux 6.12 (32-bit, built with Buildroot)   |  |  |
|  |  |  +----------------------------------------+  |  |  |
|  |  |  |  PID 1 = gosh (Gauche Scheme)          |  |  |  |
|  |  |  |    REPL ......... /dev/ttyS0 (COM1)    |  |  |  |
|  |  |  |    MIDI jack .... /dev/ttyS1 (COM2)    |  |  |  |
|  |  |  +----------------------------------------+  |  |  |
|  |  +----------------------------------------------+  |  |
|  +----------------------------------------------------+  |
|   ttyS0 <-> xterm.js console                             |
|   ttyS1 --> MIDI parser --> Web MIDI device / synth      |
+----------------------------------------------------------+`;

function Code({ children }: { children: string }): ReactNode {
  return (
    <pre className="how-code">
      <code>{children}</code>
    </pre>
  );
}

export default function HowPage(): ReactNode {
  return (
    <main className="how">
      <header className="how-header">
        <Link href="/" className="how-back">
          ← back to the machine
        </Link>
        <h1>how it works</h1>
        <p className="how-lede">
          yorishiro is a real Linux machine whose first and only inhabitant
          is a Scheme interpreter, booted entirely inside your browser.
          Nothing is simulated in the theatrical sense: the kernel is a
          real kernel, the processes are real processes, and when you
          reboot it, it really dies.
        </p>
      </header>

      <section>
        <h2>the construction</h2>
        <pre className="how-code">{ARCHITECTURE}</pre>
        <p>
          The pattern is borrowed from{" "}
          <a href="https://nerves-project.org/">Nerves</a>, the
          Elixir/Erlang embedded framework: use{" "}
          <a href="https://buildroot.org/">Buildroot</a> to produce a
          minimal Linux where the kernel is nothing but a hardware
          abstraction layer, and hand PID 1 — the first process, the one
          whose death is the machine&apos;s death — directly to a language
          runtime. Nerves puts the Erlang VM there. yorishiro puts{" "}
          <a href="https://practical-scheme.net/gauche/">Gauche Scheme</a>{" "}
          there. The construction is language-agnostic; the choice of
          language is the point.
        </p>
        <p>
          The firmware is one artifact: a bzImage with the whole root
          filesystem embedded as an initramfs (about 13 MB). The kernel
          command line says{" "}
          <code>console=ttyS0 rdinit=/sbin/yorishiro-init</code>. That
          init is four <code>mount</code> lines of shell followed by{" "}
          <code>exec /usr/bin/gosh</code> — and because <code>exec</code>{" "}
          replaces the process, PID 1 <em>is</em> the Scheme interpreter
          from that moment on. It reaps zombies on SIGCHLD, ignores the
          signals that would kill it, and serves a REPL on the serial
          console. Those are the only duties Unix actually demands of an
          init; everything else an init system does is convention.
        </p>
        <p>
          The browser side boots this image with{" "}
          <a href="https://github.com/copy/v86">v86</a>, an x86 emulator
          compiled to WebAssembly, and wires the guest&apos;s serial port
          to an xterm.js terminal. Line editing and history live on the
          browser side (the guest tty runs with echo off), a watchdog
          covers the whole journey from download to prompt, and the second
          serial port — COM2, enabled with v86&apos;s <code>uart1</code>{" "}
          option — is treated as a MIDI jack: MIDI has been a 31,250-baud
          serial protocol since 1983, so the machine plays music by
          writing bytes to <code>/dev/ttyS1</code>. The page parses them
          (running status included) and routes them to a real Web MIDI
          device if you have one, or to a built-in polysynth if you
          don&apos;t.
        </p>
      </section>

      <section>
        <h2>tutorial — programming the machine</h2>
        <p>
          The console is a standard Scheme REPL, except that the process
          evaluating your expressions holds the machine alive. Enter
          submits a line; Up/Down recall history. Multi-line expressions
          are fine — the reader waits for balanced parentheses.
        </p>

        <h3>1. first words</h3>
        <Code>{`(+ 1 2)
(map (lambda (n) (* n n)) (iota 10))
(sys-getpid)   ; => 1. you are the first process.`}</Code>

        <h3>2. the machine is a file tree</h3>
        <p>
          Everything Linux knows is readable from Scheme, because Scheme
          is not sandboxed here — it is the system.
        </p>
        <Code>{`(call-with-input-file "/proc/version" read-line)
(sys-uname)
(filter #/^\\d+$/ (sys-readdir "/proc"))  ; every process on the machine`}</Code>

        <h3>3. children, and what init owes them</h3>
        <p>
          PID 1 adopts every orphan. Fork a child, let it die, and note
          that no zombie remains — the SIGCHLD handler in the init you are
          talking to reaped it.
        </p>
        <Code>{`(let ((pid (sys-fork)))
  (if (zero? pid)
      (sys-exit 0)                                   ; child: die at once
      (format #t "child ~a was born and reaped~%" pid)))`}</Code>

        <h3>4. write a supervisor</h3>
        <p>
          Nerves&apos; deepest idea is that failure is normal and restart
          is the recovery strategy. The whole of it fits in a definition:
        </p>
        <Code>{`(define (supervise worker restarts)
  (dotimes (i restarts)
    (let ((pid (sys-fork)))
      (if (zero? pid)
          (begin (worker i) (sys-exit 0))
          (guard (e (else #f)) (sys-waitpid pid))))))

(supervise (lambda (i) (format #t "worker ~a crashed, fine~%" i)) 3)`}</Code>

        <h3>5. music</h3>
        <p>
          <code>note-on</code>, <code>note-off</code>, <code>play</code>{" "}
          and <code>play-song</code> are defined in the init. Notes are
          MIDI numbers (60 = middle C); <code>play-song</code> takes{" "}
          <code>(note ms)</code> pairs and 0 is a rest.
        </p>
        <Code>{`(play '(60 64 67 71 72) 140)                  ; arpeggio
(play-song '((60 400) (0 200) (67 800)))      ; with rhythm and rests
(with-input-from-file "/dev/urandom"          ; kernel entropy as melody
  (lambda ()
    (play (map (lambda (_) (+ 48 (modulo (read-byte) 25))) (iota 8)) 170)))`}</Code>

        <h3>6. change the machine while it runs</h3>
        <p>
          Nothing is compiled in, nothing is sacred. The prompt is a
          variable; the init&apos;s own source is a readable file; any
          definition can be replaced while the machine breathes.
        </p>
        <Code>{`(set! *prompt* "λ> ")
(define (help) (print "you are on your own now"))
(call-with-input-file "/sbin/yorishiro-init.scm"
  (lambda (p) (dotimes (i 12) (print (read-line p)))))`}</Code>

        <h3>7. mortality</h3>
        <p>
          The root filesystem is immutable; <code>/tmp</code> is the only
          writable ground and it vanishes with the machine. Rebooting
          calls a real <code>reboot(2)</code> — which the emulated CPU
          does not survive. Reload the page and an identical universe
          boots again, with no memory of you. Whether that is the same
          machine is left as an exercise.
        </p>
        <Code>{`(with-output-to-file "/tmp/soul.scm"
  (lambda () (write '(i was here))))
(sys-system "reboot -f")   ; the end`}</Code>
      </section>

      <section>
        <h2>build it yourself</h2>
        <p>
          The repository has two halves. <code>firmware/</code> is a
          Buildroot external tree: <code>firmware/build.sh</code> runs the
          whole build inside Docker and drops the bzImage into{" "}
          <code>web/public/machine/</code>. <code>web/</code> is this page
          — strict TypeScript, Next.js, with the emulator confined behind
          a single adapter interface and the lifecycle modeled as a state
          machine (<code>npm run check</code> runs typecheck, lint and
          tests). The same firmware boots under QEMU with{" "}
          <code>
            qemu-system-i386 -kernel bzImage -append &quot;console=ttyS0
            rdinit=/sbin/yorishiro-init&quot; -nographic
          </code>
          .
        </p>
      </section>

      <section>
        <h2>lineage</h2>
        <p>
          The idea that a Scheme can be PID 1 is proven in production by{" "}
          <a href="https://www.gnu.org/software/shepherd/">GNU Shepherd</a>{" "}
          (Guile), init of Guix System since 2013. One rung below Linux
          sits <a href="https://scheme.fail/">Loko Scheme</a>, which runs
          on bare metal with drivers written in Scheme — the same
          construction, minus the kernel. At the bottom of the lineage are
          the historical Lisp machines (MIT CADR, Symbolics), whose CPUs
          executed Lisp natively. yorishiro is not one of those; it is a
          machine that Lisp <em>inhabits</em> rather than a machine{" "}
          <em>made of</em> Lisp — which is why it is named after the
          vessel, not the spirit.
        </p>
      </section>
    </main>
  );
}
