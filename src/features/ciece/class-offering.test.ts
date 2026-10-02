/** 14.9.1 — Organização oficial da oferta da turma como fonte de etapa. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classOfferingFacts, episodeFacts } from "./fact-adapters";
import type { OfferingState } from "@/features/classes/class-offering-shift-projection";
import { FACT_CATALOG, validateFact } from "./fact-catalog";
import { computeAgeGradeDistortion, offeringStageSource, type AgeGradeDistortionRule } from "./age-grade-distortion";

/** Resposta projetada do reader `class_offering_at` numa data. */
const ax = (schemeId: string, valueId: string) => ({ schemeId, valueId, valueVersion: 1, label: null });
const off = (o: Partial<OfferingState>): OfferingState => ({
  versionId: "o1", logicalId: "L1", version: 1, validFrom: "2026-02-01", validUntil: "2026-06-30", correctionReason: null, actRef: "ato", createdAt: "t",
  axes: [ax("etapa", "ef"), ax("posicao", "ano-6")], ...o,
});

describe("14.9.1 organização da oferta", () => {
  // Duas consultas do reader (abril e agosto), cada uma devolvendo o segmento vigente.
  const facts = [
    ...classOfferingFacts("t1", off({})),
    ...classOfferingFacts("t1", off({ versionId: "o2", logicalId: "L2", validFrom: "2026-07-01", validUntil: null, axes: [ax("posicao", "ano-7")] })),
  ];
  it("um fato válido por eixo, com catálogo declarado", () => {
    expect(facts).toHaveLength(3);
    for (const f of facts) expect(validateFact(f, "class_offering_versions")).toEqual([]);
    expect(FACT_CATALOG.some((d) => d.factTypeId === "organizacao-da-oferta-da-turma")).toBe(true);
  });
  it("vigência na data: mudança posterior não reclassifica o passado", () => {
    const src = offeringStageSource(facts, "posicao");
    expect(src("t1", "2026-04-01")?.stageId).toBe("ano-6");
    expect(src("t1", "2026-08-01")?.stageId).toBe("ano-7");
    expect(src("t1", "2026-01-15")).toBeNull();
  });
  it("correção devolvida pelo reader é a única versão citada", () => {
    const f = classOfferingFacts("t1", off({ versionId: "o1b", version: 2, axes: [ax("posicao", "ano-5")] }));
    expect(offeringStageSource(f, "posicao")("t1", "2026-04-01")).toEqual({ stageId: "ano-5", sourceRef: "class_offering_versions:o1b@2" });
  });
  it("14.8 lê a etapa oficial, e sem regra homologada nada é calculado", () => {
    const epi = episodeFacts([{ id: "a", enrollment_id: "m", student_id: "s-a", school_id: "e1", class_id: "t1", class_label_snapshot: "6º ANO", cycle_id: "c", valid_from: "2026-02-10", originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: null }] as never);
    const births = new Map([["s-a", { studentId: "s-a", birthDate: "2012-01-01", identityVersionRef: "i@1" }]]);
    const rule: AgeGradeDistortionRule = { id: "r", version: 1, status: "homologada", homologationActRef: "ato", population: { factTypeId: "episodio-de-enturmacao" },
      stageSourceId: "organizacao-da-oferta:posicao", referenceDate: "2026-05-31", adequateMaxAgeByStage: { "ano-6": 11 }, distortionYearsBeyond: 2,
      missingData: "excluir-e-declarar", operation: { evaluatorId: "contagem", params: { select: { kind: "categoria-em", categoryIds: ["em-distorcao"] } } } };
    const r = computeAgeGradeDistortion(rule, [...epi, ...facts], births);
    expect(r.ok && r.result.value).toBe(1);
    expect(r.ok && r.students[0]!.provenance.stageSourceRef).toBe("class_offering_versions:o1@1");
    expect(computeAgeGradeDistortion({ ...rule, status: "rascunho" }, [...epi, ...facts], births).ok).toBe(false);
  });
  it("nenhuma enumeração fechada de etapa/ano/fase e nenhum uso do rótulo da turma", () => {
    const src = readFileSync("src/features/ciece/age-grade-distortion.ts", "utf8") + readFileSync("src/features/ciece/fact-adapters.ts", "utf8").split("// 14.9")[1];
    expect(src).not.toMatch(/class_label_snapshot|stage_label_snapshot|"ano-\d|"eja|"infantil/i);
  });
});
