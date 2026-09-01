import { describe, expect, it } from "vitest";
import { findPossibleDuplicate } from "./duplicates";

describe("findPossibleDuplicate", () => {
  it("detecta duplicata com mesma data e mesmo valor", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-12", amount: 29.9 }]
    );
    expect(result).toBe(true);
  });

  it("detecta duplicata com data até 2 dias de diferença", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-14", amount: 29.9 }]
    );
    expect(result).toBe(true);
  });

  it("não detecta duplicata quando a data está a mais de 2 dias", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-15", amount: 29.9 }]
    );
    expect(result).toBe(false);
  });

  it("não detecta duplicata quando o valor é diferente", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-12", amount: 35.0 }]
    );
    expect(result).toBe(false);
  });

  it("retorna false para lista vazia de transações existentes", () => {
    expect(findPossibleDuplicate({ date: "2026-08-12", amount: 29.9 }, [])).toBe(false);
  });
});
