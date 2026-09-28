/**
 * Etapa 6D.2.1 — Lesson Correction Resolver.
 *
 * Motor declarativo da retificação do registro de aula. Recebe FATOS
 * (versão vigente, agente e capacidades declaradas, política aplicável,
 * fechamento oficial vigente, contexto) e projeta o que é admissível.
 *
 * Invariantes:
 * - O resolver NÃO conhece cargos autorizados. Professor, coordenação e
 *   secretaria são consequências de capacidades vigentes, nunca regras de código.
 * - Fechamento oficial não implica justificativa: ele altera o CONTEXTO
 *   NORMATIVO consultado; a política homologada é que projeta o rito exigido.
 * - Falha fechada: sem regra homologada aplicável, nada é admitido.
 * - Nenhuma versão fantasma: sem alteração efetiva, não há retificação.
 * - Proteção de contexto: fato cuja revelação não foi autorizada pela política
 *   não aparece na projeção divulgável.
 */
import {
  createSupersedingLessonVersion,
  currentLessonVersion,
  lessonFactsDelta,
  type LessonChangeAspect,
  type LessonFacts,
  type LessonRecordVersion,
  type LessonRectificationAct,
} from "./lesson-versions";

/** Capacidades são identificadores abertos declarados por configuração. */
export type LessonCorrectionCapability = string;

export type LessonCorrectionRequirement = {
  code: string;
  label: string;
  provenance: string;
};

/** Fechamento oficial vigente que cobre a aula, quando houver (12H.1). */
export type LessonOfficialClosingFact = {
  closingId: string;
  closingVersion: number;
  periodLabel: string;
};

/**
 * Regra homologada da retificação de aula. Toda exigência vem daqui:
 * o motor não enumera rito, prazo, documento nem competência.
 */
export type LessonCorrectionPolicy = {
  id: string;
  version: number;
  label: string;
  homologated: boolean;
  /** Contexto normativo em que a regra se aplica. */
  appliesWhenOfficialClosing: "present" | "absent" | "any";
  /** A regra admite ou impede a retificação naquele contexto. */
  outcome: "admissible" | "forbidden";
  forbiddenReason?: string;
  requiredCapabilities: readonly LessonCorrectionCapability[];
  requirements: readonly LessonCorrectionRequirement[];
  /** Aspectos que a regra admite alterar (identificadores abertos). */
  admissibleChanges: readonly LessonChangeAspect[];
  /** A regra autoriza revelar o fechamento e as capacidades exigidas? */
  disclosesNormativeContext: boolean;
};

export type LessonCorrectionAgent = {
  agentId: string;
  capabilities: readonly LessonCorrectionCapability[];
};

export type LessonCorrectionBlockingCode =
  | "versao-inexistente"
  | "registro-em-elaboracao"
  | "versao-substituida"
  | "sem-regra-homologada"
  | "retificacao-impedida-pela-regra"
  | "capacidade-ausente";

export type LessonCorrectionBlockingReason = {
  code: LessonCorrectionBlockingCode;
  message: string;
  provenance: string;
  /** Falso quando a regra não autoriza revelar o fato que sustenta o bloqueio. */
  disclosable: boolean;
};

export type LessonCorrectionInput = {
  /** Versão que o agente tem em mão (pode estar obsoleta). */
  baseVersionId: string;
  versions: readonly LessonRecordVersion[];
  agent: LessonCorrectionAgent;
  policies: readonly LessonCorrectionPolicy[];
  officialClosing?: LessonOfficialClosingFact;
};

export type LessonCorrectionProjection = {
  canCorrect: boolean;
  admissibleChanges: readonly LessonChangeAspect[];
  requiredCapabilities: readonly LessonCorrectionCapability[];
  requiredRitual: readonly LessonCorrectionRequirement[];
  blockingReasons: readonly LessonCorrectionBlockingReason[];
  /** Subconjunto revelável: nunca expõe fato não autorizado. */
  disclosableReasons: readonly { code: string; message: string }[];
  appliedPolicy?: { id: string; version: number; label: string };
  consultedClosing?: LessonOfficialClosingFact;
};

function applicablePolicy(
  policies: readonly LessonCorrectionPolicy[],
  closing: LessonOfficialClosingFact | undefined,
): LessonCorrectionPolicy | undefined {
  const situation = closing ? "present" : "absent";
  const homologated = policies.filter((item) => item.homologated);
  return (
    homologated.find((item) => item.appliesWhenOfficialClosing === situation) ??
    homologated.find((item) => item.appliesWhenOfficialClosing === "any")
  );
}

export function resolveLessonCorrection(
  input: LessonCorrectionInput,
): LessonCorrectionProjection {
  const { baseVersionId, versions, agent, policies, officialClosing } = input;
  const blocking: LessonCorrectionBlockingReason[] = [];
  const base = versions.find((item) => item.id === baseVersionId);

  if (!base)
    blocking.push({
      code: "versao-inexistente",
      message: "Não há registro de aula concluído para corrigir.",
      provenance: `Versão informada não encontrada: ${baseVersionId}.`,
      disclosable: true,
    });

  if (base && base.status !== "Concluída")
    blocking.push({
      code: "registro-em-elaboracao",
      message: "Este registro ainda está em elaboração: o conteúdo é alterado na própria edição.",
      provenance:
        "Retificação versionada só existe depois da conclusão do registro; antes disso a edição é ordinária.",
      disclosable: true,
    });

  const current = base ? currentLessonVersion(versions, base.logicalRecordId) : undefined;
  if (base && current && current.id !== base.id)
    blocking.push({
      code: "versao-substituida",
      message:
        "Esta não é mais a versão vigente do registro. Abra a versão atual antes de corrigir.",
      provenance: `Versão vigente: ${current.id} (versão ${current.version}); base apresentada: ${base.id} (versão ${base.version}).`,
      disclosable: true,
    });

  const policy = applicablePolicy(policies, officialClosing);
  if (!policy)
    blocking.push({
      code: "sem-regra-homologada",
      message: "Não há regra homologada que discipline a correção deste registro.",
      provenance: officialClosing
        ? `Contexto normativo consultado: fechamento oficial vigente ${officialClosing.closingId} (versão ${officialClosing.closingVersion}).`
        : "Contexto normativo consultado: sem fechamento oficial vigente.",
      disclosable: true,
    });

  if (policy && policy.outcome === "forbidden")
    blocking.push({
      code: "retificacao-impedida-pela-regra",
      message:
        policy.forbiddenReason ??
        "A regra vigente não admite correção deste registro neste momento.",
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
        officialClosing
          ? ` Fechamento consultado: ${officialClosing.closingId} (versão ${officialClosing.closingVersion}).`
          : ""
      }`,
      disclosable: policy?.disclosesNormativeContext ?? false,
    });

  const canCorrect = blocking.length === 0 && Boolean(policy) && Boolean(base);

  return {
    canCorrect,
    admissibleChanges: canCorrect ? (policy?.admissibleChanges ?? []) : [],
    requiredCapabilities,
    requiredRitual: canCorrect ? (policy?.requirements ?? []) : [],
    blockingReasons: blocking,
    disclosableReasons: blocking
      .filter((item) => item.disclosable)
      .map((item) => ({ code: item.code, message: item.message })),
    ...(policy ? { appliedPolicy: { id: policy.id, version: policy.version, label: policy.label } } : {}),
    ...(officialClosing && (policy?.disclosesNormativeContext ?? false)
      ? { consultedClosing: officialClosing }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Ato de retificação
// ---------------------------------------------------------------------------

export type LessonCorrectionSubmission = {
  facts: LessonFacts;
  justification?: string;
  /** Códigos das exigências declaradas como atendidas no ato. */
  satisfiedRequirementCodes?: readonly string[];
};

export type LessonCorrectionAttempt =
  | { registered: false; issues: readonly string[] }
  | { registered: true; version: LessonRecordVersion };

export function lessonCorrectionSubmissionIssues(
  projection: LessonCorrectionProjection,
  base: LessonRecordVersion | undefined,
  submission: LessonCorrectionSubmission,
): string[] {
  if (!projection.canCorrect || !base)
    return projection.disclosableReasons.length
      ? projection.disclosableReasons.map((item) => item.message)
      : ["Esta correção não é admissível neste momento."];

  const issues: string[] = [];
  const delta = lessonFactsDelta(base.facts, submission.facts);
  if (!delta.length) issues.push("Nenhuma informação diferente do registro vigente.");

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
export function rectifyLessonRecord(input: {
  correction: LessonCorrectionInput;
  submission: LessonCorrectionSubmission;
  versionId: string;
  now: string;
}): LessonCorrectionAttempt {
  const projection = resolveLessonCorrection(input.correction);
  const base = input.correction.versions.find((item) => item.id === input.correction.baseVersionId);
  const issues = lessonCorrectionSubmissionIssues(projection, base, input.submission);
  if (issues.length || !base || !projection.appliedPolicy)
    return { registered: false, issues: issues.length ? issues : ["Correção inadmissível."] };

  const act: LessonRectificationAct = {
    actedAt: input.now,
    agentId: input.correction.agent.agentId,
    policyId: projection.appliedPolicy.id,
    policyVersion: projection.appliedPolicy.version,
    policyLabel: projection.appliedPolicy.label,
    satisfiedRequirements: projection.requiredRitual,
    changedAspects: lessonFactsDelta(base.facts, input.submission.facts),
    ...(input.submission.justification?.trim()
      ? { justification: input.submission.justification.trim() }
      : {}),
    ...(input.correction.officialClosing
      ? {
          consultedClosing: {
            closingId: input.correction.officialClosing.closingId,
            closingVersion: input.correction.officialClosing.closingVersion,
            periodLabel: input.correction.officialClosing.periodLabel,
          },
        }
      : {}),
  };

  return {
    registered: true,
    version: createSupersedingLessonVersion({
      base,
      versionId: input.versionId,
      facts: input.submission.facts,
      rectification: act,
      now: input.now,
    }),
  };
}
