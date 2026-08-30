// Using require for CommonJS version of pdf-parse which has the expected API
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require("pdf-parse");

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text;
}
