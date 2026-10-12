import { describe, it, expect } from "vitest";
import { baeStatus, reconciliationIssues, divergences, BAE_INVESTIGATION } from "./national-bae";
import { NATIONAL_BAE } from "./permanence-audit";

const h = "a".repeat(64);
const adh = { evidenceRef: "termo", evidenceSha256: h, verifiedBy: "p", verifiedOn: "2026-10-01" };

describe("L21 BAE nacional", () => {
  it("investigação registrada: sem API pública e sem adesão comprovada; auditoria segue bloqueada", () => {
    expect(BAE_INVESTIGATION.publicApiFound).toBe(false);
    expect(NATIONAL_BAE.integrated).toBe(false);
    expect(baeStatus(null, null)).toBe("nao-consultado");
  });
  it("API nunca presumida: exige contrato, decisão e endpoint documentado", () => {
    expect(baeStatus({ ...adh, evidenceSha256: null }, null)).toBe("adesao-nao-comprovada");
    expect(baeStatus(adh, { mode: "api-autorizada", contractRef: null, decisionRef: "d", documentedEndpoint: "x" })).toBe("nao-consultado");
    expect(baeStatus(adh, { mode: "conciliacao-manual", contractRef: null, decisionRef: "d", documentedEndpoint: null })).toBe("conciliacao-manual");
  });
  it("conciliação manual: pessoa, referência opaca, evidência e sem dado pessoal", () => {
    const r = { caseId: "c", externalRef: "BAE-123", observedStatus: "Em andamento", observedOn: "2026-10-10", evidenceSha256: h, person: "p", key: "k" };
    expect(reconciliationIssues("conciliacao-manual", r, "2026-10-12")).toEqual([]);
    expect(reconciliationIssues("nao-consultado", r, "2026-10-12")).toContain("sem-adesao-ou-decisao");
    expect(reconciliationIssues("conciliacao-manual", { ...r, observedStatus: "CPF 123.456.789-00" }, "2026-10-12")).toContain("dado-pessoal");
  });
  it("divergência só listada para conferência", () => {
    const recs = [{ caseId: "a", externalRef: "X1", observedStatus: "Concluído", observedOn: "2026-10-01", evidenceSha256: h, person: "p", key: "k" }];
    expect(divergences([{ caseId: "a", closed: false }, { caseId: "b", closed: false }], recs, new Set(["Concluído"])))
      .toEqual([{ caseId: "a", kind: "situacao-divergente" }, { caseId: "b", kind: "nao-conciliado" }]);
  });
});
