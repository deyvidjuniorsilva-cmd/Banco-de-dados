import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Resolve the worker file relative to process.cwd(). This relies on
// `serverExternalPackages: ["pdf-parse"]` in next.config.ts, which tells
// Next.js to load this package from a real node_modules directory at
// runtime instead of bundling it — the standard pattern for
// worker/native-dependent packages (pdfjs-dist, sharp, canvas, etc.).
// With that setting, process.cwd() is the deployment root at runtime on
// both `next dev`/`next start` and Vercel, so this stays correct without
// needing bundler-fragile resolution tricks. (A prior attempt resolved
// this via `createRequire(import.meta.url)` + a package-root walk-up,
// which looked correct in an isolated `node -e` probe but broke at
// runtime under Turbopack's bundling — verified by an actual failed
// upload, not just theory. Reverted to this cwd-based approach, which
// was already verified working end-to-end against a real PDF upload.)
const workerPath = path.join(
  process.cwd(),
  "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"
);
PDFParse.setWorker(pathToFileURL(workerPath).href);

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
