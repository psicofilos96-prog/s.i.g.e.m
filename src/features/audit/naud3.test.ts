import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const s = readFileSync("src/features/audit/audit-page.tsx", "utf8");
describe("NAUD.3 — Central de Auditoria", () => {
  it("eventos relacionados usam rótulo humano, nunca o código cru da ação", () => {
    expect(s).toContain("correlated(all, sel).map((c) => actionLabel(c.action))");
    expect(s).not.toContain("map((c) => c.action)");
  });
  it("entrar, carregar e erro mantêm um título principal", () => {
    expect((s.match(/sr-only">Auditoria e governança de dados/g) ?? []).length).toBe(3);
  });
  it("exportação continua condicionada à permissão e sai do motor de relatórios", () => {
    expect(s).toContain("canExport(actor?.capabilities ?? [])");
    expect(s).toContain("runReport(AUDIT_REPORT");
  });
});
