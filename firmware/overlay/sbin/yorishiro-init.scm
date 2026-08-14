;; yorishiro-init.scm: PID 1 of the yorishiro LISP machine.
;; Exec'd by /sbin/yorishiro-init after the pseudo filesystems are mounted.
;;
;; Duties of PID 1, all handled in Scheme:
;;   - reap zombie processes on SIGCHLD
;;   - never exit (an exiting PID 1 panics the kernel)
;;   - offer a REPL on the console: the machine's user interface IS Scheme
;;   - drive the MIDI jack on the second serial port

(use gauche.interactive)
(use gauche.termios)

;; The prompt is an ordinary global variable: the machine invites you to
;; (set! *prompt* ...) it while it runs.
(define *prompt* "yorishiro> ")

(define (silence-local-echo!)
  ;; The browser side owns line editing and echo; a guest echo would
  ;; print everything twice.
  (guard (e (else #f))
    (let ((attr (sys-tcgetattr (standard-input-port))))
      (slot-set! attr 'lflag
                 (logand (slot-ref attr 'lflag) (lognot ECHO)))
      (sys-tcsetattr (standard-input-port) TCSANOW attr))))

(define (reap-children!)
  ;; Collect every exited child without blocking. ECHILD raises in Gauche,
  ;; so the guard doubles as the loop terminator.
  (guard (e (else #f))
    (let loop ()
      (receive (pid status) (sys-waitpid -1 :nohang #t)
        (when (and pid (> pid 0))
          (loop))))))

(define (install-signal-handlers!)
  (set-signal-handler! SIGCHLD (lambda (sig) (reap-children!)))
  ;; PID 1 must not die on stray terminal signals.
  (set-signal-handler! SIGINT #f)
  (set-signal-handler! SIGQUIT #f)
  (set-signal-handler! SIGTSTP #f))

;; --- MIDI out ---------------------------------------------------------
;; The machine's second serial port is its MIDI jack. MIDI has always been
;; a serial protocol; the browser side turns these bytes into Web MIDI or
;; a synthesizer. The tty must be raw: the line discipline would otherwise
;; rewrite byte 0x0A (LF) and corrupt the stream.

(define *midi-port* #f)

(define (midi-out)
  (unless *midi-port*
    (guard (e (else #f))
      (let ((port (open-output-file "/dev/ttyS1")))
        (guard (e2 (else #f))
          (let ((attr (sys-tcgetattr port)))
            (slot-set! attr 'oflag
                       (logand (slot-ref attr 'oflag) (lognot OPOST)))
            (sys-tcsetattr port TCSANOW attr)))
        (set! *midi-port* port))))
  *midi-port*)

(define (midi-bytes . bytes)
  (let ((port (midi-out)))
    (if port
        (begin
          (for-each (lambda (b) (write-byte b port)) bytes)
          (flush port)
          #t)
        'no-midi-port)))

(define (note-on note . args)
  (let ((vel (if (pair? args) (car args) 100)))
    (midi-bytes #x90 note vel)))

(define (note-off note)
  (midi-bytes #x80 note 0))

(define (rest-ms ms)
  (sys-nanosleep (* ms 1000000)))

(define (play notes . args)
  ;; Play a list of MIDI note numbers in sequence. A note of 0 is a rest.
  (let ((ms (if (pair? args) (car args) 180)))
    (for-each (lambda (n)
                (if (zero? n)
                    (rest-ms ms)
                    (begin (note-on n) (rest-ms ms) (note-off n))))
              notes)
    'played))

(define (play-song pairs)
  ;; Play a list of (note ms) pairs. A note of 0 is a rest.
  (for-each (lambda (p)
              (let ((n (car p)) (ms (cadr p)))
                (if (zero? n)
                    (rest-ms ms)
                    (begin (note-on n) (rest-ms ms) (note-off n)))))
            pairs)
  'played)

;; ----------------------------------------------------------------------

(define (help)
  (print "This is Gauche Scheme running as PID 1 on Linux.")
  (print "Everything is live. Some things to try:")
  (print "  (sys-getpid)                     ; who you are")
  (print "  (call-with-input-file \"/proc/version\" read-line)")
  (print "  (sys-system \"uname -a\")          ; spawn a child process")
  (print "  (play '(60 64 67 72) 150)        ; the serial port is a MIDI jack")
  (print "  (play-song '((60 400) (64 400))) ; (note ms) pairs")
  (print "  (set! *prompt* \"\\u03bb> \")          ; the prompt is a variable")
  (print "  (apropos 'sys-)                  ; every syscall binding")
  (values))

(define (banner)
  (print)
  (print "                      _     _")
  (print " _   _  ___  _ __(_)___| |__ (_)_ __ ___")
  (print "| | | |/ _ \\| '__| / __| '_ \\| | '__/ _ \\")
  (print "| |_| | (_) | |  | \\__ \\ | | | | | | (_) |")
  (print " \\__, |\\___/|_|  |_|___/_| |_|_|_|  \\___/")
  (print " |___/     yorishiro · 依代 · a vessel for Lisp")
  (print)
  (print "Gauche " (gauche-version) " is PID 1 on Linux. This is Scheme")
  (print "all the way down. Type (help) for things to try.")
  (print))

(define (repl-once)
  (display *prompt*)
  (flush)
  (let ((expr (read)))
    (if (eof-object? expr)
        (begin (print) (print ";; EOF ignored — PID 1 cannot leave.") #t)
        (receive results (eval expr (interaction-environment))
          (for-each (lambda (r) (write r) (newline)) results)
          #t))))

(define (repl-forever)
  (let loop ()
    (guard (e (else
               (format #t ";; error: ~a~%"
                       (guard (e2 (else "unprintable condition"))
                         (condition-message e "unknown")))))
      (repl-once))
    (loop)))

(define (main args)
  (silence-local-echo!)
  (install-signal-handlers!)
  (sys-setenv "HOME" "/root" #t)
  (banner)
  (repl-forever)
  ;; Unreachable, but PID 1 must never return.
  (let hang () (sys-pause) (hang)))
