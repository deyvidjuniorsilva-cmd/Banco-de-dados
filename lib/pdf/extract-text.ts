import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";

PDFParse.setWorker(
  pathToFileURL(
    path.join(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs")
  ).href
);

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
