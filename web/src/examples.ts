/**
 * The example catalog: one-click Scheme programs that show off what it
 * means to have a live Scheme REPL as PID 1 of a real Linux kernel.
 *
 * Every `code` string is sent to the guest REPL verbatim (plus a newline),
 * so each entry must be a single complete s-expression sequence.
 */

export type ExampleCategory =
  | "machine"
  | "scheme"
  | "supervision"
  | "midi"
  | "songs"
  | "tricks"
  | "drawing"
  | "chaos";

export interface Example {
  readonly id: string;
  readonly category: ExampleCategory;
  readonly title: string;
  readonly blurb: string;
  readonly code: string;
}

export const CATEGORY_LABELS: Readonly<Record<ExampleCategory, string>> = {
  machine: "You are the machine",
  scheme: "Scheme, live",
  supervision: "Init duties, by hand",
  midi: "MIDI out — /dev/ttyS1",
  songs: "Songbook",
  tricks: "Party tricks",
  drawing: "Drawing — character graphics",
  chaos: "Chaos engineering",
};

export const EXAMPLES: readonly Example[] = [
  // --- You are the machine -------------------------------------------------
  {
    id: "whoami",
    category: "machine",
    title: "Who am I?",
    blurb: "PID 1. Not a shell under an OS — the OS's first process itself.",
    code: "(sys-getpid)",
  },
  {
    id: "alone",
    category: "machine",
    title: "How alone are you?",
    blurb: "List every process on the machine. It is a short list.",
    code: '(filter #/^\\d+$/ (sys-readdir "/proc"))',
  },
  {
    id: "kernel",
    category: "machine",
    title: "Ask the kernel",
    blurb: "Read /proc/version like any file — from Scheme.",
    code: '(call-with-input-file "/proc/version" read-line)',
  },
  {
    id: "uname",
    category: "machine",
    title: "uname, natively",
    blurb: "The uname(2) syscall, bound as a Scheme procedure.",
    code: "(sys-uname)",
  },
  {
    id: "meminfo",
    category: "machine",
    title: "How much world is there?",
    blurb: "First lines of /proc/meminfo — the RAM your browser granted.",
    code:
      '(with-input-from-file "/proc/meminfo"\n' +
      "  (lambda () (dotimes (i 3 'meminfo) (print (read-line)))))",
  },
  {
    id: "uptime",
    category: "machine",
    title: "Seconds since creation",
    blurb: "This universe began when the page loaded.",
    code: '(call-with-input-file "/proc/uptime" read-line)',
  },
  {
    id: "entropy",
    category: "machine",
    title: "Dice from the kernel",
    blurb: "Read bytes from /dev/urandom.",
    code:
      '(with-input-from-file "/dev/urandom"\n' +
      "  (lambda () (list (read-byte) (read-byte) (read-byte))))",
  },
  {
    id: "soul",
    category: "machine",
    title: "Read the machine's soul",
    blurb: "PID 1 is a text file. Print the init program you are talking to.",
    code:
      '(call-with-input-file "/sbin/yorishiro-init.scm"\n' +
      "  (lambda (p) (dotimes (i 12 'the-soul) (print (read-line p)))))",
  },
  {
    id: "spawn",
    category: "machine",
    title: "Spawn a child",
    blurb: "fork+exec busybox. You are init; every process is your child.",
    code: '(sys-system "uname -a")',
  },
  {
    id: "df",
    category: "machine",
    title: "The filesystem",
    blurb: "An immutable initramfs plus a tmpfs — Nerves-style.",
    code: '(sys-system "ls -la /")',
  },

  // --- Scheme, live --------------------------------------------------------
  {
    id: "squares",
    category: "scheme",
    title: "First light",
    blurb: "Map over a list. The obligatory hello.",
    code: "(map (lambda (n) (* n n)) (iota 10))",
  },
  {
    id: "million",
    category: "scheme",
    title: "A million loops, no stack",
    blurb: "Proper tail calls: iterate a million times inside a browser tab.",
    code: "(let loop ((i 0)) (if (< i 1000000) (loop (+ i 1)) i))",
  },
  {
    id: "callcc",
    category: "scheme",
    title: "Escape through a continuation",
    blurb: "call/cc aborts the addition and returns 42 directly.",
    code: "(call/cc (lambda (k) (+ 1 (k 42))))",
  },
  {
    id: "bigfact",
    category: "scheme",
    title: "100! exactly",
    blurb: "Arbitrary-precision integers, no library needed.",
    code: "(let fact ((n 100)) (if (zero? n) 1 (* n (fact (- n 1)))))",
  },
  {
    id: "macro",
    category: "scheme",
    title: "Grow the language",
    blurb: "Define a `swap!` macro, then use it. The language is soft clay.",
    code:
      "(begin\n" +
      "  (define-syntax swap!\n" +
      "    (syntax-rules ()\n" +
      "      ((_ a b) (let ((tmp a)) (set! a b) (set! b tmp)))))\n" +
      "  (define x 'kernel) (define y 'lisp)\n" +
      "  (swap! x y)\n" +
      "  (list x y))",
  },
  {
    id: "prompt",
    category: "scheme",
    title: "Repaint the prompt",
    blurb: "The prompt is just a variable in the running init. Change it.",
    code: '(set! *prompt* "\\u03bb> ")',
  },
  {
    id: "apropos",
    category: "scheme",
    title: "Every syscall binding",
    blurb: "apropos over the live image: the machine documents itself.",
    code: "(apropos 'sys-set)",
  },
  {
    id: "persist",
    category: "scheme",
    title: "Write, then reread",
    blurb: "S-expressions to disk (tmpfs) and back: data is code is data.",
    code:
      "(begin\n" +
      '  (with-output-to-file "/tmp/soul.scm"\n' +
      "    (lambda () (write '(hello from inside the vessel))))\n" +
      '  (call-with-input-file "/tmp/soul.scm" read))',
  },

  // --- Init duties, by hand ------------------------------------------------
  {
    id: "mortal",
    category: "supervision",
    title: "A mortal child",
    blurb:
      "fork a child that dies at once. The SIGCHLD handler in init reaps it — no zombie remains.",
    code:
      "(let ((pid (sys-fork)))\n" +
      "  (if (zero? pid)\n" +
      "      (sys-exit 0)\n" +
      '      (begin (format #t "child ~a was born and reaped~%" pid)\n' +
      "             'reaped)))",
  },
  {
    id: "supervisor",
    category: "supervision",
    title: "OTP in ten lines",
    blurb:
      "A supervisor: run a worker, watch it die, restart it. Nerves' core idea, hand-rolled.",
    code:
      "(begin\n" +
      "  (define (supervise worker restarts)\n" +
      "    (dotimes (i restarts)\n" +
      "      (let ((pid (sys-fork)))\n" +
      "        (if (zero? pid)\n" +
      "            (begin (worker i) (sys-exit 0))\n" +
      "            (guard (e (else #f)) (sys-waitpid pid))))))\n" +
      "  (supervise\n" +
      '    (lambda (i) (format #t "worker #~a: crash! (and that is fine)~%" i))\n' +
      "    3)\n" +
      "  'all-restarts-done)",
  },
  {
    id: "zombie-count",
    category: "supervision",
    title: "Zombie census",
    blurb: "Prove the reaper works: count Z-state processes (expect zero).",
    code:
      "(length\n" +
      "  (filter\n" +
      "    (lambda (d)\n" +
      "      (guard (e (else #f))\n" +
      '        (and (#/^\\d+$/ d)\n' +
      "             (string-scan\n" +
      '               (call-with-input-file #"/proc/~|d|/stat" read-line)\n' +
      '               " Z "))))\n' +
      '    (sys-readdir "/proc")))',
  },

  // --- MIDI out ------------------------------------------------------------
  {
    id: "chime",
    category: "midi",
    title: "Startup chime",
    blurb:
      "The machine's second serial port is a MIDI jack. Arpeggiate a C major 7 through it.",
    code: "(play '(60 64 67 71 72) 140)",
  },
  {
    id: "chord",
    category: "midi",
    title: "Hold a chord",
    blurb: "Three note-ons, a beat of silence, three note-offs.",
    code:
      "(begin\n" +
      "  (for-each note-on '(60 64 67))\n" +
      "  (rest-ms 900)\n" +
      "  (for-each note-off '(60 64 67))\n" +
      "  'rung)",
  },
  {
    id: "scale-walk",
    category: "midi",
    title: "Map over a scale",
    blurb: "The melody is a list; transpose it with map before playing.",
    code: "(play (map (lambda (n) (+ n 12)) '(60 62 64 65 67 69 71 72)) 120)",
  },
  {
    id: "kernel-composes",
    category: "midi",
    title: "The kernel composes",
    blurb:
      "Eight notes drawn from /dev/urandom: kernel entropy as a melody.",
    code:
      "(with-input-from-file \"/dev/urandom\"\n" +
      "  (lambda ()\n" +
      "    (play (map (lambda (_) (+ 48 (modulo (read-byte) 25)))\n" +
      "               (iota 8))\n" +
      "          170)))",
  },
  {
    id: "raw-midi",
    category: "midi",
    title: "Speak raw MIDI",
    blurb:
      "No helpers: write the 1983 wire protocol byte by byte. 0x90 60 100 is note-on middle C.",
    code:
      "(begin (midi-bytes #x90 60 100) (rest-ms 500) (midi-bytes #x80 60 0))",
  },

  // --- Songs (public-domain melodies) --------------------------------------
  {
    id: "star-spangled-banner",
    category: "songs",
    title: "The Star-Spangled Banner",
    blurb: "The opening strain, played by PID 1 through its serial jack.",
    code:
      "(for-each (lambda (p) (note-on (car p)) (rest-ms (cadr p)) (note-off (car p)))\n" +
      "  '((67 300) (64 300) (60 700) (64 700) (67 700) (72 1300)\n" +
      "    (76 300) (74 300) (72 700) (64 700) (66 700) (67 1300)\n" +
      "    (67 300) (67 300) (76 700) (74 300) (72 300) (71 1300)\n" +
      "    (69 300) (71 300) (72 700) (72 300) (67 300) (64 700) (60 900)))",
  },
  {
    id: "amazing-grace",
    category: "songs",
    title: "Amazing Grace",
    blurb: "One verse of the hymn, as a list of (note ms) pairs.",
    code:
      "(for-each (lambda (p) (note-on (car p)) (rest-ms (cadr p)) (note-off (car p)))\n" +
      "  '((62 400) (67 800) (71 400) (69 400) (67 800) (64 400) (62 800)\n" +
      "    (62 400) (67 800) (71 400) (69 400) (71 800) (74 1200)\n" +
      "    (74 400) (74 800) (71 400) (74 400) (71 400) (67 800) (62 800)\n" +
      "    (64 400) (67 800) (71 400) (69 400) (67 1600)))",
  },
  {
    id: "kojo-no-tsuki",
    category: "songs",
    title: "Kōjō no Tsuki (荒城の月)",
    blurb: "Rentarō Taki, 1901 — a ruined castle, moonlight, and a Wasm CPU.",
    code:
      "(for-each (lambda (p) (note-on (car p)) (rest-ms (cadr p)) (note-off (car p)))\n" +
      "  '((64 400) (64 400) (69 400) (71 400) (72 600) (71 200) (69 800)\n" +
      "    (66 400) (66 400) (71 400) (69 400) (67 400) (66 400) (64 1200)\n" +
      "    (64 400) (64 400) (69 400) (71 400) (72 600) (71 200) (69 800)\n" +
      "    (66 400) (66 400) (71 400) (69 400) (67 400) (66 400) (64 1200)))",
  },
  {
    id: "furusato",
    category: "songs",
    title: "Furusato (故郷)",
    blurb: "\"Usagi oishi kano yama…\" — the 1914 school song, abridged.",
    code:
      "(for-each (lambda (p) (note-on (car p)) (rest-ms (cadr p)) (note-off (car p)))\n" +
      "  '((60 400) (60 400) (60 400) (62 400) (64 400) (64 400) (62 400) (64 400)\n" +
      "    (65 400) (64 400) (62 400) (60 400) (64 600) (62 200) (62 800)\n" +
      "    (60 400) (60 400) (60 400) (62 400) (64 400) (64 400) (62 400) (64 400)\n" +
      "    (65 400) (64 400) (62 400) (60 400) (64 600) (62 200) (60 800)))",
  },

  // --- Party tricks --------------------------------------------------------
  {
    id: "quine",
    category: "tricks",
    title: "A quine",
    blurb:
      "Evaluates to a copy of its own source. The machine reproduces itself.",
    code:
      "((lambda (x) (list x (list (quote quote) x)))\n" +
      " (quote (lambda (x) (list x (list (quote quote) x)))))",
  },
  {
    id: "ackermann",
    category: "tricks",
    title: "Ackermann(2, 3)",
    blurb: "The function that taught mathematics what \"grows fast\" means.",
    code:
      "(begin\n" +
      "  (define (ack m n)\n" +
      "    (cond ((zero? m) (+ n 1))\n" +
      "          ((zero? n) (ack (- m 1) 1))\n" +
      "          (else (ack (- m 1) (ack m (- n 1))))))\n" +
      "  (ack 2 3))",
  },
  {
    id: "primes",
    category: "tricks",
    title: "Primes to 100",
    blurb: "Trial division, the honest way.",
    code:
      "(filter (lambda (n)\n" +
      "          (and (> n 1)\n" +
      "               (not (find (lambda (d) (zero? (modulo n d)))\n" +
      "                          (iota (- n 2) 2)))))\n" +
      "        (iota 100 1))",
  },
  {
    id: "fizzbuzz",
    category: "tricks",
    title: "FizzBuzz, on a real kernel",
    blurb: "The interview question, evaluated by PID 1 of an actual OS.",
    code:
      "(dotimes (i 20 'fizzbuzz)\n" +
      "  (let ((n (+ i 1)))\n" +
      "    (print (cond ((zero? (modulo n 15)) \"FizzBuzz\")\n" +
      "                 ((zero? (modulo n 3)) \"Fizz\")\n" +
      "                 ((zero? (modulo n 5)) \"Buzz\")\n" +
      "                 (else n)))))",
  },
  {
    id: "collatz",
    category: "tricks",
    title: "The Collatz staircase",
    blurb: "3n+1 from 27. Nobody knows why it always lands on 1.",
    code:
      "(let loop ((n 27) (steps '()))\n" +
      "  (if (= n 1)\n" +
      "      (reverse (cons 1 steps))\n" +
      "      (loop (if (even? n) (quotient n 2) (+ (* 3 n) 1))\n" +
      "            (cons n steps))))",
  },
  {
    id: "pi-leibniz",
    category: "tricks",
    title: "Approximate π",
    blurb: "The Leibniz series, 100000 terms summed in floating point.",
    code:
      "(* 4 (let loop ((k 0) (sum 0.0))\n" +
      "       (if (= k 100000) sum\n" +
      "           (loop (+ k 1)\n" +
      "                 (+ sum (/ (if (even? k) 1.0 -1.0) (+ (* 2 k) 1)))))))",
  },

  // --- Drawing -------------------------------------------------------------
  {
    id: "mandelbrot",
    category: "drawing",
    title: "The fractal shore",
    blurb:
      "The Mandelbrot set, computed by PID 1 and rendered in characters.",
    code:
      "(begin\n" +
      "  (dotimes (y 22)\n" +
      "    (dotimes (x 64)\n" +
      "      (let ((cr (- (* x 0.046875) 2.2)) (ci (- (* y 0.1) 1.05)))\n" +
      "        (let loop ((i 0) (zr 0.0) (zi 0.0))\n" +
      "          (if (and (< i 32) (< (+ (* zr zr) (* zi zi)) 4.0))\n" +
      "              (loop (+ i 1)\n" +
      "                    (+ (- (* zr zr) (* zi zi)) cr)\n" +
      "                    (+ (* 2.0 zr zi) ci))\n" +
      "              (display (if (= i 32) #\\@\n" +
      '                           (string-ref " .,:;=+*#%" (modulo i 10))))))))\n' +
      "    (newline))\n" +
      "  'the-shore-of-chaos)",
  },
  {
    id: "sierpinski",
    category: "drawing",
    title: "Triangle of triangles",
    blurb: "Pascal's triangle mod 2: one logand, infinite structure.",
    code:
      "(begin\n" +
      "  (dotimes (y 16)\n" +
      "    (display (make-string (- 16 y) #\\space))\n" +
      "    (dotimes (x (+ y 1))\n" +
      "      (display (if (zero? (logand x (- y x))) \"* \" \"  \")))\n" +
      "    (newline))\n" +
      "  'sierpinski)",
  },
  {
    id: "lambda-wave",
    category: "drawing",
    title: "A wave of lambdas",
    blurb: "sin(x), plotted in the only letter this machine believes in.",
    code:
      "(begin\n" +
      "  (dotimes (i 24)\n" +
      "    (print (string-append\n" +
      "            (make-string\n" +
      "             (round->exact (* 22 (+ 1.0 (sin (* i 0.5))))) #\\space)\n" +
      '            "\\u03bb")))\n' +
      "  'wave)",
  },

  // --- Chaos engineering ---------------------------------------------------
  {
    id: "fill-tmp",
    category: "chaos",
    title: "Fill the writable world",
    blurb: "Write 1000 files to tmpfs, then count them. Rootfs stays immutable.",
    code:
      "(begin\n" +
      "  (dotimes (i 1000)\n" +
      '    (with-output-to-file #"/tmp/grain-~|i|" (lambda () (display i))))\n' +
      '  (length (sys-readdir "/tmp")))',
  },
  {
    id: "reboot",
    category: "chaos",
    title: "End the universe",
    blurb:
      "reboot(2) — the emulated CPU does not survive it. The vessel dies; summon again to be reborn.",
    code: '(sys-system "reboot -f")',
  },
];
