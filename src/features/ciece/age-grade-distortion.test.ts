/** 14.8 — idade derivada, faixas configuradas e distorção idade-série. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { classifyAgeBand, deriveCompletedAge, type AgeBandScheme, type BirthSource } from "./age-derivation";
import { computeAgeGradeDistortion, registerStageSource, type AgeGradeDistortionRule } from "./age-grade-distortion";
import { episodeFacts } from "./fact-adapters";

const b = (birthDate: string | null, id = "s1", ref = "student_identity_versions:i1@1"): BirthSource => ({ studentId: id, birthDate, identityVersionRef: ref });
const epi = (id: string, cls: string, from: string, ended: string | null = null) => ({ id, enrollment_id: `m-${id}`, student_id: `s-${id}`, school_id: "e1", class_id: cls, class_label_snapshot: null, cycle_id: "c26", valid_from: from, originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: ended });

registerStageSource("teste-etapa", (classId) => (classId === "sem-etapa" ? null : { stageId: classId === "t6" ? "ano-6" : "ano-7", sourceRef: `fonte:${classId}` }));
const rule = (o: Partial<AgeGradeDistortionRule> = {}): AgeGradeDistortionRule => ({
  id: "regra-prova", version: 1, status: "homologada", homologationActRef: "ato-prova",
  population: { factTypeId: "episodio-de-enturmacao" }, stageSourceId: "teste-etapa", referenceDate: "2026-05-31",
  adequateMaxAgeByStage: { "ano-6": 11 }, distortionYearsBeyond: 2, missingData: "excluir-e-declarar",
  operation: { evaluatorId: "percentual", params: { numerator: { kind: "categoria-em", categoryIds: ["em-distorcao"] } } }, ...o,
});

describe("14.8.1 idade derivada", () => {
  it("1/2 aniversário ocorrido e não ocorrido", () => {
    expect(deriveCompletedAge(b("2014-05-31"), "2026-05-31")).toMatchObject({ status: "determinada", years: 12 });
    expect(deriveCompletedAge(b("2014-06-01"), "2026-05-31")).toMatchObject({ status: "determinada", years: 11 });
  });
  it("3 nascimento em 29/02", () => {
    expect(deriveCompletedAge(b("2012-02-29"), "2026-02-28")).toMatchObject({ years: 13 });
    expect(deriveCompletedAge(b("2012-02-29"), "2026-03-01")).toMatchObject({ years: 14 });
    expect(deriveCompletedAge(b("2012-02-29"), "2028-02-29")).toMatchObject({ years: 16 });
  });
  it("4/5/6 ausências e referência anterior", () => {
    expect(deriveCompletedAge(b(null), "2026-01-01")).toMatchObject({ status: "indeterminada", reason: "nascimento-ausente" });
    expect(deriveCompletedAge(b("2014-01-01"), undefined)).toMatchObject({ status: "indeterminada", reason: "referencia-ausente" });
    expect(deriveCompletedAge(b("2014-01-01"), "2013-12-31")).toMatchObject({ status: "invalida" });
  });
  it("9 proveniência cita a versão cadastral e a data", () => {
    expect(deriveCompletedAge(b("2014-01-01", "s1", "student_identity_versions:i2@2"), "2026-01-01").provenance)
      .toEqual({ identityVersionRef: "student_identity_versions:i2@2", referenceDate: "2026-01-01", rule: "idade-completa-v1" });
  });
});

describe("14.8.2 faixas", () => {
  const age = deriveCompletedAge(b("2014-01-01"), "2026-06-01");
  it("10 sem esquema homologado nada é presumido", () => {
    expect(classifyAgeBand(age, null).status).toBe("sem-faixa-homologada");
    const draft: AgeBandScheme = { id: "f", version: 1, status: "rascunho", homologationActRef: null, bands: [{ id: "a", label: "a", minYears: 0, maxYears: 99 }] };
    expect(classifyAgeBand(age, draft).status).toBe("sem-faixa-homologada");
    expect(classifyAgeBand(age, { ...draft, status: "homologada", homologationActRef: "x" })).toMatchObject({ status: "classificada", bandId: "a" });
  });
});

describe("14.8.3/4 distorção", () => {
  const facts = episodeFacts([
    epi("a", "t6", "2026-02-01"),               // 14 anos → distorção
    epi("b", "t6", "2026-02-01"),               // 12 anos → sem
    epi("c", "t6", "2026-02-01"),               // sem nascimento
    epi("d", "t6", "2026-02-01", "2026-04-30"), // transferido antes
    epi("e", "t6", "2026-06-15"),               // ingressou depois
  ] as never);
  const births = new Map([
    ["s-a", b("2012-01-10", "s-a")], ["s-b", b("2014-01-10", "s-b")], ["s-c", b(null, "s-c")],
    ["s-d", b("2010-01-10", "s-d")], ["s-e", b("2010-01-10", "s-e")],
  ]);
  it("11 sem regra homologada não calcula", () => {
    expect(computeAgeGradeDistortion(null, facts, births)).toMatchObject({ ok: false, code: "regra-nao-homologada" });
    expect(computeAgeGradeDistortion(rule({ status: "rascunho" }), facts, births)).toMatchObject({ ok: false });
    expect(computeAgeGradeDistortion(rule({ stageSourceId: "inexistente" }), facts, births)).toMatchObject({ ok: false, code: "fonte-de-etapa-nao-registrada" });
  });
  it("7/8/12/13 população na data, critério configurado, ausente ≠ zero", () => {
    const r = computeAgeGradeDistortion(rule(), facts, births);
    if (!r.ok) throw new Error("esperado ok");
    expect(r.populationSize).toBe(3);
    expect(r.students.map((s) => s.studentId).sort()).toEqual(["s-a", "s-b", "s-c"]);
    expect(r.indeterminate).toBe(1);
    expect(r.result).toMatchObject({ numerator: 1, denominator: 2, value: 50 });
    expect(computeAgeGradeDistortion(rule({ distortionYearsBeyond: 1 }), facts, births)).toMatchObject({ result: { numerator: 2 } });
    expect(computeAgeGradeDistortion(rule({ missingData: "indeterminar-resultado" }), facts, births)).toMatchObject({ result: { value: null } });
  });
  it("etapa sem critério ou sem fonte fica indeterminada, nunca inferida do nome", () => {
    const f = episodeFacts([epi("x", "t7", "2026-02-01"), epi("y", "sem-etapa", "2026-02-01")] as never);
    const r = computeAgeGradeDistortion(rule(), f, new Map([["s-x", b("2012-01-01", "s-x")], ["s-y", b("2012-01-01", "s-y")]]));
    expect(r.ok && r.students.map((s) => s.reason)).toEqual(["etapa-sem-criterio-declarado", "etapa-indeterminada"]);
  });
  it("14 proveniência até nascimento, enturmação, etapa e regra", () => {
    const r = computeAgeGradeDistortion(rule(), facts, births);
    expect(r.ok && r.students.find((s) => s.studentId === "s-a")!.provenance).toEqual({
      episodeRef: "class_enrollment_episodes:a", enrollmentRef: "m-a", identityVersionRef: "student_identity_versions:i1@1", stageSourceRef: "fonte:t6", ruleRef: "regra-prova@1",
    });
  });
});

describe("14.8 auditoria de código", () => {
  const migrations = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
  const src = ["age-derivation.ts", "age-grade-distortion.ts"].map((f) => readFileSync(`src/features/ciece/${f}`, "utf8")).join("\n");
  it("15 nenhum campo persistente de idade", () => {
    expect(migrations).not.toMatch(/\b(age|idade|age_years|age_band)\b\s+(integer|int|smallint|numeric|text)/i);
  });
  it("16 nenhuma fórmula normativa hardcoded e nenhum 'hoje'", () => {
    expect(src).not.toMatch(/new Date\(\)|Date\.now/);
    expect(src).not.toMatch(/distortionYearsBeyond\s*[:=]\s*\d|adequateMaxAgeByStage\s*[:=]\s*\{\s*"/);
  });
});
