import { describe, expect, it } from "vitest";
import { parseSicoob } from "./sicoob";
import { SICOOB_SAMPLE_TEXT } from "./fixtures/sicoob-sample";

describe("parseSicoob", () => {
  it("extrai uma transação de crédito (entrada)", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-01",
      description: "PIX REC.OUTRA IF MT",
      amount: 1000,
      direction: "entrada",
    });
  });

  it("extrai uma transação de débito (saida)", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-05",
      description: "COMP MASTER MAESTRO",
      amount: 25.5,
      direction: "saida",
    });
  });

  it("extrai transferência Pix corretamente", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-15",
      description: "TRANSF. PIX SICOOB",
      amount: 200,
      direction: "saida",
    });
  });

  it("ignora linhas de SALDO ANTERIOR e SALDO DO DIA", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result.find((t) => t.description.includes("SALDO"))).toBeUndefined();
    expect(result).toHaveLength(4);
  });

  it("aplica ano anterior quando o mês da transação é depois do mês final do período", () => {
    const text = `
PERÍODO: 15/12/2026 - 15/01/2027

28/12 COMP MASTER MAESTRO 50,00D
`;
    const result = parseSicoob(text);
    expect(result).toContainEqual({
      date: "2026-12-28",
      description: "COMP MASTER MAESTRO",
      amount: 50,
      direction: "saida",
    });
  });

  it("lança erro quando o período não é encontrado", () => {
    expect(() => parseSicoob("nada aqui")).toThrow();
  });

  it("retorna array vazio para um período válido sem transações", () => {
    expect(
      parseSicoob("PERÍODO: 01/07/2026 - 31/07/2026\nnada mais aqui")
    ).toEqual([]);
  });
});
