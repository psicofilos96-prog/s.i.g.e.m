/**
 * Etapa 6D.3.3.1 — Assessment Period Projection.
 *
 * Projeção canônica, pura e serializável do período avaliativo de uma turma em
 * um componente. É a ÚNICA fonte que a futura Mesa Avaliativa do Período
 * (6D.3.3.2) consumirá. Não é motor e não é segunda verdade:
 *
 * 1. Estado de cada célula vem de `projectInstrumentEntryRoster` (6D.3.2.1);
 *    nada é reinterpretado aqui.
 * 2. Composição vem EXCLUSIVAMENTE de `compositionBlocks` + `composePeriod`;
 *    nenhuma média, soma ou arredondamento é feita neste módulo.
 * 3. Só versões oficiais vigentes (`registrado`) entram; rascunho nunca.
 * 4. Sem registro ≠ `nao-registrado` explícito ≠ não aplicável; nenhum vira zero.
 * 5. Ações são projetadas de definições declaradas + capacidades do agente;
 *    capacidade faltante falha fechada, com motivo por extenso.
 * 6. Valores protegidos são suprimidos NA FRONTEIRA da projeção quando a
 *    capacidade de leitura declarada não foi concedida.
 * 7. Fechamento, recuperação, Conselho, situação e CIECE permanecem fora: não
 *    há taxa, ranking, risco nem indicador.
 * 8. Nada é persistido: agregados são contagens de objetos concretos,
 *    recalculadas a cada projeção.
 */
import { composePeriod, compositionBlocks } from "./assessment-composition";
import { compositionInputFromVersion, officialCurrentVersionsForStudent } from "./assessment-canonical-inputs";
import {
  projectCompositionExplanation,
  type CompositionExplanationProjection,
} from "./composition-explanation-projection";
import type {
  CompositionEntryInput,
  CompositionModel,
  MissingRequirement,
  NumericStage,
} from "./assessment-composition-types";
import {
  projectInstrumentEntryRoster,
  type InstrumentEntryRosterStudent,
  type InstrumentEntryWorkspaceProjection,
  type InstrumentInputMode,
  type MissingEntryPolicyProjection,
} from "./assessment-entry-projection";
import {
  assessmentLogicalEntryId,
  currentAssessmentEntryVersion,
  type AssessmentCapability,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import type {
  AssessmentConfiguration,
  AssessmentInstrument,
  AssessmentPeriod,
  EntryValue,
} from "./assessment-types";

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/** Ação declarada por configuração; o projetor não conhece nenhum verbo. */
export type PeriodActionDefinition = {
  actionId: string;
  label: string;
  /** Sobre o que a ação incide. */
  target: "instrument" | "result";
  requiredCapabilities: readonly AssessmentCapability[];
  /** Estados de célula em que a ação é admissível (apenas para `result`). */
  admissibleCellStates?: readonly PeriodCellState[];
};

export type ProjectAssessmentPeriodInput = {
  context: {
    classId: string;
    classLabel?: string;
    componentLabel?: string;
    /** Componente curricular opcional (matriz) para filtrar instrumentos. */
    componentId?: string;
  };
  period: Pick<AssessmentPeriod, "id" | "label"> | undefined;
  configuration: AssessmentConfiguration | undefined;
  compositionModel: CompositionModel | undefined;
  instruments: readonly AssessmentInstrument[];
  students: readonly InstrumentEntryRosterStudent[];
  versions: readonly AssessmentEntryVersion[];
  missingEntryPolicy?: MissingEntryPolicyProjection;
  agent: { agentId: string; capabilities: readonly AssessmentCapability[] };
  actionDefinitions: readonly PeriodActionDefinition[];
  /** Capacidade exigida para ver valores; ausente ⇒ nada é exigido. */
  valueReadCapability?: AssessmentCapability;
  /** Referência versionada do fechamento, quando existir; nunca interpretada. */
  closingReference?: { closingId: string; closingVersion: number };
};

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

/**
 * "recorded": fato oficial vigente com valor.
 * "explicitly-unrecorded": fato oficial vigente `nao-registrado` (com motivo).
 * "unrecorded": apto, sem fato oficial.
 * "not-applicable": sem vínculo na data de aplicação.
 * "instrument-unavailable": o instrumento não admite lançamento.
 */
export type PeriodCellState =
  | "recorded"
  | "explicitly-unrecorded"
  | "unrecorded"
  | "not-applicable"
  | "instrument-unavailable";

export type PeriodProjectedAction =
  | { actionId: string; label: string; available: true }
  | { actionId: string; label: string; available: false; blockedReasons: readonly string[] };

export type PeriodCellProjection = {
  instrumentId: string;
  state: PeriodCellState;
  valueDisclosure: "disclosed" | "suppressed" | "none";
  currentVersionId?: string;
  currentVersionNumber?: number;
  /**
   * Versão que a vigente substituiu, quando houver — DERIVADO da cadeia
   * (`supersedesVersionId`), nunca um booleano persistido. Ausente = v1 vigente.
   */
  currentVersionSupersedesVersionId?: string;
  currentValue?: EntryValue;
  currentDisplayLabel?: string;
  /** Motivo do `nao-registrado` explícito (só quando divulgado). */
  unrecordedReason?: string;
  actions: readonly PeriodProjectedAction[];
};

export type PeriodInstrumentProjection = {
  instrumentId: string;
  title: string;
  appliedOn: string;
  instrumentTypeId: string;
  entryState: InstrumentEntryWorkspaceProjection["state"];
  inputKind?: InstrumentInputMode["kind"];
  unavailableReasons?: readonly string[];
  counts: {
    recorded: number;
    explicitlyUnrecorded: number;
    unrecorded: number;
    notApplicable: number;
  };
  actions: readonly PeriodProjectedAction[];
};

export type PeriodStudentComposition =
  | {
      kind: "blocked";
      reasons: readonly string[];
      pendingRuleIds: readonly string[];
    }
  | {
      kind: "suppressed";
    }
  | {
      kind: "composed";
      compositionKind: "acumulado-parcial" | "fechamento-do-periodo";
      complete: boolean;
      stage: NumericStage | null;
      categories: readonly {
        categoryId: string;
        label: string;
        stage: NumericStage | null;
        usedEntryIds: readonly string[];
        missing: readonly MissingRequirement[];
      }[];
      missing: readonly MissingRequirement[];
      provenance: {
        modelId: string;
        modelVersion: number;
        configurationId: string;
        configurationVersion: number;
        usedVersionIds: readonly string[];
      };
      /** A projeção nunca produz resultado oficial; isso é do fechamento. */
      official: false;
    };

export type PeriodStudentProjection = {
  studentId: string;
  displayName: string;
  rollNumber?: number;
  /** Exibido apenas quando há homonímia no recorte. */
  identityDiscriminator?: string;
  cells: readonly PeriodCellProjection[];
  composition: PeriodStudentComposition;
  /**
   * 6D.3.3.3c — explicação homologada (6D.3.3.3b), apenas repassada.
   * A Mesa não recalcula nada: consome este contrato para "Como este
   * resultado foi formado?".
   */
  explanation: CompositionExplanationProjection;
};

export type AssessmentPeriodContextProjection = {
  classId: string;
  classLabel?: string;
  componentLabel?: string;
  periodId?: string;
  periodLabel?: string;
  configurationId?: string;
  configurationVersion?: number;
  closingReference?: { closingId: string; closingVersion: number };
};

export const ASSESSMENT_PERIOD_UNAVAILABLE_REASONS = {
  periodMissing: "periodo-nao-informado",
  configurationMissing: "configuracao-ausente",
  noInstruments: "nenhum-instrumento-no-periodo",
} as const;

export type AssessmentPeriodProjection =
  | {
      state: "period-available";
      schemaVersion: 1;
      context: AssessmentPeriodContextProjection;
      instruments: readonly PeriodInstrumentProjection[];
      students: readonly PeriodStudentProjection[];
      /** Contagem de objetos concretos; nunca taxa. */
      balance: {
        instruments: number;
        students: number;
        cellsRecorded: number;
        cellsExplicitlyUnrecorded: number;
        cellsUnrecorded: number;
        cellsNotApplicable: number;
      };
      disclosures: readonly string[];
    }
  | {
      state: "period-unavailable";
      schemaVersion: 1;
      context: AssessmentPeriodContextProjection;
      reason: string;
      disclosableReasons: readonly string[];
    };

// ---------------------------------------------------------------------------
// Projetor
// ---------------------------------------------------------------------------

const VALUE_SUPPRESSED_NOTE =
  "Os valores deste período não são exibidos: a capacidade de leitura exigida não foi concedida.";

function projectAction(
  definition: PeriodActionDefinition,
  capabilities: readonly AssessmentCapability[],
): PeriodProjectedAction {
  const missing = definition.requiredCapabilities.filter((c) => !capabilities.includes(c));
  if (missing.length === 0)
    return { actionId: definition.actionId, label: definition.label, available: true };
  return {
    actionId: definition.actionId,
    label: definition.label,
    available: false,
    blockedReasons: ["Esta ação exige autorização institucional que não foi concedida."],
  };
}

function homonymDiscriminators(
  students: readonly InstrumentEntryRosterStudent[],
): Set<string> {
  const byName = new Map<string, number>();
  for (const s of students) {
    const key = s.displayName.trim().toLocaleLowerCase("pt-BR");
    byName.set(key, (byName.get(key) ?? 0) + 1);
  }
  return new Set(
    students
      .filter((s) => (byName.get(s.displayName.trim().toLocaleLowerCase("pt-BR")) ?? 0) > 1)
      .map((s) => s.studentId),
  );
}

export function projectAssessmentPeriod(
  input: ProjectAssessmentPeriodInput,
): AssessmentPeriodProjection {
  const { configuration, period } = input;
  const context: AssessmentPeriodContextProjection = {
    classId: input.context.classId,
    ...(input.context.classLabel ? { classLabel: input.context.classLabel } : {}),
    ...(input.context.componentLabel ? { componentLabel: input.context.componentLabel } : {}),
    ...(period ? { periodId: period.id } : {}),
    ...(period?.label ? { periodLabel: period.label } : {}),
    ...(configuration
      ? { configurationId: configuration.id, configurationVersion: configuration.version }
      : {}),
    ...(input.closingReference ? { closingReference: { ...input.closingReference } } : {}),
  };

  if (!period)
    return {
      state: "period-unavailable",
      schemaVersion: 1,
      context,
      reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.periodMissing,
      disclosableReasons: ["Nenhum período avaliativo foi informado para este contexto."],
    };
  if (!configuration)
    return {
      state: "period-unavailable",
      schemaVersion: 1,
      context,
      reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.configurationMissing,
      disclosableReasons: ["Não há configuração avaliativa aplicável a este contexto."],
    };

  const instruments = input.instruments
    .filter(
      (i) =>
        i.classId === input.context.classId &&
        i.periodId === period.id &&
        i.configurationId === configuration.id &&
        (!input.context.componentId ||
          (i.curriculumRef?.kind === "matriz" &&
            i.curriculumRef.componentId === input.context.componentId)),
    )
    .slice()
    .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn) || a.id.localeCompare(b.id));

  if (instruments.length === 0)
    return {
      state: "period-unavailable",
      schemaVersion: 1,
      context,
      reason: ASSESSMENT_PERIOD_UNAVAILABLE_REASONS.noInstruments,
      disclosableReasons: ["Ainda não há instrumentos avaliativos neste período."],
    };

  const capabilities = input.agent.capabilities;
  const valuesDisclosed =
    !input.valueReadCapability || capabilities.includes(input.valueReadCapability);
  const instrumentActionDefs = input.actionDefinitions.filter((d) => d.target === "instrument");
  const resultActionDefs = input.actionDefinitions.filter((d) => d.target === "result");
  const homonyms = homonymDiscriminators(input.students);

  // Pauta canônica por instrumento (reuso integral da 6D.3.2.1).
  const rosters = instruments.map((instrument) =>
    projectInstrumentEntryRoster({
      instrument,
      configuration,
      period,
      students: input.students,
      versions: input.versions,
      ...(input.missingEntryPolicy ? { missingEntryPolicy: input.missingEntryPolicy } : {}),
    }),
  );

  const cellsByStudent = new Map<string, PeriodCellProjection[]>();
  const instrumentProjections: PeriodInstrumentProjection[] = instruments.map((instrument, idx) => {
    const roster = rosters[idx]!;
    const counts = { recorded: 0, explicitlyUnrecorded: 0, unrecorded: 0, notApplicable: 0 };
    for (const student of input.students) {
      let cell: PeriodCellProjection;
      if (roster.state === "entry-unavailable") {
        cell = {
          instrumentId: instrument.id,
          state: "instrument-unavailable",
          valueDisclosure: "none",
          actions: [],
        };
      } else {
        const item = roster.rosterItems.find((r) => r.studentId === student.studentId)!;
        let state: PeriodCellState =
          item.entryState === "recorded"
            ? item.currentValue?.kind === "nao-registrado"
              ? "explicitly-unrecorded"
              : "recorded"
            : item.entryState;
        const hasValue = state === "recorded" || state === "explicitly-unrecorded";
        const official = hasValue
          ? currentAssessmentEntryVersion(
              input.versions,
              assessmentLogicalEntryId(instrument.id, student.studentId),
            )
          : undefined;
        if (state === "recorded") counts.recorded++;
        else if (state === "explicitly-unrecorded") counts.explicitlyUnrecorded++;
        else if (state === "unrecorded") counts.unrecorded++;
        else counts.notApplicable++;
        const disclose = hasValue && valuesDisclosed;
        cell = {
          instrumentId: instrument.id,
          state,
          valueDisclosure: !hasValue ? "none" : disclose ? "disclosed" : "suppressed",
          ...(hasValue && item.currentVersionId ? { currentVersionId: item.currentVersionId } : {}),
          ...(official ? { currentVersionNumber: official.version } : {}),
          ...(official?.supersedesVersionId
            ? { currentVersionSupersedesVersionId: official.supersedesVersionId }
            : {}),
          ...(disclose && item.currentValue ? { currentValue: item.currentValue } : {}),
          ...(disclose && item.currentDisplayLabel && state === "recorded"
            ? { currentDisplayLabel: item.currentDisplayLabel }
            : {}),
          ...(disclose && item.currentValue?.kind === "nao-registrado"
            ? { unrecordedReason: item.currentValue.reason }
            : {}),
          actions: resultActionDefs
            .filter((d) => !d.admissibleCellStates || d.admissibleCellStates.includes(state))
            .map((d) => projectAction(d, capabilities)),
        };
        state = cell.state;
      }
      const list = cellsByStudent.get(student.studentId) ?? [];
      list.push(cell);
      cellsByStudent.set(student.studentId, list);
    }
    return {
      instrumentId: instrument.id,
      title: instrument.title,
      appliedOn: instrument.appliedOn,
      instrumentTypeId: instrument.instrumentTypeId,
      entryState: roster.state,
      ...(roster.state === "entry-enabled"
        ? { inputKind: roster.inputMode.kind }
        : { unavailableReasons: [...roster.disclosableReasons] }),
      counts,
      actions:
        roster.state === "entry-enabled"
          ? instrumentActionDefs.map((d) => projectAction(d, capabilities))
          : [],
    };
  });

  const model = input.compositionModel;
  const students: PeriodStudentProjection[] = input.students.map((student) => {
    // 6D.3.4.1 — tradução canônica compartilhada com o Fechamento do período.
    const entries: CompositionEntryInput[] = officialCurrentVersionsForStudent({
      studentId: student.studentId,
      instruments,
      versions: input.versions,
    }).map((use) => compositionInputFromVersion(use, configuration));

    let composition: PeriodStudentComposition;
    let explanation: CompositionExplanationProjection;
    const notApplicableInstrumentIds = (cellsByStudent.get(student.studentId) ?? [])
      .filter((c) => c.state === "not-applicable")
      .map((c) => c.instrumentId);
    const explanationBase = {
      model,
      configuration: { id: configuration.id, version: configuration.version },
      instruments,
      versions: input.versions,
      notApplicableInstrumentIds,
      valuesDisclosed,
    };
    const block = compositionBlocks({ configuration, model, entries });
    if (block) {
      composition = {
        kind: "blocked",
        reasons: [...block.reasons],
        pendingRuleIds: [...block.pendingRuleIds],
      };
      explanation = projectCompositionExplanation({
        ...explanationBase,
        source: { kind: "blocked", reasons: block.reasons, pendingRuleIds: block.pendingRuleIds },
      });
    } else if (!valuesDisclosed) {
      composition = { kind: "suppressed" };
      explanation = { state: "protected", explanation: "values-not-disclosed" };
    } else {
      const composed = composePeriod({ model: model!, period, entries, official: false });
      explanation = projectCompositionExplanation({
        ...explanationBase,
        source: { kind: "composed", composition: composed },
      });
      composition = {
        kind: "composed",
        compositionKind: composed.kind,
        complete: composed.complete,
        stage: composed.stage,
        categories: composed.categories.map((c) => ({
          categoryId: c.categoryId,
          label: c.label,
          stage: c.stage,
          usedEntryIds: [...c.usedEntryIds],
          missing: [...c.missing],
        })),
        missing: [...composed.missing],
        provenance: {
          modelId: model!.id,
          modelVersion: model!.version,
          configurationId: configuration.id,
          configurationVersion: configuration.version,
          usedVersionIds: entries.map((e) => e.entryId),
        },
        official: false,
      };
    }

    return {
      studentId: student.studentId,
      displayName: student.displayName,
      ...(student.rollNumber === undefined ? {} : { rollNumber: student.rollNumber }),
      ...(homonyms.has(student.studentId) && student.identityDiscriminator
        ? { identityDiscriminator: student.identityDiscriminator }
        : {}),
      cells: cellsByStudent.get(student.studentId) ?? [],
      composition,
      explanation,
    };
  });

  const sum = (k: keyof PeriodInstrumentProjection["counts"]) =>
    instrumentProjections.reduce((s, i) => s + i.counts[k], 0);

  return {
    state: "period-available",
    schemaVersion: 1,
    context,
    instruments: instrumentProjections,
    students,
    balance: {
      instruments: instrumentProjections.length,
      students: students.length,
      cellsRecorded: sum("recorded"),
      cellsExplicitlyUnrecorded: sum("explicitlyUnrecorded"),
      cellsUnrecorded: sum("unrecorded"),
      cellsNotApplicable: sum("notApplicable"),
    },
    disclosures: valuesDisclosed ? [] : [VALUE_SUPPRESSED_NOTE],
  };
}
