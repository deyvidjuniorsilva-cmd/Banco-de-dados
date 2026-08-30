import { describe, expect, it } from "vitest";
import { parseNubank } from "./nubank";
import { NUBANK_SAMPLE_TEXT } from "./fixtures/nubank-sample";

describe("parseNubank", () => {
  it("extrai uma transação simples de uma linha", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-16",
      description: "Padaria Bom Pão",
      amount: 18.5,
      direction: "saida",
    });
  });

  it("extrai uma linha sem os 4 dígitos do cartão (IOF)", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-18",
      description: 'IOF de "Loja Estrangeira Xyz"',
      amount: 2.1,
      direction: "saida",
    });
  });

  it("extrai uma transação internacional em múltiplas linhas", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-20",
      description: "Loja Estrangeira Xyz",
      amount: 52.3,
      direction: "saida",
    });
  });

  it("marca pagamento da fatura (valor negativo) como entrada", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-15",
      description: "Pagamento em 15 FEV",
      amount: 300,
      direction: "entrada",
    });
  });

  it("ignora a linha de subtotal do titular", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(
      result.find((t) => t.description.includes("Fulano De Tal"))
    ).toBeUndefined();
  });

  it("aplica ano anterior quando o mês da transação é depois do mês de vencimento", () => {
    const text = `
Data de vencimento: 10 JAN 2027

29 DEZ •••• 0001 Compra de Fim de Ano R$ 99,90
`;
    const result = parseNubank(text);
    expect(result).toContainEqual({
      date: "2026-12-29",
      description: "Compra de Fim de Ano",
      amount: 99.9,
      direction: "saida",
    });
  });

  it("retorna array vazio para texto sem transações", () => {
    expect(parseNubank("nada aqui")).toEqual([]);
  });
});
