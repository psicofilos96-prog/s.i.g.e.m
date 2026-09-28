/** 6D.4 — Conselho → Situação → Encerramento (conjuntos de TESTE, não norma da rede). */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { determineAcademicStanding } from "./academic-standing-engine";
import { createAcademicStandingStore, standingScopeKey } from "./academic-standing-store";
import { projectStandingDivergence } from "./academic-standing-divergence";
import { standingDemonstrationActor } from "./academic-standing-governance";
import {
  scopeKeyOf,
  type AcademicStandingRuleSet,
  type FactProvenance,
  type ResolvedFact,
  type StandingValue,
} from "./academic-standing-types";
import {
  officialStandingDeliberationFor,
  preparingDeliberationsFor,
} from "@/features/collegial/collegial-standing-bridge";
import type { CollegialDeliberation, StructuredMinute } from "@/features/collegial/collegial-types";
import { standingObservations } from "@/features/cycle-closing/cycle-closing-sources";

const prov = (v = 1): FactProvenance => ({
  sources: [{ kind: "fechamento", id: "fch-1", version: v }],
  algorithm: "teste",
  materializedAt: "2026-12-01T00:00:00.000Z",
});
const scope = { kind: "componente-curricular", id: "c1" };
const fact = (value: StandingValue | null, v = 1): ResolvedFact => ({
  factId: "resultado", scope, scopeKey: scopeKeyOf(scope), category: "consolidado",
  valueKind: "numero", value, provenance: prov(v),
});
const cycle = { id: "cic", kindId: "k", academicYearId: "2026" };
const key = standingScopeKey({ cycleId: "cic", studentId: "alu" });

const rule = (version = 1): AcademicStandingRuleSet => ({
  id: "rgs", version, label: "Teste", status: "homologada", scope: { academicYearId: "2026" },
  standings: [
    { id: "sit-x", code: "X", label: "X", description: "", properties: {}, effects: [] },
    { id: "sit-pp", code: "PP", label: "Progressão parcial (teste)", description: "", properties: {}, effects: [] },
  ],
  parameters: [{ id: "par", label: "ref", value: 10 }],
  bodies: [{ id: "org", label: "Órgão", competences: [{ id: "cmp", label: "Comp", allowedStandingIds: ["sit-pp"] }] }],
  steps: [
    { id: "s1", order: 1, label: "acima", stopsOnMatch: true,
      when: { id: "n1", kind: "comparacao", fact: { factId: "resultado", scope }, operator: "maior-ou-igual", parameter: { kind: "parametro", parameterId: "par" } },
      consequence: { kind: "atribuir-situacao", standingId: "sit-x" } },
    { id: "s2", order: 2, label: "abaixo", stopsOnMatch: true,
      when: { id: "n2", kind: "comparacao", fact: { factId: "resultado", scope }, operator: "existe", parameter: { kind: "sem-parametro" } },
      consequence: { kind: "encaminhar-para-deliberacao", bodyId: "org", competenceId: "cmp" } },
  ],
  audit: { events: [], demonstrative: true },
});

const delib = (over: Partial<CollegialDeliberation> = {}): CollegialDeliberation => ({
  id: "dlb-1", sessionId: "ses-1", agendaItemId: "a", bodyId: "org", competenceId: "cmp", competenceLabel: "Comp",
  studentId: "alu", cycleId: "cic", decision: { outcomeId: "o", outcomeLabel: "PP", standingId: "sit-pp" },
  rationale: "fundamentação", dossier: { referenceSnapshotAt: "2026-12-10", sources: [], facts: [] },
  actor: { actorId: "p", actorName: "P", profileLabel: "Perfil", at: "2026-12-10" }, at: "2026-12-10T10:00:00.000Z", ...over,
});
const minute = (d: CollegialDeliberation[], over: Partial<StructuredMinute> = {}) =>
  ({ id: "ata-1", sessionId: "ses-1", version: 1, closedAt: "2026-12-10T12:00:00.000Z", deliberations: d, ...over }) as StructuredMinute;

const determine = (facts: ResolvedFact[], minutes: StructuredMinute[], r = rule()) => {
  const deliberation = officialStandingDeliberationFor(minutes, key, () => "Órgão");
  return determineAcademicStanding({
    cycle, studentId: "alu", studentName: "Aluna", ruleSet: r, facts,
    factPendencies: [], cycleComplete: true, factsOfficial: true,
    ...(deliberation ? { deliberation } : {}),
  });
};

describe("6D.4 Conselho → Situação", () => {
  it("decisão em Conselho aberto não afeta situação (é preparação)", () => {
    const d = delib();
    expect(determine([fact(5)], []).operationalState).toBe("aguardando-deliberacao");
    expect(preparingDeliberationsFor([d], [], key)).toHaveLength(1);
  });
  it("a mesma decisão passa a valer após encerramento da ata, com proveniência exata", () => {
    const r = determine([fact(5)], [minute([delib()])]);
    expect(r.operationalState).toBe("situacao-determinada");
    expect(r.standingId).toBe("sit-pp");
    const store = createAcademicStandingStore();
    const reg = store.register({ actor: standingDemonstrationActor("secretaria")!, determination: r });
    expect(reg.ok).toBe(true);
    if (reg.ok) {
      expect(reg.value.deliberationId).toBe("dlb-1");
      expect(reg.value.deliberationSource).toMatchObject({ minuteId: "ata-1", minuteVersion: 1, sessionId: "ses-1" });
      const obs = standingObservations([reg.value], { classId: "t", cycleId: "cic" });
      expect(obs[0]!.dimensions).toMatchObject({ deliberationId: "dlb-1", minuteId: "ata-1" });
    }
  });
  it("ata retificada: vale a deliberação da versão vigente", () => {
    const v2 = minute([delib({ id: "dlb-2" })], { id: "ata-2", version: 2, precedingMinuteId: "ata-1", closedAt: "2026-12-11T00:00:00.000Z" });
    expect(officialStandingDeliberationFor([minute([delib()]), v2], key, () => undefined)?.id).toBe("dlb-2");
  });
  it("órgão não autorizado pela regra não altera situação", () => {
    const r = determine([fact(5)], [minute([delib({ bodyId: "outro" })])]);
    expect(r.standingId).toBeNull();
  });
  it("situação fora da competência declarada não é produzida", () => {
    const r = determine([fact(5)], [minute([delib({ decision: { outcomeId: "o", outcomeLabel: "X", standingId: "sit-x" } })])]);
    expect(r.standingId).toBeNull();
  });
  it("progressão parcial declarada pela regra não é confundida com outra situação", () => {
    expect(determine([fact(5)], [minute([delib()])]).standing?.label).toBe("Progressão parcial (teste)");
  });
  it("fato ausente (null) nunca vira zero nem situação presumida", () => {
    const r = determine([fact(null)], []);
    expect(r.standingId).toBeNull();
  });
  it("Conselho nunca importa lançamentos, composição ou fechamento", () => {
    const dir = "src/features/collegial";
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && !n.includes("test"))) {
      const src = readFileSync(`${dir}/${f}`, "utf8");
      expect(src).not.toMatch(/assessment-entry|period-closing|assessment-composition|cycle-consolidation/);
    }
  });
});

describe("6D.4.3 divergência pós-situação", () => {
  const registered = () => {
    const store = createAcademicStandingStore();
    const reg = store.register({ actor: standingDemonstrationActor("secretaria")!, determination: determine([fact(15)], []) });
    if (!reg.ok) throw new Error(reg.reasons.join(" "));
    return reg.value;
  };
  it("sem mudança ⇒ sem divergência", () => {
    expect(projectStandingDivergence({ record: registered(), currentFacts: [fact(15)], historicalRuleSet: rule() }).status).toBe("no-divergence");
  });
  it("fato mudou ⇒ divergência detectada, registro intacto, impacto pela regra histórica", () => {
    const rec = registered();
    const d = projectStandingDivergence({ record: rec, currentFacts: [fact(5, 2)], historicalRuleSet: rule(1) });
    expect(d.status).toBe("divergent");
    if (d.status === "divergent") {
      expect(d.changes.map((c) => c.kind)).toEqual(expect.arrayContaining(["fact-value", "fact-source-version"]));
      expect(d.impact.kind).not.toBe("standing-unchanged");
      expect(d.regularization).toBe("not-declared");
    }
    expect(rec.standingId).toBe("sit-x");
    expect(rec.facts[0]!.value).toBe(15);
  });
  it("sem a regra histórica exata (regra vigente mudou) ⇒ impacto indeterminado", () => {
    const d = projectStandingDivergence({ record: registered(), currentFacts: [fact(5, 2)], historicalRuleSet: rule(2) });
    expect(d.status === "divergent" && d.impact.kind).toBe("impact-undetermined");
  });
});
