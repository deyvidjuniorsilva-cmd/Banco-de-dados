import { describe, it, expect } from "vitest";
import { resolveMonthParams, buildMonthSummary, type DashboardTransaction } from "./dashboard";

describe("resolveMonthParams", () => {
  it("usa o mês atual quando não há parâmetros", () => {
    const now = new Date();
    const result = resolveMonthParams({});
    expect(result).toEqual({ year: now.getFullYear(), month: now.getMonth() + 1 });
  });

  it("usa ano e mês da URL quando fornecidos", () => {
    const result = resolveMonthParams({ ano: "2026", mes: "3" });
    expect(result).toEqual({ year: 2026, month: 3 });
  });

  it("usa o mês atual quando mes está fora do intervalo válido (mes=13)", () => {
    const now = new Date();
    const result = resolveMonthParams({ ano: "2026", mes: "13" });
    expect(result).toEqual({ year: 2026, month: now.getMonth() + 1 });
  });

  it("usa o ano atual quando ano não é numérico (ano=abc)", () => {
    const now = new Date();
    const result = resolveMonthParams({ ano: "abc", mes: "3" });
    expect(result).toEqual({ year: now.getFullYear(), month: 3 });
  });

  it("usa o mês atual quando mes é zero (mes=0)", () => {
    const now = new Date();
    const result = resolveMonthParams({ ano: "2026", mes: "0" });
    expect(result).toEqual({ year: 2026, month: now.getMonth() + 1 });
  });
});

describe("buildMonthSummary", () => {
  it("retorna totais zerados e porCategoria vazio para mês sem transações", () => {
    const result = buildMonthSummary([]);
    expect(result).toEqual({ saldo: 0, receitas: 0, gastos: 0, porCategoria: [] });
  });

  it("calcula saldo, receitas e gastos misturando entrada e saída", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-05",
        description: "Salário",
        amount: 5000,
        direction: "entrada",
        categoryId: null,
        categoryName: null,
      },
      {
        id: "2",
        occurredOn: "2026-08-10",
        description: "Mercado",
        amount: 300,
        direction: "saida",
        categoryId: "cat-mercado",
        categoryName: "Mercado",
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.receitas).toBe(5000);
    expect(result.gastos).toBe(300);
    expect(result.saldo).toBe(4700);
  });

  it("agrupa transações sem categoria em 'Sem categoria'", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-05",
        description: "Compra avulsa",
        amount: 50,
        direction: "saida",
        categoryId: null,
        categoryName: null,
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.porCategoria).toEqual([
      { categoryId: null, categoryName: "Sem categoria", total: 50 },
    ]);
  });

  it("soma múltiplas transações da mesma categoria e ordena por total decrescente", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-01",
        description: "Uber",
        amount: 20,
        direction: "saida",
        categoryId: "cat-transporte",
        categoryName: "Transporte",
      },
      {
        id: "2",
        occurredOn: "2026-08-02",
        description: "Mercado",
        amount: 300,
        direction: "saida",
        categoryId: "cat-mercado",
        categoryName: "Mercado",
      },
      {
        id: "3",
        occurredOn: "2026-08-03",
        description: "99",
        amount: 15,
        direction: "saida",
        categoryId: "cat-transporte",
        categoryName: "Transporte",
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.porCategoria).toEqual([
      { categoryId: "cat-mercado", categoryName: "Mercado", total: 300 },
      { categoryId: "cat-transporte", categoryName: "Transporte", total: 35 },
    ]);
  });
});
