import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "yorishiro — a LISP machine in your browser",
  description:
    "A minimal Linux built with Buildroot, with Gauche Scheme as PID 1, " +
    "booting inside a WebAssembly x86 emulator on this very page.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
