import { describe, expect, it } from "vitest";
import { matchCategory } from "./categorization";

describe("matchCategory", () => {
  it("retorna a categoria da primeira regra cuja palavra-chave aparece na descrição", () => {
    const rules = [
      { keyword: "uber", categoryId: "cat-transporte" },
      { keyword: "mercado", categoryId: "cat-mercado" },
    ];
    expect(matchCategory("UBER *TRIP", rules)).toBe("cat-transporte");
  });

  it("não diferencia maiúsculas de minúsculas", () => {
    const rules = [{ keyword: "MERCADO", categoryId: "cat-mercado" }];
    expect(matchCategory("mercado livre - parcela 1/3", rules)).toBe(
      "cat-mercado"
    );
  });

  it("usa a primeira regra que bater, respeitando a ordem da lista", () => {
    const rules = [
      { keyword: "pix", categoryId: "cat-transferencia" },
      { keyword: "uber", categoryId: "cat-transporte" },
    ];
    expect(matchCategory("PIX UBER TRIP", rules)).toBe("cat-transferencia");
  });

  it("retorna null quando nenhuma regra bate", () => {
    const rules = [{ keyword: "uber", categoryId: "cat-transporte" }];
    expect(matchCategory("padaria bom pao", rules)).toBeNull();
  });

  it("retorna null quando não há regras", () => {
    expect(matchCategory("qualquer coisa", [])).toBeNull();
  });
});
