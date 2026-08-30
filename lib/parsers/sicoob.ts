import type { Direction, ParsedTransaction } from "./types";

const LINE_PATTERN = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])$/;
const PERIODO_PATTERN =
  /PERÍODO:\s*\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/;
const IGNORED_DESCRIPTIONS = [
  "SALDO ANTERIOR",
  "SALDO DO DIA",
  "SALDO BLOQ.ANTERIOR",
];

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function directionFromSuffix(suffix: string): Direction {
  return suffix === "C" ? "entrada" : "saida";
}

export function parseSicoob(text: string): ParsedTransaction[] {
  const periodoMatch = text.match(PERIODO_PATTERN);
  if (!periodoMatch) {
    throw new Error("Não foi possível encontrar o período do extrato no PDF.");
  }
  const refMonth = parseInt(periodoMatch[2], 10);
  const refYear = parseInt(periodoMatch[3], 10);

  const lines = text.split("\n").map((line) => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;

    const [, day, month, description, amountRaw, suffix] = match;
    const trimmedDescription = description.trim();
    if (IGNORED_DESCRIPTIONS.includes(trimmedDescription.toUpperCase())) {
      continue;
    }

    const monthNum = parseInt(month, 10);
    const year = monthNum > refMonth ? refYear - 1 : refYear;

    transactions.push({
      date: `${year}-${month}-${day}`,
      description: trimmedDescription,
      amount: parseAmount(amountRaw),
      direction: directionFromSuffix(suffix),
    });
  }

  return transactions;
}
