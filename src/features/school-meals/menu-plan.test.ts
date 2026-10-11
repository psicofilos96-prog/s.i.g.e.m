import { describe, it, expect } from "vitest";
import { grid, horizonProblems, adequacy, substitute, transition, compareScenarios, printHtml, type Menu, type Actor } from "./menu-plan";

const menu: Menu = { id: "m", horizon: "semanal", from: "2026-03-02", to: "2026-03-03", stage: "EF", modality: null, journey: "parcial",
  slots: [{ date: "2026-03-02", meal: "almoço", preparationId: "arroz", portionGrams: 100 }], substitutions: [] };
const nut: Actor = { id: "n", isPerson: true, nutritionistRegistry: "CRN-1", canReview: true, canPublish: true };

describe("cardápio", () => {
  it("grade deixa vazio como null e valida horizonte", () => {
    const g = grid(menu, ["almoço"]);
    expect(g).toHaveLength(2);
    expect(g[1]!.cells[0]).toBeNull();
    expect(horizonProblems({ ...menu, to: "2026-03-20" })[0]).toContain("excede");
  });
  it("adequação bloqueia sem parâmetro homologado e não presume nutriente", () => {
    expect(adequacy(menu, [{ nutrient: "kcal", minPerDay: 300, maxPerDay: null, paramVersion: "v1", homologated: false }], []).state).toBe("BLOCKED_BY_HOMOLOGATED_RULE");
    const t = [{ nutrient: "kcal", minPerDay: 300, maxPerDay: null, paramVersion: "v1", homologated: true }];
    expect(adequacy(menu, t, [])).toEqual({ state: "OK", rows: [{ date: "2026-03-02", nutrient: "kcal", total: null, status: "indeterminado", paramVersion: "v1" }] });
    expect(adequacy(menu, t, [{ preparationId: "arroz", nutrient: "kcal", perGram: 1.3 }]).rows[0]!.status).toBe("abaixo");
  });
  it("substituição exige motivo e guarda histórico", () => {
    expect(substitute(menu, { date: "2026-03-02", meal: "almoço", to: "macarrao", reason: "", by: "n", at: "x" })).toEqual({ error: "motivo obrigatório" });
    const r = substitute(menu, { date: "2026-03-02", meal: "almoço", to: "macarrao", reason: "falta de estoque", by: "n", at: "x" }) as Menu;
    expect(r.substitutions[0]!.from).toBe("arroz");
    expect(compareScenarios(menu, r)).toHaveLength(1);
  });
  it("fluxo: executor técnico nunca aprova; aprovador distinto com registro", () => {
    expect(transition("em-revisao", "aprovado", { ...nut, isPerson: false }, "a", menu)).toContain("executor técnico");
    expect(transition("em-revisao", "aprovado", nut, "n", menu)).toContain("distinto");
    expect(transition("em-revisao", "aprovado", { ...nut, nutritionistRegistry: null }, "a", menu)).toContain("nutricionista");
    expect(transition("rascunho", "publicado", nut, "a", menu)).toContain("não permitida");
    expect(transition("em-revisao", "aprovado", nut, "a", menu)).toBeNull();
  });
  it("impressão marca rascunho e escapa HTML", () => {
    const h = printHtml(menu, ["almoço"], "aprovado", () => "<b>Arroz</b>");
    expect(h).toContain("RASCUNHO");
    expect(h).not.toContain("<b>Arroz");
  });
});
