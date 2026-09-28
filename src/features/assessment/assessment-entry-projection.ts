/**
 * Etapa 6D.3.2.1 — Assessment Entry Projection.
 *
 * Projetor canônico da pauta de lançamento de UM instrumento. A superfície
 * (6D.3.2.2) consome esta projeção e NÃO reinterpreta o domínio: não inspeciona
 * `EntryValue`, não olha etapa, modalidade, turma, cargo nem nome de instrumento
 * para decidir campo numérico, menu de conceitos ou parecer.
 *
 * Invariantes congelados:
 * 1. A projeção é DADO serializável: nenhuma função viaja dentro dela. A
 *    validação é externa e pura (`validateInstrumentEntryDraft`).
 * 2. `entry-enabled` x `entry-unavailable`: ausência de operação avaliativa
 *    admissível NÃO é uma quarta semântica de entrada. Sem instrumento
 *    admissível não existe pauta de lançamento.
 * 3. Cada linha tem `entryState`: "recorded" | "unrecorded" | "not-applicable".
 *    Sem registro e não aplicável não são epistemicamente iguais, e nenhum dos
 *    dois é zero nem pendência.
 * 4. `currentValue` / `currentVersionId` / `currentDisplayLabel` significam
 *    exclusivamente o último FATO OFICIAL VIGENTE. Rascunho de digitação
 *    pertence ao estado da superfície, nunca a esta projeção.
 * 5. Nada é deduzido por nome: semântica de entrada, escala e admissibilidade
 *    vêm da configuração avaliativa e da colocação acadêmica na data.
 */
import { placementOn, validateEntryValue } from "./assessment-rules";
import {
  assessmentLogicalEntryId,
  currentAssessmentEntryVersion,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import type {
  AcademicPlacement,
  AssessmentConfiguration,
  AssessmentInstrument,
  AssessmentPeriod,
  EntryValue,
  ScaleDefinition,
} from "./assessment-types";

// ---------------------------------------------------------------------------
// Semânticas de entrada (apenas as três naturezas de LANÇAMENTO)
// ---------------------------------------------------------------------------

export type NumericInputMode = {
  kind: "numerica";
  min: number;
  max: number;
  step: number;
  allowsDecimals: boolean;
  /** Rótulo humano da escala, projetado da configuração. */
  formatLabel: string;
};

export type ConceptualInputMode = {
  kind: "conceitual";
  /** Quando a sequência das opções tem significado normativo. */
  ordered: boolean;
  options: readonly { id: string; label: string; order: number }[];
};

export type DescriptiveInputMode = {
  kind: "descritiva";
  maxLength?: number;
  placeholder: string;
};

export type InstrumentInputMode = NumericInputMode | ConceptualInputMode | DescriptiveInputMode;

/** Natureza declarada pela configuração/instrumento — nunca inferida pelo motor. */
export type InstrumentEntryValueKind = InstrumentInputMode["kind"];

// ---------------------------------------------------------------------------
// Política de "não registrado"
// ---------------------------------------------------------------------------

export type MissingEntryPolicyProjection = {
  requiresReason: boolean;
  /** Motivos regulamentados. Vazio não significa "qualquer motivo". */
  admissibleReasons: readonly { id: string; label: string }[];
  allowsCustomReason: boolean;
};

/** Falha fechada: sem política declarada, exige motivo e não oferece catálogo. */
const DEFAULT_MISSING_ENTRY_POLICY: MissingEntryPolicyProjection = {
  requiresReason: true,
  admissibleReasons: [],
  allowsCustomReason: true,
};

// ---------------------------------------------------------------------------
// Linhas e balanço
// ---------------------------------------------------------------------------

/**
 * "recorded": existe fato oficial vigente.
 * "unrecorded": apto, sem fato oficial — NUNCA zero, nunca pendência.
 * "not-applicable": não elegível àquele instrumento na data de aplicação.
 */
export type InstrumentEntryState = "recorded" | "unrecorded" | "not-applicable";

export type InstrumentRosterItemProjection = {
  studentId: string;
  displayName: string;
  rollNumber?: number;
  /** Apresentação: discriminador autorizado, exibido apenas em homônimos. */
  identityDiscriminator?: string;
  entryState: InstrumentEntryState;
  admissibility: { eligible: boolean; blockerReason?: string };
  currentVersionId?: string;
  currentValue?: EntryValue;
  currentDisplayLabel?: string;
};

export type InstrumentSurfaceBalance = {
  totalStudents: number;
  recordedCount: number;
  unrecordedCount: number;
  notApplicableCount: number;
  /** Frase neutra, sem juízo de valor e sem a palavra "pendência". */
  summaryLabel: string;
};

export type InstrumentEntryContextProjection = {
  instrumentId: string;
  title: string;
  classId: string;
  classLabel?: string;
  componentLabel?: string;
  appliedOn: string;
  periodId: string;
  periodLabel?: string;
  configurationId: string;
  configurationVersion: number;
};

// ---------------------------------------------------------------------------
// Projeção (dois estados na raiz)
// ---------------------------------------------------------------------------

export type InstrumentEntryWorkspaceProjection =
  | {
      state: "entry-enabled";
      context: InstrumentEntryContextProjection;
      inputMode: InstrumentInputMode;
      missingEntryPolicy: MissingEntryPolicyProjection;
      rosterItems: readonly InstrumentRosterItemProjection[];
      surfaceBalance: InstrumentSurfaceBalance;
    }
  | {
      state: "entry-unavailable";
      context: InstrumentEntryContextProjection;
      /** Código estruturado do impedimento (apresentação é da superfície). */
      reason: string;
      /** Razões divulgáveis por extenso; ausência de dado nunca vira zero. */
      disclosableReasons: readonly string[];
    };

export const INSTRUMENT_ENTRY_UNAVAILABLE_REASONS = {
  instrumentTypeNotAdmitted: "tipo-de-instrumento-nao-admitido",
  noAdmissibleScale: "nenhuma-escala-admissivel",
  ambiguousValueKind: "natureza-de-lancamento-ambigua",
  declaredKindNotAdmitted: "natureza-declarada-nao-admissivel",
} as const;

export type InstrumentEntryRosterStudent = {
  studentId: string;
  displayName: string;
  rollNumber?: number;
  /** Identificador institucional exibível já autorizado; só aparece para desambiguar. */
  identityDiscriminator?: string;
  /** Colocações acadêmicas da trajetória (ver studentPlacements). */
  placements: readonly AcademicPlacement[];
};

export type ProjectInstrumentEntryRosterInput = {
  instrument: Pick<
    AssessmentInstrument,
    "id" | "title" | "classId" | "appliedOn" | "periodId" | "instrumentTypeId" | "configurationId"
  > & { snapshot?: AssessmentInstrument["snapshot"] };
  configuration: AssessmentConfiguration;
  period?: Pick<AssessmentPeriod, "id" | "label">;
  /** Natureza declarada quando a configuração admite mais de uma (híbrida). */
  declaredValueKind?: InstrumentEntryValueKind;
  students: readonly InstrumentEntryRosterStudent[];
  /** Versões oficiais conhecidas do resultado avaliativo. */
  versions: readonly AssessmentEntryVersion[];
  missingEntryPolicy?: MissingEntryPolicyProjection;
};

const NOT_ELIGIBLE_REASON =
  "Sem vínculo com a turma na data de aplicação deste instrumento.";

function buildContext(
  input: ProjectInstrumentEntryRosterInput,
): InstrumentEntryContextProjection {
  const { instrument, configuration, period } = input;
  return {
    instrumentId: instrument.id,
    title: instrument.title,
    classId: instrument.classId,
    appliedOn: instrument.appliedOn,
    periodId: instrument.periodId,
    configurationId: configuration.id,
    configurationVersion: configuration.version,
    ...(instrument.snapshot?.classLabel ? { classLabel: instrument.snapshot.classLabel } : {}),
    ...(instrument.snapshot?.fieldLabel ? { componentLabel: instrument.snapshot.fieldLabel } : {}),
    ...(period?.label ? { periodLabel: period.label } : {}),
  };
}

/** Escalas que a configuração efetivamente admite para lançamento. */
function admissibleScales(configuration: AssessmentConfiguration): ScaleDefinition[] {
  return configuration.scales.filter((scale) => {
    if (scale.kind === "numerica") return configuration.allowsGrades;
    return true;
  });
}

function inputModeFromScale(scale: ScaleDefinition): InstrumentInputMode {
  if (scale.kind === "numerica") {
    return {
      kind: "numerica",
      min: scale.min,
      max: scale.max,
      step: scale.step,
      allowsDecimals: !Number.isInteger(scale.step),
      formatLabel: `${scale.min} a ${scale.max}`,
    };
  }
  if (scale.kind === "conceitual") {
    return {
      kind: "conceitual",
      ordered: scale.ordered,
      options: scale.options.map((option, index) => ({
        id: option.id,
        label: option.label,
        order: index + 1,
      })),
    };
  }
  return { kind: "descritiva", placeholder: "Registro descritivo" };
}

function displayLabel(value: EntryValue, mode: InstrumentInputMode, stored?: string): string {
  if (stored) return stored;
  if (value.kind === "numerica") return String(value.value).replace(".", ",");
  if (value.kind === "conceitual") {
    const option = mode.kind === "conceitual"
      ? mode.options.find((item) => item.id === value.optionId)
      : undefined;
    return option?.label ?? value.optionId;
  }
  if (value.kind === "descritiva") return value.text;
  return "Não registrado";
}

/**
 * Projeta a pauta de um instrumento. Não calcula composição, não fecha período e
 * não decide situação acadêmica.
 */
export function projectInstrumentEntryRoster(
  input: ProjectInstrumentEntryRosterInput,
): InstrumentEntryWorkspaceProjection {
  const context = buildContext(input);
  const { configuration, instrument } = input;

  const typeAdmitted = configuration.allowedInstrumentTypeIds.includes(instrument.instrumentTypeId);
  if (!typeAdmitted) {
    return {
      state: "entry-unavailable",
      context,
      reason: INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.instrumentTypeNotAdmitted,
      disclosableReasons: [
        configuration.allowedInstrumentTypeIds.length === 0
          ? "Este contexto não admite instrumentos avaliativos; o acompanhamento ocorre por registros pedagógicos."
          : "O tipo de instrumento não consta entre os admitidos pela configuração avaliativa aplicável.",
      ],
    };
  }

  const scales = admissibleScales(configuration);
  if (scales.length === 0) {
    return {
      state: "entry-unavailable",
      context,
      reason: INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.noAdmissibleScale,
      disclosableReasons: [
        "A configuração avaliativa aplicável não admite nenhuma escala de lançamento.",
      ],
    };
  }

  let scale: ScaleDefinition | undefined;
  if (input.declaredValueKind) {
    scale = scales.find((item) => item.kind === input.declaredValueKind);
    if (!scale) {
      return {
        state: "entry-unavailable",
        context,
        reason: INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.declaredKindNotAdmitted,
        disclosableReasons: [
          "A natureza de lançamento declarada para este instrumento não é admitida pela configuração aplicável.",
        ],
      };
    }
  } else if (scales.length === 1) {
    scale = scales[0];
  } else {
    return {
      state: "entry-unavailable",
      context,
      reason: INSTRUMENT_ENTRY_UNAVAILABLE_REASONS.ambiguousValueKind,
      disclosableReasons: [
        "Mais de uma natureza de lançamento é admissível e nenhuma foi declarada para este instrumento; decisão normativa necessária.",
      ],
    };
  }

  const inputMode = inputModeFromScale(scale!);
  const missingEntryPolicy = input.missingEntryPolicy ?? DEFAULT_MISSING_ENTRY_POLICY;

  const rosterItems: InstrumentRosterItemProjection[] = input.students.map((student) => {
    const placement = placementOn(
      [...student.placements],
      instrument.classId,
      instrument.appliedOn,
    );
    const base = {
      studentId: student.studentId,
      displayName: student.displayName,
      ...(student.rollNumber === undefined ? {} : { rollNumber: student.rollNumber }),
      ...(student.identityDiscriminator ? { identityDiscriminator: student.identityDiscriminator } : {}),
    };
    if (!placement) {
      return {
        ...base,
        entryState: "not-applicable" as const,
        admissibility: { eligible: false, blockerReason: NOT_ELIGIBLE_REASON },
      };
    }
    const official = currentAssessmentEntryVersion(
      input.versions,
      assessmentLogicalEntryId(instrument.id, student.studentId),
    );
    // Rascunho não é fato oficial: só versão registrada alimenta `currentValue`.
    if (!official || official.status !== "registrado") {
      return { ...base, entryState: "unrecorded" as const, admissibility: { eligible: true } };
    }
    return {
      ...base,
      entryState: "recorded" as const,
      admissibility: { eligible: true },
      currentVersionId: official.id,
      currentValue: official.value,
      currentDisplayLabel: displayLabel(official.value, inputMode, official.valueLabel),
    };
  });

  const recordedCount = rosterItems.filter((item) => item.entryState === "recorded").length;
  const unrecordedCount = rosterItems.filter((item) => item.entryState === "unrecorded").length;
  const notApplicableCount = rosterItems.filter(
    (item) => item.entryState === "not-applicable",
  ).length;

  const parts = [
    `${recordedCount} ${recordedCount === 1 ? "registrado" : "registrados"}`,
    `${unrecordedCount} sem registro`,
  ];
  if (notApplicableCount > 0)
    parts.push(`${notApplicableCount} ${notApplicableCount === 1 ? "não aplicável" : "não aplicáveis"}`);

  return {
    state: "entry-enabled",
    context,
    inputMode,
    missingEntryPolicy,
    rosterItems,
    surfaceBalance: {
      totalStudents: rosterItems.length,
      recordedCount,
      unrecordedCount,
      notApplicableCount,
      summaryLabel: parts.join(" · "),
    },
  };
}

// ---------------------------------------------------------------------------
// Validador puro e externo
// ---------------------------------------------------------------------------

export type InstrumentEntryDraftValidation =
  | { ok: true; value: EntryValue }
  | { ok: false; error: string };

/**
 * Determinístico: mesma semântica projetada + mesma entrada bruta ⇒ mesmo
 * resultado. Não conhece estudante, turma, etapa nem cargo.
 */
export function validateInstrumentEntryDraft(
  inputMode: InstrumentInputMode,
  rawInput: string,
): InstrumentEntryDraftValidation {
  const raw = rawInput.trim();
  if (inputMode.kind === "numerica") {
    if (!raw) return { ok: false, error: "Informe um valor da escala." };
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) return { ok: false, error: "Valor não numérico." };
    if (parsed < inputMode.min || parsed > inputMode.max)
      return { ok: false, error: `Valor fora da escala (${inputMode.formatLabel}).` };
    if (!inputMode.allowsDecimals && !Number.isInteger(parsed))
      return { ok: false, error: "Esta escala não admite casas decimais." };
    return { ok: true, value: { kind: "numerica", value: parsed } };
  }
  if (inputMode.kind === "conceitual") {
    const option = inputMode.options.find((item) => item.id === raw);
    if (!option) return { ok: false, error: "Conceito inexistente nesta escala." };
    return { ok: true, value: { kind: "conceitual", optionId: option.id } };
  }
  if (!raw) return { ok: false, error: "Registro descritivo vazio." };
  if (inputMode.maxLength && raw.length > inputMode.maxLength)
    return { ok: false, error: `Limite de ${inputMode.maxLength} caracteres excedido.` };
  return { ok: true, value: { kind: "descritiva", text: raw } };
}

/**
 * "Não registrado" é ação neutra, nunca atalho universal de ausência. O motivo
 * obedece à política projetada; ausência de motivo não vira zero nem presunção.
 */
export function validateMissingEntryDraft(
  policy: MissingEntryPolicyProjection,
  input: { reasonId?: string; customReason?: string },
): InstrumentEntryDraftValidation {
  const catalogued = policy.admissibleReasons.find((item) => item.id === input.reasonId);
  if (input.reasonId && !catalogued)
    return { ok: false, error: "Motivo não previsto pela política aplicável." };
  const custom = input.customReason?.trim() ?? "";
  if (!catalogued && custom && !policy.allowsCustomReason)
    return { ok: false, error: "Esta política não admite motivo livre." };
  const reason = catalogued?.label ?? custom;
  if (!reason && policy.requiresReason) return { ok: false, error: "Informe o motivo." };
  return { ok: true, value: { kind: "nao-registrado", reason } };
}

/** Confirmação canônica da escala: nunca reimplementa `validateEntryValue`. */
export function scaleIssuesForDraft(
  configuration: AssessmentConfiguration,
  value: EntryValue,
): string[] {
  return validateEntryValue(configuration, value);
}
