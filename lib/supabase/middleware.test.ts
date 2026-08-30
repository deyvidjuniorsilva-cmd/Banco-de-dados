import { describe, expect, it } from "vitest";
import { shouldRedirectToLogin } from "./middleware";

describe("shouldRedirectToLogin", () => {
  it("redireciona quando não há usuário e a rota não é pública", () => {
    expect(shouldRedirectToLogin({ hasUser: false, pathname: "/dashboard" })).toBe(true);
  });

  it("não redireciona quando há usuário", () => {
    expect(shouldRedirectToLogin({ hasUser: true, pathname: "/dashboard" })).toBe(false);
  });

  it("não redireciona para a própria página de login", () => {
    expect(shouldRedirectToLogin({ hasUser: false, pathname: "/login" })).toBe(false);
  });
});
