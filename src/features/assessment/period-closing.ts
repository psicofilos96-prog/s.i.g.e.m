/**
 * Etapa 12G — Fechamento do Período Avaliativo (domínio puro).
 *
 * Consome exclusivamente as fontes canônicas já existentes:
 *   calendário (12B) → períodos oficiais → instrumentos e lançamentos (12C/12D)
 *   → regra avaliativa homologada (12F) → motor de composição (12E).
 *
 * Nada aqui inventa nota, zero, média proporcional, equivalência, prazo,
 * situação acadêmica, frequência ou deliberação de Conselho.
 */
import type { PedagogicalAssignmentRecord } from "@/features/pedagogical/pedagogical-data";
import type { DemonstrationStudent } from "@/features/students/students-data";
import { projectCanonicalPeriodResult, type CanonicalPeriodResult } from "./assessment-period-result";
import { officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";
import {
  assessmentLogicalEntryId,
  currentAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import type { CompositionModel, PeriodComposition } from "./assessment-composition-types";
import {
  evaluateClosingRequirements,
  type ClosingRequirementEvaluation,
} from "./period-closing-admissibility";
import { compositionModelFromRule, officialModelFromRule } from "./assessment-rule-model";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import {
  curriculumKey,
  eligibilityInPeriod,
  sameCurriculum,
  studentPlacements,
} from "./assessment-rules";
import type {
  AssessmentConfiguration,
  AssessmentEntry,
  AssessmentInstrument,
  AssessmentPeriod,
  CurriculumRef,
} from "./assessment-types";
import {
  CLOSING_CAPABILITY_LABEL,
  type ClosingAction,
  type ClosingActor,
  type ClosingActorStamp,
  type ClosingCapability,
  type ClosingEvent,
  type ClosingPendency,
  type ClosingScope,
  type ClosingSourceReference,
  type ClosingStage,
  type ClosingWorkflow,
  type MaterializedStudentResult,
  type PeriodClosingRecord,
} from "./period-closing-types";

// -------------------------------------------------------------- Identidade

export function closingScopeKey(scope: ClosingScope) {
  return [
    scope.classId,
    scope.academicYearId,
    scope.calendarPeriodId ?? scope.periodId,
    curriculumKey(scope.curriculumRef),
  ].join("|");
}

export function sameScope(a: ClosingScope, b: ClosingScope) {
  return closingScopeKey(a) === closingScopeKey(b);
}

// ------------------------------------------------------------- Capacidades

/**
 * Perfis DEMONSTRATIVOS. Existem apenas para exercitar o ciclo antes da
 * autorização real: nenhum cargo é regra universal, e a atribuição definitiva
 * de cada capacidade pertence à governança institucional futura.
 */
export const CLOSING_DEMONSTRATION_PROFILES: Array<{
  id: string;
  label: string;
  name: string;
  capabilities: ClosingCapability[];
  professionalId?: string;
}> = [
  {
    id: "perfil-docente",
    label: "Professor responsável pelo componente",
    name: "Professor(a) do componente (demonstração)",
    capabilities: ["entregar-pauta-docente", "consultar-auditoria-fechamentos"],
  },
  {
    id: "perfil-gestao-escolar",
    label: "Gestão escolar / Coordenação pedagógica",
    name: "Gestão escolar (demonstração)",
    capabilities: [
      "realizar-conferencia-escolar",
      "devolver-pauta-com-apontamentos",
      "consultar-auditoria-fechamentos",
    ],
  },
  {
    id: "perfil-secretaria-escolar",
    label: "Secretaria escolar",
    name: "Secretaria escolar (demonstração)",
    capabilities: [
      "realizar-conferencia-escolar",
      "homologar-fechamento-oficial",
      "executar-retificacao-pos-fechamento",
      "consultar-auditoria-fechamentos",
    ],
  },
  {
    id: "perfil-supervisao",
    label: "Supervisão de Ensino",
    name: "Supervisão de Ensino (demonstração)",
    capabilities: [
      "homologar-fechamento-oficial",
      "autorizar-retificacao-pos-fechamento",
      "reabrir-periodo-fechado",
      "consultar-auditoria-fechamentos",
    ],
  },
];

export function demonstrationActor(profileId: string): ClosingActor {
  const profile =
    CLOSING_DEMONSTRATION_PROFILES.find((p) => p.id === profileId) ??
    CLOSING_DEMONSTRATION_PROFILES[0]!;
  return {
    id: profile.id,
    name: profile.name,
    profileLabel: profile.label,
    capabilities: profile.capabilities,
  };
}

export function actorStamp(actor: ClosingActor, at: string): ClosingActorStamp {
  return { actorId: actor.id, actorName: actor.name, profileLabel: actor.profileLabel, at };
}

export function can(actor: ClosingActor, capability: ClosingCapability) {
  return actor.capabilities.includes(capability);
}

export function missingCapabilityReason(capability: ClosingCapability) {
  return `Esta operação exige a capacidade "${CLOSING_CAPABILITY_LABEL[capability]}", que este perfil não possui.`;
}

/** Capacidade exigida por ação. Mapa de capacidade, nunca de cargo. */
export const CLOSING_ACTION_CAPABILITY: Record<ClosingAction, ClosingCapability> = {
  "entrega-docente": "entregar-pauta-docente",
  "inicio-conferencia": "realizar-conferencia-escolar",
  "devolucao-com-apontamentos": "devolver-pauta-com-apontamentos",
  "fechamento-oficial": "homologar-fechamento-oficial",
  "retificacao-pontual": "executar-retificacao-pos-fechamento",
  "reabertura-integral": "reabrir-periodo-fechado",
};

// ------------------------------------------------- Vigência histórica (ajuste 4)

/**
 * A atuação é validada pela VIGÊNCIA NO PERÍODO, nunca pelo estado atual.
 * Uma atuação encerrada hoje pode ter sido legitimamente vigente durante o
 * período que está sendo fechado.
 */
export function assignmentActiveInPeriod(
  assignment: Pick<PedagogicalAssignmentRecord, "start" | "end">,
  period: Pick<AssessmentPeriod, "start" | "end">,
) {
  return assignment.start <= period.end && (!assignment.end || assignment.end >= period.start);
}

// ---------------------------------------------------------------- Contexto

export type ClosingContext = {
  scope: ClosingScope;
  configuration: AssessmentConfiguration;
  period: Pick<AssessmentPeriod, "id" | "label" | "start" | "end">;
  /** O período vem de calendário homologado? */
  officialPeriod: boolean;
  calendarId?: string;
  /** Regra aplicável resolvida (homologada ou em elaboração). */
  rule?: InstitutionalAssessmentRule;
  assignment?: PedagogicalAssignmentRecord;
  /** Instrumentos do componente/campo naquele período. */
  instruments: AssessmentInstrument[];
  /**
   * 6D.3.4.1 — fatos canônicos: versões oficiais dos resultados. O fechamento
   * não lê mais lançamentos do armazenamento legado.
   */
  versions: readonly AssessmentEntryVersion[];
  students: DemonstrationStudent[];
  stage: ClosingStage;
  /** 6D.3.4.2 — ledger do ciclo, consultado pelos requisitos de rito declarados. */
  events?: readonly ClosingEvent[];
};

/** Instrumentos do escopo: mesma turma, mesmo período e mesmo componente. */
export function instrumentsInScope(
  instruments: readonly AssessmentInstrument[],
  scope: ClosingScope,
  periodId: string,
) {
  return instruments.filter(
    (i) =>
      i.classId === scope.classId &&
      i.periodId === periodId &&
      sameCurriculum(i.curriculumRef, scope.curriculumRef),
  );
}

/** Alunos com vínculo com a turma dentro do período, com a cobertura temporal. */
export function studentsInPeriod(ctx: Pick<ClosingContext, "scope" | "period" | "students">) {
  return ctx.students
    .map((student) => ({
      student,
      eligibility: eligibilityInPeriod(
        studentPlacements(student),
        ctx.scope.classId,
        ctx.period,
      ),
    }))
    .filter((s) => s.eligibility.coverage !== "sem-vinculo")
    .sort((a, b) => a.student.personName.localeCompare(b.student.personName, "pt-BR"));
}

// -------------------------------------------------------------- Modelo/motor

/** Modelo que pode produzir fechamento OFICIAL: só regra homologada. */
export function officialModel(ctx: ClosingContext): CompositionModel | undefined {
  return ctx.rule ? (officialModelFromRule(ctx.rule) ?? undefined) : undefined;
}

/** Modelo para PRÉVIA não oficial (regra em elaboração). Nunca gera registro. */
export function previewModel(ctx: ClosingContext): CompositionModel | undefined {
  return ctx.rule ? compositionModelFromRule(ctx.rule) : undefined;
}

export type StudentComposition = {
  studentId: string;
  studentName: string;
  composition: PeriodComposition;
  /** 6D.3.5.3 — resultado canônico do período (antes → recuperação → depois). */
  result: CanonicalPeriodResult;
  entryIds: string[];
  /** Versões exatas consumidas pelo motor. */
  usedVersions: AssessmentEntryVersion[];
  coverage: ReturnType<typeof eligibilityInPeriod>["coverage"];
};

/**
 * Compõe o período aluno por aluno pelo motor da 12E. Nenhum valor é digitado
 * ou copiado: tudo é derivado dos lançamentos canônicos.
 */
export function composeScope(ctx: ClosingContext, model: CompositionModel): StudentComposition[] {
  return studentsInPeriod(ctx).map(({ student, eligibility }) => {
    const uses = officialCurrentVersionsForStudent({
      studentId: student.id,
      instruments: ctx.instruments,
      versions: ctx.versions,
    });
    // 6D.3.5.3 — mesma fronteira canônica da Avaliação do período.
    const result = projectCanonicalPeriodResult({
      model,
      periodId: ctx.period.id,
      uses,
      configuration: ctx.configuration,
      official: ctx.officialPeriod && model.normativeStatus === "homologado",
      ...(ctx.rule ? { rule: ctx.rule } : {}),
    });
    return {
      studentId: student.id,
      studentName: student.personName,
      composition: result.composition,
      result,
      entryIds: result.inputs.map((i) => i.entryId),
      usedVersions: result.uses.map((u) => u.version),
      coverage: eligibility.coverage,
    };
  });
}

/** Retrato materializado do fechamento — resultado consolidado do PERÍODO. */
export function materializeResults(
  ctx: ClosingContext,
  model: CompositionModel,
): MaterializedStudentResult[] {
  return composeScope(ctx, model).map((item) => {
    const unregistered = item.usedVersions
      .filter((v) => v.value.kind === "nao-registrado")
      .map((v) => ({
        entryId: v.id,
        reason: v.value.kind === "nao-registrado" ? v.value.reason : "",
      }));
    return {
      studentId: item.studentId,
      studentName: item.studentName,
      entryIds: item.entryIds,
      usedEntryVersions: item.usedVersions.map((v) => ({
        versionId: v.id,
        logicalEntryId: v.logicalEntryId,
        version: v.version,
      })),
      categories: item.composition.categories.map((c) => ({
        categoryId: c.categoryId,
        label: c.label,
        value: c.stage?.value ?? null,
        rounded: c.stage?.rounded ?? false,
      })),
      consolidatedPeriodScore: item.result.finalStage?.value ?? null,
      rounded: item.result.finalStage?.rounded ?? false,
      periodScoreBeforeRecovery: item.composition.stage?.value ?? null,
      recovery: item.result.recovery,
      complete: item.composition.complete,
      unregistered,
      coverage: item.coverage,
    };
  });
}

// ------------------------------------------------------------- Pendências

const pend = (p: ClosingPendency): ClosingPendency => p;

/**
 * Pendências da ENTREGA DOCENTE: invariantes factuais + requisitos que a
 * política homologada declarar para esta ação. Nada é exigido por padrão.
 */
export function deliveryPendencies(
  ctx: ClosingContext,
  actor?: Pick<ClosingActor, "capabilities">,
): ClosingPendency[] {
  const list: ClosingPendency[] = [];

  if (ctx.assignment && !assignmentActiveInPeriod(ctx.assignment, ctx.period))
    list.push(
      pend({
        code: "atuacao-sem-vigencia-no-periodo",
        severity: "bloqueante",
        message:
          "A atuação pedagógica informada não teve vigência dentro deste período. O encerramento posterior de uma atuação não invalida registros produzidos enquanto ela estava vigente.",
      }),
    );

  // Configuração sem notas (ex.: acompanhamento da Educação Infantil).
  if (!ctx.configuration.allowsGrades || ctx.configuration.usesPedagogicalRecords) {
    list.push(
      pend({
        code: "exigencia-de-fechamento-nao-configurada",
        severity: "aviso",
        message:
          "Esta configuração conclui o período pelos registros pedagógicos do Diário. A rede ainda não configurou quais registros e qual síntese são exigidos para o fechamento: nenhuma exigência é presumida, e nenhuma nota, conceito numérico ou média é criada.",
        pendingRuleIds: ["pn-ei"],
      }),
    );
    return list;
  }

  if (ctx.instruments.length === 0) {
    list.push(
      pend({
        code: "sem-instrumento-no-periodo",
        severity: "aviso",
        message:
          "Nenhum instrumento avaliativo foi cadastrado neste período para este componente.",
      }),
    );
  }

  // 6D.3.4.2 — completude e instrumentos planejados deixaram de ser
  // universais: só existem quando a política homologada os declara.
  list.push(...requirementPendencies(ctx, "entrega-docente", actor));

  // Quantidade mínima de instrumentos: SOMENTE quando a regra homologada a
  // declarar. Sem definição, o sistema não inventa exigência.
  const model = officialModel(ctx);
  if (model && model.categories.some((c) => c.minimumEntries !== undefined)) {
    for (const item of composeScope(ctx, model)) {
      for (const missing of item.composition.missing)
        if (missing.kind === "quantidade-minima")
          list.push(
            pend({
              code: "quantidade-minima-de-instrumentos",
              severity: "bloqueante",
              message: `A regra homologada exige ${missing.required} registro(s) na categoria e há ${missing.present}.`,
              studentId: item.studentId,
              studentName: item.studentName,
              categoryId: missing.categoryId,
            }),
          );
    }
  }

  // Trajetória que exige decisão humana — explicitamente sinalizada, nunca
  // resolvida pelo sistema e nunca convertida em nota, zero ou proporção.
  for (const { student, eligibility } of studentsInPeriod(ctx)) {
    if (eligibility.coverage !== "integral")
      list.push(
        pend({
          code: "pendencia-especial-de-trajetoria",
          severity: "pendencia-especial",
          message:
            "Cobertura parcial do período na turma. O aproveitamento depende de decisão administrativa/pedagógica: nenhuma nota, zero, média proporcional ou equivalência é presumida.",
          studentId: student.id,
          studentName: student.personName,
          pendingRuleIds: eligibility.pendingRuleIds,
        }),
      );
  }

  return list;
}

function requirementPendencies(
  ctx: ClosingContext,
  action: ClosingAction,
  actor?: Pick<ClosingActor, "capabilities">,
) {
  return evaluateClosingRequirements(ctx, action, actor).flatMap((e) => e.pendencies);
}

/**
 * Invariantes do FECHAMENTO OFICIAL (categoria C): sem eles não há fato a
 * materializar. Não são configuráveis.
 */
function officialClosingInvariants(ctx: ClosingContext): ClosingPendency[] {
  const list: ClosingPendency[] = [];
  if (ctx.stage === "fechado")
    list.push(
      pend({
        code: "periodo-ja-fechado",
        severity: "bloqueante",
        message:
          "Este período já está fechado oficialmente. Use retificação pontual ou reabertura formal.",
      }),
    );
  if (!ctx.officialPeriod || !ctx.calendarId)
    list.push(
      pend({
        code: "calendario-nao-homologado",
        severity: "bloqueante",
        message:
          "O período não vem de calendário escolar homologado. Sem período oficial não existe fechamento oficial.",
      }),
    );
  if (!officialModel(ctx))
    list.push(
      pend({
        code: "regra-nao-homologada",
        severity: "bloqueante",
        message:
          "Não há regra avaliativa homologada aplicável a esta turma. A prévia abaixo é uma simulação não oficial e não produz fechamento.",
        pendingRuleIds: ["pn-consolidacao"],
      }),
    );
  else if (!ctx.rule?.closingAdmissibility)
    list.push(
      pend({
        code: "politica-de-fechamento-ausente",
        severity: "bloqueante",
        message:
          "A regra homologada não declara os requisitos de fechamento do período. Sem essa declaração o fechamento não pode ser determinado, e nenhum requisito é presumido.",
      }),
    );
  return list;
}

/**
 * Pendências do FECHAMENTO OFICIAL: invariantes + pendências factuais da
 * entrega + requisitos declarados para o fechamento (sem duplicar os que
 * condicionam as duas ações).
 */
export function officialClosingPendencies(
  ctx: ClosingContext,
  actor?: Pick<ClosingActor, "capabilities">,
): ClosingPendency[] {
  const delivery = deliveryPendencies(ctx, actor).filter((p) => !p.requirementId);
  return [
    ...officialClosingInvariants(ctx),
    ...delivery,
    ...requirementPendencies(ctx, "fechamento-oficial", actor),
  ];
}

export type ClosingAdmissibilityProjection = {
  canClose: boolean;
  /** `insuficiente` = não existe política homologada que determine o fechamento. */
  normativeSufficiency: "suficiente" | "insuficiente";
  requirements: ClosingRequirementEvaluation[];
  unmetRequirements: ClosingRequirementEvaluation[];
  blockingReasons: ClosingPendency[];
  /** Mensagens humanas; IDs técnicos ficam apenas na proveniência. */
  disclosableReasons: string[];
  provenance: {
    ruleId?: string;
    ruleVersion?: number;
    policyId?: string;
    policyVersion?: number;
    configurationId: string;
    configurationVersion?: number;
    evaluatedRequirementIds: string[];
    metRequirementIds: string[];
    unmetRequirementIds: string[];
  };
};

/** "Este período pode ser fechado agora segundo a regra homologada vigente?" */
export function projectClosingAdmissibility(
  ctx: ClosingContext,
  actor?: Pick<ClosingActor, "capabilities">,
): ClosingAdmissibilityProjection {
  const requirements = evaluateClosingRequirements(ctx, "fechamento-oficial", actor);
  const unmetRequirements = requirements.filter((r) => r.status !== "atendido");
  const blockingReasons = blocking(officialClosingPendencies(ctx, actor));
  const policy = ctx.rule?.closingAdmissibility;
  const sufficient = Boolean(officialModel(ctx) && policy);
  return {
    canClose: sufficient && blockingReasons.length === 0,
    normativeSufficiency: sufficient ? "suficiente" : "insuficiente",
    requirements,
    unmetRequirements,
    blockingReasons,
    disclosableReasons: [...new Set(blockingReasons.map((p) => p.message))],
    provenance: {
      ...(ctx.rule ? { ruleId: ctx.rule.id, ruleVersion: ctx.rule.version } : {}),
      ...(policy ? { policyId: policy.id, policyVersion: policy.version } : {}),
      configurationId: ctx.configuration.id,
      ...(ctx.configuration.version !== undefined
        ? { configurationVersion: ctx.configuration.version }
        : {}),
      evaluatedRequirementIds: requirements.map((r) => r.requirement.id),
      metRequirementIds: requirements.filter((r) => r.status === "atendido").map((r) => r.requirement.id),
      unmetRequirementIds: unmetRequirements.map((r) => r.requirement.id),
    },
  };
}

export const blocking = (list: readonly ClosingPendency[]) =>
  list.filter((p) => p.severity === "bloqueante");
export const specialPendencies = (list: readonly ClosingPendency[]) =>
  list.filter((p) => p.severity === "pendencia-especial");
export const advisories = (list: readonly ClosingPendency[]) =>
  list.filter((p) => p.severity === "aviso");

// ------------------------------------------------------- Cadeia de versões

/** Versões do escopo em ordem crescente. Nenhuma é sobrescrita. */
export function closingChain(records: readonly PeriodClosingRecord[], scopeKey: string) {
  return records
    .filter((r) => closingScopeKey(r.scope) === scopeKey)
    .sort((a, b) => a.version - b.version);
}

/**
 * Versão VIGENTE derivada da cadeia: a única versão que nenhuma outra sucede.
 * Não existe campo editável de vigência.
 */
export function currentClosing(
  records: readonly PeriodClosingRecord[],
  scopeKey: string,
): PeriodClosingRecord | undefined {
  const chain = closingChain(records, scopeKey);
  const superseded = new Set(
    chain.map((r) => r.precedingClosingId).filter((id): id is string => !!id),
  );
  const open = chain.filter((r) => !superseded.has(r.id));
  return open[open.length - 1];
}

/** Uma versão é histórica quando outra versão a sucede. */
export function isSuperseded(records: readonly PeriodClosingRecord[], record: PeriodClosingRecord) {
  return closingChain(records, closingScopeKey(record.scope)).some(
    (r) => r.precedingClosingId === record.id,
  );
}

/** Invariantes da cadeia: versões únicas, encadeamento válido, uma vigente. */
export function closingChainIssues(
  records: readonly PeriodClosingRecord[],
  scopeKey: string,
): string[] {
  const chain = closingChain(records, scopeKey);
  const issues: string[] = [];
  const versions = new Set<number>();
  for (const record of chain) {
    if (versions.has(record.version)) issues.push(`Versão ${record.version} duplicada.`);
    versions.add(record.version);
    if (record.version === 1) {
      if (record.precedingClosingId) issues.push("A versão 1 não pode suceder outra versão.");
    } else if (!record.precedingClosingId) issues.push(`Versão ${record.version} sem antecessora.`);
    else if (!chain.some((r) => r.id === record.precedingClosingId))
      issues.push(`Versão ${record.version} aponta para antecessora inexistente.`);
  }
  const superseded = new Set(
    chain.map((r) => r.precedingClosingId).filter((id): id is string => !!id),
  );
  const open = chain.filter((r) => !superseded.has(r.id));
  if (open.length > 1) issues.push("Mais de uma versão vigente na mesma cadeia.");
  return issues;
}

/** Referência que um documento futuro deve gravar (versão, não "vigente"). */
export function closingSourceReference(record: PeriodClosingRecord): ClosingSourceReference {
  return {
    closingId: record.id,
    closingVersion: record.version,
    scopeKey: closingScopeKey(record.scope),
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
    calendarId: record.calendarId,
    materializedAt: record.closedAt,
  };
}

/** Rótulo institucional único desta etapa. */
export const CONSOLIDATED_PERIOD_RESULT_LABEL = "Resultado consolidado oficial do período";

export const CONSOLIDATED_PERIOD_RESULT_NOTE =
  "Este resultado é do período. Resultado anual, recuperação final, frequência, Conselho de Classe e situação acadêmica pertencem a etapas posteriores e não são produzidos aqui.";

// ------------------------------------------------------------- Transições

export const CLOSING_STAGE_AFTER: Record<ClosingAction, ClosingStage> = {
  "entrega-docente": "entregue",
  "inicio-conferencia": "em-conferencia",
  "devolucao-com-apontamentos": "devolvida-para-ajustes",
  "fechamento-oficial": "fechado",
  "retificacao-pontual": "fechado",
  "reabertura-integral": "reaberto",
};

/** Estados de origem admitidos por ação. Nada de volta silenciosa de estado. */
export const CLOSING_STAGE_FROM: Record<ClosingAction, ClosingStage[]> = {
  "entrega-docente": ["em-andamento", "devolvida-para-ajustes", "reaberto"],
  // 6D.3.4.2 — a ordem do rito é requisito declarado, não transição fixa.
  "inicio-conferencia": ["em-andamento", "entregue", "devolvida-para-ajustes", "reaberto"],
  "devolucao-com-apontamentos": ["entregue", "em-conferencia", "reaberto"],
  "fechamento-oficial": [
    "em-andamento",
    "entregue",
    "em-conferencia",
    "devolvida-para-ajustes",
    "reaberto",
  ],
  "retificacao-pontual": ["fechado"],
  "reabertura-integral": ["fechado"],
};

export function transitionAllowed(action: ClosingAction, stage: ClosingStage) {
  return CLOSING_STAGE_FROM[action].includes(stage);
}

export function emptyWorkflow(scope: ClosingScope): ClosingWorkflow {
  return { scopeKey: closingScopeKey(scope), scope, stage: "em-andamento", events: [] };
}
