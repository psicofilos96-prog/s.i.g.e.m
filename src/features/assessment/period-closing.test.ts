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
    placement: {},
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
  return { ...base, status: "homologada", ...patch };
}

function ctxOf(over: Partial<ClosingContext> = {}): ClosingContext {
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
    entries: entriesFor(ins),
    students: demonstrationStudents,
    stage: "em-andamento",
    ...over,
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
    const ctx = ctxOf({ officialPeriod: false, calendarId: undefined, rule: homologatedRule({ status: "rascunho" }) });
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
