import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const DESCRIPTION =
  "A minimal Linux built with Buildroot, with Gauche Scheme as PID 1, " +
  "booting inside a WebAssembly x86 emulator on this very page.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yorishiro.lolipop-now.app"),
  title: "yorishiro — Scheme as PID 1 of a browser Linux",
  description: DESCRIPTION,
  openGraph: {
    title: "yorishiro 依代 — Scheme as PID 1 of a browser Linux",
    description: DESCRIPTION,
    url: "/",
    siteName: "yorishiro",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "yorishiro 依代 — Scheme as PID 1 of a browser Linux",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
