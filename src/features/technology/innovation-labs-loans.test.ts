import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { accessibilityStatus, activeLabs, loanSituation, projectOutcomes } from "./innovation-labs-loans";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((x) => x.startsWith("0494"))!}`, "utf8");

describe("L21 inovação, laboratórios, empréstimos e acessibilidade", () => {
  it("uso não comprova melhoria da aprendizagem", () => {
    const o = projectOutcomes([{ seq: 1, kind: "relato-de-uso" }, { seq: 2, kind: "relato-de-uso" }, { seq: 3, kind: "relato-de-percepcao" }]);
    expect(o.usageReports).toBe(2);
    expect(o.learningEvidence).toBe(0);
    expect(o.learningClaim).toMatch(/não comprovam melhoria/);
    expect(projectOutcomes([{ seq: 1, kind: "evidencia-de-aprendizagem", evidenceSource: null, hasDoc: true }]).learningEvidence).toBe(0);
    expect(sql).toMatch(/kind <> 'evidencia-de-aprendizagem' OR \(evidence_source IS NOT NULL AND doc_ref IS NOT NULL\)/);
  });
  it("laboratório só por designação aprovada por outra pessoa; retirada encerra", () => {
    const d = (id: string, action: "designar" | "retirar", at: string) => ({ id, spaceId: "s", action, personId: "a", createdAt: at });
    expect(activeLabs([d("1", "designar", "1")], [{ designationId: "1", personId: "a" }])).toEqual([]);
    expect(activeLabs([d("1", "designar", "1")], [{ designationId: "1", personId: "b" }])).toEqual(["s"]);
    expect(activeLabs([d("1", "designar", "1"), d("2", "retirar", "2")], [{ designationId: "1", personId: "b" }, { designationId: "2", personId: "b" }])).toEqual([]);
  });
  it("empréstimo: atraso projetado; banco exige bem de tecnologia, um aberto, tomador ≠ recebedor", () => {
    expect(loanSituation({ id: "l", assetId: "a", dueOn: "2026-10-01", returnedOn: null }, "2026-10-12")).toBe("em-atraso");
    for (const s of ["nao-e-equipamento-de-tecnologia", "bem-baixado", "emprestimo-aberto", "tomador-nao-recebe", "autoemprestimo", "tomador-nao-vigente-na-escola"]) expect(sql).toContain(s);
    expect(sql).not.toMatch(/CREATE TABLE public\.tech_(assets|rooms|labs)\b/);
  });
  it("acessibilidade conta só o conferido por outra pessoa", () => {
    expect(accessibilityStatus(null, null).state).toBe("nao-informada");
    expect(accessibilityStatus({ features: ["libras"], personId: "a" }, { confirmed: ["libras"], personId: "a" }).state).toBe("declarada");
    expect(accessibilityStatus({ features: ["libras"], personId: "a" }, { confirmed: ["libras"], personId: "b" }).confirmed).toEqual(["libras"]);
    expect(sql.match(/FROM PUBLIC, anon;/g)!.length).toBe(8);
  });
});
