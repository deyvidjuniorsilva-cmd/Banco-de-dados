import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWhatsappSignature } from "./signature";

const APP_SECRET = "test-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex");
}

describe("verifyWhatsappSignature", () => {
  it("aceita uma assinatura válida", () => {
    const body = '{"hello":"world"}';
    expect(verifyWhatsappSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it("rejeita uma assinatura de outro corpo", () => {
    const body = '{"hello":"world"}';
    expect(verifyWhatsappSignature(body, sign('{"other":"body"}'), APP_SECRET)).toBe(false);
  });

  it("rejeita quando o header está ausente", () => {
    expect(verifyWhatsappSignature('{"a":1}', null, APP_SECRET)).toBe(false);
  });

  it("rejeita uma assinatura com segredo errado", () => {
    const body = '{"hello":"world"}';
    const wrongSignature =
      "sha256=" + createHmac("sha256", "wrong-secret").update(body, "utf8").digest("hex");
    expect(verifyWhatsappSignature(body, wrongSignature, APP_SECRET)).toBe(false);
  });
});
