import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Resolve the worker path relative to the pdf-parse package itself rather
// than process.cwd(), so it stays correct regardless of where the process
// is launched from (and so it can be traced into Next's standalone/
// serverless output bundle). pdf-parse's package.json doesn't expose a
// "./package.json" export subpath, so we resolve the package's main entry
// and walk up to the package root instead.
const require = createRequire(import.meta.url);
const pdfParseEntry = require.resolve("pdf-parse");
function findPackageRoot(fromDir: string): string {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (pkg.name === "pdf-parse") return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate pdf-parse package root");
    }
    dir = parent;
  }
}
const pdfParseRoot = findPackageRoot(path.dirname(pdfParseEntry));
const workerPath = path.join(pdfParseRoot, "dist/worker/pdf.worker.mjs");
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
