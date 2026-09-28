/**
 * 6D.3.2.3 — Registro Oficial do Lote. Lote realista de 35 estudantes com
 * novos resultados, registrados intocados, retificação autorizada, "não
 * registrado", não aplicáveis, sem registro legítimos e concorrência.
 */
import { describe, expect, it } from "vitest";
import type { AssessmentCorrectionPolicy, AssessmentPeriodClosingFact } from "./assessment-correction";
import {
  commitAssessmentEntryBatch,
  prepareAssessmentEntryBatch,
  type AssessmentBatchDraftItem,
  type AssessmentBatchOperation,
  type PrepareAssessmentEntryBatchInput,
} from "./assessment-entry-batch";
import type { InstrumentEntryRosterStudent } from "./assessment-entry-projection";
import {
  createFirstAssessmentEntryVersion,
  createSupersedingAssessmentEntryVersion,
  currentAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import { assessmentConfigurations } from "./assessment-fixtures";

const config = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const sid = (n: number) => `stu-${String(n).padStart(2, "0")}`;

const students: InstrumentEntryRosterStudent[] = Array.from({ length: 35 }, (_, i) => ({
  studentId: sid(i + 1),
  displayName: `Estudante ${i + 1}`,
  rollNumber: i + 1,
  placements: [
    {
      participationNature: "regular",
      studentId: sid(i + 1),
      enrollmentId: `enr-${i + 1}`,
      unitId: "un-1",
      academicLinkId: `lnk-${i + 1}`,
      participationId: `par-${i + 1}`,
      allocationId: `alo-${i + 1}`,
      classId: "cls-1",
      // 34 e 35 saíram antes da aplicação: não aplicáveis.
      from: "2026-02-01",
      until: i >= 33 ? "2026-03-01" : null,
    },
  ],
}));

const official = (n: number, value: number): AssessmentEntryVersion =>
  createFirstAssessmentEntryVersion({
    versionId: `v1-${sid(n)}`,
    instrumentId: "ins-1",
    studentId: sid(n),
    placement: { enrollmentId: `enr-${n}`, academicLinkId: `lnk-${n}`, participationId: `par-${n}`, allocationId: `alo-${n}` },
    value: { kind: "numerica", value },
    status: "registrado",
    recordedByAssignmentId: "atu-1",
    now: "2026-04-11T10:00:00.000Z",
  });

// 1–5 já registrados.
const initialVersions = [1, 2, 3, 4, 5].map((n) => official(n, 60 + n));

const freePolicy: AssessmentCorrectionPolicy = {
  id: "pol-livre",
  version: 1,
  label: "Correção antes do fechamento",
  homologated: true,
  appliesWhenPeriodClosing: "absent",
  outcome: "admissible",
  requiredCapabilities: [],
  requirements: [
    { code: "justificativa", label: "Justificativa da correção", provenance: "Regra pol-livre v1." },
  ],
  disclosesNormativeContext: true,
};

const num = (value: number) => ({ kind: "numerica" as const, value });

/** 6–30 novos; 1 retificado com justificativa; 2 idêntico (no-op); 31 não registrado; 32–33 sem registro. */
function drafts(): AssessmentBatchDraftItem[] {
  const list: AssessmentBatchDraftItem[] = [];
  for (let n = 6; n <= 30; n += 1) list.push({ studentId: sid(n), value: num(50 + n), expectedBaseVersionId: null });
  list.push({ studentId: sid(1), value: num(90), expectedBaseVersionId: "v1-stu-01", correction: { justification: "Erro de digitação." } });
  list.push({ studentId: sid(2), value: num(62), expectedBaseVersionId: "v1-stu-02" });
  list.push({ studentId: sid(31), value: { kind: "nao-registrado", reason: "Estudante não realizou" }, expectedBaseVersionId: null });
  return list;
}

function prepareInput(versions: readonly AssessmentEntryVersion[], d = drafts()): PrepareAssessmentEntryBatchInput {
  return {
    roster: {
      instrument: { id: "ins-1", title: "Prova", classId: "cls-1", appliedOn: "2026-04-10", periodId: "per-1", instrumentTypeId: "it-prova", configurationId: config.id },
      configuration: config,
      students,
      versions,
    },
    drafts: d,
    agent: { agentId: "prof-1", capabilities: [] },
    recordedByAssignmentId: "atu-1",
    correctionPolicies: [freePolicy],
    instrumentStatus: "aplicado",
  };
}

const idFor = (op: AssessmentBatchOperation) =>
  op.kind === "novo-registro" ? `v1-${op.studentId}` : `v${op.baseVersion + 1}-${op.studentId}`;

describe("6D.3.2.3 — preparo do lote", () => {
  it("classifica novo registro, retificação e no-op, e deriva o sumário do plano", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    expect(plan.state).toBe("ready");
    expect(plan.summary).toMatchObject({ newRecords: 26, rectifications: 1, eliminatedNoOps: 1, remainingUnrecorded: 2, notApplicable: 2 });
    expect(plan.summary.label).toBe(
      "26 novos registros · 1 alteração de registro existente · 2 estudantes continuam sem registro · 2 não se aplicam",
    );
    expect(plan.summary.label).not.toMatch(/pend/i);
    expect(plan.operations.find((op) => op.studentId === sid(1))?.kind).toBe("retificacao");
  });

  it("é determinístico: mesmos fatos e mesmo rascunho produzem o mesmo plano", () => {
    expect(prepareAssessmentEntryBatch(prepareInput(initialVersions)).planId).toBe(
      prepareAssessmentEntryBatch(prepareInput(initialVersions)).planId,
    );
  });

  it("retificação sem o rito exigido pelo resolvedor bloqueia o plano", () => {
    const d = drafts().map((item) => (item.studentId === sid(1) ? { ...item, correction: {} } : item));
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions, d));
    expect(plan.state).toBe("blocked");
    expect(plan.blockers[0]).toMatchObject({ code: "retificacao-inadmissivel", studentId: sid(1) });
  });

  it("sem política homologada, alterar fato oficial é impedido", () => {
    const input = { ...prepareInput(initialVersions), correctionPolicies: [{ ...freePolicy, homologated: false }] };
    expect(prepareAssessmentEntryBatch(input).blockers.map((b) => b.code)).toContain("retificacao-inadmissivel");
  });

  it("não aplicável e valor fora da escala bloqueiam; sem registro não bloqueia por si", () => {
    const d = [
      { studentId: sid(34), value: num(70), expectedBaseVersionId: null },
      { studentId: sid(6), value: num(999), expectedBaseVersionId: null },
    ];
    const codes = prepareAssessmentEntryBatch(prepareInput(initialVersions, d)).blockers.map((b) => b.code);
    expect(codes).toEqual(expect.arrayContaining(["estudante-nao-aplicavel", "valor-inadmissivel"]));
  });

  it("completude só é exigida quando uma regra homologada a declara", () => {
    const policy = { id: "cmp-1", version: 1, label: "Pauta integral", homologated: true, requiresAllEligibleRecorded: true };
    expect(prepareAssessmentEntryBatch({ ...prepareInput(initialVersions), completenessPolicy: policy }).blockers.map((b) => b.code)).toContain("completude-exigida");
    expect(prepareAssessmentEntryBatch({ ...prepareInput(initialVersions), completenessPolicy: { ...policy, homologated: false } }).state).toBe("ready");
  });

  it("lote sem alteração efetiva não é registrável", () => {
    const d = [{ studentId: sid(2), value: num(62), expectedBaseVersionId: "v1-stu-02" }];
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions, d));
    expect(plan.state).toBe("blocked");
    expect(plan.operations).toHaveLength(0);
  });
});

describe("6D.3.2.3 — registro atômico", () => {
  it("sucesso: todas e somente as operações do plano viram versões, com proveniência", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const result = commitAssessmentEntryBatch({ plan, current: prepareInput(initialVersions), committedActs: [], newVersionId: idFor, now: "2026-04-20T10:00:00.000Z" });
    if (!result.committed) throw new Error("falhou");
    expect(result.newVersions).toHaveLength(27);
    expect(result.act.versionIds).toHaveLength(27);
    const all = [...initialVersions, ...result.newVersions];
    const s1 = currentAssessmentEntryVersion(all, "res-ins-1-stu-01")!;
    expect(s1).toMatchObject({ version: 2, supersedesVersionId: "v1-stu-01" });
    expect(s1.rectification?.policyId).toBe("pol-livre");
    expect(s1.rectification?.justification).toBe("Erro de digitação.");
    const s6 = currentAssessmentEntryVersion(all, "res-ins-1-stu-06")!;
    expect(s6.originMetadata?.["batchPlanId"]).toBe(plan.planId);
    expect(s6.placement.enrollmentId).toBe("enr-6");
    expect(currentAssessmentEntryVersion(all, "res-ins-1-stu-31")?.value.kind).toBe("nao-registrado");
    // no-op, sem registro e não aplicáveis ficam intocados.
    for (const n of [2, 32, 33, 34, 35])
      expect(result.newVersions.some((v) => v.studentId === sid(n))).toBe(false);
  });

  it("concorrência por entrada: se B avançou para v2, nenhuma versão nova existe", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const concurrent = createSupersedingAssessmentEntryVersion({
      base: initialVersions[0]!,
      versionId: "v2-outra-sessao",
      value: num(80),
      rectification: { actedAt: "x", agentId: "outra", policyId: "pol-livre", policyVersion: 1, policyLabel: "x", satisfiedRequirements: [], changedAspects: ["resultado-registrado"] },
      now: "2026-04-19T00:00:00.000Z",
    });
    const moved = [...initialVersions, concurrent];
    const before = JSON.stringify(moved);
    const result = commitAssessmentEntryBatch({ plan, current: prepareInput(moved), committedActs: [], newVersionId: idFor, now: "2026-04-20T10:00:00.000Z" });
    expect(result.committed).toBe(false);
    if (result.committed) return;
    expect(result.plan.blockers).toEqual([expect.objectContaining({ code: "versao-base-divergente", studentId: sid(1) })]);
    expect(JSON.stringify(moved)).toBe(before);
  });

  it("concorrência em novo registro: outra sessão já criou v1", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const moved = [...initialVersions, official(10, 77)];
    const result = commitAssessmentEntryBatch({ plan, current: prepareInput(moved), committedActs: [], newVersionId: idFor, now: "t" });
    expect(result.committed).toBe(false);
  });

  it("regra substituída entre preparo e registro: fatos mudaram, nada é registrado", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const current = prepareInput(initialVersions);
    current.roster = { ...current.roster, configuration: { ...config, version: config.version + 1 } };
    const result = commitAssessmentEntryBatch({ plan, current, committedActs: [], newVersionId: idFor, now: "t" });
    expect(result).toMatchObject({ committed: false, reason: "fatos-mudaram" });
  });

  it("elegibilidade mudou antes do registro: nada é registrado", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const current = prepareInput(initialVersions);
    current.roster = {
      ...current.roster,
      students: students.map((s) => (s.studentId === sid(6) ? { ...s, placements: [{ ...s.placements[0]!, until: "2026-03-01" }] } : s)),
    };
    expect(commitAssessmentEntryBatch({ plan, current, committedActs: [], newVersionId: idFor, now: "t" }).committed).toBe(false);
  });

  it("duplo clique/reenvio não cria v1 duplicada nem v2 fantasma", () => {
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions));
    const first = commitAssessmentEntryBatch({ plan, current: prepareInput(initialVersions), committedActs: [], newVersionId: idFor, now: "t1" });
    if (!first.committed) throw new Error("falhou");
    const after = [...initialVersions, ...first.newVersions];
    const second = commitAssessmentEntryBatch({ plan, current: prepareInput(after), committedActs: [first.act], newVersionId: idFor, now: "t2" });
    expect(second).toMatchObject({ committed: true, alreadyCommitted: true, newVersions: [] });
    // Sem o livro de atos, o reenvio também falha fechado pela base divergente.
    const third = commitAssessmentEntryBatch({ plan, current: prepareInput(after), committedActs: [], newVersionId: idFor, now: "t3" });
    expect(third.committed).toBe(false);
  });

  it("plano bloqueado nunca é registrado", () => {
    const d = [{ studentId: sid(34), value: num(70), expectedBaseVersionId: null }];
    const plan = prepareAssessmentEntryBatch(prepareInput(initialVersions, d));
    const result = commitAssessmentEntryBatch({ plan, current: prepareInput(initialVersions, d), committedActs: [], newVersionId: idFor, now: "t" });
    expect(result).toMatchObject({ committed: false, reason: "plano-bloqueado" });
  });
});

// 6D.3.4.3b — homologação funcional: concorrência do fechamento no registro em lote.
const closingV1: AssessmentPeriodClosingFact = { closingId: "clo-1", closingVersion: 1, periodLabel: "1º período" };
const closingV2: AssessmentPeriodClosingFact = { closingId: "clo-1", closingVersion: 2, periodLabel: "1º período" };

/** Política aplicável SOMENTE com fechamento vigente — exigência vem dela, não do código. */
const posClosingPolicy: AssessmentCorrectionPolicy = {
  ...freePolicy,
  id: "pol-pos",
  label: "Correção após fechamento",
  appliesWhenPeriodClosing: "present",
};

function prepareInputComFechamento(
  versions: readonly AssessmentEntryVersion[],
  closing: AssessmentPeriodClosingFact,
  d: readonly AssessmentBatchDraftItem[] = drafts(),
): PrepareAssessmentEntryBatchInput {
  const input = prepareInput(versions, [...d]);
  return { ...input, correctionPolicies: [posClosingPolicy], periodClosing: closing };
}

describe("6D.3.4.3b — concorrência do fechamento no registro em lote", () => {
  it("plano preparado sob Closing v1 não é registrado após Closing v2: falha fechada, sem versão nova, sem parcial", () => {
    // 1. Closing v1 vigente; 2. pauta com alterações locais, incluindo retificação de fato oficial.
    const planV1 = prepareAssessmentEntryBatch(prepareInputComFechamento(initialVersions, closingV1));
    expect(planV1.state).toBe("ready");
    expect(planV1.operations.some((op) => op.kind === "retificacao")).toBe(true);

    // A impressão digital incorpora o contexto de fechamento: v1 ≠ v2, v2 determinístico.
    const planV2 = prepareAssessmentEntryBatch(prepareInputComFechamento(initialVersions, closingV2));
    expect(planV2.planId).not.toBe(planV1.planId);
    expect(prepareAssessmentEntryBatch(prepareInputComFechamento(initialVersions, closingV2)).planId).toBe(planV2.planId);

    // 5. Antes de "Registrar lançamentos", o fechamento vigente passa a ser Closing v2.
    const versoesAntes = JSON.stringify(initialVersions);
    const rascunhosAntes = JSON.stringify(drafts());
    const v1Antes = JSON.stringify(closingV1);
    const v2Antes = JSON.stringify(closingV2);

    // 6. O professor tenta registrar o plano preparado sob v1, contra fatos relidos com v2.
    const result = commitAssessmentEntryBatch({
      plan: planV1,
      current: prepareInputComFechamento(initialVersions, closingV2),
      committedActs: [],
      newVersionId: idFor,
      now: "2026-04-20T10:00:00.000Z",
    });

    expect(result).toMatchObject({ committed: false, reason: "fatos-mudaram" });
    if (!result.committed) {
      expect(result.plan.planId).toBe(planV2.planId);
      expect(result.plan.state).toBe("ready");
    }
    // Nenhuma AssessmentEntryVersion nova; nenhuma operação parcial; rascunhos e fechamentos intactos.
    expect(JSON.stringify(initialVersions)).toBe(versoesAntes);
    expect(JSON.stringify(drafts())).toBe(rascunhosAntes);
    expect(JSON.stringify(closingV1)).toBe(v1Antes);
    expect(JSON.stringify(closingV2)).toBe(v2Antes);

    // Nova conferência contra Closing v2: novo plano é produzido e registrável segundo a política então aplicável.
    const novoPlano = prepareAssessmentEntryBatch(prepareInputComFechamento(initialVersions, closingV2));
    expect(novoPlano.state).toBe("ready");
    const segunda = commitAssessmentEntryBatch({
      plan: novoPlano,
      current: prepareInputComFechamento(initialVersions, closingV2),
      committedActs: [],
      newVersionId: idFor,
      now: "2026-04-20T11:00:00.000Z",
    });
    expect(segunda.committed).toBe(true);
    if (segunda.committed) {
      expect(segunda.act.planId).toBe(novoPlano.planId);
      expect(segunda.newVersions.length).toBe(novoPlano.operations.length);
 expect(segunda.newVersions.length).toBeGreaterThan(0);
      expect(currentAssessmentEntryVersion([...initialVersions, ...segunda.newVersions], "res-ins-1-stu-01")!.version).toBe(2);
    }
  });
});
