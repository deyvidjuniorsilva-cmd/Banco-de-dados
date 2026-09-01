import { describe, expect, it } from "vitest";
import {
  buildAccountPrompt,
  buildConfirmationPrompt,
  parseAccountSelection,
  parseConfirmationReply,
} from "./conversation";

const RECEIPT = {
  date: "2026-08-12",
  description: "Farmacia",
  amount: 29.9,
  direction: "saida" as const,
};

const ACCOUNTS = [
  { id: "acc-1", name: "Nubank (cartão)" },
  { id: "acc-2", name: "Sicoob Credivar (conta)" },
];

describe("buildAccountPrompt", () => {
  it("lista as contas numeradas com os dados extraídos", () => {
    const prompt = buildAccountPrompt(RECEIPT, ACCOUNTS);
    expect(prompt).toContain("R$ 29,90");
    expect(prompt).toContain("12/08");
    expect(prompt).toContain("Farmacia");
    expect(prompt).toContain("1) Nubank (cartão)");
    expect(prompt).toContain("2) Sicoob Credivar (conta)");
  });
});

describe("parseAccountSelection", () => {
  it("aceita o número da opção", () => {
    expect(parseAccountSelection("1", ACCOUNTS)).toBe("acc-1");
    expect(parseAccountSelection("2", ACCOUNTS)).toBe("acc-2");
  });

  it("aceita o nome da conta (case-insensitive, parcial)", () => {
    expect(parseAccountSelection("nubank", ACCOUNTS)).toBe("acc-1");
  });

  it("retorna null para uma resposta que não corresponde a nenhuma conta", () => {
    expect(parseAccountSelection("banco inexistente", ACCOUNTS)).toBeNull();
  });

  it("retorna null para um número fora do intervalo", () => {
    expect(parseAccountSelection("9", ACCOUNTS)).toBeNull();
  });

  it("retorna null para uma resposta vazia", () => {
    expect(parseAccountSelection("", ACCOUNTS)).toBeNull();
  });

  it("retorna null para uma resposta só com espaços", () => {
    expect(parseAccountSelection("   ", ACCOUNTS)).toBeNull();
  });
});

describe("buildConfirmationPrompt", () => {
  it("monta a mensagem de confirmação com os dados e a conta escolhida", () => {
    const prompt = buildConfirmationPrompt(RECEIPT, "Nubank (cartão)");
    expect(prompt).toContain("Farmacia");
    expect(prompt).toContain("R$ 29,90");
    expect(prompt).toContain("12/08");
    expect(prompt).toContain("Nubank (cartão)");
    expect(prompt).toContain("sim/não");
  });
});

describe("parseConfirmationReply", () => {
  it("reconhece variações de confirmação", () => {
    expect(parseConfirmationReply("sim")).toBe("confirm");
    expect(parseConfirmationReply("Sim")).toBe("confirm");
    expect(parseConfirmationReply(" SIM ")).toBe("confirm");
  });

  it("reconhece variações de cancelamento", () => {
    expect(parseConfirmationReply("não")).toBe("cancel");
    expect(parseConfirmationReply("nao")).toBe("cancel");
    expect(parseConfirmationReply("Não")).toBe("cancel");
  });

  it("retorna 'unknown' para qualquer outra resposta", () => {
    expect(parseConfirmationReply("talvez")).toBe("unknown");
  });
});
