import type { Direction, ParsedTransaction } from "./types";

const MONTHS: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).join("|");

const LINE_PATTERN = new RegExp(
  `^(\\d{2}) (${MONTH_NAMES})\\s*(?:••••\\s*\\d{4}\\s*)?(.*)$`
);
const AMOUNT_PATTERN = /([-−–]?)\s*R\$\s*([\d.,]+)\s*$/;
const STANDALONE_AMOUNT_PATTERN = /^([-−–]?)\s*R\$\s*([\d.,]+)\s*$/;
const DUE_DATE_PATTERN = new RegExp(
  `Data de vencimento:\\s*(\\d{2}) (${MONTH_NAMES}) (\\d{4})`
);

function parseAmount(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  return Math.abs(parseFloat(normalized));
}

function directionFromSign(sign: string): Direction {
  return sign ? "entrada" : "saida";
}

export function parseNubank(text: string): ParsedTransaction[] {
  const dueMatch = text.match(DUE_DATE_PATTERN);
  if (!dueMatch) {
    throw new Error("Não foi possível encontrar a data de vencimento no PDF.");
  }
  const dueMonth = MONTHS[dueMatch[2]];
  const dueYear = parseInt(dueMatch[3], 10);

  const lines = text.split("\n").map((line) => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(LINE_PATTERN);
    if (!match) continue;

    const [, day, monthAbbr, rest] = match;
    const month = MONTHS[monthAbbr];
    const year = month > dueMonth ? dueYear - 1 : dueYear;
    const date = `${year}-${String(month).padStart(2, "0")}-${day}`;

    const inlineAmount = rest.match(AMOUNT_PATTERN);
    if (inlineAmount) {
      const description = rest.slice(0, inlineAmount.index).trim();
      if (!description) continue;
      transactions.push({
        date,
        description,
        amount: parseAmount(inlineAmount[2]),
        direction: directionFromSign(inlineAmount[1]),
      });
      continue;
    }

    const description = rest.trim();
    if (!description) continue;

    let amountLine: RegExpMatchArray | null = null;
    for (let j = i + 1; j < lines.length && j < i + 6; j++) {
      const candidate = lines[j].match(STANDALONE_AMOUNT_PATTERN);
      if (candidate) {
        amountLine = candidate;
        break;
      }
      if (lines[j].match(LINE_PATTERN)) break;
    }

    if (amountLine) {
      transactions.push({
        date,
        description,
        amount: parseAmount(amountLine[2]),
        direction: directionFromSign(amountLine[1]),
      });
    }
  }

  return transactions;
}
