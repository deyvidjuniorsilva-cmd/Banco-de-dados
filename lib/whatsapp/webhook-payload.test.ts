import { describe, expect, it } from "vitest";
import { parseIncomingMessage } from "./webhook-payload";

function payloadWith(message: Record<string, unknown>) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

describe("parseIncomingMessage", () => {
  it("extrai uma mensagem de imagem", () => {
    const result = parseIncomingMessage(
      payloadWith({
        from: "5511999999999",
        type: "image",
        image: { id: "media-1", mime_type: "image/jpeg" },
      })
    );
    expect(result).toEqual({
      from: "5511999999999",
      type: "image",
      mediaId: "media-1",
      mimeType: "image/jpeg",
    });
  });

  it("extrai uma mensagem de documento (PDF)", () => {
    const result = parseIncomingMessage(
      payloadWith({
        from: "5511999999999",
        type: "document",
        document: { id: "media-2", mime_type: "application/pdf" },
      })
    );
    expect(result).toEqual({
      from: "5511999999999",
      type: "document",
      mediaId: "media-2",
      mimeType: "application/pdf",
    });
  });

  it("extrai uma mensagem de texto", () => {
    const result = parseIncomingMessage(
      payloadWith({ from: "5511999999999", type: "text", text: { body: "sim" } })
    );
    expect(result).toEqual({ from: "5511999999999", type: "text", text: "sim" });
  });

  it("retorna null quando não há mensagens no payload (ex: status de entrega)", () => {
    const payload = { entry: [{ changes: [{ value: {} }] }] };
    expect(parseIncomingMessage(payload)).toBeNull();
  });

  it("retorna null para um payload malformado", () => {
    expect(parseIncomingMessage({})).toBeNull();
    expect(parseIncomingMessage(null)).toBeNull();
  });

  it("marca tipos não suportados como 'unknown'", () => {
    const result = parseIncomingMessage(
      payloadWith({ from: "5511999999999", type: "audio" })
    );
    expect(result).toEqual({ from: "5511999999999", type: "unknown" });
  });
});
