/**
 * Etapa 12H.1 — Fechamento e Consolidação Oficial da Frequência (tipos).
 *
 * Três fatos permanecem RIGOROSAMENTE separados:
 *   1. unidade PREVISTA   — o que a grade e o calendário indicavam que ocorreria;
 *   2. unidade MINISTRADA — o que o registro de aula (LessonEntry) comprova;
 *   3. unidade APLICÁVEL  — a unidade ministrada que alcança aquele aluno,
 *      segundo a vigência do vínculo com a turma.
 *
 * Invariantes desta etapa:
 * - Unidade prevista e não ministrada NUNCA gera presença nem ausência.
 * - Unidade ministrada sem chamada concluída NUNCA vira presença nem falta:
 *   é pendência institucional de registro e bloqueia o fechamento quando a
 *   política exigir chamada.
 * - Nenhum efeito é atribuído à justificativa: aqui só existem fatos neutros
 *   (ausência com ocorrência registrada / sem ocorrência registrada).
 * - A granularidade do fechamento NÃO é fixada em código: vem da política de
 *   apuração configurada (componente, bloco, turno, dia ou outra unidade).
 * - Nenhuma métrica oficial (percentual, mínimo legal, abono) é produzida.
 */

// ------------------------------------------------------- Política de apuração

/**
 * Unidade em que a frequência é apurada. É IDENTIFICADOR CONFIGURÁVEL, não
 * enumeração fechada: aula, dia e hora são apenas as unidades atualmente
 * cadastradas. A rede pode declarar outras sem alteração do motor.
 */
export type AttendanceUnitKind = string;

/**
 * Dimensão de apuração do fechamento (escopo). Também identificador
 * configurável: componente, turma integrada, bloco, turno e dia escolar são
 * configurações atuais, nunca os únicos modelos possíveis.
 */
export type AttendanceAccountingScopeKind = string;

/** Rótulos das unidades hoje cadastradas. Ausência de rótulo não invalida o ID. */
export const ATTENDANCE_UNIT_LABEL: Record<string, string> = {
  aula: "Aula ministrada",
  bloco: "Bloco de horário",
  turno: "Turno",
  dia: "Dia escolar",
  hora: "Hora / carga horária",
  "outra-unidade-configurada": "Outra unidade configurada pela rede",
};

export const ATTENDANCE_SCOPE_LABEL: Record<string, string> = {
  "componente-ou-campo": "Por componente curricular ou campo de experiência",
  "turma-integrada": "Por turma, em contexto pedagógico integrado",
  bloco: "Por bloco de horário",
  turno: "Por turno",
  "dia-escolar": "Por dia escolar",
  "outra-unidade-configurada": "Por outra unidade configurada pela rede",
};

/** Rótulo de unidade/escopo desconhecido cai no próprio identificador. */
export const attendanceUnitLabel = (id: AttendanceUnitKind) => ATTENDANCE_UNIT_LABEL[id] ?? id;
export const attendanceScopeLabel = (id: AttendanceAccountingScopeKind) =>
  ATTENDANCE_SCOPE_LABEL[id] ?? id;


export type AttendancePolicyStatus = "rascunho" | "em-revisao" | "homologada" | "arquivada";

export const ATTENDANCE_POLICY_STATUS_LABEL: Record<AttendancePolicyStatus, string> = {
  rascunho: "Rascunho — sem valor institucional",
  "em-revisao": "Em revisão pela Supervisão",
  homologada: "Homologada",
  arquivada: "Arquivada",
};

/**
 * Política de unidade/apuração da frequência. É a configuração que determina a
 * granularidade e as exigências do fechamento. Nenhum percentual, mínimo legal
 * ou efeito de justificativa é declarado aqui: isso pertence à regra
 * institucional futura (12I).
 */
export type AttendanceAccountingPolicy = {
  id: string;
  version: number;
  label: string;
  status: AttendancePolicyStatus;
  /** Unidade em que os fatos são contados. */
  unitKind: AttendanceUnitKind;
  /** Granularidade do escopo de fechamento. */
  scopeKind: AttendanceAccountingScopeKind;
  /** A política exige chamada concluída na unidade ministrada? */
  requiresConcludedAttendance: boolean;
  /** A política preserva a duração (carga horária) de cada unidade? */
  preservesDurationMinutes: boolean;
  appliesTo: {
    academicYearId: string;
    classIds?: readonly string[];
    stageIds?: readonly string[];
  };
  /**
   * Fórmulas declarativas de frequência que a política adota (ver
   * `attendance-formula.ts`). Não há fórmula embutida no motor; sem fórmula
   * declarada nenhuma proporção é materializada como oficial.
   */
  frequencyFormulaIds?: readonly string[];
  note?: string;

};

// ------------------------------------------- Ocorrências (prontuário escolar)

/**
 * Tipo de ocorrência/justificativa CONFIGURÁVEL, com identificador estável.
 * Atestado, licença e convocação existem apenas como exemplos de fixture.
 */
export type AttendanceOccurrenceType = {
  id: string;
  code: string;
  label: string;
  description: string;
  requiresDocument: boolean;
  active: boolean;
};

/**
 * Ocorrência registrada no PRONTUÁRIO DO ALUNO pela Secretaria Escolar. A
 * frequência apenas referencia: o documento não é duplicado em cada chamada.
 */
export type StudentAttendanceOccurrence = {
  id: string;
  studentId: string;
  occurrenceTypeId: string;
  /** Intervalo de datas coberto pela ocorrência (ISO canônico). */
  from: string;
  until: string;
  source: "prontuario-do-aluno-secretaria-escolar";
  documentRef?: string;
  registeredAt: string;
  registeredBy: string;
  note?: string;
};

// ------------------------------------------------------------- Fatos atômicos

/** Unidade PREVISTA pela grade/calendário. Prova apenas o que deveria ocorrer. */
export type PlannedUnitFact = {
  plannedKey: string;
  date: string;
  blockId: string;
  label: string;
  durationMinutes: number | null;
  /** Existe registro de aula que comprove a execução desta unidade prevista? */
  executed: boolean;
};

/** Unidade MINISTRADA, comprovada por registro de aula concluído. */
export type TaughtUnitFact = {
  unitKey: string;
  lessonEntryId: string;
  date: string;
  slotKey: string;
  slotLabel: string;
  /** Carga horária preservada; null quando a duração não é conhecida. */
  durationMinutes: number | null;
  blockId?: string;
  /** A chamada da aula está concluída? Sem isso não há fato de frequência. */
  attendanceConcluded: boolean;
};

/** Marcação neutra de frequência. Ausência de marcação não é presença nem falta. */
export type AttendanceFactMark = "presenca" | "ausencia";

export type StudentUnitFact = {
  unitKey: string;
  lessonEntryId: string;
  date: string;
  slotLabel: string;
  durationMinutes: number | null;
  /** null = unidade ministrada sem registro de chamada aplicável ao aluno. */
  mark: AttendanceFactMark | null;
  /** Ocorrência do prontuário que cobre a data, quando existir. */
  occurrenceId?: string;
  occurrenceTypeId?: string;
};

/**
 * Fatos do aluno no escopo. Vocabulário deliberadamente neutro: não existe
 * "falta injustificada" nesta camada.
 */
export type StudentAttendanceFacts = {
  studentId: string;
  studentName: string;
  /** Cobertura temporal do vínculo com a turma no período. */
  coverage: "integral" | "ingresso-posterior" | "saida-anterior" | "parcial" | "sem-vinculo";
  applicableUnits: number;
  applicableMinutes: number | null;
  presences: number;
  presenceMinutes: number | null;
  absences: number;
  absenceMinutes: number | null;
  absencesWithRegisteredOccurrence: number;
  absenceWithOccurrenceMinutes: number | null;
  absencesWithoutRegisteredOccurrence: number;
  absenceWithoutOccurrenceMinutes: number | null;
  /** Pendência institucional de registro, nunca ausência do aluno. */
  unitsWithoutAttendanceRecord: number;
  unitsWithoutAttendanceMinutes: number | null;
  occurrenceRefs: readonly {
    occurrenceId: string;
    occurrenceTypeId: string;
    from: string;
    until: string;
  }[];
  units: readonly StudentUnitFact[];
};

/** Totais do escopo. Previsto, ministrado e pendências são fatos distintos. */
export type ScopeAttendanceTotals = {
  /** null = sem fonte de dias letivos (indisponível), nunca zero; lista conhecida vazia = 0. */
  plannedUnits: number | null;
  plannedMinutes: number | null;
  taughtUnits: number;
  taughtMinutes: number | null;
  /** Unidades previstas sem execução comprovada — pendência de execução. null = indisponível. */
  plannedWithoutExecutionUnits: number | null;
  /** Unidades ministradas sem chamada concluída — pendência de registro. */
  taughtWithoutAttendanceUnits: number;
  taughtWithoutAttendanceMinutes: number | null;
};

// ------------------------------------------------------------------- Escopo

/** Unidade de apuração resolvida pela política. Identidade sempre por ID. */
export type AttendanceAccountingUnitRef = {
  kind: AttendanceAccountingScopeKind;
  id: string;
  label: string;
};

export type AttendanceClosingScope = {
  classId: string;
  academicYearId: string;
  periodId: string;
  /** Período oficial do calendário homologado, quando existir. */
  calendarPeriodId?: string;
  accountingUnit: AttendanceAccountingUnitRef;
};

// -------------------------------------------------------------- Estados/fluxo

export type AttendanceClosingStage =
  | "em-andamento"
  | "entregue"
  | "em-conferencia"
  | "devolvida-para-ajustes"
  | "fechado"
  | "reaberto";

export const ATTENDANCE_STAGE_LABEL: Record<AttendanceClosingStage, string> = {
  "em-andamento": "Período em andamento",
  entregue: "Pauta de frequência entregue pelo professor",
  "em-conferencia": "Em conferência institucional",
  "devolvida-para-ajustes": "Devolvida para ajustes",
  fechado: "Frequência fechada oficialmente",
  reaberto: "Reaberto por exceção formal",
};

export const ATTENDANCE_STAGE_TONE: Record<
  AttendanceClosingStage,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  "em-andamento": "neutral",
  entregue: "info",
  "em-conferencia": "info",
  "devolvida-para-ajustes": "warning",
  fechado: "success",
  reaberto: "warning",
};

export type AttendanceClosingCapability =
  | "entregar-pauta-de-frequencia"
  | "realizar-conferencia-de-frequencia"
  | "devolver-pauta-de-frequencia"
  | "homologar-fechamento-de-frequencia"
  | "autorizar-retificacao-de-frequencia"
  | "executar-retificacao-de-frequencia"
  | "reabrir-frequencia-fechada"
  | "registrar-ocorrencia-no-prontuario"
  | "consultar-auditoria-de-frequencia";

export const ATTENDANCE_CAPABILITY_LABEL: Record<AttendanceClosingCapability, string> = {
  "entregar-pauta-de-frequencia": "Entregar a pauta de frequência",
  "realizar-conferencia-de-frequencia": "Realizar a conferência da frequência",
  "devolver-pauta-de-frequencia": "Devolver a pauta com apontamentos",
  "homologar-fechamento-de-frequencia": "Homologar o fechamento oficial da frequência",
  "autorizar-retificacao-de-frequencia": "Autorizar retificação após o fechamento",
  "executar-retificacao-de-frequencia": "Executar retificação após o fechamento",
  "reabrir-frequencia-fechada": "Reabrir frequência fechada",
  "registrar-ocorrencia-no-prontuario": "Registrar ocorrência no prontuário do aluno",
  "consultar-auditoria-de-frequencia": "Consultar o histórico de fechamentos de frequência",
};

export type AttendanceClosingActor = {
  id: string;
  name: string;
  /** Rótulo humano do perfil; não governa capacidade. */
  profileLabel: string;
  capabilities: readonly AttendanceClosingCapability[];
  professionalId?: string;
};

export type AttendanceActorStamp = {
  actorId: string;
  actorName: string;
  profileLabel: string;
  at: string;
};

// --------------------------------------------------------------- Pendências

export type AttendancePendencyCode =
  | "aula-ministrada-sem-chamada-concluida"
  | "unidade-prevista-sem-execucao"
  | "aula-em-data-sem-dia-letivo"
  | "dia-letivo-sem-registro-de-aula"
  | "politica-de-apuracao-nao-homologada"
  | "calendario-nao-homologado"
  | "calendario-institucional-indisponivel"
  | "unidades-previstas-indisponiveis"
  | "pauta-de-frequencia-nao-entregue"
  | "pauta-de-frequencia-nao-conferida"
  | "frequencia-do-periodo-ja-fechada"
  | "cobertura-parcial-do-periodo"
  | "sem-unidade-ministrada-no-periodo"
  | "unidade-de-apuracao-nao-configurada";

export type AttendancePendencySeverity = "bloqueante" | "pendencia-especial" | "aviso";

export type AttendancePendency = {
  code: AttendancePendencyCode;
  severity: AttendancePendencySeverity;
  message: string;
  studentId?: string;
  studentName?: string;
  lessonEntryId?: string;
  date?: string;
};

// ---------------------------------------------------- Registro de fechamento

export type AttendanceRevisionKind = "retificacao-pontual" | "reabertura-integral";

export type AttendanceClosingRevision = {
  kind: AttendanceRevisionKind;
  justification: string;
  authorizedBy: AttendanceActorStamp;
  studentId?: string;
};

/**
 * Versão oficial IMUTÁVEL dos fatos de frequência do período. Nunca
 * sobrescrita: retificação ou novo fechamento após reabertura geram a versão
 * seguinte, encadeada.
 */
export type PeriodAttendanceClosingRecord = {
  id: string;
  scope: AttendanceClosingScope;
  version: number;
  precedingClosingId?: string;
  /** Natureza explícita: fatos de frequência, nunca situação acadêmica. */
  factKind: "fatos-oficiais-de-frequencia-do-periodo";
  policyId: string;
  policyVersion: number;
  unitKind: AttendanceUnitKind;
  calendarId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  closedBy: AttendanceActorStamp;
  closedAt: string;
  revision?: AttendanceClosingRevision;
  /** Registros de aula que fundamentaram os fatos (referência, não cópia). */
  lessonEntryIds: readonly string[];
  totals: ScopeAttendanceTotals;
  students: readonly StudentAttendanceFacts[];
};

/** Referência que todo documento futuro deve gravar: a VERSÃO exata usada. */
export type AttendanceClosingSourceReference = {
  closingId: string;
  closingVersion: number;
  scopeKey: string;
  policyId: string;
  policyVersion: number;
  calendarId: string;
  materializedAt: string;
};

// ------------------------------------------------------------ Eventos/fluxo

export type AttendanceClosingAction =
  | "entrega-docente"
  | "inicio-conferencia"
  | "devolucao-com-apontamentos"
  | "fechamento-oficial"
  | "retificacao-pontual"
  | "reabertura-integral";

export const ATTENDANCE_ACTION_LABEL: Record<AttendanceClosingAction, string> = {
  "entrega-docente": "Entrega da pauta de frequência pelo professor",
  "inicio-conferencia": "Início da conferência institucional da frequência",
  "devolucao-com-apontamentos": "Devolução da pauta com apontamentos",
  "fechamento-oficial": "Fechamento oficial da frequência do período",
  "retificacao-pontual": "Retificação pontual após o fechamento",
  "reabertura-integral": "Reabertura integral da frequência do período",
};

export type AttendanceClosingEvent = {
  at: string;
  action: AttendanceClosingAction;
  actor: AttendanceActorStamp;
  detail: string;
  justification?: string;
  closingId?: string;
  closingVersion?: number;
};

export type AttendanceClosingWorkflow = {
  scopeKey: string;
  scope: AttendanceClosingScope;
  stage: AttendanceClosingStage;
  events: AttendanceClosingEvent[];
};

// ------------------------------------------------- Saída analítica (CIECE)

/**
 * Fato atômico para o motor analítico do CIECE. Dimensões estáveis,
 * proveniência e temporalidade preservadas; nenhum indicador final é produzido.
 */
export type FactStudentAttendanceAnalytical = {
  academicYearId: string;
  calendarId: string;
  periodId: string;
  calendarPeriodId?: string;
  unitId: string;
  classId: string;
  studentId: string;
  accountingUnitKind: AttendanceAccountingScopeKind;
  accountingUnitId: string;
  unitKind: AttendanceUnitKind;
  policyId: string;
  policyVersion: number;
  closingId: string;
  closingVersion: number;
  closedAt: string;
  coverage: StudentAttendanceFacts["coverage"];
  plannedUnits: number | null;
  plannedMinutes: number | null;
  taughtUnits: number;
  taughtMinutes: number | null;
  applicableUnits: number;
  applicableMinutes: number | null;
  attendedUnits: number;
  attendedMinutes: number | null;
  absentUnits: number;
  absentMinutes: number | null;
  absencesWithRegisteredOccurrence: number;
  absencesWithoutRegisteredOccurrence: number;
  plannedWithoutExecutionUnits: number | null;
  taughtWithoutAttendanceUnits: number;
};

export const ATTENDANCE_CLOSING_LABEL = "Fatos oficiais de frequência do período";

export const ATTENDANCE_CLOSING_NOTE =
  "Esta etapa produz apenas fatos de frequência do período: unidades previstas, ministradas e aplicáveis ao aluno, com presenças e ausências neutras. Percentual oficial, abono de ausência, mínimo legal, resultado do ciclo e situação acadêmica pertencem a etapas posteriores e não são calculados aqui.";
