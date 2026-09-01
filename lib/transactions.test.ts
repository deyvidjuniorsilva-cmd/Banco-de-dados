import { describe, expect, it } from "vitest";
import { markDuplicateRows } from "./transactions";
import type { ParsedTransaction } from "./parsers/types";

describe("markDuplicateRows", () => {
  it("marca como duplicata e desmarca a inclusão quando bate com uma transação existente", () => {
    const rows: ParsedTransaction[] = [
      { date: "2026-08-12", description: "Drogaria", amount: 29.9, direction: "saida" },
    ];
    const existing = [{ occurredOn: "2026-08-12", amount: 29.9 }];

    const result = markDuplicateRows(rows, existing);

    expect(result).toEqual([
      {
        date: "2026-08-12",
        description: "Drogaria",
        amount: 29.9,
        direction: "saida",
        possibleDuplicate: true,
        included: false,
      },
    ]);
  });

  it("mantém incluída uma linha sem correspondência", () => {
    const rows: ParsedTransaction[] = [
      { date: "2026-08-12", description: "Mercado", amount: 100, direction: "saida" },
    ];

    const result = markDuplicateRows(rows, []);

    expect(result[0].possibleDuplicate).toBe(false);
    expect(result[0].included).toBe(true);
  });
});
