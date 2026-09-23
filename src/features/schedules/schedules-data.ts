import {
  demonstrationClasses,
  getDemonstrationClass,
  getClassUnitName,
} from "@/features/classes/classes-data";
import {
  demonstrationPedagogicalAssignments,
  getPedagogicalAssignment,
  pedagogicalContext,
} from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";

export const SCHEDULE_REFERENCE_DATE = "2026-09-23";

export const WEEK_DAYS = [
  { id: "mon", short: "Seg", label: "Segunda-feira" },
  { id: "tue", short: "Ter", label: "Terça-feira" },
  { id: "wed", short: "Qua", label: "Quarta-feira" },
  { id: "thu", short: "Qui", label: "Quinta-feira" },
  { id: "fri", short: "Sex", label: "Sexta-feira" },
  { id: "sat", short: "Sáb", label: "Sábado" },
] as const;

export type WeekDayId = (typeof WEEK_DAYS)[number]["id"];
export type SchedulePublicationState =
  | "Não iniciada"
  | "Em elaboração"
  | "Pronta para revisão"
  | "Publicada"
  | "Substituída por nova versão"
  | "Histórica";
export type ScheduleSituation =
  | "Conflito temporal potencial"
  | "Incompatibilidade estrutural demonstrativa"
  | "Compatibilidade pendente de validação"
  | "Informação insuficiente"
  | "Situação sem conflito identificado";
export type ScheduleBlockKind =
  "Aula" | "Intervalo" | "Atividade pedagógica" | "Outro bloco configurável";

export type JourneyInterval = { start: string; end: string; label: string };
export type JourneyDay = {
  day: WeekDayId;
  start: string;
  end: string;
  declaredDuration: string;
  intervals: JourneyInterval[];
};
export type SchoolJourney = {
  id: string;
  classId: string;
  shift: string;
  days: JourneyDay[];
  effectiveFrom: string;
  effectiveUntil?: string;
  origin: string;
  note: string;
};
export type ScheduleBlock = {
  id: string;
  day: WeekDayId;
  start: string;
  end: string;
  kind: ScheduleBlockKind;
  label: string;
  assignmentIds: string[];
  groupingIds?: string[];
  status: "Planejado" | "Requer revisão" | "Sem distribuição";
  note?: string;
};
export type ScheduleVersion = {
  id: string;
  classId: string;
  journeyId: string;
  label: string;
  state: SchedulePublicationState;
  effectiveFrom: string;
  effectiveUntil?: string;
  referenceDate: string;
  blocks: ScheduleBlock[];
  history: Array<{ id: string; title: string; date: string; note: string }>;
};

const regularDays = (
  start: string,
  end: string,
  duration: string,
  intervalStart: string,
  intervalEnd: string,
): JourneyDay[] =>
  (["mon", "tue", "wed", "thu", "fri"] as WeekDayId[]).map((day) => ({
    day,
    start,
    end,
    declaredDuration: duration,
    intervals: [{ start: intervalStart, end: intervalEnd, label: "Intervalo declarado" }],
  }));

export const schoolJourneys: SchoolJourney[] = [
  {
    id: "jor-001",
    classId: "tur-001",
    shift: "Manhã",
    days: regularDays("07:20", "11:40", "4h20", "09:20", "09:40"),
    effectiveFrom: "2026-02-05",
    origin: "Configuração demonstrativa da turma",
    note: "Jornada independente da distribuição semanal.",
  },
  {
    id: "jor-002",
    classId: "tur-002",
    shift: "Manhã e tarde",
    days: regularDays("08:00", "16:00", "8h", "11:30", "13:00"),
    effectiveFrom: "2026-02-05",
    origin: "Configuração demonstrativa da Educação Infantil",
    note: "Rotina ampliada sem pressupor disciplinas em todos os blocos.",
  },
  {
    id: "jor-003",
    classId: "tur-003",
    shift: "Manhã",
    days: [
      ...regularDays("07:30", "11:50", "4h20", "09:30", "09:50").filter(
        (item) => item.day !== "fri",
      ),
      {
        day: "fri",
        start: "07:30",
        end: "10:50",
        declaredDuration: "3h20",
        intervals: [{ start: "09:10", end: "09:30", label: "Intervalo declarado" }],
      },
    ],
    effectiveFrom: "2026-02-05",
    origin: "Configuração demonstrativa da turma do campo",
    note: "A sexta-feira possui duração diferente; nenhuma uniformidade diária foi presumida.",
  },
  {
    id: "jor-004",
    classId: "tur-004",
    shift: "Noite",
    days: [
      ...regularDays("18:30", "22:10", "3h40", "20:10", "20:25"),
      {
        day: "sat",
        start: "08:00",
        end: "11:20",
        declaredDuration: "3h20",
        intervals: [{ start: "09:30", end: "09:45", label: "Intervalo declarado" }],
      },
    ],
    effectiveFrom: "2026-02-10",
    origin: "Organização demonstrativa própria da EJA",
    note: "Inclui sábado e fases próprias; não exige série única.",
  },
  {
    id: "jor-005",
    classId: "tur-005",
    shift: "Tarde",
    days: regularDays("12:40", "17:50", "5h10", "15:00", "15:20"),
    effectiveFrom: "2026-02-05",
    origin: "Configuração demonstrativa da turma",
    note: "Durações dos blocos variam conforme a organização declarada.",
  },
  {
    id: "jor-006",
    classId: "tur-006",
    shift: "Manhã",
    days: regularDays("07:10", "12:00", "4h50", "09:25", "09:45"),
    effectiveFrom: "2025-02-03",
    effectiveUntil: "2025-12-19",
    origin: "Registro histórico demonstrativo",
    note: "Jornada histórica preservada.",
  },
  {
    id: "jor-007",
    classId: "tur-007",
    shift: "Noite",
    days: regularDays("18:40", "22:20", "3h40", "20:20", "20:35"),
    effectiveFrom: "2026-02-12",
    origin: "Configuração demonstrativa da EJA",
    note: "Organização por fases.",
  },
  {
    id: "jor-009",
    classId: "tur-009",
    shift: "Manhã",
    days: regularDays("07:30", "11:50", "4h20", "09:30", "09:50"),
    effectiveFrom: "2026-02-05",
    origin: "Configuração demonstrativa multietapa",
    note: "Uma única turma preserva seus agrupamentos.",
  },
];

const block = (
  id: string,
  day: WeekDayId,
  start: string,
  end: string,
  kind: ScheduleBlockKind,
  label: string,
  assignmentIds: string[],
  status: ScheduleBlock["status"] = "Planejado",
  note?: string,
): ScheduleBlock => ({
  id,
  day,
  start,
  end,
  kind,
  label,
  assignmentIds,
  status,
  ...(note ? { note } : {}),
});

export const scheduleVersions: ScheduleVersion[] = [
  {
    id: "grd-001-v2",
    classId: "tur-001",
    journeyId: "jor-001",
    label: "Versão 2",
    state: "Publicada",
    effectiveFrom: "2026-05-04",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-001",
        "mon",
        "07:20",
        "08:10",
        "Aula",
        "Componente curricular demonstrativo — Linguagens",
        ["atp-001", "atp-004"],
      ),
      block(
        "bl-002",
        "mon",
        "08:10",
        "09:20",
        "Aula",
        "Componente curricular demonstrativo — Linguagens",
        ["atp-001"],
      ),
      block("bl-003", "mon", "09:20", "09:40", "Intervalo", "Intervalo", []),
      block("bl-004", "mon", "09:40", "10:30", "Atividade pedagógica", "Leitura orientada", [
        "atp-001",
      ]),
      block(
        "bl-005",
        "tue",
        "07:20",
        "08:10",
        "Aula",
        "Componente curricular demonstrativo — Linguagens",
        ["atp-001"],
      ),
      block(
        "bl-006",
        "wed",
        "07:20",
        "08:10",
        "Aula",
        "Componente curricular demonstrativo — Linguagens",
        ["atp-001"],
      ),
      block(
        "bl-007",
        "thu",
        "07:20",
        "08:10",
        "Aula",
        "Componente curricular demonstrativo — Linguagens",
        ["atp-010"],
        "Requer revisão",
        "Substituição temporária registrada; atualização da grade requer operação explícita.",
      ),
      block(
        "bl-008",
        "fri",
        "10:30",
        "11:40",
        "Outro bloco configurável",
        "Período sem distribuição definida",
        [],
        "Sem distribuição",
      ),
    ],
    history: [
      {
        id: "grd-001-h1",
        title: "Versão 1 substituída",
        date: "03 maio 2026",
        note: "Mudança estrutural demonstrativa gerou nova versão.",
      },
      {
        id: "grd-001-h2",
        title: "Versão 2 publicada",
        date: "04 maio 2026",
        note: "Publicação apenas representada; nenhuma operação real ocorreu.",
      },
    ],
  },
  {
    id: "grd-002-v1",
    classId: "tur-002",
    journeyId: "jor-002",
    label: "Versão 1",
    state: "Pronta para revisão",
    effectiveFrom: "2026-02-05",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-020",
        "mon",
        "08:00",
        "09:30",
        "Atividade pedagógica",
        "Campo de experiência demonstrativo — convívio e linguagem",
        ["atp-005"],
      ),
      block("bl-021", "mon", "11:30", "13:00", "Intervalo", "Alimentação e repouso", []),
      block(
        "bl-022",
        "mon",
        "12:40",
        "13:30",
        "Atividade pedagógica",
        "Rotina pedagógica compartilhada",
        ["atp-005"],
        "Requer revisão",
      ),
      block(
        "bl-023",
        "tue",
        "13:00",
        "14:20",
        "Outro bloco configurável",
        "Exploração dos espaços",
        [],
      ),
    ],
    history: [
      {
        id: "grd-002-h1",
        title: "Grade preparada para revisão",
        date: "20 set 2026",
        note: "Blocos de rotina sem disciplina convencional.",
      },
    ],
  },
  {
    id: "grd-003-v1",
    classId: "tur-003",
    journeyId: "jor-003",
    label: "Versão 1",
    state: "Em elaboração",
    effectiveFrom: "2026-02-05",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-030",
        "mon",
        "07:30",
        "08:20",
        "Atividade pedagógica",
        "Acompanhamento dos agrupamentos",
        ["atp-009"],
      ),
      block("bl-031", "fri", "09:30", "10:50", "Atividade pedagógica", "Atividade multietapa", [
        "atp-009",
      ]),
    ],
    history: [
      {
        id: "grd-003-h1",
        title: "Elaboração iniciada",
        date: "18 set 2026",
        note: "Agrupamentos permanecem associados à mesma turma.",
      },
    ],
  },
  {
    id: "grd-004-v1",
    classId: "tur-004",
    journeyId: "jor-004",
    label: "Versão 1",
    state: "Publicada",
    effectiveFrom: "2026-02-10",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-040",
        "mon",
        "18:30",
        "19:20",
        "Atividade pedagógica",
        "Campo pedagógico demonstrativo da EJA",
        ["atp-007"],
      ),
      block("bl-041", "sat", "08:00", "09:30", "Atividade pedagógica", "Organização por fases", [
        "atp-007",
      ]),
    ],
    history: [
      {
        id: "grd-004-h1",
        title: "Grade publicada",
        date: "12 fev 2026",
        note: "Estado conceitual demonstrativo.",
      },
    ],
  },
  {
    id: "grd-005-v1",
    classId: "tur-005",
    journeyId: "jor-005",
    label: "Versão 1",
    state: "Em elaboração",
    effectiveFrom: "2026-02-05",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-050",
        "mon",
        "12:40",
        "13:30",
        "Aula",
        "Componente curricular demonstrativo — Ciências",
        ["atp-006"],
        "Requer revisão",
        "Sobreposição potencial com outra unidade para a mesma Pessoa.",
      ),
      block(
        "bl-051",
        "wed",
        "13:30",
        "14:25",
        "Aula",
        "Componente curricular demonstrativo — Ciências",
        ["atp-006"],
      ),
    ],
    history: [
      {
        id: "grd-005-h1",
        title: "Elaboração iniciada",
        date: "19 set 2026",
        note: "Compatibilidade administrativa pendente.",
      },
    ],
  },
  {
    id: "grd-006-v1",
    classId: "tur-006",
    journeyId: "jor-006",
    label: "Versão histórica 1",
    state: "Histórica",
    effectiveFrom: "2025-02-03",
    effectiveUntil: "2025-12-19",
    referenceDate: "2025-12-19",
    blocks: [
      block(
        "bl-060",
        "mon",
        "07:10",
        "08:00",
        "Aula",
        "Componente curricular demonstrativo — Matemática",
        ["atp-003"],
      ),
    ],
    history: [
      {
        id: "grd-006-h1",
        title: "Grade preservada como histórica",
        date: "19 dez 2025",
        note: "Não é reinterpretada pela configuração atual.",
      },
    ],
  },
  {
    id: "grd-007-v0",
    classId: "tur-007",
    journeyId: "jor-007",
    label: "Sem versão",
    state: "Não iniciada",
    effectiveFrom: "2026-02-12",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [],
    history: [],
  },
  {
    id: "grd-009-v1",
    classId: "tur-009",
    journeyId: "jor-009",
    label: "Versão 1",
    state: "Em elaboração",
    effectiveFrom: "2026-02-05",
    referenceDate: SCHEDULE_REFERENCE_DATE,
    blocks: [
      block(
        "bl-090",
        "tue",
        "07:30",
        "09:00",
        "Atividade pedagógica",
        "Campo de experiência demonstrativo da Educação Infantil",
        ["atp-002"],
      ),
    ],
    history: [
      {
        id: "grd-009-h1",
        title: "Elaboração iniciada",
        date: "21 set 2026",
        note: "Turma multietapa preservada como registro único.",
      },
    ],
  },
];

export const scheduleScenarios = [
  ["A", "Turma com jornada e grade completa", "tur-001"],
  ["B", "Turma com jornada, mas sem grade", "tur-007"],
  ["C", "Jornadas diferentes entre turnos", "jor-001,jor-005"],
  ["D", "Durações de aulas diferentes", "grd-001-v2,grd-005-v1"],
  ["E", "Jornada com dias diferentes", "jor-003"],
  ["F", "Educação Infantil", "tur-002"],
  ["G", "Ensino Fundamental Anos Iniciais", "tur-001"],
  ["H", "Ensino Fundamental Anos Finais", "tur-005"],
  ["I", "EJA", "tur-004"],
  ["J", "Turma multisseriada", "tur-003"],
  ["K", "Profissional em duas escolas", "pro-003"],
  ["L", "Profissional com dois vínculos", "pro-008"],
  ["M", "Conflito temporal potencial entre escolas", "bl-022,bl-050"],
  ["N", "Dois profissionais no mesmo componente", "bl-001"],
  ["O", "Substituição temporária", "bl-007"],
  ["P", "Grade em elaboração", "grd-003-v1"],
  ["Q", "Grade publicada", "grd-001-v2"],
  ["R", "Grade histórica", "grd-006-v1"],
  ["S", "Informação insuficiente", "tur-008"],
  ["T", "Intervalo ou atividade sem componente disciplinar", "bl-021,bl-023"],
] as const;

export function getJourneyForClass(classId: string) {
  return schoolJourneys.find((item) => item.classId === classId);
}
export function getScheduleForClass(classId: string) {
  return scheduleVersions.find((item) => item.classId === classId);
}
export function schedulesForUnit(unitId: string) {
  return scheduleVersions.filter(
    (schedule) => getDemonstrationClass(schedule.classId)?.unitId === unitId,
  );
}
export function scheduleBlocksForAssignment(assignmentId: string) {
  return scheduleVersions
    .flatMap((schedule) => schedule.blocks.map((blockItem) => ({ schedule, block: blockItem })))
    .filter(({ block: item }) => item.assignmentIds.includes(assignmentId));
}
export function scheduleBlocksForProfessional(professionalId: string) {
  const assignmentIds = new Set(
    demonstrationPedagogicalAssignments
      .filter((item) => item.professionalId === professionalId)
      .map((item) => item.id),
  );
  return scheduleVersions
    .flatMap((schedule) => schedule.blocks.map((blockItem) => ({ schedule, block: blockItem })))
    .filter(({ block: item }) => item.assignmentIds.some((id) => assignmentIds.has(id)));
}
function minutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}
function overlaps(a: ScheduleBlock, b: ScheduleBlock) {
  return a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
}

export type ScheduleConflict = {
  id: string;
  professionalId: string;
  blockIds: [string, string];
  classIds: [string, string];
  unitIds: [string, string];
  situation: ScheduleSituation;
  explanation: string;
};
export function detectPotentialConflicts(): ScheduleConflict[] {
  const results: ScheduleConflict[] = [];
  for (const professional of demonstrationPedagogicalAssignments
    .map((item) => item.professionalId)
    .filter((id, index, all) => all.indexOf(id) === index)) {
    const entries = scheduleBlocksForProfessional(professional).filter(
      ({ block: item }) => item.assignmentIds.length > 0,
    );
    for (let left = 0; left < entries.length; left += 1)
      for (let right = left + 1; right < entries.length; right += 1) {
        const a = entries[left];
        const b = entries[right];
        if (!a || !b || a.schedule.classId === b.schedule.classId || !overlaps(a.block, b.block))
          continue;
        const classA = getDemonstrationClass(a.schedule.classId);
        const classB = getDemonstrationClass(b.schedule.classId);
        if (!classA || !classB) continue;
        results.push({
          id: `conf-${a.block.id}-${b.block.id}`,
          professionalId: professional,
          blockIds: [a.block.id, b.block.id],
          classIds: [classA.id, classB.id],
          unitIds: [classA.unitId, classB.unitId],
          situation: "Conflito temporal potencial",
          explanation: `Mesma Pessoa em ${getClassUnitName(classA.unitId)} e ${getClassUnitName(classB.unitId)}, ${WEEK_DAYS.find((day) => day.id === a.block.day)?.label}, com intervalos sobrepostos. Requer validação; não constitui infração automática.`,
        });
      }
  }
  return results;
}
export function scheduleSituation(schedule?: ScheduleVersion): ScheduleSituation {
  if (!schedule || schedule.state === "Não iniciada") return "Informação insuficiente";
  if (detectPotentialConflicts().some((conflict) => conflict.classIds.includes(schedule.classId)))
    return "Conflito temporal potencial";
  if (schedule.blocks.some((item) => item.status === "Requer revisão"))
    return "Compatibilidade pendente de validação";
  if (schedule.blocks.some((item) => item.status === "Sem distribuição"))
    return "Informação insuficiente";
  return "Situação sem conflito identificado";
}
export function scheduleStateTone(state: SchedulePublicationState) {
  if (state === "Publicada") return "success" as const;
  if (state === "Pronta para revisão" || state === "Em elaboração") return "warning" as const;
  return "neutral" as const;
}
export function scheduleSituationTone(state: ScheduleSituation) {
  if (
    state === "Conflito temporal potencial" ||
    state === "Incompatibilidade estrutural demonstrativa"
  )
    return "danger" as const;
  if (state === "Compatibilidade pendente de validação" || state === "Informação insuficiente")
    return "warning" as const;
  return "success" as const;
}
export function blockContexts(blockItem: ScheduleBlock) {
  return blockItem.assignmentIds
    .map((id) => getPedagogicalAssignment(id))
    .filter((item) => Boolean(item))
    .map((assignment) =>
      assignment ? { assignment, context: pedagogicalContext(assignment) } : undefined,
    )
    .filter((item) => Boolean(item));
}
export function scheduleConsistencyIssues() {
  const issues: string[] = [];
  for (const journey of schoolJourneys)
    if (!getDemonstrationClass(journey.classId))
      issues.push(`Jornada ${journey.id} referencia turma inexistente.`);
  for (const schedule of scheduleVersions) {
    const klass = getDemonstrationClass(schedule.classId);
    if (!klass) issues.push(`Grade ${schedule.id} referencia turma inexistente.`);
    if (
      !schoolJourneys.some(
        (item) => item.id === schedule.journeyId && item.classId === schedule.classId,
      )
    )
      issues.push(`Grade ${schedule.id} não corresponde à jornada da turma.`);
    for (const planned of schedule.blocks)
      for (const assignmentId of planned.assignmentIds) {
        const assignment = getPedagogicalAssignment(assignmentId);
        if (!assignment || assignment.classId !== schedule.classId)
          issues.push(`Bloco ${planned.id} contradiz a atuação ${assignmentId}.`);
      }
  }
  return issues;
}
export function scheduleRowForClass(classId: string) {
  const klass = getDemonstrationClass(classId);
  if (!klass) return undefined;
  const journey = getJourneyForClass(classId);
  const schedule = getScheduleForClass(classId);
  return {
    klass,
    journey,
    schedule,
    unitName: getClassUnitName(klass.unitId),
    situation: scheduleSituation(schedule),
  };
}
export const scheduleClassRows = demonstrationClasses
  .map((item) => scheduleRowForClass(item.id))
  .filter((item) => Boolean(item));
export function professionalScheduleSummary(professionalId: string) {
  const professional = getDemonstrationProfessional(professionalId);
  const entries = scheduleBlocksForProfessional(professionalId);
  const conflicts = detectPotentialConflicts().filter(
    (item) => item.professionalId === professionalId,
  );
  return {
    professional,
    entries,
    conflicts,
    assignments: demonstrationPedagogicalAssignments.filter(
      (item) => item.professionalId === professionalId,
    ),
  };
}

export const SCHEDULE_CONCEPT_NOTE =
  "A jornada define funcionamento; a grade distribui o planejamento recorrente; o calendário define datas civis e eventos; a aula efetivamente ministrada será registrada futuramente no Diário de Classe.";
export const SCHEDULE_AUTHORIZATION_NOTE =
  "A autorização futura considerará capacidade, finalidade, escopo, unidade, período e contexto funcional. Lotação, cargo ou função isolados não concedem acesso irrestrito aos horários da rede.";
export const SCHEDULE_DEMONSTRATION_NOTE =
  "Dados integralmente fictícios. Consulta demonstrativa sem publicação, edição ou persistência real.";
