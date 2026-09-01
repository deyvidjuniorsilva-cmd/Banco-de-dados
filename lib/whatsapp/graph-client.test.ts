import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWhatsappMedia, sendWhatsappText } from "./graph-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadWhatsappMedia", () => {
  it("busca a URL da mídia e depois baixa os bytes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://cdn.example.com/file", mime_type: "image/jpeg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWhatsappMedia("media-123", "token-abc");

    expect(result.mimeType).toBe("image/jpeg");
    expect(Buffer.from(result.data)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/media-123",
      { headers: { Authorization: "Bearer token-abc" } }
    );
  });

  it("lança erro quando a busca de metadados falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));
    await expect(downloadWhatsappMedia("media-123", "token-abc")).rejects.toThrow();
  });
});

describe("sendWhatsappText", () => {
  it("envia uma mensagem de texto para o número informado", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsappText("5511999999999", "Lançado ✅", {
      phoneNumberId: "phone-1",
      accessToken: "token-abc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/phone-1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "5511999999999",
      type: "text",
      text: { body: "Lançado ✅" },
    });
  });

  it("lança erro quando o envio falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
    await expect(
      sendWhatsappText("5511999999999", "oi", { phoneNumberId: "phone-1", accessToken: "t" })
    ).rejects.toThrow();
  });
});
