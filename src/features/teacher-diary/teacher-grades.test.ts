import { describe, expect, it } from "vitest";
import { buildGridBatch, checkValue, reviewRequest, validateInstrument, type HomologatedRule, type InstrumentDraft } from "./teacher-grades";

const rule: HomologatedRule = { ruleId: "r", version: 1, scale: { kind: "numerica", min: 0, max: 10, step: 0.5 }, instrumentTypeIds: ["prova", "trabalho"], weightsAllowed: false, maxTotalPoints: 10 };
const period = { start: "2026-02-01", end: "2026-04-30" };
const d: InstrumentDraft = { classId: "t", componentId: "c", periodId: "p1", assignmentId: "a", typeId: "prova", title: "P1", appliedOn: "2026-03-10",
  criteria: [{ label: "Q1", points: 6, skillRefs: [] }, { label: "Q2", points: 4, skillRefs: [] }], weight: null, origin: "docente" };

describe("avaliações docentes (L10)", () => {
  it("sem regra homologada não conclui; A&A não entra pela tela docente", () => {
    expect(validateInstrument(d, null, period).join()).toMatch(/homologada/);
    expect(validateInstrument({ ...d, origin: "aa" }, rule, period).join()).toMatch(/institucional/);
    expect(validateInstrument(d, rule, period)).toEqual([]);
  });
  it("tipo, peso, período e teto vêm da regra", () => {
    const e = validateInstrument({ ...d, typeId: "quiz", weight: 2, appliedOn: "2026-06-01", criteria: [{ label: "Q", points: 11, skillRefs: [] }] }, rule, period).join("|");
    expect(e).toMatch(/tipo/); expect(e).toMatch(/pesos/); expect(e).toMatch(/fora do período/); expect(e).toMatch(/máximo/);
  });
  it("escala: vazio não é zero; fora de faixa/passo/conceito recusa", () => {
    const s = rule.scale;
    expect(checkValue(null, s)).toBeNull();
    expect(checkValue(10.5, s)).toMatch(/fora/);
    expect(checkValue(7.3, s)).toMatch(/passos/);
    expect(checkValue("B", { kind: "conceitual", values: ["A", "B"] })).toBeNull();
    expect(checkValue("Z", { kind: "conceitual", values: ["A", "B"] })).toMatch(/Conceito/);
  });
  it("grade não preenche ninguém e falha inteira com um erro", () => {
    const ok = buildGridBatch([{ studentId: "e1", value: 8 }, { studentId: "e2", value: null }], ["e1", "e2", "e3"], rule.scale);
    expect(ok.ok && ok.entries).toEqual([{ studentId: "e1", value: 8 }]);
    expect(ok.ok && ok.notRecorded).toEqual(["e2", "e3"]);
    expect(buildGridBatch([{ studentId: "e1", value: 8 }, { studentId: "e9", value: 5 }], ["e1"], rule.scale).ok).toBe(false);
  });
  it("revisão exige motivo, base atual e mudança real", () => {
    expect(reviewRequest({ versionId: "v1", value: 6 }, 6, "", "v1")).toHaveLength(2);
    expect(reviewRequest({ versionId: "v2", value: 6 }, 7, "erro de soma", "v1").join()).toMatch(/recarregue/);
    expect(reviewRequest({ versionId: "v1", value: 6 }, 7, "erro de soma", "v1")).toEqual([]);
  });
});
