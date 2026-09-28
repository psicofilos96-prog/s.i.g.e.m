import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
/** Etapa 12G — fechamento do período avaliativo. */
import { describe, expect, it } from "vitest";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import { buildInstrument, instrumentRoster } from "./assessment-instruments";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { AssessmentEntry, AssessmentInstrument } from "./assessment-types";
import {
  assignmentActiveInPeriod,
  blocking,
  closingChainIssues,
  closingScopeKey,
  closingSourceReference,
  CONSOLIDATED_PERIOD_RESULT_LABEL,
  currentClosing,
  deliveryPendencies,
  demonstrationActor,
  isSuperseded,
  officialClosingPendencies,
  specialPendencies,
  type ClosingContext,
} from "./period-closing";
import { createPeriodClosingStore } from "./period-closing-store";
import type { ClosingScope, PeriodClosingRecord } from "./period-closing-types";

const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const ei = assessmentConfigurations.find((c) => c.id === "cfg-2026-ei-acompanhamento")!;
const structure = periodStructures.find((s) => s.id === "est-2026-a")!;
const period = structure.periods[0]!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;
const NOW = "2026-04-20T12:00:00.000Z";

const docente = demonstrationActor("perfil-docente");
const gestao = demonstrationActor("perfil-gestao-escolar");
const secretaria = demonstrationActor("perfil-secretaria-escolar");
const supervisao = demonstrationActor("perfil-supervisao");

function instrument(id: string, typeId = "it-prova"): AssessmentInstrument {
  const r = buildInstrument({
    id,
    input: { title: `Instrumento ${id}`, instrumentTypeId: typeId, appliedOn: "2026-03-10" },
    configuration: quant,
    structure,
    assignment: atp,
    professionalId: atp.professionalId,
    classId: "tur-001",
    now: NOW,
  });
  if (!r.ok) throw new Error(r.reasons.join(" "));
  return { ...r.value, status: "aplicado" };
}

function entriesFor(
  i: AssessmentInstrument,
  make: (studentId: string, index: number) => Partial<AssessmentEntry> = () => ({}),
): AssessmentEntry[] {
  return instrumentRoster(i, demonstrationStudents).eligible.map((e, index) => ({
    id: `lan-${i.id}-${e.student.id}`,
    instrumentId: i.id,
    studentId: e.student.id,
    placement: {
      enrollmentId: "mat-teste",
      academicLinkId: "vin-teste",
      participationId: "par-teste",
      allocationId: "alo-teste",
    },
    value: { kind: "numerica", value: 80 },
    recordedAt: NOW,
    recordedByAssignmentId: atp.id,
    status: "registrado",
    ...make(e.student.id, index),
  }));
}

/** Regra homologada usada APENAS no teste, para exercitar o fechamento oficial. */
function homologatedRule(
  patch: Partial<InstitutionalAssessmentRule> = {},
): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  return { ...base, status: "homologada", configurationId: quant.id, configurationVersion: quant.version, ...patch };
}

/** Fixtures legadas entram pelo conversor homologado: o fechamento só lê versões. */
function ctxOf(
  over: Partial<ClosingContext> & { entries?: AssessmentEntry[] } = {},
): ClosingContext {
  const { entries, ...rest } = over;
  const scope: ClosingScope = {
    classId: "tur-001",
    academicYearId: quant.academicYearId,
    periodId: period.id,
    calendarPeriodId: "per-teste-1",
    curriculumRef: { kind: "atuacao", assignmentId: atp.id },
  };
  const ins = instrument("ins-a");
  return {
    scope,
    configuration: quant,
    period: { id: period.id, label: period.label, start: period.start, end: period.end },
    officialPeriod: true,
    calendarId: "cal-teste",
    rule: homologatedRule(),
    assignment: atp,
    instruments: [ins],
    versions: (entries ?? entriesFor(ins)).flatMap(assessmentVersionsFromLegacyEntry),
    students: demonstrationStudents,
    stage: "em-andamento",
    ...rest,
  };
}

const closeFlow = (ctx: ClosingContext, store = createPeriodClosingStore()) => {
  const r1 = store.act({ ctx, actor: docente, action: "entrega-docente", now: NOW });
  const r2 = store.act({ ctx, actor: gestao, action: "inicio-conferencia", now: NOW });
  const r3 = store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW });
  return { store, r1, r2, r3 };
};

describe("estados e transições", () => {
  it("entrega, conferência e fechamento são momentos distintos e sequenciais", () => {
    const ctx = ctxOf();
    const store = createPeriodClosingStore();
    expect(store.stage(ctx.scope)).toBe("em-andamento");
    expect(store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW }).ok).toBe(
      false,
    );
    const flow = closeFlow(ctx, store);
    expect([flow.r1.ok, flow.r2.ok, flow.r3.ok]).toEqual([true, true, true]);
    expect(store.stage(ctx.scope)).toBe("fechado");
    expect(store.chain(ctx.scope).map((r) => r.version)).toEqual([1]);
  });

  it("devolução com apontamentos exige justificativa e volta o fluxo ao professor", () => {
    const ctx = ctxOf();
    const store = createPeriodClosingStore();
    store.act({ ctx, actor: docente, action: "entrega-docente", now: NOW });
    expect(store.act({ ctx, actor: gestao, action: "devolucao-com-apontamentos", now: NOW }).ok).toBe(
      false,
    );
    const r = store.act({
      ctx,
      actor: gestao,
      action: "devolucao-com-apontamentos",
      justification: "Rever o lançamento do aluno transferido.",
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(store.stage(ctx.scope)).toBe("devolvida-para-ajustes");
  });

  it("reabertura é exceção justificada e preserva o fechamento anterior", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const v1 = store.current(ctx.scope)!;
    const r = store.act({
      ctx,
      actor: supervisao,
      action: "reabertura-integral",
      justification: "Determinação formal da Supervisão.",
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(store.stage(ctx.scope)).toBe("reaberto");
    expect(store.chain(ctx.scope)).toEqual([v1]);
  });
});

describe("capacidades, nunca cargos", () => {
  it("cada operação exige a capacidade correspondente", () => {
    const ctx = ctxOf();
    const store = createPeriodClosingStore();
    expect(store.act({ ctx, actor: gestao, action: "entrega-docente", now: NOW }).ok).toBe(false);
    store.act({ ctx, actor: docente, action: "entrega-docente", now: NOW });
    expect(store.act({ ctx, actor: docente, action: "inicio-conferencia", now: NOW }).ok).toBe(false);
    store.act({ ctx, actor: gestao, action: "inicio-conferencia", now: NOW });
    expect(store.act({ ctx, actor: gestao, action: "fechamento-oficial", now: NOW }).ok).toBe(false);
    expect(store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW }).ok).toBe(
      true,
    );
  });

  it("retificação exige executor e autorização compatível", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const semAutorizacao = store.act({
      ctx,
      actor: secretaria,
      action: "retificacao-pontual",
      justification: "Correção de lançamento justificada.",
      now: NOW,
    });
    expect(semAutorizacao.ok).toBe(false);
    const comAutorizacao = store.act({
      ctx,
      actor: secretaria,
      authorizer: supervisao,
      action: "retificacao-pontual",
      justification: "Correção de lançamento justificada.",
      now: NOW,
    });
    expect(comAutorizacao.ok).toBe(true);
    expect(store.chain(ctx.scope).map((r) => r.version)).toEqual([1, 2]);
  });
});

describe("pendências da entrega", () => {
  it("lançamento ausente e lançamento em rascunho bloqueiam", () => {
    const ins = instrument("ins-b");
    const all = entriesFor(ins);
    const semUm = ctxOf({ instruments: [ins], entries: all.slice(1) });
    expect(blocking(deliveryPendencies(semUm)).some((p) => p.code === "lancamento-ausente")).toBe(
      true,
    );
    const rascunho = ctxOf({
      instruments: [ins],
      entries: all.map((e, i) => (i === 0 ? { ...e, status: "rascunho" as const } : e)),
    });
    expect(
      blocking(deliveryPendencies(rascunho)).some((p) => p.code === "lancamento-em-rascunho"),
    ).toBe(true);
  });

  it('"não registrado" com motivo é situação definida e não bloqueia', () => {
    const ins = instrument("ins-c");
    const ctx = ctxOf({
      instruments: [ins],
      entries: entriesFor(ins, () => ({
        value: { kind: "nao-registrado", reason: "Aluno ausente na aplicação." },
      })),
    });
    expect(blocking(deliveryPendencies(ctx))).toEqual([]);
  });

  it("instrumento apenas planejado impede a entrega", () => {
    const ins = { ...instrument("ins-d"), status: "planejado" as const };
    const ctx = ctxOf({ instruments: [ins], entries: [] });
    expect(
      blocking(deliveryPendencies(ctx)).some((p) => p.code === "instrumento-sem-pauta-aberta"),
    ).toBe(true);
  });

  it("quantidade mínima só bloqueia quando a regra homologada a declara", () => {
    const ins = instrument("ins-e");
    const semMinimo = ctxOf({ instruments: [ins], entries: entriesFor(ins) });
    expect(
      blocking(deliveryPendencies(semMinimo)).some(
        (p) => p.code === "quantidade-minima-de-instrumentos",
      ),
    ).toBe(false);
    const base = homologatedRule();
    const comMinimo = ctxOf({
      instruments: [ins],
      entries: entriesFor(ins),
      rule: homologatedRule({
        categories: base.categories.map((c) => ({ ...c, minimumEntries: 3 })),
      }),
    });
    expect(
      blocking(deliveryPendencies(comMinimo)).some(
        (p) => p.code === "quantidade-minima-de-instrumentos",
      ),
    ).toBe(true);
  });

  it("configuração de acompanhamento não gera nota e sinaliza exigência não configurada", () => {
    const ctx = ctxOf({ configuration: ei, instruments: [], entries: [] });
    const list = deliveryPendencies(ctx);
    expect(blocking(list)).toEqual([]);
    expect(list.some((p) => p.code === "exigencia-de-fechamento-nao-configurada")).toBe(true);
  });
});

describe("elegibilidade temporal", () => {
  it("aluno fora da pauta por trajetória não é pendência bloqueante", () => {
    const ins = instrument("ins-f");
    const ctx = ctxOf({ instruments: [ins], entries: entriesFor(ins) });
    expect(blocking(deliveryPendencies(ctx))).toEqual([]);
    for (const p of specialPendencies(deliveryPendencies(ctx)))
      expect(p.code).toBe("pendencia-especial-de-trajetoria");
  });
});

describe("ajuste 1 — resultado consolidado oficial do período", () => {
  it("o registro é do período e não produz situação acadêmica, anual ou frequência", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const record = store.current(ctx.scope)!;
    expect(record.resultKind).toBe("resultado-consolidado-oficial-do-periodo");
    expect(CONSOLIDATED_PERIOD_RESULT_LABEL).toContain("período");
    const keys = [...Object.keys(record), ...Object.keys(record.results[0] ?? {})];
    for (const forbidden of [
      "situacaoAcademica",
      "academicStanding",
      "resultadoAnual",
      "annualResult",
      "aprovado",
      "promoted",
      "frequencia",
      "attendance",
      "recuperacaoFinal",
    ])
      expect(keys).not.toContain(forbidden);
    expect(record.results[0]?.consolidatedPeriodScore).not.toBeUndefined();
  });
});

describe("ajuste 2 — documento fica ligado à versão que o originou", () => {
  it("a referência da v1 continua apontando para a v1 depois da v2", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const v1 = store.current(ctx.scope)!;
    const ref = closingSourceReference(v1);
    store.act({
      ctx,
      actor: secretaria,
      authorizer: supervisao,
      action: "retificacao-pontual",
      justification: "Correção justificada.",
      now: NOW,
    });
    const v2 = store.current(ctx.scope)!;
    expect(v2.version).toBe(2);
    expect(ref.closingId).toBe(v1.id);
    expect(ref.closingVersion).toBe(1);
    expect(ref.ruleId).toBe(v1.ruleId);
    expect(isSuperseded(store.allRecords(), v1)).toBe(true);
    expect(store.chain(ctx.scope)[0]).toEqual(v1);
  });
});

describe("ajuste 3 — vigência derivada da cadeia", () => {
  it("nenhum campo editável de vigência; a versão vigente é derivada", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const v1 = store.current(ctx.scope)!;
    expect(Object.keys(v1)).not.toContain("isCurrent");
    store.act({
      ctx,
      actor: secretaria,
      authorizer: supervisao,
      action: "retificacao-pontual",
      justification: "Correção justificada.",
      now: NOW,
    });
    expect(store.current(ctx.scope)!.version).toBe(2);
    expect(store.issues(ctx.scope)).toEqual([]);
  });

  it("duas versões sem sucessora são detectadas como violação de invariante", () => {
    const ctx = ctxOf();
    const { store } = closeFlow(ctx);
    const v1 = store.current(ctx.scope)!;
    const clone: PeriodClosingRecord = { ...v1, id: `${v1.id}-clone`, version: 2 };
    const issues = closingChainIssues([...store.allRecords(), clone], closingScopeKey(ctx.scope));
    expect(issues.length).toBeGreaterThan(0);
    expect(currentClosing([...store.allRecords(), clone], closingScopeKey(ctx.scope))).toBeDefined();
  });
});

describe("ajuste 4 — vigência histórica da atuação", () => {
  const p = { start: period.start, end: period.end };
  it("atuação encerrada após o período permanece válida para o período", () => {
    expect(assignmentActiveInPeriod({ start: "2026-02-01", end: "2026-12-20" }, p)).toBe(true);
    const ctx = ctxOf({ assignment: { ...atp, end: "2026-12-20" } });
    expect(
      deliveryPendencies(ctx).some((x) => x.code === "atuacao-sem-vigencia-no-periodo"),
    ).toBe(false);
  });
  it("atuação encerrada antes do período bloqueia a entrega daquele período", () => {
    expect(assignmentActiveInPeriod({ start: "2025-02-01", end: "2025-12-20" }, p)).toBe(false);
    const ctx = ctxOf({ assignment: { ...atp, start: "2025-02-01", end: "2025-12-20" } });
    expect(
      blocking(deliveryPendencies(ctx)).some((x) => x.code === "atuacao-sem-vigencia-no-periodo"),
    ).toBe(true);
  });
});

describe("fechamento oficial exige governança homologada", () => {
  it("sem calendário homologado e sem regra homologada não existe fechamento", () => {
    const base = ctxOf({ officialPeriod: false, rule: homologatedRule({ status: "rascunho" }) });
    const { calendarId: _drop, ...rest } = base;
    const ctx: ClosingContext = rest;
    const store = createPeriodClosingStore();
    store.act({ ctx, actor: docente, action: "entrega-docente", now: NOW });
    store.act({ ctx, actor: gestao, action: "inicio-conferencia", now: NOW });
    const r = store.act({ ctx, actor: secretaria, action: "fechamento-oficial", now: NOW });
    expect(r.ok).toBe(false);
    const codes = blocking(officialClosingPendencies({ ...ctx, stage: "em-conferencia" })).map(
      (x) => x.code,
    );
    expect(codes).toContain("calendario-nao-homologado");
    expect(codes).toContain("regra-nao-homologada");
    expect(store.allRecords()).toEqual([]);
  });
});

// ------------------------------------------------ 6D.3.4.1 — fonte canônica
import { assessmentPeriodV2Helper } from "./period-closing.test-helpers";
import { composeScope, officialModel } from "./period-closing";

describe("6D.3.4.1 — fechamento lê versões oficiais", () => {
  const ins = instrument("ins-a");
  const base = () => ctxOf({ instruments: [ins] });
  const aStudent = () => base().versions[0]!.studentId;

  it("A. fechamento novo referencia as versões oficiais consumidas", () => {
    const ctx = base();
    const { store, r3 } = closeFlow(ctx);
    expect(r3.ok).toBe(true);
    const rec = store.current(ctx.scope)!;
    const row = rec.results.find((r) => r.studentId === aStudent())!;
    expect(row.usedEntryVersions).toEqual([
      expect.objectContaining({ versionId: ctx.versions[0]!.id, version: 1 }),
    ]);
    expect(row.entryIds).toEqual([ctx.versions[0]!.id]);
  });

  it("B/C. novo fechamento usa v2; o anterior continua em v1 com snapshot intacto", () => {
    const ctx1 = base();
    const { store } = closeFlow(ctx1);
    const v1Record = store.current(ctx1.scope)!;
    const frozen = JSON.stringify(v1Record);
    const v1 = ctx1.versions.find((v) => v.studentId === aStudent())!;
    const v2 = assessmentPeriodV2Helper(v1, { kind: "numerica", value: 40 });
    const ctx2 = { ...ctx1, versions: [...ctx1.versions, v2] };
    store.act({ ctx: ctx2, actor: supervisao, action: "reabertura-integral", justification: "Formal.", now: NOW });
    store.act({ ctx: ctx2, actor: docente, action: "entrega-docente", now: NOW });
    store.act({ ctx: ctx2, actor: gestao, action: "inicio-conferencia", now: NOW });
    expect(store.act({ ctx: ctx2, actor: secretaria, action: "fechamento-oficial", now: NOW }).ok).toBe(true);
    const chain = store.chain(ctx1.scope);
    expect(chain).toHaveLength(2);
    const usedIn = (i: number) => chain[i]!.results.find((r) => r.studentId === v1.studentId)!.usedEntryVersions[0]!;
    expect(usedIn(0).versionId).toBe(v1.id);
    expect(usedIn(1).versionId).toBe(v2.id);
    expect(usedIn(1).version).toBe(2);
    expect(JSON.stringify(chain[0])).toBe(frozen);
  });

  it("D. “Não registrado” preserva motivo e referência de versão", () => {
    const ctx = ctxOf({
      instruments: [ins],
      entries: entriesFor(ins, (_s, i) => (i === 0 ? { value: { kind: "nao-registrado", reason: "Não realizou" } } : {})),
    });
    const { store } = closeFlow(ctx);
    const first = ctx.versions.find((v) => v.value.kind === "nao-registrado")!;
    const row = store.current(ctx.scope)!.results.find((r) => r.studentId === first.studentId)!;
    expect(row.unregistered).toEqual([{ entryId: first.id, reason: "Não realizou" }]);
  });

  it("E. ausência de resultado nunca vira zero", () => {
    const ctx = ctxOf({ instruments: [ins], entries: [] });
    const model = officialModel(ctx)!;
    for (const item of composeScope(ctx, model)) {
      expect(item.entryIds).toEqual([]);
      expect(item.composition?.stage?.value ?? null).not.toBe(0);
    }
  });

  it("F. resultado do motor idêntico entre versões convertidas e entrada canônica", () => {
    const ctx = base();
    const model = officialModel(ctx)!;
    const a = composeScope(ctx, model).map((i) => i.composition);
    const b = composeScope({ ...ctx, versions: [...ctx.versions].reverse() }, model).map((i) => i.composition);
    expect(b).toEqual(a);
    expect(a.some((c) => c?.stage?.value === 80)).toBe(true);
  });
});

// ------------------------------------------------ 6D.3.5.3 — recuperação periódica
import { projectCanonicalPeriodResult } from "./assessment-period-result";
import { officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";

describe("6D.3.5.3 — fechamento consome o resultado pós-recuperação", () => {
  const recRule = {
    id: "rec-p", enabled: true, scope: "periodo" as const, replacesCategoryIds: [], instrumentTypeIds: ["it-projeto"],
    prevalence: "substituicao-direta" as const, normativeStatus: "homologado" as const,
  };
  const prova = instrument("ins-a");
  const ativ = instrument("ins-at", "it-atividade");
  const rec = instrument("ins-rec", "it-projeto");
  const ctxRec = () =>
    ctxOf({
      rule: homologatedRule({ periodicRecovery: recRule }),
      instruments: [prova, ativ, rec],
      versions: [
        ...entriesFor(prova).flatMap(assessmentVersionsFromLegacyEntry),
        ...entriesFor(ativ).flatMap(assessmentVersionsFromLegacyEntry),
        ...entriesFor(rec, () => ({ value: { kind: "numerica", value: 95 } })).flatMap(assessmentVersionsFromLegacyEntry),
      ],
    });

  it("K/L/M/P. mesmo resultado; versão exata da recuperação; regra alterada depois não muda o histórico; sem requisito novo", () => {
    const ctx = ctxRec();
    const model = officialModel(ctx)!;
    const { store, r3 } = closeFlow(ctx);
    expect(r3.ok).toBe(true); // P: nenhum requisito novo nasce da recuperação
    const record = store.current(ctx.scope)!;
    const frozen = JSON.stringify(record);
    const row = record.results[0]!;
    const recV = ctx.versions.find((v) => v.instrumentId === rec.id && v.studentId === row.studentId)!;
    expect(row.periodScoreBeforeRecovery).toBe(160);
    expect(row.consolidatedPeriodScore).toBe(95);
    expect(row.recovery?.state).toBe("applied-with-effect");
    expect(row.recovery?.recoveryEntries[0]).toMatchObject({ versionId: recV.id, version: 1 });
    expect(row.usedEntryVersions.map((u) => u.versionId)).toContain(recV.id);

    // K. a Avaliação do período recebe exatamente o mesmo resultado
    const direct0 = projectCanonicalPeriodResult({
      model, periodId: ctx.period.id, configuration: ctx.configuration, official: false, rule: ctx.rule!,
      uses: officialCurrentVersionsForStudent({ studentId: row.studentId, instruments: ctx.instruments, versions: ctx.versions }),
    });
    if (direct0.status !== "available") throw new Error("indisponível");
    expect(direct0.finalStage?.value).toBe(row.consolidatedPeriodScore);
    // M. regra vigente alterada depois: o fechamento histórico permanece
    ctx.rule = homologatedRule({ periodicRecovery: { ...recRule, prevalence: "maior-resultado" } });
    expect(JSON.stringify(store.current(ctx.scope))).toBe(frozen);
  });
});

describe("6D.3.5.3b — resultado calculável ≠ período fechável", () => {
  it("G. resultado canônico disponível, mas política de fechamento ausente bloqueia o fechamento", () => {
    const { closingAdmissibility: _c, ...noPolicy } = homologatedRule();
    const ctx = ctxOf({ rule: noPolicy as InstitutionalAssessmentRule });
    const model = officialModel(ctx)!;
    expect(composeScope(ctx, model).every((i) => i.result.status === "available")).toBe(true);
    const codes = blocking(officialClosingPendencies({ ...ctx, stage: "em-conferencia" })).map((p) => p.code);
    expect(codes).toContain("politica-de-fechamento-ausente");
    expect(codes).not.toContain("resultado-canonico-indisponivel");
  });

  it("H. resultado canônico indisponível: fechamento bloqueado e nenhum snapshot numérico", () => {
    const base = homologatedRule();
    const ctx = ctxOf({ rule: { ...base, periodAggregation: { kind: "media-ponderada" }, categories: base.categories.map((c) => ({ ...c, weight: 0 })) } as InstitutionalAssessmentRule });
    const model = officialModel(ctx);
    expect(model).toBeDefined();
    if (model) {
      expect(composeScope(ctx, model).every((i) => i.result.status === "unavailable")).toBe(true);
      const codes = blocking(officialClosingPendencies({ ...ctx, stage: "em-conferencia" })).map((p) => p.code);
      expect(codes).toContain("resultado-canonico-indisponivel");
    }
    const { store } = closeFlow(ctx);
    expect(store.current(ctx.scope)).toBeUndefined();
  });
});

describe("6D.3.5.3b — vínculo Rule ↔ Configuration explícito", () => {
  const resultFor = (rule: InstitutionalAssessmentRule) => {
    const ctx = ctxOf({ rule });
    const model = officialModel(ctx)!;
    const items = composeScope(ctx, model);
    const codes = blocking(officialClosingPendencies({ ...ctx, stage: "em-conferencia" })).map((p) => p.code);
    return { ctx, items, codes };
  };
  it("1/8. vínculo correto → resultado disponível e numericamente idêntico", () => {
    const { items, codes } = resultFor(homologatedRule());
    expect(items.every((i) => i.result.status === "available")).toBe(true);
    expect(codes).not.toContain("resultado-canonico-indisponivel");
  });
  it("2/3. configurationId ou versão divergente → indisponível no Fechamento e na fronteira", () => {
    for (const patch of [{ configurationId: "cfg-outra" }, { configurationVersion: 99 }]) {
      const { ctx, items, codes } = resultFor(homologatedRule(patch));
      expect(items.every((i) => i.result.status === "unavailable")).toBe(true);
      expect(codes).toContain("resultado-canonico-indisponivel");
      const direct = projectCanonicalPeriodResult({
        model: officialModel(ctx), periodId: ctx.period.id, configuration: ctx.configuration, official: false,
        uses: officialCurrentVersionsForStudent({ studentId: items[0]!.studentId, instruments: ctx.instruments, versions: ctx.versions }),
      });
      expect(direct.status).toBe("unavailable");
    }
  });
  it("4/5. regra histórica sem vínculo: sem fallback para rule.id/rule.version, nada inventado", () => {
    const { configurationId: _i, configurationVersion: _v, ...legacy } = homologatedRule();
    const model = officialModel(ctxOf({ rule: legacy as InstitutionalAssessmentRule }))!;
    expect(model.configurationId).toBeUndefined();
    expect(model.configurationVersion).toBeUndefined();
    const { items, codes } = resultFor(legacy as InstitutionalAssessmentRule);
    expect(items.every((i) => i.result.status === "unavailable")).toBe(true);
    expect(codes).toContain("resultado-canonico-indisponivel");
  });
  it("6. pn-consolidacao manual não contradiz regra homologada; é derivado dos fatos do modelo", () => {
    const ctx = ctxOf({ rule: homologatedRule() });
    expect(ctx.configuration.pendingRuleIds).toContain("pn-consolidacao");
    expect(composeScope(ctx, officialModel(ctx)!).every((i) => i.result.status === "available")).toBe(true);
    const unhomologated = projectCanonicalPeriodResult({
      model: { ...officialModel(ctx)!, normativeStatus: "configurado" }, periodId: ctx.period.id,
      configuration: ctx.configuration, official: false, uses: [],
    });
    expect(unhomologated.status === "unavailable" && unhomologated.pendingRuleIds).toContain("pn-consolidacao");
  });
});

// ------------------------------------ 6D.3.5.4 — divergência por fato novo relevante
import { determineClosingImpact, type HistoricalNormativeArchive } from "./period-closing-divergence";
import type { EntryValue } from "./assessment-types";

describe("6D.3.5.4 — divergência pós-fechamento por fato novo", () => {
  const recRule = (prevalence: "substituicao-direta" | "maior-resultado" = "substituicao-direta") => ({
    id: "rec-p", enabled: true, scope: "periodo" as const, replacesCategoryIds: [], instrumentTypeIds: ["it-projeto"],
    prevalence, normativeStatus: "homologado" as const,
  });
  const prova = instrument("ins-a");
  const ativ = instrument("ins-at", "it-atividade");
  const rec = instrument("ins-rec", "it-projeto");
  const outro = instrument("ins-outro", "it-outro");
  const baseVersions = () => [
    ...entriesFor(prova).flatMap(assessmentVersionsFromLegacyEntry),
    ...entriesFor(ativ).flatMap(assessmentVersionsFromLegacyEntry),
  ];
  const recVersions = (value: EntryValue, status: "registrado" | "rascunho" = "registrado") =>
    entriesFor(rec, () => ({ value })).flatMap(assessmentVersionsFromLegacyEntry).map((v) => ({ ...v, status }));
  const archiveOf = (ctx: ClosingContext, over: Partial<HistoricalNormativeArchive> = {}): HistoricalNormativeArchive => ({
    rule: (id, v) => (ctx.rule && ctx.rule.id === id && ctx.rule.version === v ? ctx.rule : undefined),
    configuration: (id, v) => (ctx.configuration.id === id && ctx.configuration.version === v ? ctx.configuration : undefined),
    ...over,
  });
  /** Fechamento sem recuperação; devolve contexto e ato congelado. */
  const closedWithoutRecovery = (prevalence?: "substituicao-direta" | "maior-resultado") => {
    const ctx = ctxOf({ rule: homologatedRule({ periodicRecovery: recRule(prevalence) }), instruments: [prova, ativ], versions: baseVersions() });
    const { store, r3 } = closeFlow(ctx);
    if (!r3.ok) throw new Error("fechamento de teste falhou");
    const record = store.current(ctx.scope)!;
    return { ctx, store, record, frozen: JSON.stringify(record) };
  };
  const analyze = (s: ReturnType<typeof closedWithoutRecovery>, versions: ClosingContext["versions"], over?: Partial<HistoricalNormativeArchive>) => {
    const before = versions.length;
    const impact = determineClosingImpact({ record: s.record, currentFacts: { ...s.ctx, instruments: [prova, ativ, rec, outro], versions }, archive: archiveOf(s.ctx, over) });
    expect(versions.length).toBe(before); // a análise não cria versão
    expect(JSON.stringify(s.store.current(s.ctx.scope))).toBe(s.frozen); // ato intacto, nenhum Closing novo
    expect(s.store.current(s.ctx.scope)!.version).toBe(s.record.version);
    return impact;
  };

  it("A. nenhuma mudança posterior → sem divergência", () => {
    const s = closedWithoutRecovery();
    expect(analyze(s, s.ctx.versions).kind).toBe("no-divergence");
  });
  it("1/10. Recovery v1 posterior que altera → fato novo + impacto material; Closing intacto", () => {
    const s = closedWithoutRecovery();
    const impact = analyze(s, [...s.ctx.versions, ...recVersions({ kind: "numerica", value: 95 })]);
    expect(impact.divergence.origins).toEqual(["new-relevant-fact"]);
    expect(impact.divergence.superseded).toHaveLength(0);
    expect(impact.divergence.newFacts.every((f) => f.instrumentId === rec.id && f.relevance === "relevante" && f.currentVersion === 1)).toBe(true);
    expect(impact.kind).toBe("divergence-with-material-impact");
    expect(impact.changes.some((c) => c.factId === "resultado-do-periodo" && c.rematerialized === 95)).toBe(true);
    expect(impact.provenance.analyzedWithRule).toEqual({ id: s.record.ruleId, version: s.record.ruleVersion });
  });
  it("2. Recovery v1 que não vence pela prevalência → divergência factual sem impacto material", () => {
    const s = closedWithoutRecovery("maior-resultado");
    const impact = analyze(s, [...s.ctx.versions, ...recVersions({ kind: "numerica", value: 70 })]);
    expect(impact.divergence.origins).toEqual(["new-relevant-fact"]);
    expect(impact.kind).toBe("divergence-without-material-impact");
  });
  it("3. instrumento posterior irrelevante para a regra histórica → sem divergência", () => {
    const s = closedWithoutRecovery();
    const extra = entriesFor(outro, () => ({ value: { kind: "numerica", value: 10 } })).flatMap(assessmentVersionsFromLegacyEntry);
    expect(analyze(s, [...s.ctx.versions, ...extra]).kind).toBe("no-divergence");
  });
  it("4. Recovery em rascunho → sem divergência", () => {
    const s = closedWithoutRecovery();
    expect(analyze(s, [...s.ctx.versions, ...recVersions({ kind: "numerica", value: 95 }, "rascunho")]).kind).toBe("no-divergence");
  });
  it("5. Recovery “não registrado” é fato novo, nunca zero", () => {
    const s = closedWithoutRecovery();
    const impact = analyze(s, [...s.ctx.versions, ...recVersions({ kind: "nao-registrado", reason: "ausente" })]);
    expect(impact.divergence.origins).toEqual(["new-relevant-fact"]);
    expect(impact.changes.some((c) => c.factId === "resultado-do-periodo" && c.rematerialized === 0)).toBe(false);
  });
  it("6. Recovery v1 → v2: considera a vigente, preservando a cadeia", () => {
    const s = closedWithoutRecovery();
    const v1s = recVersions({ kind: "numerica", value: 95 });
    const v2s = v1s.map((v) => assessmentPeriodV2Helper(v, { kind: "numerica", value: 99 }));
    const impact = analyze(s, [...s.ctx.versions, ...v1s, ...v2s]);
    expect(impact.divergence.newFacts.every((f) => f.currentVersion === 2)).toBe(true);
    expect(impact.changes.some((c) => c.factId === "resultado-do-periodo" && c.rematerialized === 99)).toBe(true);
  });
  it("7. correção de resultado comum + nova recuperação → ambas as origens; impacto por reprojeção única", () => {
    const s = closedWithoutRecovery();
    const corr = assessmentPeriodV2Helper(s.ctx.versions[0]!, { kind: "numerica", value: 1 });
    const impact = analyze(s, [...s.ctx.versions, corr, ...recVersions({ kind: "numerica", value: 95 })]);
    expect(impact.divergence.origins).toEqual(["version-succession", "new-relevant-fact"]);
    expect(impact.kind).toBe("divergence-with-material-impact");
  });
  it("8. regra histórica ausente → relevância e impacto indeterminados, sem regra atual", () => {
    const s = closedWithoutRecovery();
    const impact = analyze(s, [...s.ctx.versions, ...recVersions({ kind: "numerica", value: 95 })], { rule: () => undefined });
    expect(impact.kind).toBe("impact-undetermined");
    expect(impact.divergence.newFacts.every((f) => f.relevance === "indeterminada")).toBe(true);
    expect(impact.provenance.analyzedWithRule).toBeUndefined();
  });
  it("9. configuração histórica ausente → impacto indeterminado", () => {
    const s = closedWithoutRecovery();
    const impact = analyze(s, [...s.ctx.versions, ...recVersions({ kind: "numerica", value: 95 })], { configuration: () => undefined });
    expect(impact.kind).toBe("impact-undetermined");
  });
});
