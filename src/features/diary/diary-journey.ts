/**
 * Jornada docente — camada de leitura integrada do Diário (Etapa 11E).
 *
 * Deriva, de forma determinística e a partir dos registros existentes
 * (fixtures + memória da aba), a situação de cada aula prevista, a próxima
 * ação legítima, as pendências operacionais, os itens a retomar e a leitura
 * temporal unificada. Nenhuma regra pedagógica é decidida aqui: apenas o
 * estado dos dados é interpretado de um único jeito para todas as páginas.
 */
import { DIARY_REFERENCE_DATE, diaryStageForClass, type DiarySearch } from "./diary-data";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  attendanceStatus,
  attendanceStore,
  type AttendanceRecord,
  type AttendanceStatus,
} from "./attendance";
import {
  dailyAgenda,
  findLessonEntry,
  lessonEntries,
  type AgendaItem,
  type LessonEntry,
  type LocalLessonRecord,
} from "./lesson-records";
import { infantExperienceRecords, type InfantExperienceRecord } from "./infant-experiences";

// Temporalidade --------------------------------------------------------------

export type Temporality = "histórica" | "hoje" | "futura";

/** "Hoje" demonstrativo é a data de referência fixa do Diário. */
export function temporalityOf(date: string, today = DIARY_REFERENCE_DATE): Temporality {
  if (date < today) return "histórica";
  if (date > today) return "futura";
  return "hoje";
}

// Situação da aula -----------------------------------------------------------

export type JourneyState =
  | "Prevista"
  | "Prevista · sem registro"
  | "Registro em elaboração"
  | "Chamada pendente"
  | "Chamada em elaboração"
  | "Chamada concluída";

export type JourneyActionKind =
  "registrar" | "continuar-registro" | "fazer-chamada" | "continuar-chamada" | "ver-registro";

export type JourneyAction = {
  kind: JourneyActionKind;
  label: string;
  to: "/diario/registrar" | "/diario/chamada/$registroId" | "/diario/registros/$registroId";
  params?: { registroId: string };
  search: DiarySearch & { atuacao?: string; bloco?: string; registro?: string };
};

export type JourneyItem = AgendaItem & {
  infant: boolean;
  journeyState: JourneyState;
  attendance: AttendanceStatus | null;
  draftId?: string;
  action: JourneyAction;
};

function infantDraftFor(
  item: AgendaItem,
  experiences: InfantExperienceRecord[],
): InfantExperienceRecord | undefined {
  return experiences.find(
    (exp) =>
      exp.status === "Rascunho local" &&
      exp.assignmentId === item.assignmentId &&
      exp.date === item.date,
  );
}

/** Estado derivado único a partir de agenda, registro e chamada. */
export function journeyState(
  temporality: Temporality,
  agendaState: AgendaItem["state"],
  attendance: AttendanceStatus | null,
  hasInfantDraft = false,
): JourneyState {
  if (agendaState === "Rascunho em elaboração" || (agendaState === "Prevista" && hasInfantDraft))
    return "Registro em elaboração";
  if (agendaState === "Prevista")
    return temporality === "futura" ? "Prevista" : "Prevista · sem registro";
  if (attendance === "Concluída") return "Chamada concluída";
  if (attendance === "Rascunho" || attendance === "Parcialmente preenchida")
    return "Chamada em elaboração";
  return "Chamada pendente";
}

/** Próxima ação legítima; terminologia da EI aplicada automaticamente. */
export function nextAction(
  state: JourneyState,
  ctx: {
    infant: boolean;
    search: DiarySearch;
    date: string;
    assignmentId: string;
    blockId?: string;
    entryId?: string;
    draftId?: string;
  },
): JourneyAction {
  const base = { ...ctx.search, data: ctx.date };
  const noun = ctx.infant ? "experiência" : "aula";
  switch (state) {
    case "Prevista":
    case "Prevista · sem registro":
      return {
        kind: "registrar",
        label: `Registrar ${noun}`,
        to: "/diario/registrar",
        search: {
          ...base,
          atuacao: ctx.assignmentId,
          ...(ctx.blockId ? { bloco: ctx.blockId } : {}),
        },
      };
    case "Registro em elaboração":
      return {
        kind: "continuar-registro",
        label: "Continuar registro",
        to: "/diario/registrar",
        search: {
          ...base,
          atuacao: ctx.assignmentId,
          ...(ctx.draftId ? { registro: ctx.draftId } : {}),
        },
      };
    case "Chamada pendente":
      return {
        kind: "fazer-chamada",
        label: "Fazer chamada",
        to: "/diario/chamada/$registroId",
        params: { registroId: ctx.entryId ?? "" },
        search: base,
      };
    case "Chamada em elaboração":
      return {
        kind: "continuar-chamada",
        label: "Continuar chamada",
        to: "/diario/chamada/$registroId",
        params: { registroId: ctx.entryId ?? "" },
        search: base,
      };
    default:
      return {
        kind: "ver-registro",
        label: "Ver registro",
        to: "/diario/registros/$registroId",
        params: { registroId: ctx.entryId ?? "" },
        search: base,
      };
  }
}

export type JourneySources = {
  lessons: LocalLessonRecord[];
  attendance: AttendanceRecord[];
  experiences: InfantExperienceRecord[];
};

function attendanceFor(entryId: string, local: AttendanceRecord[]) {
  return local.find((item) => item.entryId === entryId) ?? attendanceStore.get(entryId);
}

/** Agenda da data como projeção dos blocos de Horários + estado da jornada. */
export function journeyAgenda(
  professionalId: string,
  date: string,
  sources: JourneySources,
  search: DiarySearch = {},
): JourneyItem[] {
  const temporality = temporalityOf(date);
  return dailyAgenda(professionalId, date, sources.lessons)
    .filter(
      (item) =>
        (!search.unidade || item.unitId === search.unidade) &&
        (!search.turma || item.classId === search.turma) &&
        (!search.componente || item.field === search.componente),
    )
    .map((item) => {
      const infant = diaryStageForClass(item.classId) === "Educação Infantil";
      const entry = item.entryId ? findLessonEntry(item.entryId, sources.lessons) : undefined;
      const attendance =
        entry && item.state === "Registrada"
          ? attendanceStatus(entry, attendanceFor(entry.id, sources.attendance))
          : null;
      const infantDraft = infant ? infantDraftFor(item, sources.experiences) : undefined;
      const state = journeyState(temporality, item.state, attendance, Boolean(infantDraft));
      const draftId =
        item.state === "Rascunho em elaboração" ? item.entryId : (infantDraft?.id ?? undefined);
      return {
        ...item,
        infant,
        journeyState: state,
        attendance,
        ...(draftId ? { draftId } : {}),
        action: nextAction(state, {
          infant,
          search,
          date,
          assignmentId: item.assignmentId,
          blockId: item.blockId,
          ...(item.entryId ? { entryId: item.entryId } : {}),
          ...(draftId ? { draftId } : {}),
        }),
      };
    });
}

/** Primeira ação ainda aberta do dia, respeitando a ordem cronológica. */
export function primaryAction(items: JourneyItem[]): JourneyItem | undefined {
  return items.find((item) => item.action.kind !== "ver-registro");
}

// Pendências legítimas e retomada ------------------------------------------

export type PendingKind =
  | "registro-em-elaboracao"
  | "experiencia-em-elaboracao"
  | "chamada-em-elaboracao"
  | "chamada-pendente";

export type PendingItem = {
  id: string;
  kind: PendingKind;
  label: "Em elaboração" | "Pendente" | "A concluir";
  title: string;
  description: string;
  date: string;
  action: JourneyAction;
};

/**
 * Pendências operacionais legítimas: somente trabalho iniciado e não
 * concluído, ou aula já registrada sem chamada. Aulas previstas, datas
 * futuras, ausência de planejamento ou de observações nunca são pendências.
 */
export function legitimatePending(
  professionalId: string,
  sources: JourneySources,
  search: DiarySearch = {},
  today = DIARY_REFERENCE_DATE,
): PendingItem[] {
  const pending: PendingItem[] = [];
  for (const draft of sources.lessons) {
    if (draft.professionalId !== professionalId || draft.status !== "Rascunho local") continue;
    const entry = findLessonEntry(draft.id, sources.lessons);
    pending.push({
      id: `lesson:${draft.id}`,
      kind: "registro-em-elaboracao",
      label: "Em elaboração",
      title: `${entry?.className ?? "Turma"} · ${entry?.field ?? "Registro"}`,
      description: `Registro de aula de ${formatAcademicDate(draft.date)} em rascunho nesta aba.`,
      date: draft.date,
      action: nextAction("Registro em elaboração", {
        infant: false,
        search,
        date: draft.date,
        assignmentId: draft.assignmentId,
        draftId: draft.id,
      }),
    });
  }
  for (const exp of sources.experiences) {
    if (exp.professionalId !== professionalId || exp.status !== "Rascunho local") continue;
    const observations = exp.individualObservations.length;
    pending.push({
      id: `experience:${exp.id}`,
      kind: "experiencia-em-elaboracao",
      label: "Em elaboração",
      title: `${exp.title || "Experiência pedagógica"}`,
      description:
        observations > 0
          ? `Experiência de ${formatAcademicDate(exp.date)} com ${observations} observação(ões) individual(is) em elaboração.`
          : `Experiência pedagógica de ${formatAcademicDate(exp.date)} em rascunho nesta aba.`,
      date: exp.date,
      action: nextAction("Registro em elaboração", {
        infant: true,
        search,
        date: exp.date,
        assignmentId: exp.assignmentId,
        draftId: exp.id,
      }),
    });
  }
  for (const entry of lessonEntries(professionalId, sources.lessons)) {
    if (entry.status === "Rascunho local" || entry.date > today) continue;
    const status = attendanceStatus(entry, attendanceFor(entry.id, sources.attendance));
    if (status === "Concluída") continue;
    const inProgress = status !== "Sem chamada";
    pending.push({
      id: `attendance:${entry.id}`,
      kind: inProgress ? "chamada-em-elaboracao" : "chamada-pendente",
      label: inProgress ? "A concluir" : "Pendente",
      title: `${entry.className} · ${entry.field}`,
      description: inProgress
        ? `Chamada de ${formatAcademicDate(entry.date)} parcialmente preenchida.`
        : `Aula de ${formatAcademicDate(entry.date)} registrada, chamada ainda não realizada.`,
      date: entry.date,
      action: nextAction(inProgress ? "Chamada em elaboração" : "Chamada pendente", {
        infant: false,
        search,
        date: entry.date,
        assignmentId: entry.assignmentId,
        entryId: entry.id,
      }),
    });
  }
  return pending.sort((a, b) => b.date.localeCompare(a.date));
}

/** "Continuar de onde parei": apenas trabalho iniciado na sessão (memória da aba). */
export function resumeItems(professionalId: string, sources: JourneySources, search?: DiarySearch) {
  const localAttendanceIds = new Set(
    sources.attendance.filter((item) => !item.concluded).map((item) => item.entryId),
  );
  return legitimatePending(professionalId, sources, search).filter(
    (item) =>
      item.kind === "registro-em-elaboracao" ||
      item.kind === "experiencia-em-elaboracao" ||
      (item.kind === "chamada-em-elaboracao" &&
        localAttendanceIds.has(item.action.params?.registroId ?? "")),
  );
}

/** Pendências ainda não destacadas na retomada, evitando o mesmo trabalho em duas seções. */
export function pendingWithoutResume(
  professionalId: string,
  sources: JourneySources,
  search?: DiarySearch,
) {
  const resumed = new Set(resumeItems(professionalId, sources, search).map((item) => item.id));
  return legitimatePending(professionalId, sources, search).filter((item) => !resumed.has(item.id));
}

// Histórico integrado -------------------------------------------------------

export type HistoryItem = {
  /** Identidade estável: o mesmo registro tem o mesmo id em todas as visões. */
  id: string;
  date: string;
  kind: "Aula registrada" | "Experiência da EI";
  context: string;
  summary: string;
  situation: string;
  action: JourneyAction;
};

export function journeyHistory(
  professionalId: string,
  sources: JourneySources,
  search: DiarySearch = {},
): HistoryItem[] {
  const entries: LessonEntry[] = lessonEntries(professionalId, sources.lessons).filter(
    (entry) => entry.status !== "Rascunho local",
  );
  const lessonIds = new Set(entries.map((entry) => entry.id));
  const lessons = entries.map<HistoryItem>((entry) => {
    const infant = diaryStageForClass(entry.classId) === "Educação Infantil";
    const status = attendanceStatus(entry, attendanceFor(entry.id, sources.attendance));
    return {
      id: entry.id,
      date: entry.date,
      kind: infant ? "Experiência da EI" : "Aula registrada",
      context: `${entry.className} · ${entry.field} · ${entry.unitName}`,
      summary: entry.summary,
      situation: status === "Sem chamada" ? "Chamada pendente" : `Chamada: ${status.toLowerCase()}`,
      action: nextAction("Chamada concluída", {
        infant,
        search,
        date: entry.date,
        assignmentId: entry.assignmentId,
        entryId: entry.id,
      }),
    };
  });
  // Experiências EI concluídas sem registro de aula associado já listado.
  const experiences = infantExperienceRecords(professionalId, sources.experiences)
    .filter(
      (exp) =>
        exp.status !== "Rascunho local" &&
        !(exp.relatedLessonId && lessonIds.has(exp.relatedLessonId)),
    )
    .map<HistoryItem>((exp) => ({
      id: exp.relatedLessonId ?? exp.id,
      date: exp.date,
      kind: "Experiência da EI",
      context: exp.title || "Experiência pedagógica",
      summary: exp.description,
      situation: "Registrada",
      action: nextAction("Chamada concluída", {
        infant: true,
        search,
        date: exp.date,
        assignmentId: exp.assignmentId,
        entryId: exp.relatedLessonId ?? exp.id,
      }),
    }));
  return [...lessons, ...experiences].sort((a, b) => b.date.localeCompare(a.date));
}

export const journeyScenarios = [
  "A professor com uma única aula no dia",
  "B várias aulas consecutivas",
  "C aulas em turmas diferentes",
  "D duas escolas no mesmo dia",
  "E dois vínculos",
  "F aula prevista sem registro",
  "G registro em rascunho",
  "H registro concluído sem chamada",
  "I chamada parcial",
  "J chamada concluída",
  "K tudo concluído",
  "L data futura",
  "M data histórica",
  "N dia sem aulas",
  "O atuação encerrada",
  "P Educação Infantil",
  "Q EI com experiência em rascunho",
  "R EI com observações",
  "S aluno recém-enturmado",
  "T aula fora da previsão",
  "U substituição docente",
  "V corresponsabilidade",
  "W conteúdo institucional longo",
  "X múltiplas pendências legítimas",
] as const;
