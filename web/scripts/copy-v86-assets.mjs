// Copy the v86 runtime files out of node_modules into public/, so the app
// serves them as plain static assets. This sidesteps bundler-specific asset
// handling entirely and keeps the emulator loading path deterministic.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const v86 = join(root, "node_modules", "v86");
const dest = join(root, "public", "v86");

mkdirSync(dest, { recursive: true });

// seabios.bin / vgabios.bin are vendored directly in public/v86/ (the npm
// package does not ship them); only the build artifacts are copied here.
const files = [
  ["build/libv86.js", "libv86.js"],
  ["build/v86.wasm", "v86.wasm"],
];

for (const [from, to] of files) {
  copyFileSync(join(v86, from), join(dest, to));
}

console.log(`copied ${String(files.length)} v86 assets to public/v86/`);
