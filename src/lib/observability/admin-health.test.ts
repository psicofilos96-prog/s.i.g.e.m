import { describe, expect, it } from "vitest";
import { actorIssues, alertsFrom, backupClaim, moduleStatus, secretRotation } from "./admin-health";

const now = "2026-10-11T20:00:00Z";
describe("centro de administração", () => {
  it("status sem verificação nunca é ok", () => {
    expect(moduleStatus({ module: "diario", ranAt: null, ok: null }, now, 60)).toBe("nao-verificado");
    expect(moduleStatus({ module: "diario", ranAt: "2026-10-11T10:00:00Z", ok: true }, now, 60)).toBe("verificacao-antiga");
    expect(moduleStatus({ module: "diario", ranAt: "2026-10-11T19:30:00Z", ok: false }, now, 60)).toBe("falha");
  });
  it("backup só com restauração testada", () => {
    expect(backupClaim(null).state).toBe("sem-evidencia");
    expect(backupClaim({ takenAt: "2026-10-10", restoreTestedAt: null, checksumMatched: null, provider: "cloud" }).state).toBe("nao-testado");
    expect(backupClaim({ takenAt: "2026-10-10", restoreTestedAt: "2026-10-11", checksumMatched: true, provider: "cloud" }).state).toBe("verificado");
  });
  it("operador técnico sem capacidade humana nem curinga", () => {
    expect(actorIssues({ id: "op", nature: "operador-tecnico", capabilities: ["homologar-politica", "*", "ler-filas"] })).toEqual(["capacidade-humana:homologar-politica", "curinga"]);
    expect(actorIssues({ id: "p", nature: "pessoa-natural", capabilities: ["homologar-politica"] })).toEqual([]);
  });
  it("rotação de segredo só com política", () => {
    expect(secretRotation({ name: "X", rotatedAt: "2026-01-01" }, null, "2026-10-11").state).toBe("sem-politica");
    expect(secretRotation({ name: "X", rotatedAt: "2026-01-01" }, 90, "2026-10-11").state).toBe("vencido");
  });
  it("alertas deduplicados", () =>
    expect(alertsFrom([{ module: "a", status: "falha" }, { module: "a", status: "falha" }, { module: "b", status: "ok" }])).toEqual(["a"]));
});
