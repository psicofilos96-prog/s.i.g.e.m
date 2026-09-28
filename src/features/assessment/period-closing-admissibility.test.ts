/** 6D.3.4.2 — testes cirúrgicos da admissibilidade declarativa do fechamento. */
import { describe, expect, it } from "vitest";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type {
  ClosingAdmissibilityPolicy,
  ClosingRequirementDeclaration,
  InstitutionalAssessmentRule,
} from "./assessment-rule-types";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import { buildInstrument, instrumentRoster } from "./assessment-instruments";
import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
import { demonstrationStudents } from "@/features/students/students-data";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";
import {
  blocking,
  demonstrationActor,
  projectClosingAdmissibility,
  type ClosingContext,
} from "./period-closing";
import { createPeriodClosingStore } from "./period-closing-store";

const NOW = "2026-04-20T12:00:00.000Z";
const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const structure = periodStructures.find((s) => s.id === "est-2026-a")!;
const period = structure.periods[0]!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;

function instrument(
  id: string,
  status: AssessmentInstrument["status"] = "aplicado",
  appliedOn = "2026-03-10",
): AssessmentInstrument {
  const r = buildInstrument({
    id,
    input: { title: `Instrumento ${id}`, instrumentTypeId: "it-prova", appliedOn },
    configuration: quant,
    structure,
    assignment: atp,
    professionalId: atp.professionalId,
    classId: "tur-001",
    now: NOW,
  });
  if (!r.ok) throw new Error(r.reasons.join(" "));
  return { ...r.value, status };
}

function entries(i: AssessmentInstrument, skipFirst = false): AssessmentEntry[] {
  return instrumentRoster(i, demonstrationStudents)
    .eligible.slice(skipFirst ? 1 : 0)
    .map((e) => ({
      id: `lan-${i.id}-${e.student.id}`,
      instrumentId: i.id,
      studentId: e.student.id,
      placement: { enrollmentId: "m", academicLinkId: "v", participationId: "p", allocationId: "a" },
      value: { kind: "numerica", value: 80 },
      recordedAt: NOW,
      recordedByAssignmentId: atp.id,
      status: "registrado",
    })) as AssessmentEntry[];
}

const policy = (...requirements: ClosingRequirementDeclaration[]): ClosingAdmissibilityPolicy => ({
  id: "pfe-teste",
  version: 3,
  requirements,
});
const COMPLETUDE: ClosingRequirementDeclaration = {
  id: "req-c",
  label: "Completude",
  evaluatorId: "resultados-elegiveis-registrados",
};
const PLANEJADOS: ClosingRequirementDeclaration = {
  id: "req-p",
  label: "Planejados resolvidos",
  evaluatorId: "instrumentos-planejados-resolvidos",
};
const ENTREGA: ClosingRequirementDeclaration = {
  id: "req-e",
  label: "Entrega",
  evaluatorId: "ato-do-fluxo-realizado",
  parameters: { actionId: "entrega-docente" },
};
const CONFERENCIA: ClosingRequirementDeclaration = {
  id: "req-f",
  label: "Conferência",
  evaluatorId: "ato-do-fluxo-realizado",
  parameters: { actionId: "inicio-conferencia" },
};

function rule(p: ClosingAdmissibilityPolicy | undefined): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  const { closingAdmissibility: _drop, ...rest } = base;
  return { ...rest, status: "homologada", ...(p ? { closingAdmissibility: p } : {}) };
}

function ctxOf(over: {
  policy?: ClosingAdmissibilityPolicy;
  instruments?: AssessmentInstrument[];
  entries?: AssessmentEntry[];
  events?: ClosingContext["events"];
}): ClosingContext {
  const ins = over.instruments ?? [instrument("ins-a")];
  return {
    scope: {
      classId: "tur-001",
      academicYearId: quant.academicYearId,
      periodId: period.id,
      calendarPeriodId: "per-teste-1",
      curriculumRef: { kind: "atuacao", assignmentId: atp.id },
    },
    configuration: quant,
    period: { id: period.id, label: period.label, start: period.start, end: period.end },
    officialPeriod: true,
    calendarId: "cal-teste",
    rule: rule(over.policy),
    assignment: atp,
    instruments: ins,
    versions: (over.entries ?? ins.flatMap((i) => entries(i))).flatMap(assessmentVersionsFromLegacyEntry),
    students: demonstrationStudents,
    stage: "em-andamento",
    events: over.events ?? [],
  };
}

const secretaria = demonstrationActor("perfil-secretaria-escolar");
const codes = (c: ClosingContext) => projectClosingAdmissibility(c, secretaria).blockingReasons.map((p) => p.code);

describe("6D.3.4.2 — admissibilidade declarativa", () => {
  it("A. sem resultado + política sem completude não bloqueia por esse motivo", () => {
    const ins = instrument("ins-a");
    const c = ctxOf({ policy: policy(), instruments: [ins], entries: entries(ins, true) });
    expect(codes(c)).not.toContain("lancamento-ausente");
    expect(projectClosingAdmissibility(c, secretaria).canClose).toBe(true);
  });

  it("B. sem resultado + política exige completude bloqueia com requisito explícito", () => {
    const ins = instrument("ins-a");
    const p = projectClosingAdmissibility(
      ctxOf({ policy: policy(COMPLETUDE), instruments: [ins], entries: entries(ins, true) }),
      secretaria,
    );
    expect(p.canClose).toBe(false);
    expect(p.blockingReasons.find((x) => x.code === "lancamento-ausente")?.requirementId).toBe("req-c");
    expect(p.unmetRequirements.map((r) => r.requirement.id)).toEqual(["req-c"]);
  });

  it("C. estudante fora da elegibilidade (não se aplica) não é exigido", () => {
    const ins = { ...instrument("ins-a"), appliedOn: "1900-01-01" };
    expect(instrumentRoster(ins, demonstrationStudents).eligible).toHaveLength(0);
    const c = ctxOf({ policy: policy(COMPLETUDE), instruments: [ins], entries: [] });
    expect(codes(c)).not.toContain("lancamento-ausente");
  });

  it("D. instrumento planejado + política silenciosa não bloqueia", () => {
    const c = ctxOf({ policy: policy(), instruments: [instrument("ins-p", "planejado")], entries: [] });
    expect(codes(c)).not.toContain("instrumento-sem-pauta-aberta");
  });

  it("E. instrumento planejado + política exige resolução bloqueia", () => {
    const c = ctxOf({ policy: policy(PLANEJADOS), instruments: [instrument("ins-p", "planejado")], entries: [] });
    expect(codes(c)).toContain("instrumento-sem-pauta-aberta");
  });

  it("F. política sem rito permite fechamento direto, sem entrega nem conferência", () => {
    const c = ctxOf({ policy: policy() });
    const store = createPeriodClosingStore();
    const r = store.act({ ctx: c, actor: secretaria, action: "fechamento-oficial", now: NOW });
    expect(r.ok).toBe(true);
    expect(store.chain(c.scope)).toHaveLength(1);
  });

  it("G. entrega e conferência são avaliadas separadamente", () => {
    const stamp = { actorId: "x", actorName: "x", profileLabel: "x", at: NOW };
    const base = { policy: policy(ENTREGA, CONFERENCIA) };
    const nada = projectClosingAdmissibility(ctxOf(base), secretaria);
    expect(nada.provenance.unmetRequirementIds).toEqual(["req-e", "req-f"]);
    const soEntrega = projectClosingAdmissibility(
      ctxOf({ ...base, events: [{ at: NOW, action: "entrega-docente", actor: stamp, detail: "" }] }),
      secretaria,
    );
    expect(soEntrega.provenance.metRequirementIds).toEqual(["req-e"]);
    expect(soEntrega.provenance.unmetRequirementIds).toEqual(["req-f"]);
    const soConferencia = projectClosingAdmissibility(
      ctxOf({ policy: policy(CONFERENCIA), events: [{ at: NOW, action: "inicio-conferencia", actor: stamp, detail: "" }] }),
      secretaria,
    );
    expect(soConferencia.canClose).toBe(true);
  });

  it("H. capacidade exigida pelo requisito ausente falha fechada", () => {
    const c = ctxOf({ policy: policy({ ...COMPLETUDE, requiredCapabilityIds: ["capacidade-inexistente"] }) });
    const p = projectClosingAdmissibility(c, secretaria);
    expect(p.canClose).toBe(false);
    expect(p.unmetRequirements[0]?.missingCapabilityIds).toEqual(["capacidade-inexistente"]);
    const store = createPeriodClosingStore();
    expect(store.act({ ctx: c, actor: secretaria, action: "fechamento-oficial", now: NOW }).ok).toBe(false);
  });

  it("I. sem política homologada falha fechada por insuficiência normativa, sem fabricar requisitos", () => {
    const semPolitica = projectClosingAdmissibility(ctxOf({}), secretaria);
    expect(semPolitica.canClose).toBe(false);
    expect(semPolitica.normativeSufficiency).toBe("insuficiente");
    expect(semPolitica.requirements).toEqual([]);
    expect(semPolitica.blockingReasons.map((p) => p.code)).toEqual(["politica-de-fechamento-ausente"]);

    const naoHomologada = { ...ctxOf({ policy: policy() }), rule: { ...rule(policy()), status: "rascunho" as const } };
    const p2 = projectClosingAdmissibility(naoHomologada, secretaria);
    expect(p2.normativeSufficiency).toBe("insuficiente");
    expect(blocking(p2.blockingReasons).map((p) => p.code)).toContain("regra-nao-homologada");

    const semAvaliador = projectClosingAdmissibility(
      ctxOf({ policy: policy({ id: "req-x", label: "Novo", evaluatorId: "avaliador-desconhecido" }) }),
      secretaria,
    );
    expect(semAvaliador.canClose).toBe(false);
    expect(semAvaliador.unmetRequirements[0]?.status).toBe("inconclusivo");
  });

  it("J. proveniência identifica regra, versão e política utilizadas", () => {
    const p = projectClosingAdmissibility(ctxOf({ policy: policy(COMPLETUDE) }), secretaria);
    expect(p.provenance).toMatchObject({
      ruleId: "rav-demo-estrutural",
      ruleVersion: 1,
      policyId: "pfe-teste",
      policyVersion: 3,
      evaluatedRequirementIds: ["req-c"],
      metRequirementIds: ["req-c"],
    });
  });
});
