import { describe, expect, it } from "vitest";
import { officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";
import type { CompositionModel } from "./assessment-composition-types";
import { assessmentLogicalEntryId, type AssessmentEntryVersion } from "./assessment-entry-versions";
import { projectCanonicalPeriodResult } from "./assessment-period-result";
import type { RecoveryRule } from "./assessment-rule-types";
import type { AssessmentInstrument } from "./assessment-types";

const model = {
  id: "m", configurationId: "cfg", configurationVersion: 2, scaleSemantics: "quantitativa",
  categories: [
    { id: "a", label: "A", instrumentTypeIds: ["ta"], weight: 1, minimumEntries: 1, aggregation: { kind: "media-simples" } },
    { id: "b", label: "B", instrumentTypeIds: ["tb"], weight: 1, minimumEntries: 1, aggregation: { kind: "media-simples" } },
  ],
  periodAggregation: { kind: "soma" }, cycleAggregation: { kind: "media-simples" }, requiresAllPeriods: true,
  rounding: { id: "arr-1", mode: "meio-acima", decimals: 0, applyAt: ["periodo"], normativeStatus: "homologado" },
  administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "homologado" },
  normativeStatus: "homologado", version: 1,
} as unknown as CompositionModel;

const ins = (id: string, typeId: string, periodId = "p1") =>
  ({ id, title: `Instrumento ${id}`, instrumentTypeId: typeId, periodId, appliedOn: "2026-03-10" }) as unknown as AssessmentInstrument;
const instruments = [ins("ia", "ta"), ins("ib", "tb"), ins("ir", "tr"), ins("ir-p2", "tr", "p2")];
const ver = (instrumentId: string, value: unknown, over: Partial<AssessmentEntryVersion> = {}) =>
  ({
    id: `${instrumentId}-v${over.version ?? 1}`, logicalEntryId: assessmentLogicalEntryId(instrumentId, "s1"), version: 1,
    instrumentId, studentId: "s1", value, status: "registrado", recordedAt: "2026-03-10",
    ...over,
  }) as AssessmentEntryVersion;
const num = (value: number) => ({ kind: "numerica", value });
const base = [ver("ia", num(10)), ver("ib", num(10))]; // período = 20

const recovery = (over: Partial<RecoveryRule> = {}): RecoveryRule => ({
  id: "rec", enabled: true, scope: "periodo", replacesCategoryIds: ["a", "b"], instrumentTypeIds: ["tr"],
  prevalence: "maior-resultado", aggregation: { kind: "media-simples" }, normativeStatus: "homologado",
  ...over,
});
const must = (r: ReturnType<typeof projectCanonicalPeriodResult>) => {
  if (r.status !== "available") throw new Error(r.reasons.join(" "));
  return r;
};
const run = (versions: AssessmentEntryVersion[], rec?: RecoveryRule, ruleVersion = 4) =>
  must(projectCanonicalPeriodResult({
    model, periodId: "p1", configuration: { id: "cfg", version: 2 }, official: true,
    uses: officialCurrentVersionsForStudent({ studentId: "s1", instruments, versions }),
    rule: { id: "rav", version: ruleVersion, ...(rec ? { periodicRecovery: rec } : {}) },
  }));

describe("6D.3.5.3 — resultado canônico do período com recuperação", () => {
  it("A. sem recuperação configurada, idêntico à composição anterior", () => {
    const r = run(base);
    expect(r.recovery.state).toBe("not-configured");
    expect(r.finalStage).toEqual(r.composition.stage);
    expect(r.finalStage?.value).toBe(20);
  });

  it("B. configurada + não elegível → resultado original", () => {
    const r = run([...base, ver("ir", num(30))], recovery({ eligibility: { kind: "limite-de-pontuacao", threshold: 15, basis: "resultado-do-periodo" } }));
    expect(r.recovery.state).toBe("not-eligible");
    expect(r.finalStage?.value).toBe(20);
  });

  it("C. elegibilidade indeterminada preservada", () => {
    const r = run([...base, ver("ir", num(30))], recovery({ eligibility: { kind: "limite-de-pontuacao", threshold: 25, basis: "subtotal-substituivel" } }));
    expect(r.recovery.state).toBe("eligibility-indeterminate");
    expect(r.finalStage?.value).toBe(20);
  });

  it("critério ausente = sem restrição (não é insuficiência)", () => {
    const r = run([...base, ver("ir", num(30))], recovery());
    expect(r.recovery.eligibility).toEqual({ kind: "unrestricted" });
    expect(r.recovery.state).toBe("applied-with-effect");
  });

  it("D/J/O. elegível sem resultado e “Não registrado”: ausência preservada, nunca zero", () => {
    const empty = run(base, recovery());
    expect(empty.recovery.state).toBe("eligible-without-result");
    expect(empty.finalStage?.value).toBe(20);
    const nr = run([...base, ver("ir", { kind: "nao-registrado", reason: "Faltou" })], recovery());
    expect(nr.recovery.state).toBe("eligible-without-result");
    expect(nr.recovery.recoveryEntries).toEqual([expect.objectContaining({ valueKind: "nao-registrado", accepted: false })]);
    expect(nr.recovery.recoveryStage).toBeNull();
    expect(nr.finalStage?.value).toBe(20);
  });

  it("E. registrada sem efeito → resultado mantido, recibo registra a consideração", () => {
    const r = run([...base, ver("ir", num(12))], recovery());
    expect(r.recovery.state).toBe("applied-without-effect");
    expect(r.finalStage?.value).toBe(20);
    expect(r.recovery.recoveryStage?.value).toBe(12);
    expect(r.recovery.effect?.effectEvaluatorId).toBe("maior-resultado");
  });

  it("F. registrada com efeito → recibo completo antes → recuperação → depois", () => {
    const r = run([...base, ver("ir", num(30))], recovery({ maxScore: 28 }));
    expect(r.recovery.state).toBe("applied-with-effect");
    expect(r.composition.stage?.value).toBe(20);
    expect(r.finalStage?.value).toBe(28);
    expect(r.recovery).toMatchObject({
      originalStage: { value: 20 },
      recoveryStage: { value: 28 },
      finalStage: { value: 28 },
      replacedCategoryIds: ["a", "b"],
      rule: { ruleId: "rav", ruleVersion: 4, configurationId: "cfg", configurationVersion: 2, recoveryRuleId: "rec" },
      effect: { recoveryRuleId: "rec", effectEvaluatorId: "maior-resultado", cap: 28, producedValue: 28 },
      recoveryEntries: [{ versionId: "ir-v1", version: 1, instrumentId: "ir", accepted: true }],
    });
  });

  it("G. subtotal substituível usa o fato da 6D.3.5.2b", () => {
    const r = run(
      [...base, ver("ir", num(30))],
      recovery({
        eligibility: { kind: "limite-de-pontuacao", threshold: 25, basis: "subtotal-substituivel" },
        replaceableSubtotal: { aggregation: { kind: "soma" } },
      }),
    );
    expect(r.recovery.replaceableSubtotal).toMatchObject({ status: "produced", receipt: { value: 20, categoryIds: ["a", "b"] } });
    expect(r.recovery.eligibility).toMatchObject({ kind: "evaluated", projection: { eligible: true } });
    expect(r.recovery.state).toBe("applied-with-effect");
  });

  it("H/I/N. só a versão vigente entra; rascunho nunca; resultado original sem supersedes", () => {
    const v1 = ver("ir", num(30));
    const v2 = ver("ir", num(15), { id: "ir-v2", version: 2, supersedesVersionId: "ir-v1" });
    const r = run([...base, v1, v2], recovery());
    expect(r.recovery.recoveryEntries.map((e) => e.versionId)).toEqual(["ir-v2"]);
    expect(r.recovery.state).toBe("applied-without-effect");
    const draft = run([...base, ver("ir", num(30), { status: "rascunho" })], recovery());
    expect(draft.recovery.state).toBe("eligible-without-result");
    expect(r.uses.filter((u) => u.instrument.id !== "ir").every((u) => u.version.supersedesVersionId === undefined)).toBe(true);
  });

  it("recuperação de outro período não entra", () => {
    const r = run([...base, ver("ir-p2", num(30))], recovery());
    expect(r.recovery.state).toBe("eligible-without-result");
  });

  it("insuficiência normativa: não homologada, sem tipo declarado ou tipo ambíguo", () => {
    const v = [...base, ver("ir", num(30))];
    expect(run(v, recovery({ normativeStatus: "configurado" })).recovery.state).toBe("normative-insufficiency");
    expect(run(v, recovery({ instrumentTypeIds: [] })).recovery.state).toBe("normative-insufficiency");
    expect(run(v, recovery({ instrumentTypeIds: ["ta"] })).recovery.state).toBe("normative-insufficiency");
    const { prevalence: _p, ...noPrevalence } = recovery();
    const pending = run(v, noPrevalence);
    expect(pending.recovery.state).toBe("normative-insufficiency");
    expect(pending.finalStage?.value).toBe(20);
  });

  it("período incompleto: recuperação não considerada, nada vira zero", () => {
    const r = run([ver("ia", num(10)), ver("ir", num(30))], recovery());
    expect(r.recovery.state).toBe("period-incomplete");
    expect(r.finalStage?.value).not.toBe(0);
  });

  it("não identifica recuperação pelo título", () => {
    const titled = [...instruments.slice(0, 2), { ...ins("ix", "tx"), title: "Recuperação" }];
    const r = must(projectCanonicalPeriodResult({
      model, periodId: "p1", configuration: { id: "cfg", version: 2 }, official: true,
      uses: officialCurrentVersionsForStudent({ studentId: "s1", instruments: titled, versions: [...base, ver("ix", num(30))] }),
      rule: { id: "rav", version: 4, periodicRecovery: recovery() },
    }));
    expect(r.recovery.state).toBe("eligible-without-result");
    expect(r.finalStage?.value).toBe(20);
  });
});

describe("6D.3.5.3b — existência do resultado decidida pela fronteira canônica", () => {
  const unavailable = (m: CompositionModel | undefined, versions = [...base, ver("ir", num(30))]) =>
    projectCanonicalPeriodResult({
      model: m, periodId: "p1", configuration: { id: "cfg", version: 2 }, official: true,
      uses: officialCurrentVersionsForStudent({ studentId: "s1", instruments, versions }),
      rule: { id: "rav", version: 4, periodicRecovery: recovery() },
    });
  it("B/C/D/F/I. modelo ausente, não homologado, arredondamento não homologado, pesos nulos: indisponível, sem recuperação nem valor", () => {
    const cases = [
      undefined,
      { ...model, normativeStatus: "pendente" },
      { ...model, rounding: { ...model.rounding, normativeStatus: "pendente" } },
      { ...model, periodAggregation: { kind: "media-ponderada" }, categories: model.categories.map((c) => ({ ...c, weight: 0 })) },
    ] as (CompositionModel | undefined)[];
    for (const m of cases) {
      const r = unavailable(m);
      expect(r.status).toBe("unavailable");
      expect(r).not.toHaveProperty("finalStage");
      expect(r).not.toHaveProperty("recovery");
    }
  });
  it("E. registros chegam à fronteira sempre com a configuração do contexto (mistura não é produzida pela tradução canônica)", () => {
    const r = must(projectCanonicalPeriodResult({
      model, periodId: "p1", configuration: { id: "cfg", version: 2 }, official: true,
      uses: officialCurrentVersionsForStudent({ studentId: "s1", instruments, versions: base }),
    }));
    expect(new Set(r.inputs.map((i) => `${i.configurationId}@${i.configurationVersion}`)).size).toBe(1);
  });
});
