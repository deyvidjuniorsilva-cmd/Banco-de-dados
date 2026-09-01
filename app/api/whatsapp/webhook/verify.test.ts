import { describe, expect, it } from "vitest";
import { verifyWebhookChallenge } from "./route";

const VERIFY_TOKEN = "test-verify-token";

describe("verifyWebhookChallenge", () => {
  it("retorna o challenge quando o modo e o token batem", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBe("12345");
  });

  it("retorna null quando o token não bate", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBeNull();
  });

  it("retorna null quando o modo não é subscribe", () => {
    const params = new URLSearchParams({
      "hub.mode": "unsubscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBeNull();
  });
});
