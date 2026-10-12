import { describe, expect, it } from "vitest";
import { currentPlan, licenseState, planActionProblems, TECH_INTEGRATIONS } from "./integrations-licenses-plan";

describe("L22 integrações, licenças e plano", () => {
  it("cobre os oito setores pedidos", () => {
    expect(new Set(TECH_INTEGRATIONS.map((i) => i.sector)).size).toBe(8);
  });
  it("recusa valor orçamentário sem fonte contábil e referência fora da lista", () => {
    expect(planActionProblems([{ title: "Comprar notebooks", kind: "aquisicao", cost: 10 }])).toContain("acao-0-valor-sem-fonte-contabil");
    expect(planActionProblems([{ title: "Comprar notebooks", kind: "aquisicao", refs: [{ source: "planilha", id: "abc" }] }])).toContain("acao-0-referencia");
  });
  it("plano só vigora aprovado por outra pessoa, sem fallback", () => {
    const v = [{ id: "a", year: 2027, version: 1, personId: "p" }, { id: "b", year: 2027, version: 2, personId: "p" }];
    expect(currentPlan(2027, v, [{ planVersionId: "a", personId: "q" }])).toBeNull();
    expect(currentPlan(2027, v, [{ planVersionId: "b", personId: "p" }])).toBeNull();
    expect(currentPlan(2027, v, [{ planVersionId: "b", personId: "q" }])?.id).toBe("b");
  });
  it("licença: vigência e excesso de uso", () => {
    const l = [{ serviceKey: "s", version: 1, kind: "por-usuario", seats: 2, validFrom: "2026-01-01", validUntil: "2026-12-31" }];
    expect(licenseState("s", "2027-01-01", l, 0).state).toBe("fora-de-vigencia");
    const st = licenseState("s", "2026-06-01", l, 3);
    expect(st.state === "vigente" && st.overUse && st.available === -1).toBe(true);
    expect(licenseState("x", "2026-06-01", l, 0).state).toBe("sem-licenca");
  });
});
