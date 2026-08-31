import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { extractReceiptData } from "./receipt-extraction";

function fakeClient(toolInput: unknown): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: toolInput
          ? [{ type: "tool_use", name: "record_receipt", id: "tool-1", input: toolInput }]
          : [{ type: "text", text: "não consigo ler essa imagem" }],
      }),
    },
  } as unknown as Anthropic;
}

const MEDIA = { data: Buffer.from([1, 2, 3]), mimeType: "image/jpeg" };

describe("extractReceiptData", () => {
  it("retorna os dados extraídos quando o Claude preenche a tool corretamente", async () => {
    const client = fakeClient({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });

    const result = await extractReceiptData(client, MEDIA);

    expect(result).toEqual({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });
  });

  it("retorna null quando não há bloco tool_use na resposta", async () => {
    const client = fakeClient(null);
    const result = await extractReceiptData(client, MEDIA);
    expect(result).toBeNull();
  });

  it("retorna null quando o input da tool está malformado", async () => {
    const client = fakeClient({ date: "2026-08-12", amount: "não é número" });
    const result = await extractReceiptData(client, MEDIA);
    expect(result).toBeNull();
  });

  it("envia um bloco document para PDFs e um bloco image para fotos", async () => {
    const client = fakeClient({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });

    await extractReceiptData(client, { data: Buffer.from([1]), mimeType: "application/pdf" });

    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const contentBlock = call.messages[0].content[0];
    expect(contentBlock.type).toBe("document");
    expect(contentBlock.source.media_type).toBe("application/pdf");
  });
});
