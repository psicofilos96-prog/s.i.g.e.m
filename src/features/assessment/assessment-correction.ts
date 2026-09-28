/**
 * Etapa 6D.3.1 — Assessment Correction Resolver.
 *
 * Motor declarativo da retificação do RESULTADO AVALIATIVO. Recebe FATOS
 * (versão vigente, agente e capacidades declaradas, configuração aplicável,
 * política homologada, fechamento de período vigente, contexto) e projeta o que
 * é admissível. A interface nunca decide: apenas projeta esta saída.
 *
 * Invariantes:
 * - O resolver NÃO conhece cargos. Professor, coordenação, secretaria e
 *   supervisão são consequências de capacidades vigentes, nunca de código.
 * - O resolver NÃO conhece "nota": as naturezas admissíveis vêm da configuração
 *   (numérica, conceitual, descritiva) e de "não registrado" com motivo.
 * - Contexto que não admite instrumento avaliativo (ex.: acompanhamento do
 *   desenvolvimento) não tem correção de resultado: falha fechada.
 * - Fechamento oficial não implica justificativa: ele altera o CONTEXTO
 *   NORMATIVO consultado; a política homologada projeta o rito exigido.
 * - Falha fechada: sem política homologada aplicável, nada é admitido.
 * - Nenhuma versão fantasma: sem alteração factual efetiva, não há retificação.
 * - Concorrência: correção iniciada sobre versão superada falha fechada.
 * - Proteção de contexto: fato cuja revelação não foi autorizada pela política
 *   não aparece na projeção divulgável nem anuncia sua existência.
 *
 * Esta etapa NÃO calcula, NÃO compõe e NÃO fecha período: `assessment-composition.ts`
 * permanece a única autoridade de composição.
 */
import type { ValueSemantics } from "./assessment-composition-types";
import { instrumentFlowAvailable } from "./assessment-instruments";
import { validateEntryValue } from "./assessment-rules";
import type {
  AssessmentConfiguration,
  AssessmentInstrument,
  EntryValue,
} from "./assessment-types";
import {
  assessmentValueDelta,
  createSupersedingAssessmentEntryVersion,
  currentAssessmentEntryVersion,
  type AssessmentCapability,
  type AssessmentChangeAspect,
  type AssessmentEntryVersion,
  type AssessmentRectificationAct,
} from "./assessment-entry-versions";
import type { EntryOrigin } from "./assessment-composition-types";

// ---------------------------------------------------------------------------
// Fatos consultados
// ---------------------------------------------------------------------------

export type AssessmentCorrectionRequirement = {
  code: string;
  label: string;
  provenance: string;
};

/** Fechamento de período vigente que cobre o instrumento, quando houver (12G). */
export type AssessmentPeriodClosingFact = {
  closingId: string;
  closingVersion: number;
  periodLabel: string;
};

/**
 * Política homologada da retificação de resultado. Toda exigência vem daqui: o
 * motor não enumera rito, prazo, documento, patamar nem competência.
 */
export type AssessmentCorrectionPolicy = {
  id: string;
  version: number;
  label: string;
  homologated: boolean;
  /** Contexto normativo em que a política se aplica. */
  appliesWhenPeriodClosing: "present" | "absent" | "any";
  outcome: "admissible" | "forbidden";
  forbiddenReason?: string;
  requiredCapabilities: readonly AssessmentCapability[];
  requirements: readonly AssessmentCorrectionRequirement[];
  /** Aspectos que a política admite alterar. Ausente = todos os da configuração. */
  admissibleChanges?: readonly AssessmentChangeAspect[];
  /**
   * Naturezas de resultado que a política admite na correção. Ausente = as que a
   * configuração já admite. Serve, por exemplo, para uma rede que admita corrigir
   * valor por valor, mas NÃO admita transformar resultado em "não registrado".
   */
  admissibleValueKinds?: readonly EntryValue["kind"][];
  /** A política autoriza revelar fechamento e capacidades exigidas? */
  disclosesNormativeContext: boolean;
};

export type AssessmentCorrectionAgent = {
  agentId: string;
  capabilities: readonly AssessmentCapability[];
};

export type AssessmentCorrectionBlockingCode =
  | "versao-inexistente"
  | "resultado-em-rascunho"
  | "versao-substituida"
  | "contexto-sem-instrumento-avaliativo"
  | "sem-politica-homologada"
  | "retificacao-impedida-pela-politica"
  | "capacidade-ausente";

export type AssessmentCorrectionBlockingReason = {
  code: AssessmentCorrectionBlockingCode;
  message: string;
  provenance: string;
  /** Falso quando a política não autoriza revelar o fato que sustenta o bloqueio. */
  disclosable: boolean;
};

export type AssessmentCorrectionInput = {
  /** Versão que o agente tem em mão (pode estar obsoleta). */
  baseVersionId: string;
  versions: readonly AssessmentEntryVersion[];
  agent: AssessmentCorrectionAgent;
  instrument: Pick<AssessmentInstrument, "id" | "instrumentTypeId" | "status">;
  configuration: AssessmentConfiguration;
  policies: readonly AssessmentCorrectionPolicy[];
  periodClosing?: AssessmentPeriodClosingFact;
  context?: { unitId?: string; academicYearId?: string };
};

/** Valores admissíveis projetados da escala configurada — nunca inventados. */
export type AdmissibleAssessmentValues =
  | { kind: "numerica"; min: number; max: number; step?: number }
  | { kind: "conceitual"; options: readonly { id: string; label: string }[] }
  | { kind: "descritiva" }
  | { kind: "nao-registrado" };

export type AssessmentCorrectionProjection = {
  canCorrect: boolean;
  /** Naturezas admitidas pela configuração E pela política. */
  admissibleValueKinds: readonly EntryValue["kind"][];
  /** Forma concreta de cada natureza admitida, projetada da escala da época. */
  admissibleValues: readonly AdmissibleAssessmentValues[];
  admissibleChanges: readonly AssessmentChangeAspect[];
  requiredCapabilities: readonly AssessmentCapability[];
  requiredRitual: readonly AssessmentCorrectionRequirement[];
  blockingReasons: readonly AssessmentCorrectionBlockingReason[];
  /** Subconjunto revelável: nunca expõe fato não autorizado. */
  disclosableReasons: readonly { code: string; message: string }[];
  appliedPolicy?: { id: string; version: number; label: string };
  consultedClosing?: AssessmentPeriodClosingFact;
  /** Semânticas de valor que a configuração comporta, para leitura da interface. */
  configuredSemantics: readonly ValueSemantics[];
};

// ---------------------------------------------------------------------------
// Projeção da configuração (nenhuma natureza privilegiada)
// ---------------------------------------------------------------------------

/**
 * Naturezas que a CONFIGURAÇÃO admite. Testadas pelo próprio validador canônico
 * do domínio, para não duplicar a regra de escala em dois lugares.
 */
function configuredValueKinds(configuration: AssessmentConfiguration): EntryValue["kind"][] {
  const probes: EntryValue[] = [
    { kind: "numerica", value: numericProbe(configuration) },
    { kind: "conceitual", optionId: conceptualProbe(configuration) },
    { kind: "descritiva", text: "sonda" },
    // "Não registrado" é fato epistêmico: admitido sempre que há lançamento,
    // porque ausência de informação não pode ser proibida nem convertida.
    { kind: "nao-registrado", reason: "sonda" },
  ];
  return probes
    .filter((value) => validateEntryValue(configuration, value).length === 0)
    .map((value) => value.kind);
}

function numericProbe(configuration: AssessmentConfiguration): number {
  const scale = configuration.scales.find((item) => item.kind === "numerica");
  return scale && scale.kind === "numerica" ? scale.min : Number.NaN;
}

function conceptualProbe(configuration: AssessmentConfiguration): string {
  const scale = configuration.scales.find((item) => item.kind === "conceitual");
  return scale && scale.kind === "conceitual" ? (scale.options[0]?.id ?? "") : "";
}

function admissibleValuesOf(
  configuration: AssessmentConfiguration,
  kinds: readonly EntryValue["kind"][],
): AdmissibleAssessmentValues[] {
  const values: AdmissibleAssessmentValues[] = [];
  for (const kind of kinds) {
    if (kind === "numerica") {
      const scale = configuration.scales.find((item) => item.kind === "numerica");
      if (scale && scale.kind === "numerica")
        values.push({
          kind: "numerica",
          min: scale.min,
          max: scale.max,
          ...(scale.step !== undefined ? { step: scale.step } : {}),
        });
      continue;
    }
    if (kind === "conceitual") {
      const scale = configuration.scales.find((item) => item.kind === "conceitual");
      if (scale && scale.kind === "conceitual")
        values.push({
          kind: "conceitual",
          options: scale.options.map((option) => ({ id: option.id, label: option.label })),
        });
      continue;
    }
    values.push(kind === "descritiva" ? { kind: "descritiva" } : { kind: "nao-registrado" });
  }
  return values;
}

function configuredSemanticsOf(configuration: AssessmentConfiguration): ValueSemantics[] {
  const semantics: ValueSemantics[] = [];
  for (const scale of configuration.scales) {
    if (scale.kind === "numerica" && !semantics.includes("quantitativa"))
      semantics.push("quantitativa");
    if (scale.kind === "conceitual" && !semantics.includes("conceitual"))
      semantics.push("conceitual");
    if (scale.kind === "descritiva" && !semantics.includes("descritiva"))
      semantics.push("descritiva");
  }
  return semantics;
}

function applicablePolicy(
  policies: readonly AssessmentCorrectionPolicy[],
  closing: AssessmentPeriodClosingFact | undefined,
): AssessmentCorrectionPolicy | undefined {
  const situation = closing ? "present" : "absent";
  const homologated = policies.filter((item) => item.homologated);
  return (
    homologated.find((item) => item.appliesWhenPeriodClosing === situation) ??
    homologated.find((item) => item.appliesWhenPeriodClosing === "any")
  );
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function resolveAssessmentCorrection(
  input: AssessmentCorrectionInput,
): AssessmentCorrectionProjection {
  const { baseVersionId, versions, agent, configuration, policies, periodClosing } = input;
  const blocking: AssessmentCorrectionBlockingReason[] = [];
  const base = versions.find((item) => item.id === baseVersionId);

  if (!base)
    blocking.push({
      code: "versao-inexistente",
      message: "Não há resultado registrado para corrigir.",
      provenance: `Versão informada não encontrada: ${baseVersionId}.`,
      disclosable: true,
    });

  if (base && base.status !== "registrado")
    blocking.push({
      code: "resultado-em-rascunho",
      message:
        "Este resultado ainda está em rascunho: ele é alterado na própria pauta, sem correção formal.",
      provenance:
        "Retificação versionada só existe depois do registro do resultado; antes disso a edição é ordinária.",
      disclosable: true,
    });

  const current = base ? currentAssessmentEntryVersion(versions, base.logicalEntryId) : undefined;
  if (base && current && current.id !== base.id)
    blocking.push({
      code: "versao-substituida",
      message:
        "Esta não é mais a versão vigente deste resultado. Abra a versão atual antes de corrigir.",
      provenance: `Versão vigente: ${current.id} (versão ${current.version}); base apresentada: ${base.id} (versão ${base.version}).`,
      disclosable: true,
    });

  if (!instrumentFlowAvailable(configuration))
    blocking.push({
      code: "contexto-sem-instrumento-avaliativo",
      message:
        "O acompanhamento desta turma não trabalha com resultados de instrumento; não há resultado a corrigir aqui.",
      provenance: `Configuração aplicável: ${configuration.id} (versão ${configuration.version}) — estratégia "${configuration.strategy}", sem tipos de instrumento ou escalas admitidas.`,
      disclosable: true,
    });

  const policy = applicablePolicy(policies, periodClosing);
  if (!policy)
    blocking.push({
      code: "sem-politica-homologada",
      message: "Não há regra homologada que discipline a correção deste resultado.",
      provenance: periodClosing
        ? `Contexto normativo consultado: fechamento de período vigente ${periodClosing.closingId} (versão ${periodClosing.closingVersion}).`
        : "Contexto normativo consultado: sem fechamento de período vigente.",
      disclosable: true,
    });

  if (policy && policy.outcome === "forbidden")
    blocking.push({
      code: "retificacao-impedida-pela-politica",
      message:
        policy.forbiddenReason ??
        "A regra vigente não admite correção deste resultado neste momento.",
      provenance: `Regra aplicada: ${policy.label} (${policy.id}, versão ${policy.version}).`,
      disclosable: policy.disclosesNormativeContext,
    });

  const requiredCapabilities = policy?.requiredCapabilities ?? [];
  const missing = requiredCapabilities.filter((item) => !agent.capabilities.includes(item));
  for (const capability of missing)
    blocking.push({
      code: "capacidade-ausente",
      message: policy?.disclosesNormativeContext
        ? `Esta correção exige a capacidade institucional "${capability}", que não consta para quem está operando.`
        : "Esta correção depende de autorização institucional que não consta para quem está operando.",
      provenance: `Capacidade exigida: ${capability}. Regra: ${policy?.id} (versão ${policy?.version}).${
        periodClosing
          ? ` Fechamento consultado: ${periodClosing.closingId} (versão ${periodClosing.closingVersion}).`
          : ""
      }`,
      disclosable: policy?.disclosesNormativeContext ?? false,
    });

  const canCorrect = blocking.length === 0 && Boolean(policy) && Boolean(base);

  const configured = configuredValueKinds(configuration);
  const kinds = canCorrect
    ? policy?.admissibleValueKinds
      ? configured.filter((kind) => policy.admissibleValueKinds!.includes(kind))
      : configured
    : [];

  return {
    canCorrect,
    admissibleValueKinds: kinds,
    admissibleValues: admissibleValuesOf(configuration, kinds),
    admissibleChanges: canCorrect
      ? (policy?.admissibleChanges ?? DEFAULT_ADMISSIBLE_CHANGES)
      : [],
    requiredCapabilities,
    requiredRitual: canCorrect ? (policy?.requirements ?? []) : [],
    blockingReasons: blocking,
    disclosableReasons: blocking
      .filter((item) => item.disclosable)
      .map((item) => ({ code: item.code, message: item.message })),
    configuredSemantics: configuredSemanticsOf(configuration),
    ...(policy
      ? { appliedPolicy: { id: policy.id, version: policy.version, label: policy.label } }
      : {}),
    ...(periodClosing && (policy?.disclosesNormativeContext ?? false)
      ? { consultedClosing: periodClosing }
      : {}),
  };
}

/**
 * Sem declaração da política, todos os aspectos que a configuração já comporta
 * são admissíveis: a política restringe, nunca amplia silenciosamente.
 */
const DEFAULT_ADMISSIBLE_CHANGES: readonly AssessmentChangeAspect[] = [
  "natureza-do-resultado",
  "resultado-registrado",
  "motivo-da-ausencia-de-registro",
  "origem-do-resultado",
];

// ---------------------------------------------------------------------------
// Ato de retificação
// ---------------------------------------------------------------------------

export type AssessmentCorrectionSubmission = {
  value: EntryValue;
  valueLabel?: string;
  origin?: EntryOrigin;
  justification?: string;
  /** Códigos das exigências declaradas como atendidas no ato. */
  satisfiedRequirementCodes?: readonly string[];
};

export type AssessmentCorrectionAttempt =
  | { registered: false; issues: readonly string[] }
  | { registered: true; version: AssessmentEntryVersion };

export function assessmentCorrectionSubmissionIssues(
  projection: AssessmentCorrectionProjection,
  base: AssessmentEntryVersion | undefined,
  configuration: AssessmentConfiguration,
  submission: AssessmentCorrectionSubmission,
): string[] {
  if (!projection.canCorrect || !base)
    return projection.disclosableReasons.length
      ? projection.disclosableReasons.map((item) => item.message)
      : ["Esta correção não é admissível neste momento."];

  const issues: string[] = [];

  if (!projection.admissibleValueKinds.includes(submission.value.kind))
    issues.push("A regra vigente não admite registrar este resultado nesta natureza.");

  // A validação de escala continua sendo a do domínio canônico.
  issues.push(...validateEntryValue(configuration, submission.value));

  const delta = assessmentValueDelta(
    { value: base.value, ...(base.origin ? { origin: base.origin } : {}) },
    { value: submission.value, ...(submission.origin ? { origin: submission.origin } : {}) },
  );
  if (!delta.length) issues.push("Nenhuma informação diferente do resultado vigente.");

  const inadmissible = delta.filter((aspect) => !projection.admissibleChanges.includes(aspect));
  for (const aspect of inadmissible)
    issues.push(`A regra vigente não admite alterar: ${aspect}.`);

  for (const requirement of projection.requiredRitual) {
    if (requirement.code === "justificativa" && !submission.justification?.trim()) {
      issues.push(`Informe: ${requirement.label}.`);
      continue;
    }
    if (
      requirement.code !== "justificativa" &&
      !(submission.satisfiedRequirementCodes ?? []).includes(requirement.code)
    )
      issues.push(`Exigência pendente: ${requirement.label}.`);
  }
  return issues;
}

/** Produz a próxima versão encadeada, ou devolve diagnósticos. Falha fechada. */
export function rectifyAssessmentEntry(input: {
  correction: AssessmentCorrectionInput;
  submission: AssessmentCorrectionSubmission;
  versionId: string;
  now: string;
}): AssessmentCorrectionAttempt {
  const projection = resolveAssessmentCorrection(input.correction);
  const base = input.correction.versions.find(
    (item) => item.id === input.correction.baseVersionId,
  );
  const issues = assessmentCorrectionSubmissionIssues(
    projection,
    base,
    input.correction.configuration,
    input.submission,
  );
  if (issues.length || !base || !projection.appliedPolicy)
    return { registered: false, issues: issues.length ? issues : ["Correção inadmissível."] };

  const act: AssessmentRectificationAct = {
    actedAt: input.now,
    agentId: input.correction.agent.agentId,
    policyId: projection.appliedPolicy.id,
    policyVersion: projection.appliedPolicy.version,
    policyLabel: projection.appliedPolicy.label,
    satisfiedRequirements: projection.requiredRitual,
    changedAspects: assessmentValueDelta(
      { value: base.value, ...(base.origin ? { origin: base.origin } : {}) },
      {
        value: input.submission.value,
        ...(input.submission.origin ? { origin: input.submission.origin } : {}),
      },
    ),
    ...(input.submission.justification?.trim()
      ? { justification: input.submission.justification.trim() }
      : {}),
    ...(projection.requiredCapabilities.length
      ? { exercisedCapabilities: projection.requiredCapabilities }
      : {}),
    ...(input.correction.periodClosing
      ? {
          consultedClosing: {
            closingId: input.correction.periodClosing.closingId,
            closingVersion: input.correction.periodClosing.closingVersion,
            periodLabel: input.correction.periodClosing.periodLabel,
          },
        }
      : {}),
  };

  return {
    registered: true,
    version: createSupersedingAssessmentEntryVersion({
      base,
      versionId: input.versionId,
      value: input.submission.value,
      rectification: act,
      now: input.now,
      ...(input.submission.valueLabel ? { valueLabel: input.submission.valueLabel } : {}),
      ...(input.submission.origin ? { origin: input.submission.origin } : {}),
    }),
  };
}
