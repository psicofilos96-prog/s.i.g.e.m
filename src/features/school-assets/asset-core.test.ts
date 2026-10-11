import { describe, expect, it } from "vitest";
import { compareInfra, duplicateTags, inventoryOverdue, priorityOf, projectAsset, woMove } from "./asset-core";

const t = { seq: 1, kind: "tombamento" as const, on: "2026-01-01", schoolId: "A", roomId: "s1", actorPersonId: "p" };
describe("patrimônio", () => {
  it("projeção e movimentação preservam cadeia", () => {
    const r = projectAsset([t, { seq: 2, kind: "movimentacao", on: "2026-02-01", schoolId: "B", roomId: null, actorPersonId: "p" }]);
    expect(r.ok && r.state.schoolId).toBe("B");
  });
  it("sem tombamento, lacuna, baixa sem motivo e evento após baixa são recusados", () => {
    expect(projectAsset([]).ok).toBe(false);
    expect(projectAsset([t, { seq: 3, kind: "condicao", on: "x", actorPersonId: "p" }])).toEqual({ ok: false, reason: "cadeia-com-lacuna" });
    expect(projectAsset([t, { seq: 2, kind: "baixa", on: "x", actorPersonId: "p" }])).toEqual({ ok: false, reason: "baixa-sem-motivo" });
    expect(projectAsset([t, { seq: 2, kind: "baixa", on: "x", reason: "inservível", actorPersonId: "p" }, { seq: 3, kind: "movimentacao", on: "y", actorPersonId: "p" }])).toEqual({ ok: false, reason: "evento-apos-baixa" });
  });
  it("tombamento duplicado", () => expect(duplicateTags(["1", "2", "1"])).toEqual(["1"]));
  it("OS: segregação e evidência", () => {
    expect(woMove("vistoriada", "aprovada", { requesterId: "p", actorId: "p", evidenceCount: 0 }).ok).toBe(false);
    expect(woMove("executada", "aceita", { requesterId: "p", actorId: "q", evidenceCount: 0 })).toEqual({ ok: false, reason: "sem-evidencia" });
    expect(woMove("solicitada", "aprovada", { requesterId: "p", actorId: "q", evidenceCount: 0 }).ok).toBe(false);
  });
  it("prioridade e inventário só configurados", () => {
    expect(priorityOf({}, "eletrica")).toBeNull();
    expect(inventoryOverdue("2025-01-01", null, "2026-10-11")).toBeNull();
    expect(inventoryOverdue("2025-01-01", 365, "2026-10-11")).toBe(true);
  });
  it("infraestrutura só compara mesma data", () => {
    expect(compareInfra({ refDate: "2026-05-27", value: 10 }, { refDate: "2026-03-01", value: 10 })).toBe("nao-comparavel");
    expect(compareInfra({ refDate: "2026-05-27", value: 10 }, { refDate: "2026-05-27", value: 9 })).toBe("divergente");
  });
});
