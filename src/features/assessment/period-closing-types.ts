/**
 * Etapa 12G — Fechamento do Período Avaliativo (tipos).
 *
 * Quatro momentos DISTINTOS, que podem existir separadamente:
 *   1. entrega docente   — o professor declara seus registros concluídos;
 *   2. conferência       — a escola confere institucionalmente a pauta;
 *   3. fechamento oficial— ato institucional versionado e imutável;
 *   4. retificação/reabertura — exceções formais, auditadas e versionadas.
 *
 * Invariantes desta etapa:
 * - O fechamento produz "RESULTADO CONSOLIDADO OFICIAL DO PERÍODO". Nunca
 *   situação acadêmica final, resultado anual, recuperação final, frequência
 *   oficial ou deliberação de Conselho — todos pertencem a etapas posteriores.
 * - Nenhuma segunda fonte editável: os lançamentos (12C) continuam sendo a
 *   única fonte dos fatos. O fechamento materializa apenas o que o motor (12E)
 *   derivou, com as referências necessárias para auditar e reconstruir.
 * - Versão vigente é DERIVADA da cadeia de versões; não existe campo editável
 *   `isCurrent`.
 * - Competência por CAPACIDADE, nunca por cargo fixado em código.
 */
import type { CurriculumRef } from "./assessment-types";
import type { PeriodCoverage } from "./assessment-rules";

// ------------------------------------------------------------------ Estados

/**
 * Estados suficientemente expressivos para não confundir entrega, conferência
 * e fechamento oficial.
 */
export type ClosingStage =
  | "em-andamento"
  | "entregue"
  | "em-conferencia"
  | "devolvida-para-ajustes"
  | "fechado"
  | "reaberto";

export const CLOSING_STAGE_LABEL: Record<ClosingStage, string> = {
  "em-andamento": "Período em andamento",
  entregue: "Registros entregues pelo professor",
  "em-conferencia": "Em conferência institucional",
  "devolvida-para-ajustes": "Devolvida para ajustes",
  fechado: "Fechado oficialmente",
  reaberto: "Reaberto por exceção formal",
};

export const CLOSING_STAGE_TONE: Record<
  ClosingStage,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  "em-andamento": "neutral",
  entregue: "info",
  "em-conferencia": "info",
  "devolvida-para-ajustes": "warning",
  fechado: "success",
  reaberto: "warning",
};

// ------------------------------------------------------------- Capacidades

/**
 * Capacidades atômicas do ciclo. Nenhuma está amarrada a cargo: a governança
 * futura atribuirá cada uma ao perfil institucional apropriado.
 */
export type ClosingCapability =
  | "entregar-pauta-docente"
  | "realizar-conferencia-escolar"
  | "devolver-pauta-com-apontamentos"
  | "homologar-fechamento-oficial"
  | "autorizar-retificacao-pos-fechamento"
  | "executar-retificacao-pos-fechamento"
  | "reabrir-periodo-fechado"
  | "consultar-auditoria-fechamentos";

export const CLOSING_CAPABILITY_LABEL: Record<ClosingCapability, string> = {
  "entregar-pauta-docente": "Entregar a pauta do componente",
  "realizar-conferencia-escolar": "Realizar a conferência institucional",
  "devolver-pauta-com-apontamentos": "Devolver a pauta com apontamentos",
  "homologar-fechamento-oficial": "Homologar o fechamento oficial",
  "autorizar-retificacao-pos-fechamento": "Autorizar retificação após o fechamento",
  "executar-retificacao-pos-fechamento": "Executar retificação após o fechamento",
  "reabrir-periodo-fechado": "Reabrir período fechado",
  "consultar-auditoria-fechamentos": "Consultar o histórico de fechamentos",
};

/** Ator do ciclo. O conjunto de capacidades é dado, nunca inferido do cargo. */
export type ClosingActor = {
  id: string;
  name: string;
  /** Rótulo do perfil apenas para leitura humana; não governa capacidade. */
  profileLabel: string;
  capabilities: readonly ClosingCapability[];
  professionalId?: string;
  pedagogicalAssignmentId?: string;
};

export type ClosingActorStamp = {
  actorId: string;
  actorName: string;
  profileLabel: string;
  at: string;
};

// ----------------------------------------------------------------- Escopo

/**
 * O ciclo acontece por componente/campo da turma em um período. Identidade
 * sempre por ID: turma, ano letivo, período e `CurriculumRef`.
 */
export type ClosingScope = {
  classId: string;
  academicYearId: string;
  /** Período da estrutura avaliativa. */
  periodId: string;
  /** Período oficial do calendário homologado, quando existir. */
  calendarPeriodId?: string;
  curriculumRef: CurriculumRef;
};

// -------------------------------------------------------------- Pendências

export type ClosingPendencyCode =
  | "lancamento-ausente"
  | "lancamento-em-rascunho"
  | "instrumento-sem-pauta-aberta"
  | "quantidade-minima-de-instrumentos"
  | "sem-instrumento-no-periodo"
  | "atuacao-sem-vigencia-no-periodo"
  | "pendencia-especial-de-trajetoria"
  | "exigencia-de-fechamento-nao-configurada"
  | "pauta-nao-entregue"
  | "pauta-nao-conferida"
  | "calendario-nao-homologado"
  | "regra-nao-homologada"
  | "periodo-ja-fechado"
  | "politica-de-fechamento-ausente"
  | "ato-requerido-nao-realizado"
  | "avaliador-de-requisito-nao-registrado"
  | "requisito-inconclusivo"
  | "capacidade-exigida-pelo-requisito-ausente";

/**
 * "bloqueante" impede a ação. "pendencia-especial" exige decisão humana e é
 * sempre exibida, nunca resolvida pelo sistema. "aviso" é informativo.
 */
export type ClosingPendencySeverity = "bloqueante" | "pendencia-especial" | "aviso";

export type ClosingPendency = {
  code: ClosingPendencyCode;
  severity: ClosingPendencySeverity;
  message: string;
  studentId?: string;
  studentName?: string;
  instrumentId?: string;
  categoryId?: string;
  pendingRuleIds?: string[];
  /** 6D.3.4.2 — requisito declarado que originou a pendência. */
  requirementId?: string;
};

// --------------------------------------------------- Resultado materializado

/**
 * Resultado MATERIALIZADO do fechamento: retrato daquilo que o motor derivou
 * no ato. Não é pauta editável e não substitui os lançamentos.
 */
export type MaterializedStudentResult = {
  studentId: string;
  studentName: string;
  /** Lançamentos que fundamentaram o cálculo (referência, não cópia). */
  entryIds: string[];
  /**
   * 6D.3.4.1 — versões EXATAS dos resultados consumidas no ato. Congeladas no
   * registro: uma correção posterior (v2) nunca muda a referência histórica (v1).
   */
  usedEntryVersions: Array<{ versionId: string; logicalEntryId: string; version: number }>;
  categories: Array<{
    categoryId: string;
    label: string;
    value: number | null;
    rounded: boolean;
  }>;
  /** Resultado consolidado oficial do período. Nunca situação acadêmica. */
  consolidatedPeriodScore: number | null;
  rounded: boolean;
  complete: boolean;
  /** Registros "não registrado" preservados com o motivo declarado. */
  unregistered: Array<{ entryId: string; reason: string }>;
  coverage: PeriodCoverage;
};

// ------------------------------------------------------ Registro de fechamento

export type ClosingRevisionKind = "retificacao-pontual" | "reabertura-integral";

export type ClosingRevision = {
  kind: ClosingRevisionKind;
  justification: string;
  authorizedBy: ClosingActorStamp;
  /** Aluno atingido, quando a retificação for pontual. */
  studentId?: string;
};

/**
 * Versão oficial imutável do fechamento. Nunca sobrescrita: uma retificação ou
 * um novo fechamento após reabertura geram a versão seguinte, encadeada.
 */
export type PeriodClosingRecord = {
  id: string;
  scope: ClosingScope;
  version: number;
  /** Versão imediatamente anterior da mesma cadeia. */
  precedingClosingId?: string;
  /** Natureza do resultado — explicitamente do PERÍODO. */
  resultKind: "resultado-consolidado-oficial-do-periodo";
  /** Governança vigente no ato (identidade + versão). */
  ruleId: string;
  ruleVersion: number;
  calendarId: string;
  configurationId: string;
  configurationVersion?: number;
  closedBy: ClosingActorStamp;
  closedAt: string;
  revision?: ClosingRevision;
  results: MaterializedStudentResult[];
};

/**
 * Referência que todo documento futuro deverá gravar. O documento fica ligado à
 * VERSÃO que o originou — nunca a "a versão vigente".
 * A governança documental (desatualizado/substituído) pertence a etapa própria.
 */
export type ClosingSourceReference = {
  closingId: string;
  closingVersion: number;
  scopeKey: string;
  ruleId: string;
  ruleVersion: number;
  calendarId: string;
  materializedAt: string;
};

// ------------------------------------------------------------- Fluxo e eventos

export type ClosingAction =
  | "entrega-docente"
  | "inicio-conferencia"
  | "devolucao-com-apontamentos"
  | "fechamento-oficial"
  | "retificacao-pontual"
  | "reabertura-integral";

export const CLOSING_ACTION_LABEL: Record<ClosingAction, string> = {
  "entrega-docente": "Entrega dos registros pelo professor",
  "inicio-conferencia": "Início da conferência institucional",
  "devolucao-com-apontamentos": "Devolução com apontamentos",
  "fechamento-oficial": "Fechamento oficial do período",
  "retificacao-pontual": "Retificação pontual após o fechamento",
  "reabertura-integral": "Reabertura integral do período",
};

export type ClosingEvent = {
  at: string;
  action: ClosingAction;
  actor: ClosingActorStamp;
  detail: string;
  justification?: string;
  /** Versão de fechamento gerada pelo evento, quando houver. */
  closingId?: string;
  closingVersion?: number;
};

/** Fluxo do ciclo por escopo. O estado é fato do processo, não resultado. */
export type ClosingWorkflow = {
  scopeKey: string;
  scope: ClosingScope;
  stage: ClosingStage;
  events: ClosingEvent[];
};
