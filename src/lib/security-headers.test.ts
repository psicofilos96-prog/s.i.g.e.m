import { describe, expect, it } from "vitest";
import { cacheControlFor, withSecurityHeaders } from "./security-headers";

describe("NWEBSEC.1 cabeçalhos de segurança", () => {
  it("bloqueia embutir por sites estranhos e define referrer/nosniff", () => {
    const h = withSecurityHeaders(new Response("x", { headers: { "content-type": "text/html" } }), "/alunos").headers;
    expect(h.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
    expect(h.get("Content-Security-Policy")).not.toContain("*;");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
  it("páginas e funções do servidor nunca vão para cache", () => {
    expect(cacheControlFor("/alunos", "text/html; charset=utf-8")).toBe("private, no-store");
    expect(cacheControlFor("/_serverFn/abc", null)).toBe("private, no-store");
    expect(cacheControlFor("/assets/app.js", "text/javascript")).toBeNull();
  });
  it("preserva status e corpo", async () => {
    const r = withSecurityHeaders(new Response("oi", { status: 404 }), "/x");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("oi");
  });
});
