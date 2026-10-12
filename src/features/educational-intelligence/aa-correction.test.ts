import { describe, expect, it } from "vitest";
import { scoreObjective, scoreManual, recordCorrection, effectiveScore, consolidate, type Correction, type ItemSpec } from "./aa-correction";

const obj = { kind: "objetiva" as const, itemVersionId: "q1", key: "B", keyValidated: true, points: 1 };
const disc = { kind: "discursiva" as const, itemVersionId: "q2", points: 2, rubric: [{ level: "pleno", descriptor: "", points: 2 }, { level: "parcial", descriptor: "", points: 1 }] };
const prod = { kind: "producao" as const, itemVersionId: "q3", criteria: [{ id: "c1", max: 3 }, { id: "c2", max: 3 }] };
const flu = { kind: "fluencia" as const, itemVersionId: "q4", protocol: { measures: [{ id: "ppm", unit: "palavras/min" }] } };
const c = (o: Partial<Correction>): Correction => ({ studentId: "s", itemVersionId: "q1", round: 1, version: 1, score: { status: "pontuada", points: 1, detail: {} }, correctorPersonId: "p1", at: "t", reason: null, ...o });

describe("A&A Lote 07 respostas e correção", () => {
  it("objetiva só com gabarito validado; branco ≠ errado", () => {
    expect(scoreObjective({ ...obj, keyValidated: false }, null)).toMatchObject({ status: "nao-corrigivel" });
    expect(scoreObjective(obj, { studentId: "s", itemVersionId: "q1", answer: "b", recordedBy: "p", at: "t" })).toMatchObject({ points: 1 });
    expect(scoreObjective(obj, { studentId: "s", itemVersionId: "q1", answer: "", recordedBy: "p", at: "t" })).toEqual({ status: "em-branco" });
  });
  it("rubrica, critérios e protocolo de fluência validam o lançamento", () => {
    expect(scoreManual(disc, { nivel: "parcial" })).toMatchObject({ points: 1 });
    expect(scoreManual(disc, { nivel: "x" }).status).toBe("nao-corrigivel");
    expect(scoreManual(prod, { c1: 2, c2: 3 })).toMatchObject({ points: 5 });
    expect(scoreManual(prod, { c1: 4, c2: 0 }).status).toBe("nao-corrigivel");
    expect(scoreManual(flu, { ppm: 62 }).status).toBe("pontuada");
    expect(scoreManual(flu, { ppm: 62, nivel_inventado: 3 }).status).toBe("nao-corrigivel");
  });
  it("retificação versionada com motivo; segunda correção por outra pessoa; desempate por terceira", () => {
    const v1 = recordCorrection([], c({}), 0); if (!v1.ok) throw 0;
    expect(recordCorrection([v1.correction], c({ score: { status: "em-branco" } }), 1)).toMatchObject({ ok: false, reason: /motivo/ });
    expect(recordCorrection([v1.correction], c({ score: { status: "em-branco" }, reason: "erro" }), 1)).toMatchObject({ ok: true, correction: { version: 2 } });
    expect(recordCorrection([v1.correction], c({ round: 2 }), 0)).toMatchObject({ ok: false, reason: /distinta/ });
    const r2 = c({ round: 2, correctorPersonId: "p2", score: { status: "pontuada", points: 0, detail: {} } });
    expect(effectiveScore([v1.correction, r2], "s", "q1", true).state).toBe("divergente");
    expect(recordCorrection([v1.correction, r2], c({ round: 3, correctorPersonId: "p2" }), 0)).toMatchObject({ ok: false });
    expect(effectiveScore([v1.correction, r2, c({ round: 3, correctorPersonId: "p3" })], "s", "q1", true).state).toBe("final");
  });
  it("consolidação: incompleto lista limitações; completo dá só acerto bruto, nunca proficiência", () => {
    const specs: ItemSpec[] = [obj, disc, flu];
    const inc = consolidate("s", specs, [c({})], false);
    expect(inc).toMatchObject({ complete: false, limitations: ["q2: primeira correção"] });
    const ok = consolidate("s", specs, [c({}), c({ itemVersionId: "q2", score: { status: "pontuada", points: 1, detail: {} } })], false);
    expect(ok).toEqual({ studentId: "s", complete: true, points: 2, max: 3, rawPercent: (2 / 3) * 100, measure: "acerto-bruto" });
    expect(ok).not.toHaveProperty("proficiency");
  });
});
