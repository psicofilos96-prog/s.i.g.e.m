/**
 * Etapa 12H — Consolidação do Percurso Avaliativo.
 *
 * Os testes blindam os compromissos normativos: nenhuma quantidade de períodos
 * pressuposta, nenhum conhecimento de modalidade/etapa no motor, nenhum valor
 * presumido, separação rigorosa entre resultado do ciclo, recuperação final,
 * resultado pós-recuperação e situação acadêmica, e rastreabilidade pelas
 * versões exatas dos fechamentos da 12G.
 */
import { describe, expect, it } from "vitest";
import { assessmentConfigurations } from "./assessment-fixtures";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { CompositionEntryInput } from "./assessment-composition-types";
import type { CurriculumRef } from "./assessment-types";
import type { PeriodClosingRecord } from "./period-closing-types";
import { consolidateCycle, cycleRoundingPoint, finalRecoveryEligibility } from "./cycle-consolidation";
import { cycleRange, type AssessmentCycle, type CyclePeriodRef } from "./cycle-consolidation-types";
import { cycleDefinitionFor, resolveCycles } from "./cycle-configuration";

const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const ei = assessmentConfigurations.find((c) => c.id === "cfg-2026-ei-acompanhamento")!;
const CURRICULUM: CurriculumRef = { kind: "matriz", componentId: "mat" };
const YEAR = "ano-2027";
const NOW = "2027-12-18T12:00:00.000Z";

function rule(patch: Partial<InstitutionalAssessmentRule> = {}): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  return { ...base, status: "homologada", ...patch };
}

/** Períodos de teste em quantidade LIVRE: o domínio não conhece número fixo. */
function periodsOf(count: number, groupIds?: (string | undefined)[]): CyclePeriodRef[] {
  return Array.from({ length: count }, (_, index) => ({
    periodId: `pa-${index + 1}`,
    calendarPeriodId: `per-${index + 1}`,
    sequence: index + 1,
    label: `Período ${index + 1}`,
    start: `2027-0${index + 2}-01`,
    end: `2027-0${index + 2}-28`,
    official: true,
    ...(groupIds ? {} : {}),
  }));
}

function cycleOf(periods: CyclePeriodRef[], over: Partial<AssessmentCycle> = {}): AssessmentCycle {
  return {
    id: "cic-teste",
    kindId: "ciclo-completo",
    label: "Consolidação do ciclo (teste)",
    academicYearId: YEAR,
    configurationId: quant.id,
    calendarId: "cal-teste",
    periods,
    ...over,
  };
}

function closing(args: {
  period: CyclePeriodRef;
  score: number | null;
  version?: number;
  classId?: string;
  precedingClosingId?: string;
  coverage?: PeriodClosingRecord["results"][number]["coverage"];
  unregistered?: Array<{ entryId: string; reason: string }>;
  complete?: boolean;
  configurationId?: string;
  configurationVersion?: number;
  ruleId?: string;
  ruleVersion?: number;
  studentId?: string;
}): PeriodClosingRecord {
  const version = args.version ?? 1;
  const classId = args.classId ?? "tur-001";
  return {
    id: `fec-${classId}-${args.period.periodId}-v${version}`,
    scope: {
      classId,
      academicYearId: YEAR,
      periodId: args.period.periodId,
      ...(args.period.calendarPeriodId
        ? { calendarPeriodId: args.period.calendarPeriodId }
        : {}),
      curriculumRef: CURRICULUM,
    },
    version,
    ...(args.precedingClosingId ? { precedingClosingId: args.precedingClosingId } : {}),
    resultKind: "resultado-consolidado-oficial-do-periodo",
    ruleId: args.ruleId ?? "rav-demo-estrutural",
    ruleVersion: args.ruleVersion ?? 1,
    calendarId: "cal-teste",
    configurationId: args.configurationId ?? quant.id,
    configurationVersion: args.configurationVersion ?? quant.version,
    closedBy: {
      actorId: "perfil-secretaria-escolar",
      actorName: "Secretaria escolar (teste)",
      profileLabel: "Secretaria escolar",
      at: NOW,
    },
    closedAt: NOW,
    results: [
      {
        studentId: args.studentId ?? "alu-001",
        studentName: "Aluno de teste",
        entryIds: [`lan-${args.period.periodId}`],
        usedEntryVersions: [],
        categories: [],
        consolidatedPeriodScore: args.score,
        rounded: false,
        complete: args.complete ?? true,
        unregistered: args.unregistered ?? [],
        coverage: args.coverage ?? "integral",
      },
    ],
  };
}

const consolidate = (args: {
  periods: CyclePeriodRef[];
  closings: PeriodClosingRecord[];
  rule?: InstitutionalAssessmentRule;
  configuration?: typeof quant;
  finalRecoveryEntries?: CompositionEntryInput[];
  cycle?: Partial<AssessmentCycle>;
}) =>
  consolidateCycle({
    cycle: cycleOf(args.periods, args.cycle ?? {}),
    configuration: args.configuration ?? quant,
    studentId: "alu-001",
    studentName: "Aluno de teste",
    curriculumRef: CURRICULUM,
    rule: args.rule ?? rule(),
    closings: args.closings,
    ...(args.finalRecoveryEntries ? { finalRecoveryEntries: args.finalRecoveryEntries } : {}),
  });

// --------------------------------------------- Estrutura livre e configurável

describe("estrutura do ciclo: nada é pressuposto", () => {
  it("consolida ciclos de 2, 3, 4 e 5 períodos sem quantidade fixa", () => {
    for (const count of [2, 3, 4, 5]) {
      const periods = periodsOf(count);
      const result = consolidate({
        periods,
        closings: periods.map((p) => closing({ period: p, score: 10 })),
        rule: rule({ cycleAggregation: { kind: "soma" } }),
      });
      expect(result.kind).toBe("consolidado");
      if (result.kind !== "consolidado") throw new Error("esperado consolidado");
      expect(result.cycleScore).toBe(10 * count);
      expect(result.contributions).toHaveLength(count);
    }
  });

  it("média dos períodos funciona igualmente em estrutura de três períodos", () => {
    const periods = periodsOf(3);
    const scores = [60, 70, 80];
    const result = consolidate({
      periods,
      closings: periods.map((p, i) => closing({ period: p, score: scores[i]! })),
      rule: rule({ cycleAggregation: { kind: "media-simples" } }),
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.cycleScore).toBe(70);
  });

  it("o motor não conhece modalidade, etapa ou fase: só os períodos declarados", () => {
    const source = consolidateCycle.toString().toLowerCase();
    for (const term of ["eja", "semestral", "semestre", "anos finais", "anos iniciais", "bimestre", "modality"])
      expect(source).not.toContain(term);
  });

  it("o ciclo é resolvido pela configuração, com rótulo e intervalo próprios", () => {
    const definition = cycleDefinitionFor(quant);
    expect(definition.grouping).toBe("todos-os-periodos");
    const cycles = resolveCycles({
      configuration: quant,
      structure: {
        id: "est-teste",
        academicYearId: YEAR,
        label: "Estrutura de teste",
        normativeStatus: "demonstrativo",
        periods: periodsOf(3).map((p) => ({
          id: p.periodId,
          structureId: "est-teste",
          academicYearId: YEAR,
          sequence: p.sequence,
          label: p.label,
          start: p.start,
          end: p.end,
        })),
      },
      calendar: undefined,
    });
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.periods).toHaveLength(3);
    expect(cycleRange(cycles[0]!)).toEqual({ start: "2027-02-01", end: "2027-04-28" });
  });
});

// ------------------------------------------------------- Governança e bloqueios

describe("governança", () => {
  it("sem regra homologada não existe consolidação", () => {
    const periods = periodsOf(3);
    const result = consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 10 })),
      rule: rule({ status: "rascunho" }),
    });
    expect(result.kind).toBe("bloqueado");
    expect(result.facts.pendencyCodes).toContain("regra-nao-homologada");
  });

  it("forma de consolidação do ciclo pendente bloqueia o cálculo", () => {
    const periods = periodsOf(3);
    const incomplete = rule();
    delete (incomplete as { cycleAggregation?: unknown }).cycleAggregation;
    const result = consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 10 })),
      rule: incomplete,
    });
    expect(result.kind).toBe("bloqueado");
    expect(result.facts.pendencyCodes).toContain("forma-de-consolidacao-do-ciclo-nao-definida");
  });

  it("período fora de calendário homologado impede consolidação oficial", () => {
    const periods = periodsOf(2).map((p, i) => (i === 1 ? { ...p, official: false } : p));
    const result = consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 10 })),
    });
    expect(result.kind).toBe("bloqueado");
    expect(result.facts.pendencyCodes).toContain("calendario-nao-homologado");
  });

  it("período sem fechamento oficial mantém o ciclo como acumulado parcial", () => {
    const periods = periodsOf(4);
    const result = consolidate({
      periods,
      closings: periods.slice(0, 3).map((p) => closing({ period: p, score: 10 })),
      rule: rule({ cycleAggregation: { kind: "soma" } }),
    });
    expect(result.kind).toBe("acumulado-parcial");
    if (result.kind !== "acumulado-parcial") throw new Error("esperado parcial");
    expect(result.partialScore).toBe(30);
    expect(result.cycleScore).toBeNull();
    expect(result.postRecoveryScore).toBeNull();
    expect(result.official).toBe(false);
    expect(result.facts.openPeriodIds).toEqual(["pa-4"]);
  });
});

// ----------------------------------------------------- Trajetória e movimentação

describe("movimentações e configurações diferentes", () => {
  it("mudança de turma dentro do ciclo consolida normalmente", () => {
    const periods = periodsOf(4);
    const closings = periods.map((p, i) =>
      closing({ period: p, score: 20, classId: i < 2 ? "tur-001" : "tur-002" }),
    );
    const result = consolidate({ periods, closings, rule: rule({ cycleAggregation: { kind: "soma" } }) });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.cycleScore).toBe(80);
    expect(result.facts.classIds).toEqual(["tur-001", "tur-002"]);
  });

  it("ingresso posterior sem resultado anterior fica em pendência administrativa, nunca zero", () => {
    const periods = periodsOf(3);
    const closings = [
      closing({ period: periods[0]!, score: 50, studentId: "outro-aluno" }),
      closing({ period: periods[1]!, score: 60 }),
      closing({ period: periods[2]!, score: 70 }),
    ];
    const result = consolidate({ periods, closings });
    expect(result.kind).toBe("pendencia-administrativa");
    expect(result.facts.pendencyCodes).toContain("periodo-sem-resultado-do-aluno");
    expect(result.cycleScore).toBeNull();
    expect(result.postRecoveryScore).toBeNull();
    expect(JSON.stringify(result)).not.toContain('"periodScore":0');
  });

  it("cobertura não integral exige decisão humana", () => {
    const periods = periodsOf(2);
    const closings = [
      closing({ period: periods[0]!, score: 40, coverage: "ingresso-posterior" }),
      closing({ period: periods[1]!, score: 50 }),
    ];
    const result = consolidate({ periods, closings });
    expect(result.kind).toBe("pendencia-administrativa");
    expect(result.facts.pendencyCodes).toContain("periodo-sem-cobertura-integral");
  });

  it('"não registrado" nunca se converte em zero nem em resultado', () => {
    const periods = periodsOf(2);
    const closings = [
      closing({
        period: periods[0]!,
        score: null,
        complete: false,
        unregistered: [{ entryId: "lan-x", reason: "Licença de saúde comprovada" }],
      }),
      closing({ period: periods[1]!, score: 50 }),
    ];
    const result = consolidate({ periods, closings });
    expect(result.kind).toBe("pendencia-administrativa");
    expect(result.facts.pendencyCodes).toContain("resultado-nao-registrado-no-periodo");
    expect(result.cycleScore).toBeNull();
  });

  it("configuração ou regra divergente entre períodos não gera equivalência", () => {
    const periods = periodsOf(2);
    const divergentConfig = consolidate({
      periods,
      closings: [
        closing({ period: periods[0]!, score: 40 }),
        closing({ period: periods[1]!, score: 50, configurationId: "cfg-outra", configurationVersion: 3 }),
      ],
    });
    expect(divergentConfig.facts.pendencyCodes).toContain("configuracao-divergente-entre-periodos");
    const divergentRule = consolidate({
      periods,
      closings: [
        closing({ period: periods[0]!, score: 40 }),
        closing({ period: periods[1]!, score: 50, ruleVersion: 2 }),
      ],
    });
    expect(divergentRule.kind).toBe("pendencia-administrativa");
    expect(divergentRule.facts.pendencyCodes).toContain("regra-divergente-entre-periodos");
  });
});

// ---------------------------------------------------------- Recuperação final

describe("recuperação final", () => {
  const recoveryRule = (patch: Partial<NonNullable<InstitutionalAssessmentRule["finalRecovery"]>>) =>
    rule({
      cycleAggregation: { kind: "media-simples" },
      finalRecovery: {
        id: "rec-final-teste",
        enabled: true,
        scope: "anual",
        replacesCategoryIds: [],
        instrumentTypeIds: ["it-prova"],
        normativeStatus: "configurado",
        ...patch,
      },
    });

  const recoveryEntry = (id: string, value: number): CompositionEntryInput => ({
    entryId: id,
    instrumentId: `ins-${id}`,
    instrumentTypeId: "it-prova",
    periodId: "pa-1",
    configurationId: quant.id,
    configurationVersion: quant.version,
    value: { kind: "numerica", value },
    status: "registrado",
    at: NOW,
  });

  const base = () => {
    const periods = periodsOf(3);
    return { periods, closings: periods.map((p) => closing({ period: p, score: 40 })) };
  };

  it("resultado do ciclo, recuperação e pós-recuperação são três informações distintas", () => {
    const { periods, closings } = base();
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado",
        maxScore: 100,
      }),
      finalRecoveryEntries: [recoveryEntry("r1", 70)],
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.cycleScore).toBe(40);
    expect(result.finalRecovery?.recoveryScore).toBe(70);
    expect(result.postRecoveryScore).toBe(70);
    expect(result.academicStanding).toBeNull();
  });

  it("aluno acima do patamar não é elegível e o resultado permanece o do ciclo", () => {
    const periods = periodsOf(3);
    const closings = periods.map((p) => closing({ period: p, score: 80 }));
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado",
      }),
      finalRecoveryEntries: [recoveryEntry("r1", 90)],
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.state).toBe("nao-elegivel");
    expect(result.postRecoveryScore).toBe(80);
  });

  it("múltiplos registros sem forma de agregação mantêm pendência e bloqueiam o pós-recuperação", () => {
    const { periods, closings } = base();
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado",
      }),
      finalRecoveryEntries: [recoveryEntry("r1", 70), recoveryEntry("r2", 90)],
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.state).toBe("pendente-de-definicao");
    expect(result.postRecoveryScore).toBeNull();
    expect(result.cycleScore).toBe(40);
    expect(result.facts.pendencyCodes).toContain("recuperacao-final-pendente-de-definicao");
  });

  it("forma de agregação configurada consolida múltiplos registros", () => {
    const { periods, closings } = base();
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado",
        aggregation: { kind: "media-simples" },
      }),
      finalRecoveryEntries: [recoveryEntry("r1", 70), recoveryEntry("r2", 90)],
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.recoveryScore).toBe(80);
    expect(result.postRecoveryScore).toBe(80);
  });

  it("elegível sem registro deixa o pós-recuperação em aberto, sem inventar valor", () => {
    const { periods, closings } = base();
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado",
      }),
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.state).toBe("elegivel-sem-registro");
    expect(result.postRecoveryScore).toBeNull();
    expect(result.facts.pendencyCodes).toContain("recuperacao-final-elegivel-sem-registro");
  });

  it("critério de acesso pendente não presume patamar nem mínimo", () => {
    const { periods, closings } = base();
    const semCriterio = consolidate({
      periods,
      closings,
      rule: recoveryRule({ prevalence: "maior-resultado" }),
      finalRecoveryEntries: [recoveryEntry("r1", 90)],
    });
    if (semCriterio.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(semCriterio.finalRecovery?.state).toBe("pendente-de-definicao");
    expect(semCriterio.postRecoveryScore).toBeNull();

    const minimoNaoCadastrado = finalRecoveryEligibility({
      recovery: {
        id: "r",
        enabled: true,
        scope: "anual",
        replacesCategoryIds: [],
        instrumentTypeIds: [],
        eligibility: { kind: "abaixo-do-minimo-anual" },
        normativeStatus: "pendente",
      },
      rule: rule(),
      cycleScore: 10,
    });
    expect(minimoNaoCadastrado.status).toBe("pendente");
  });

  it("teto configurado limita a nota da recuperação", () => {
    const { periods, closings } = base();
    const result = consolidate({
      periods,
      closings,
      rule: recoveryRule({
        eligibility: { kind: "sem-restricao" },
        prevalence: "substituicao-direta",
        maxScore: 60,
      }),
      finalRecoveryEntries: [recoveryEntry("r1", 95)],
    });
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.recoveryScore).toBe(60);
    expect(result.postRecoveryScore).toBe(60);
  });
});

// --------------------------------------------------- Arredondamento e versões

describe("arredondamento e rastreabilidade", () => {
  it("arredonda somente nos pontos configurados", () => {
    const periods = periodsOf(3);
    const scores = [61, 62, 64];
    const closings = periods.map((p, i) => closing({ period: p, score: scores[i]! }));
    const semArredondar = consolidate({
      periods,
      closings,
      rule: rule({
        cycleAggregation: { kind: "media-simples" },
        rounding: { id: "arr", mode: "meio-acima", decimals: 0, applyAt: ["periodo"], normativeStatus: "homologado" },
      }),
    });
    if (semArredondar.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(semArredondar.cycleRounded).toBe(false);
    expect(semArredondar.cycleScore).toBeCloseTo(62.3333333333, 6);

    const arredondado = consolidate({
      periods,
      closings,
      rule: rule({
        cycleAggregation: { kind: "media-simples" },
        rounding: { id: "arr", mode: "meio-acima", decimals: 0, applyAt: ["ciclo"], normativeStatus: "homologado" },
      }),
    });
    if (arredondado.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(arredondado.cycleRounded).toBe(true);
    expect(arredondado.cycleScore).toBe(62);
    expect(arredondado.rawCycleScore).toBeCloseTo(62.3333333333, 6);
  });

  it('"ciclo" e "anual" são o mesmo ponto de fechamento generalizado', () => {
    expect(cycleRoundingPoint({ id: "a", mode: "meio-acima", applyAt: ["ciclo"], normativeStatus: "homologado" })).toBe("ciclo");
    expect(cycleRoundingPoint({ id: "a", mode: "meio-acima", applyAt: ["anual"], normativeStatus: "homologado" })).toBe("anual");
  });

  it("usa a versão vigente do fechamento e registra a proveniência exata", () => {
    const periods = periodsOf(2);
    const v1 = closing({ period: periods[0]!, score: 40, version: 1 });
    const outro = closing({ period: periods[1]!, score: 60 });
    const antes = consolidate({
      periods,
      closings: [v1, outro],
      rule: rule({ cycleAggregation: { kind: "media-simples" } }),
    });
    if (antes.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(antes.cycleScore).toBe(50);
    expect(antes.facts.sourceClosings.map((s) => s.closingVersion)).toEqual([1, 1]);

    // Retificação da 12G: a v2 sucede a v1 e a projeção passa a usá-la.
    const v2 = closing({ period: periods[0]!, score: 80, version: 2, precedingClosingId: v1.id });
    const depois = consolidate({
      periods,
      closings: [v1, outro, v2],
      rule: rule({ cycleAggregation: { kind: "media-simples" } }),
    });
    if (depois.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(depois.cycleScore).toBe(70);
    const referencia = depois.facts.sourceClosings.find((s) => s.closingId === v2.id);
    expect(referencia?.closingVersion).toBe(2);
    // A projeção anterior permanece intacta: nada é apagado.
    expect(antes.facts.sourceClosings.some((s) => s.closingId === v1.id)).toBe(true);
    expect(antes.cycleScore).toBe(50);
  });

  it("a saída expõe dimensões estruturadas com identificadores estáveis", () => {
    const periods = periodsOf(2);
    const result = consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 50 })),
      rule: rule({ cycleAggregation: { kind: "media-simples" } }),
    });
    expect(result.facts).toMatchObject({
      cycleId: "cic-teste",
      cycleKindId: "ciclo-completo",
      academicYearId: YEAR,
      configurationId: quant.id,
      studentId: "alu-001",
      curriculumKey: "matriz:mat",
      periodIds: ["pa-1", "pa-2"],
      closedPeriodIds: ["pa-1", "pa-2"],
      ruleId: "rav-demo-estrutural",
      ruleVersion: 1,
    });
    expect(result.contributions[0]).toMatchObject({
      periodId: "pa-1",
      calendarPeriodId: "per-1",
      closingVersion: 1,
      periodScore: 50,
    });
  });
});

// --------------------------------------------- Não numérico e situação acadêmica

describe("configurações não numéricas e limites da etapa", () => {
  it("configuração sem notas não gera número, média ou recuperação", () => {
    const periods = periodsOf(2);
    const result = consolidateCycle({
      cycle: cycleOf(periods, { configurationId: ei.id }),
      configuration: ei,
      studentId: "alu-001",
      curriculumRef: CURRICULUM,
      rule: rule(),
      closings: [],
    });
    expect(result.kind).toBe("nao-aplicavel");
    expect(result.cycleScore).toBeNull();
    expect(result.finalRecovery).toBeNull();
    expect(result.postRecoveryScore).toBeNull();
  });

  it("nenhuma situação acadêmica, frequência ou decisão de Conselho é produzida", () => {
    const periods = periodsOf(2);
    const result = consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 90 })),
      rule: rule({ cycleAggregation: { kind: "media-simples" } }),
    });
    expect(result.academicStanding).toBeNull();
    const serialized = JSON.stringify(result).toLowerCase();
    for (const term of ["aprovado", "reprovado", "retido", "progress", "frequ", "conselho"])
      expect(serialized).not.toContain(term);
  });
});

// ------------------------------------ 6D.3.5.2 — Entradas canônicas da recuperação

import { officialCompositionInputsForStudent } from "./assessment-canonical-inputs";
import { simulateRule } from "./assessment-rule-preview";
import { applyRecovery } from "./assessment-recovery";
import { compositionModelFromRule } from "./assessment-rule-model";
import { assessmentLogicalEntryId, type AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";
import { readFileSync } from "node:fs";

describe("6D.3.5.2 — recuperação final lê AssessmentEntryVersion vigente", () => {
  const instrument = { id: "ins-rec", instrumentTypeId: "it-prova", periodId: "pa-3", classId: "tur-001" } as AssessmentInstrument;
  const v = (id: string, version: number, value: number | null, over: Partial<AssessmentEntryVersion> = {}) =>
    ({
      id, logicalEntryId: assessmentLogicalEntryId("ins-rec", "alu-001"), version, instrumentId: "ins-rec", studentId: "alu-001",
      placement: {}, value: value === null ? { kind: "nao-registrado", reason: "ausente" } : { kind: "numerica", value },
      status: "registrado", recordedAt: NOW, recordedByAssignmentId: "a", ...over,
    }) as unknown as AssessmentEntryVersion;
  const finalRule = (patch = {}) =>
    rule({
      cycleAggregation: { kind: "media-simples" },
      finalRecovery: {
        id: "rec-final-teste", enabled: true, scope: "anual", replacesCategoryIds: [],
        instrumentTypeIds: ["it-prova"], normativeStatus: "configurado",
        eligibility: { kind: "limite-de-pontuacao", threshold: 50, basis: "resultado-anual" },
        prevalence: "maior-resultado", ...patch,
      },
    });
  const run = (versions: AssessmentEntryVersion[], r = finalRule()) => {
    const periods = periodsOf(3);
    return consolidate({
      periods,
      closings: periods.map((p) => closing({ period: p, score: 40 })),
      rule: r,
      finalRecoveryEntries: officialCompositionInputsForStudent({
        studentId: "alu-001", instruments: [instrument], versions,
        configuration: { id: quant.id, version: quant.version! },
      }),
    });
  };
  const logical = (id: string) => id; // a cadeia é resolvida por logicalEntryId
  void logical;

  it("A, D, E, F, G, H: versão oficial vigente entra como fato próprio; matemática e proveniência preservadas", () => {
    const versions = [v("rv1", 1, 70)];
    const result = run(versions);
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.cycleScore).toBe(40);
    expect(result.finalRecovery?.recoveryScore).toBe(70);
    expect(result.postRecoveryScore).toBe(70);
    expect(result.finalRecovery?.entryIds).toEqual(["rv1"]);
    expect(versions).toHaveLength(1);
    expect(result.finalRecovery?.provenance).toMatchObject({
      ruleId: "rav-demo-estrutural", recoveryRuleId: "rec-final-teste",
      configurationId: quant.id, eligibilityEvaluatorId: "limite-de-pontuacao",
      eligibilityFacts: { threshold: 50, cycleResult: 40 },
      effect: { effectEvaluatorId: "maior-resultado", originalValue: 40, recoveryValue: 70 },
    });
    expect(typeof result.finalRecovery?.provenance?.ruleVersion).toBe("number");
  });

  it("B: versão superada não entra", () => {
    const result = run([v("rv1", 1, 90), v("rv2", 2, 60, { supersedesVersionId: "rv1" })]);
    if (result.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(result.finalRecovery?.entryIds).toEqual(["rv2"]);
    expect(result.finalRecovery?.recoveryScore).toBe(60);
  });

  it("C e M: 'Não registrado' mantém a semântica e rascunho não entra; nada é presumido", () => {
    const draft = run([v("rv1", 1, 90, { status: "rascunho" } as never)]);
    if (draft.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(draft.finalRecovery?.state).toBe("elegivel-sem-registro");
    expect(draft.postRecoveryScore).toBeNull();
    const nr = run([v("rv1", 1, null)]);
    if (nr.kind !== "consolidado") throw new Error("esperado consolidado");
    expect(nr.finalRecovery?.state).not.toBe("aplicada");
    expect(nr.finalRecovery?.recoveryScore).toBeNull();
  });
});

describe("6D.3.5.2 — prévia usa o motor canônico", () => {
  const withRecovery = (patch = {}) => {
    const r = rule();
    return {
      ...r,
      periodicRecovery: {
        id: "rec-p", enabled: true, scope: "periodo" as const, replacesCategoryIds: [],
        instrumentTypeIds: ["it-prova"], maxScore: 60, prevalence: "maior-resultado" as const,
        normativeStatus: "configurado" as const, ...patch,
      },
    };
  };
  const input = (r: InstitutionalAssessmentRule) => ({
    categoryValues: Object.fromEntries(r.categories.map((c) => [c.id, 20])),
    recoveryValue: 80,
  });

  it("I: prévia produz o mesmo resultado do motor", () => {
    const r = withRecovery();
    const sim = simulateRule(r, input(r));
    if (!sim.period) return expect(sim.blocked).not.toBeNull();
    const out = applyRecovery({
      recovery: r.periodicRecovery, model: compositionModelFromRule(r), point: "periodo", original: sim.period,
      entries: [{ entryId: "x", instrumentId: "x", instrumentTypeId: "it-prova", periodId: "s", configurationId: "c", value: { kind: "numerica", value: 80 }, status: "registrado" }],
    });
    expect(sim.recovery?.value).toBe(out.recovery?.value);
    expect(sim.afterRecovery?.value).toBe(out.afterRecovery?.value);
  });

  it("J: regra incompleta permanece incompleta", () => {
    const r = withRecovery({ prevalence: undefined });
    const sim = simulateRule(r, input(r));
    expect(sim.recovery).toBeNull();
    if (r.allowsGrades && !r.usesPedagogicalRecords) expect(sim.blocked).not.toBeNull();
    const noType = withRecovery({ instrumentTypeIds: [] });
    const s2 = simulateRule(noType, input(noType));
    expect(s2.recovery).toBeNull();
  });

  it("K: a prévia não contém prevalência/teto/arredondamento próprios", () => {
    const src = readFileSync("src/features/assessment/assessment-rule-preview.ts", "utf8");
    const fn = src.slice(src.indexOf("export function simulateRule"));
    const tail = fn.slice(fn.indexOf("const recoveryRule"));
    expect(tail).not.toMatch(/prevailValue|Math\.min|Math\.max|roundScore|maxScore/);
  });
});
