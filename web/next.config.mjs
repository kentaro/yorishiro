import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required by LOLIPOP! Deploy Now.
  output: "standalone",
  // Pin the workspace root: a stray lockfile in $HOME otherwise makes
  // Next.js treat the home directory as the project root and scan it.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
