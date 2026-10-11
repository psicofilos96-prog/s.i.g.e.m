import { describe, expect, it } from "vitest";
import { guardDerived, homologatedRules, indicatorReadiness, validateRule, type CalcRule } from "./calc-rules";

const rule = (o: Partial<CalcRule>): CalcRule => ({ id: "r1", logical_id: "l1", version: 1, program_key: "producao-textual", edition_label: "2026-1", rule_kind: "limiar",
  rule_key: "criterio-90", payload: { value: 90, comparison: ">=" }, source_ref: "Documento X", reason: null, author_user_id: "u", recorded_at: "2026-01-01", ...o });

describe("catálogo de regras de cálculo", () => {
  it("sem regra homologada o indicador fica pendente e o valor derivado é bloqueado", () => {
    const r = indicatorReadiness("pt-criterio-limiar", "2026-1", []);
    expect(r.status).toBe("regra-pendente");
    expect(guardDerived(r, () => 1)).toEqual({ value: null, reason: "Regra pendente: Limiar." });
  });
  it("regra não homologada não libera", () => {
    expect(homologatedRules([rule({})], [])).toEqual([]);
  });
  it("homologada na mesma edição libera; outra edição não", () => {
    const h = homologatedRules([rule({})], [{ rule_version_id: "r1", decision: "homologado", recorded_at: "2026-01-02" }]);
    expect(indicatorReadiness("pt-criterio-limiar", "2026-1", h).status).toBe("pronto");
    expect(indicatorReadiness("pt-criterio-limiar", "2026-2", h).status).toBe("regra-pendente");
  });
  it("revogação posterior bloqueia de novo", () => {
    const h = homologatedRules([rule({})], [{ rule_version_id: "r1", decision: "homologado", recorded_at: "2026-01-02" }, { rule_version_id: "r1", decision: "revogado", recorded_at: "2026-01-03" }]);
    expect(h).toEqual([]);
  });
  it("nova versão não homologada substitui a anterior e bloqueia", () => {
    const h = homologatedRules([rule({}), rule({ id: "r2", version: 2 })], [{ rule_version_id: "r1", decision: "homologado", recorded_at: "2026-01-02" }]);
    expect(h).toEqual([]);
  });
  it("duas regras homologadas do mesmo tipo são ambíguas", () => {
    const rs = [rule({}), rule({ id: "r2", logical_id: "l2" })];
    const h = homologatedRules(rs, rs.map((r) => ({ rule_version_id: r.id, decision: "homologado" as const, recorded_at: "2026-01-02" })));
    expect(indicatorReadiness("pt-criterio-limiar", "2026-1", h).status).toBe("ambiguo");
  });
  it("valida forma sem inventar valor", () => {
    expect(validateRule("peso", {}, "Doc")).not.toEqual([]);
    expect(validateRule("formula", { kind: "livre" }, "Doc")).not.toEqual([]);
    expect(validateRule("limiar", { value: 90, comparison: ">=" }, "")).toEqual(["Fonte documental obrigatória."]);
  });
});
