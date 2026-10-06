import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { explainAccess, GOVERNANCE_REVIEW_PENDING } from "./access-explainer";

const rules = [
  { engagement_kind_id: "secretaria-escolar", capability_id: "enturmar", scope_dimensions: ["school"] },
  { engagement_kind_id: "gestao-rede", capability_id: "homologar-x", scope_dimensions: ["network"] },
];
const eng = (o: object) => ({ id: "e", engagement_kind_id: "secretaria-escolar", scope_level: "escola", school_id: "A", valid_from: "2026-01-01", valid_until: null, ...o });
const q = (o: object) => ({ capability: "enturmar", schoolId: "A", on: "2026-06-01", ...o });

describe("BF — por que pode / não pode", () => {
  it("permitido mostra regra, escopo e vigência", () => {
    const r = explainAccess("p", rules, [eng({})], q({}));
    expect(r.code).toBe("permitido"); expect(r.reason).toMatch(/school/); expect(r.reason).toMatch(/2026-01-01/);
  });
  it("outra escola (IDOR/escopo) é recusada", () => expect(explainAccess("p", rules, [eng({})], q({ schoolId: "B" })).code).toBe("escopo-insuficiente"));
  it("escopo de escola não vira rede (scope widening)", () =>
    expect(explainAccess("p", rules, [eng({ engagement_kind_id: "gestao-rede" })], q({ capability: "homologar-x", schoolId: null })).code).toBe("escopo-insuficiente"));
  it("revogação/fim de vigência", () => expect(explainAccess("p", rules, [eng({ valid_until: "2026-03-01" })], q({})).code).toBe("fora-da-vigencia"));
  it("sem atuação, sem regra, sem política", () => {
    expect(explainAccess("p", rules, [], q({})).code).toBe("sem-atuacao");
    expect(explainAccess("p", rules, [eng({})], q({ capability: "inexistente" })).code).toBe("sem-regra");
    expect(explainAccess(null, rules, [eng({})], q({})).code).toBe("sem-politica");
  });
  it("tela não chama escrita e expõe a revisão de governança", () => {
    const page = readFileSync("src/features/institutional-admin/governance-station-page.tsx", "utf8");
    expect(page).not.toMatch(/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
    expect(page).toContain("GOVERNANCE_REVIEW_PENDING");
    expect(page).not.toMatch(/"homologada"\)/);
    expect(GOVERNANCE_REVIEW_PENDING.decision).toMatch(/institucional/);
  });
});
