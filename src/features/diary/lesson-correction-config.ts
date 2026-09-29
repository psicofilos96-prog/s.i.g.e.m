/**
 * Etapa 6D.2.3 — configuração demonstrativa e repositório de versões do
 * registro de aula.
 *
 * Nada aqui é norma de código: perfis, capacidades, regras homologadas e
 * fechamentos oficiais são DADOS. O motor (`lesson-correction.ts`) continua
 * agnóstico a cargo, rito e prazo.
 *
 * Sem persistência real: as versões existem na memória desta aba, como no
 * restante da demonstração do Diário.
 */
import { useSyncExternalStore } from "react";
import {
  lessonCorrectionSubmissionIssues,
  rectifyLessonRecord,
  resolveLessonCorrection,
  type LessonCorrectionAttempt,
  type LessonCorrectionPolicy,
  type LessonCorrectionProjection,
  type LessonCorrectionSubmission,
  type LessonOfficialClosingFact,
} from "./lesson-correction";
import {
  createFirstLessonVersion,
  currentLessonVersion,
  lessonVersionChain,
  LESSON_CHANGE_ASPECTS,
  type LessonFacts,
  type LessonRecordVersion,
} from "./lesson-versions";
import { emptyLessonInput, type LessonEntry } from "./lesson-records";

// ---------------------------------------------------------------------- Perfis

export type LessonCorrectionProfile = {
  id: string;
  label: string;
  name: string;
  capabilities: readonly string[];
};

export const LESSON_CORRECTION_PROFILES: readonly LessonCorrectionProfile[] = [
  {
    id: "perfil-docente",
    label: "Professor(a) da turma",
    name: "Professor(a) da turma (demonstração)",
    capabilities: [],
  },
  {
    id: "perfil-secretaria-escolar",
    label: "Secretaria escolar",
    name: "Secretaria escolar (demonstração)",
    capabilities: ["executar-retificacao-de-registro-de-aula"],
  },
];

export function lessonCorrectionProfile(profileId: string): LessonCorrectionProfile {
  return (
    LESSON_CORRECTION_PROFILES.find((item) => item.id === profileId) ??
    LESSON_CORRECTION_PROFILES[0]!
  );
}

export function lessonCorrectionAgent(profileId: string) {
  const profile = lessonCorrectionProfile(profileId);
  return { agentId: profile.id, capabilities: profile.capabilities };
}

// ----------------------------------------------------------- Regras homologadas

export const LESSON_CORRECTION_POLICIES: readonly LessonCorrectionPolicy[] = [
  {
    id: "pol-correcao-aula-sem-fechamento",
    version: 1,
    label: "Correção de registro de aula sem fechamento oficial vigente",
    homologated: true,
    appliesWhenOfficialClosing: "absent",
    outcome: "admissible",
    requiredCapabilities: [],
    requirements: [],
    admissibleChanges: [
      LESSON_CHANGE_ASPECTS.content,
      LESSON_CHANGE_ASPECTS.contentMode,
      LESSON_CHANGE_ASPECTS.planningRelation,
      LESSON_CHANGE_ASPECTS.complements,
    ],
    disclosesNormativeContext: true,
  },
  {
    id: "pol-correcao-aula-com-fechamento",
    version: 2,
    label: "Correção de registro de aula em período com fechamento oficial",
    homologated: true,
    appliesWhenOfficialClosing: "present",
    outcome: "admissible",
    requiredCapabilities: ["executar-retificacao-de-registro-de-aula"],
    requirements: [
      {
        code: "justificativa",
        label: "Justificativa da correção",
        provenance:
          "Exigida pela regra homologada para correções em período com fechamento oficial vigente.",
      },
    ],
    admissibleChanges: [LESSON_CHANGE_ASPECTS.content, LESSON_CHANGE_ASPECTS.complements],
    disclosesNormativeContext: true,
  },
];

// ------------------------------------------------------- Fechamentos oficiais

type DemonstrationClosing = LessonOfficialClosingFact & {
  periodStart: string;
  periodEnd: string;
};

export const LESSON_DEMONSTRATION_CLOSINGS: readonly DemonstrationClosing[] = [
  {
    closingId: "fec-demonstrativo-2025-3",
    closingVersion: 1,
    periodLabel: "3º bimestre de 2025",
    periodStart: "2025-08-01",
    periodEnd: "2025-12-20",
  },
];

/** Fechamento oficial vigente que cobre a data da aula, quando houver. */
export function lessonOfficialClosingFor(date: string): LessonOfficialClosingFact | undefined {
  const match = LESSON_DEMONSTRATION_CLOSINGS.find(
    (item) => date >= item.periodStart && date <= item.periodEnd,
  );
  if (!match) return undefined;
  return {
    closingId: match.closingId,
    closingVersion: match.closingVersion,
    periodLabel: match.periodLabel,
  };
}

// --------------------------------------------------- Fatos a partir do registro

/** Traduz o registro exibido em fatos versionáveis (mesmo contrato do preenchimento). */
export function lessonEntryFacts(entry: LessonEntry): LessonFacts {
  return {
    ...emptyLessonInput(entry.professionalId, entry.date, entry.assignmentId),
    blockIds: [...entry.blockIds],
    quantity: entry.quantity,
    contentMode: entry.contentMode,
    contents: { ...entry.contents },
    planningRelation: entry.planningRelation,
    objectives: entry.optional.objectives ?? "",
    skills: entry.optional.skills ?? "",
    strategies: entry.optional.strategies ?? "",
    observations: entry.optional.observations ?? "",
    groupings: entry.optional.groupings ?? "",
    ...(entry.extraordinary
      ? {
          extraordinary: true,
          extraordinaryStart: entry.extraordinary.start,
          extraordinaryEnd: entry.extraordinary.end,
          justification: entry.extraordinary.justification,
        }
      : {}),
  };
}

// ------------------------------------------------- Repositório de versões

type State = { versions: LessonRecordVersion[] };

let state: State = { versions: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function seedVersion(logicalRecordId: string, facts: LessonFacts, at: string) {
  return createFirstLessonVersion({
    logicalRecordId,
    versionId: `${logicalRecordId}-v1`,
    facts,
    status: "Concluída",
    now: at,
  });
}

/** Com sessão: agente = capacidades efetivas; regras = homologadas no banco. */
let cloudCorrection: { agent: LessonCorrectionAgent; policies: readonly LessonCorrectionPolicy[] } | null = null;
export function setLessonCorrectionCloud(next: typeof cloudCorrection) {
  cloudCorrection = next;
  emit();
}
export function lessonCorrectionCloud() {
  return cloudCorrection;
}

export const lessonVersionStore = {
  /** Espelho somente leitura do banco (modo com sessão). */
  hydrate(versions: LessonRecordVersion[]) {
    state = { versions };
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot() {
    return state.versions;
  },
  reset() {
    state = { versions: [] };
    emit();
  },
  /** Cadeia conhecida; quando nada foi retificado, projeta a primeira versão. */
  chain(logicalRecordId: string, facts: LessonFacts, at: string): LessonRecordVersion[] {
    const stored = lessonVersionChain(state.versions, logicalRecordId);
    return stored.length ? stored : [seedVersion(logicalRecordId, facts, at)];
  },
  /** Registra a correção como nova versão encadeada. Falha fechada. */
  rectify(input: {
    logicalRecordId: string;
    seedFacts: LessonFacts;
    seedAt: string;
    agentProfileId: string;
    submission: LessonCorrectionSubmission;
    officialClosing?: LessonOfficialClosingFact;
    now?: string;
  }): LessonCorrectionAttempt {
    const versions = this.chain(input.logicalRecordId, input.seedFacts, input.seedAt);
    const base = currentLessonVersion(versions, input.logicalRecordId);
    if (!base) return { registered: false, issues: ["Não há versão vigente para corrigir."] };
    const attempt = rectifyLessonRecord({
      correction: {
        baseVersionId: base.id,
        versions,
        agent: lessonCorrectionAgent(input.agentProfileId),
        policies: LESSON_CORRECTION_POLICIES,
        ...(input.officialClosing ? { officialClosing: input.officialClosing } : {}),
      },
      submission: input.submission,
      versionId: `${input.logicalRecordId}-v${base.version + 1}`,
      now: input.now ?? new Date().toISOString(),
    });
    if (!attempt.registered) return attempt;
    const stored = lessonVersionChain(state.versions, input.logicalRecordId);
    state = {
      versions: [
        ...state.versions,
        ...(stored.length ? [] : versions),
        attempt.version,
      ],
    };
    emit();
    return attempt;
  },
};

/** Assina a loja: as projeções são derivadas fora do hook. */
export function useLessonVersions(): readonly LessonRecordVersion[] {
  return useSyncExternalStore(
    lessonVersionStore.subscribe,
    lessonVersionStore.snapshot,
    () => state.versions,
  );
}

export function useLessonVersionChain(
  logicalRecordId: string,
  facts: LessonFacts,
  at: string,
): LessonRecordVersion[] {
  useLessonVersions();
  return lessonVersionStore.chain(logicalRecordId, facts, at);
}

/** Projeção da admissibilidade a partir da versão vigente da cadeia. */
export function projectLessonCorrection(input: {
  versions: readonly LessonRecordVersion[];
  logicalRecordId: string;
  agentProfileId: string;
  officialClosing?: LessonOfficialClosingFact;
}): { projection: LessonCorrectionProjection; base?: LessonRecordVersion } {
  const base = currentLessonVersion(input.versions, input.logicalRecordId);
  const projection = resolveLessonCorrection({
    baseVersionId: base?.id ?? "",
    versions: input.versions,
    agent: cloudCorrection?.agent ?? lessonCorrectionAgent(input.agentProfileId),
    policies: cloudCorrection?.policies ?? LESSON_CORRECTION_POLICIES,
    ...(input.officialClosing ? { officialClosing: input.officialClosing } : {}),
  });
  return { projection, ...(base ? { base } : {}) };
}

export { lessonCorrectionSubmissionIssues };
