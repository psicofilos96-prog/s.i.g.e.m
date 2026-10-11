import { describe, expect, it } from "vitest";
import { indicatorView, LEADERSHIP_INDICATORS, LEADERSHIP_REPORTS, runLeadershipReport } from "./leadership-reports";

const base = { consolidated: true, calendarResolved: true, ruleHomologated: true, numerator: 9, denominator: 10, validOn: "2026-12-20", refs: ["v1"] };

describe("Direção — relatórios e indicadores", () => {
  it("catálogo cobre os 11 relatórios e 8 indicadores sem chaves duplicadas", () => {
    expect(new Set(LEADERSHIP_REPORTS.map((r) => r.key)).size).toBe(11);
    expect(new Set(LEADERSHIP_INDICATORS.map((r) => r.key)).size).toBe(8);
  });
  it("relatório: escola própria, ano obrigatório, filtro declarado, sensível só com capacidade", () => {
    const req = { schoolId: "A", actorSchoolIds: ["A"], filters: { ano: "2026" }, includeSensitive: false, canSeeSensitive: false };
    expect(runLeadershipReport("frequencia", { ...req, actorSchoolIds: ["B"] })).toMatchObject({ code: "relatorio:fora-da-escola" });
    expect(runLeadershipReport("frequencia", { ...req, filters: {} })).toMatchObject({ code: "relatorio:ano-obrigatorio" });
    expect(runLeadershipReport("pessoal", { ...req, filters: { ano: "2026", turma: "c1" } })).toMatchObject({ code: "relatorio:filtro-nao-declarado" });
    expect(runLeadershipReport("frequencia", { ...req, includeSensitive: true })).toMatchObject({ code: "relatorio:sensivel-sem-capacidade" });
    const ok = runLeadershipReport("frequencia", req);
    expect(ok.ok && ok.plan.excludeColumns).toEqual(["nome"]);
  });
  it("aprovação bloqueada sem consolidação; denominador zero não vira %; rastreável", () => {
    expect(indicatorView("aprovacao", { ...base, consolidated: false })).toMatchObject({ state: "bloqueado", reason: "requer: consolidacao" });
    expect(indicatorView("frequencia", { ...base, denominator: 0 }).state).toBe("sem-denominador");
    expect(indicatorView("cobertura-docente", { ...base, numerator: null }).state).toBe("nao-disponivel");
    expect(indicatorView("dias-letivos", { ...base, calendarResolved: false }).state).toBe("bloqueado");
    expect(indicatorView("aprovacao", base)).toMatchObject({ state: "apurado", value: 0.9, source: "academic_standing_versions", refs: ["v1"] });
  });
});
