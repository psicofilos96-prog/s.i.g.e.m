import { describe, it, expect } from "vitest";
import { analyzeSkills, expectedForPosition, centralSkillSummary, dimensionLabel, type SkillLinkCtx, type Sources, type LearningEvidence } from "./op-curriculum-skills";

const item = { itemId: "EF01MA01", editionId: "bncc-1", code: "EF01MA01", description: "Contar" };
const all: Sources = { plans: true, lessons: true, assessments: true, learning: true, catalogEditionIds: ["bncc-1"], readAt: "2026-10-12" };
const link = (target: SkillLinkCtx["target"], realized: boolean, o: Partial<SkillLinkCtx> = {}): SkillLinkCtx => ({ target, targetId: "t", targetDate: "2026-10-01", ref: { itemId: "EF01MA01", editionId: "bncc-1" }, positionKey: "1ano", realized, schoolId: "s1", classId: "c1", componentId: "mat", periodId: "b3", authorPersonId: "prof", ...o });
const evid = (studentId: string, demonstrated: boolean, crit: string | null = "crit-1"): LearningEvidence => ({ itemId: "EF01MA01", editionId: "bncc-1", classId: "c1", componentId: "mat", periodId: "b3", studentId, criterionHomologatedId: crit, demonstrated });
const run = (links: SkillLinkCtx[], evidence: LearningEvidence[] = [], sources = all, filters = { schoolId: "s1" }) => analyzeSkills({ filters, expected: [item], links, evidence, sources });

describe("Lote 07 — currículo e habilidades", () => {
  it("planejado nunca vira trabalhado", () => {
    const r = run([link("plano", true)]).rows[0]!;
    expect(r).toMatchObject({ prevista: true, trabalhada: false, avaliada: false, plannedOnly: true });
    expect(dimensionLabel(r.trabalhada, "Trabalhada")).toBe("Sem registro");
  });
  it("dimensões independentes: avaliada não implica trabalhada nem aprendizagem", () => {
    const r = run([link("avaliacao", true)]).rows[0]!;
    expect(r).toMatchObject({ prevista: false, trabalhada: false, avaliada: true, demonstrada: null });
    expect(run([link("aula", false)]).rows[0]!.trabalhada).toBe(false);
  });
  it("aprendizagem só com critério homologado, por estudante distinto", () => {
    const r = run([link("avaliacao", true)], [evid("a", true), evid("a", true), evid("b", false), evid("c", true, null)]).rows[0]!;
    expect(r.demonstrada).toEqual({ demonstrated: 1, assessed: 2 });
    expect(r.limitations.join()).toMatch(/sem critério homologado/);
  });
  it("fonte não lida é null, nunca zero; leitura sem data bloqueia", () => {
    const r = run([], [], { ...all, lessons: false, learning: false });
    expect(r.rows[0]!.trabalhada).toBeNull();
    expect(r.rows[0]!.demonstrada).toBeNull();
    expect(r.limitations.length).toBeGreaterThan(2);
    expect(dimensionLabel(null, "x")).toBe("Fonte não lida");
    expect(run([], [], { ...all, readAt: null }).blocked).toBeTruthy();
  });
  it("filtra por turma/componente/período", () => {
    const links = [link("aula", true, { classId: "c2" })];
    expect(run(links, [], all, { schoolId: "s1", classId: "c1" } as any).rows[0]!.trabalhada).toBe(false);
    expect(run(links, [], all, { schoolId: "s1", classId: "c2" } as any).rows[0]!.trabalhada).toBe(true);
    expect(run([link("aula", true, { schoolId: "s9" })]).rows[0]!.trabalhada).toBe(false);
  });
  it("registro em outra edição é sinalizado, não reinterpretado", () => {
    const r = run([link("aula", true, { ref: { itemId: "EF01MA01", editionId: "bncc-0" } })]).rows[0]!;
    expect(r.limitations.join()).toMatch(/outra edição/);
  });
  it("posição histórica: sem posição nada é presumido; edição fora da vigência excluída", () => {
    const cat = [{ ...item, positionKeys: ["1ano"] }, { ...item, itemId: "x", editionId: "old", positionKeys: ["1ano"] }];
    expect(expectedForPosition(cat, [], () => true)).toEqual([]);
    expect(expectedForPosition(cat, ["1ano"], (e) => e === "bncc-1").map((c) => c.itemId)).toEqual(["EF01MA01"]);
  });
  it("central: só contagens, estudante suprimido 1–4, fonte não lida = null", () => {
    expect(centralSkillSummary(run([link("aula", true)], [evid("a", true)]).rows)).toMatchObject({ trabalhadas: 1, estudantesAvaliadosSobCriterio: "suprimido" });
    expect(centralSkillSummary(run([], [], { ...all, plans: false }).rows).previstas).toBeNull();
  });
});
