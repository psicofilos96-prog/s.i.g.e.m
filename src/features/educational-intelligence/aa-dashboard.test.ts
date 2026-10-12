import { describe, expect, it } from "vitest";
import { managerialPanel, prioritySkills, panorama, drill, type ResultRow } from "./aa-dashboard";

const r = (o: Partial<ResultRow>): ResultRow => ({ studentId: "s", schoolId: "A", stage: "EF", year: "2", classId: "T1", component: "LP", skill: "D1", editionId: "e1", score: 5, band: null, ...o });
const lido = <T,>(value: T) => ({ state: "lido" as const, value, source: "src", at: "2026-10-12" });

describe("A&A Lote 02 painel e panorama", () => {
  it("participação só com denominador; não lido nunca é zero; desempenho exige regra", () => {
    const t = managerialPanel({ eligible: lido([{ studentId: "1", schoolId: "A", classId: "T1", stage: null, year: null }, { studentId: "2", schoolId: "B", classId: "T2", stage: null, year: null }]), results: lido([r({ studentId: "1" }), r({ studentId: "2", score: null })]), editions: { state: "nao-lido", reason: "x" }, interventions: lido(0), reassessments: lido(0), performanceRuleHomologated: false });
    const g = (k: string) => t.find((x) => x.key === k)!.display;
    expect([g("escolas"), g("elegiveis"), g("avaliados"), g("participacao")]).toEqual(["2", "2", "1", "50"]);
    expect(g("avaliacoes")).toBe("não apurado"); expect(g("intervencoes")).toBe("0"); expect(g("desempenho")).toBe("sem regra homologada");
    expect(managerialPanel({ eligible: lido([]), results: lido([]), editions: lido(0), interventions: lido(0), reassessments: lido(0), performanceRuleHomologated: true }).find((x) => x.key === "participacao")!.display).toBe("não apurado");
  });
  it("habilidades prioritárias só com corte homologado", () => {
    expect(prioritySkills([r({})], null).state).toBe("sem-regra");
    expect(prioritySkills([r({ skill: "D2", score: 2 }), r({ skill: "D2", score: 3 }), r({ skill: "D1", score: 9 })], { threshold: 5, ruleRef: "corte@1" }).skills.map((s) => s.skill)).toEqual(["D2"]);
  });
  it("panorama: uma edição, escopo de escola, ausentes à parte, nível fino sem política é retido", () => {
    const rows = [r({ schoolId: "A", score: 4 }), r({ schoolId: "A", score: 6 }), r({ schoolId: "B", score: 8 }), r({ schoolId: "A", score: null }), r({ schoolId: "A", editionId: "e2", score: 1 })];
    const esc = panorama(rows, "escola", { editionId: "e1" }, null, { network: false, schools: new Set(["A"]) });
    expect(esc.rows).toEqual([{ key: "A", n: 2, mean: 5, suppressed: false }]); expect(esc.missingScore).toBe(1);
    expect(panorama(rows, "turma", { editionId: "e1" }, null, { network: true, schools: new Set() })).toMatchObject({ withheld: "nivel-fino-sem-politica-de-divulgacao", rows: [] });
    const sup = panorama(rows, "escola", { editionId: "e1" }, 2, { network: true, schools: new Set() });
    expect(sup.rows.find((x) => x.key === "B")!.suppressed).toBe(true);
  });
  it("drill-down desce um nível fixando o grupo e para em habilidade", () => {
    expect(drill({ editionId: "e1" }, "escola", "A")).toEqual({ filters: { editionId: "e1", escola: "A" }, level: "etapa" });
    expect(drill({ editionId: "e1" }, "habilidade", "D1")).toEqual({ refused: "nivel-mais-fino-atingido" });
  });
});
