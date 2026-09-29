/** 6D.4.4/6D.4.5 — registro oficial e bloqueio do encerramento (conjuntos de TESTE). */
import { describe, expect, it } from "vitest";
import { determineAcademicStanding } from "./academic-standing-engine";
import { createAcademicStandingStore, standingScopeKey } from "./academic-standing-store";
import { standingDemonstrationActor } from "./academic-standing-governance";
import {
  registerConferredStandings,
  standingFingerprint,
  standingRegistrability,
} from "./academic-standing-registration";
import { scopeKeyOf, type AcademicStandingRuleSet, type ResolvedFact } from "./academic-standing-types";
import { inspectCycleClosing } from "@/features/cycle-closing/cycle-closing-inspector";
import { studentsWithOfficialStanding } from "@/features/cycle-closing/cycle-closing-sources";
import { demonstrationClosingPolicyQualitative } from "@/features/cycle-closing/cycle-closing-fixtures";
import type { CycleClosingPolicy } from "@/features/cycle-closing/cycle-closing-types";

const scope = { kind: "componente-curricular", id: "c1" };
const fact = (value: number | null, v = 1): ResolvedFact => ({
  factId: "resultado", scope, scopeKey: scopeKeyOf(scope), category: "consolidado", valueKind: "numero", value,
  provenance: { sources: [{ kind: "fechamento", id: "f", version: v }], algorithm: "t", materializedAt: "2026-12-01" },
});
const rule: AcademicStandingRuleSet = {
  id: "rgs", version: 1, label: "T", status: "homologada", scope: { academicYearId: "2026" },
  standings: [{ id: "sit-x", code: "X", label: "X", description: "", properties: {}, effects: [] }],
  parameters: [{ id: "par", label: "ref", value: 10 }], bodies: [],
  steps: [{ id: "s1", order: 1, label: "acima", stopsOnMatch: true,
    when: { id: "n1", kind: "comparacao", fact: { factId: "resultado", scope }, operator: "maior-ou-igual", parameter: { kind: "parametro", parameterId: "par" } },
    consequence: { kind: "atribuir-situacao", standingId: "sit-x" } }],
  audit: { events: [], demonstrative: true },
};
const determine = (value: number | null, v = 1) =>
  determineAcademicStanding({
    cycle: { id: "cic", kindId: "k", academicYearId: "2026" }, studentId: "alu", studentName: "A",
    ruleSet: rule, facts: [fact(value, v)], factPendencies: [], cycleComplete: true, factsOfficial: true,
  });
const actor = standingDemonstrationActor("perfil-deliberativo");

describe("6D.4.4 registro da situação oficial", () => {
  it("situação projetada não é oficial até o ato", () => {
    const store = createAcademicStandingStore();
    expect(determine(12).standingId).toBe("sit-x");
    expect(store.current(standingScopeKey({ cycleId: "cic", studentId: "alu" }))).toBeUndefined();
  });
  it("registrar cria fato oficial versionado e impede duplicação", () => {
    const store = createAcademicStandingStore();
    const d = determine(12);
    const r = registerConferredStandings({ store, actor, conferred: [{ studentId: "alu", fingerprint: standingFingerprint(d) }], rebuild: () => determine(12) });
    expect(r.ok && r.records[0]!.version).toBe(1);
    expect(standingRegistrability(determine(12), store).registrable).toBe(false);
  });
  it("mudança entre conferência e registro impede o ato sem registro parcial", () => {
    const store = createAcademicStandingStore();
    const fp = standingFingerprint(determine(12, 1));
    const r = registerConferredStandings({ store, actor, conferred: [{ studentId: "alu", fingerprint: fp }], rebuild: () => determine(12, 2) });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.stale).toBe(true);
    expect(store.records()).toHaveLength(0);
  });
  it("indeterminado (fato ausente) não é registrável e não vira zero", () => {
    const d = determine(null);
    expect(d.standingId).toBeNull();
    expect(standingRegistrability(d, createAcademicStandingStore()).registrable).toBe(false);
  });
});

describe("6D.4.5 encerramento exige situação oficial quando a política declara", () => {
  const policy = (required: boolean): CycleClosingPolicy => ({
    ...demonstrationClosingPolicyQualitative, requirements: [],
    terminalStandingRequirement: { required, note: "teste" },
  });
  const ctx = (records = createAcademicStandingStore().records()) => ({
    classId: "t", cycleId: "cic", academicYearId: "2026", observations: [], expectations: [], now: "2026-12-20",
    students: studentsWithOfficialStanding([{ id: "alu", name: "A" }], records, "cic"),
  });
  it("sem situação oficial bloqueia; projeção não conta", () => {
    expect(inspectCycleClosing({ policy: policy(true), context: ctx() }).closable).toBe(false);
  });
  it("com situação oficial registrada libera", () => {
    const store = createAcademicStandingStore();
    store.register({ actor, determination: determine(12) });
    expect(inspectCycleClosing({ policy: policy(true), context: ctx(store.records()) }).closable).toBe(true);
  });
  it("política sem exigência não gera falso bloqueio", () => {
    expect(inspectCycleClosing({ policy: policy(false), context: ctx() }).closable).toBe(true);
  });
});
