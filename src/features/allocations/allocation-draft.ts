/**
 * ALOCAÇÃO EM TURMA E MOVIMENTAÇÃO — modelo demonstrativo (Etapa 8E).
 *
 * Escopo conceitual completo:
 * PESSOA → ALUNO → MATRÍCULA ESCOLAR → VÍNCULO LETIVO → PARTICIPAÇÃO → ALOCAÇÃO EM TURMA.
 *
 * Invariantes conceituais preservadas:
 * - o aluno NÃO possui turma como atributo permanente: a alocação é a relação
 *   temporal entre uma PARTICIPAÇÃO e uma TURMA;
 * - participação e alocação são conceitos distintos; a alocação nunca cria,
 *   altera ou substitui participação, vínculo letivo ou matrícula escolar;
 * - a alocação possui vigência e pode terminar antes do fim do período letivo;
 * - movimentação encerra a alocação anterior e cria uma nova, preservando ambas;
 * - movimentação é uma operação conceitualmente ATÔMICA e não é transferência;
 * - turma multisseriada/multietapa preserva o agrupamento correspondente;
 * - a EJA preserva suas fases; nada é convertido em ano/série;
 * - turma encerrada permanece consultável, mas não recebe nova alocação;
 * - nenhuma regra de elegibilidade, capacidade ou reclassificação é inventada.
 *
 * Nada é persistido.
 */
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";
import {
  demonstrationStudents,
  type ClassAllocation,
  type ParticipationNature,
} from "@/features/students/students-data";
import { getPersonByStudentId } from "@/features/students/person-draft";
import {
  demonstrationClasses,
  getClassUnitName,
  type DemonstrationClass,
} from "@/features/classes/classes-data";

export const ALLOCATION_SCOPE_NOTE =
  "Esta operação não altera a matrícula escolar, o vínculo letivo nem a participação.";

export const COMPATIBILITY_PENDING_NOTE = "Compatibilidade requer validação.";

export const CAPACITY_PENDING_NOTE = "Capacidade requer validação.";

export const RECLASSIFICATION_BLOCK_NOTE =
  "Alteração de organização acadêmica requer operação específica.";

export const MOVEMENT_NOT_TRANSFER_NOTE =
  "Movimentação de turma é mudança interna de alocação dentro do contexto escolar apropriado. Transferência envolve a relação escolar com a unidade e será tratada em fluxo posterior.";

export const ATOMICITY_NOTE =
  "Operação única: encerra a alocação anterior e cria a nova alocação, preservando ambas no histórico. Sucesso parcial não é representado.";

export const NO_PARTICIPATION_NOTE =
  "Nenhuma participação disponível neste contexto. A participação pertence ao fluxo de vínculo letivo e não é criada dentro da enturmação.";

export const NO_CURRENT_ALLOCATION_LABEL = "Sem turma atual.";

export const ACTIVE_ALLOCATION_CONFLICT_NOTE =
  "Esta participação já possui alocação vigente. Nenhuma alocação é encerrada silenciosamente: use o fluxo de movimentação entre turmas.";

export const DATA_MINIMIZATION_ALLOCATION_NOTE =
  "Somente as informações necessárias à operação são exibidas: nenhum CPF, endereço, filiação, contato familiar, dado de saúde, laudo ou informação sensível.";

/** Referência fictícia de ocupação. Não é regra oficial de capacidade. */
export const DEMO_CAPACITY_REFERENCE = 25;

export const ALLOCATION_SECTIONS = [
  { id: "aluno", label: "Aluno e contexto", available: true },
  { id: "participacao", label: "Participação", available: true },
  { id: "turma", label: "Turma de destino", available: true },
  { id: "agrupamento", label: "Agrupamento e contexto acadêmico", available: true },
  { id: "vigencia", label: "Vigência da alocação", available: true },
  { id: "conflitos", label: "Conflitos e avisos", available: true },
  { id: "revisao", label: "Revisar e concluir", available: true },
  { id: "horarios", label: "Horários e atribuição docente", available: false },
] as const;

export const MOVEMENT_SECTIONS = [
  { id: "aluno", label: "Aluno e contexto", available: true },
  { id: "participacao", label: "Participação", available: true },
  { id: "atual", label: "Alocação atual", available: true },
  { id: "turma", label: "Turma de destino", available: true },
  { id: "agrupamento", label: "Agrupamento e contexto acadêmico", available: true },
  { id: "vigencia", label: "Data da movimentação", available: true },
  { id: "conflitos", label: "Conflitos e avisos", available: true },
  { id: "revisao", label: "Revisar e concluir", available: true },
] as const;

/**
 * PARTICIPAÇÃO como ponto de partida da alocação. A enturmação nunca cria
 * participação: ela apenas parte de uma já existente.
 */
export type ParticipationTarget = {
  id: string;
  studentId: string;
  studentName: string;
  sigemId: string;
  unitId: string;
  unitNameAtTime: string;
  enrollmentId: string;
  enrollmentNumber: string;
  academicLinkId: string;
  periodLabel: string;
  periodNote: string;
  offerLabel: string;
  academicOrganization: string;
  participationLabel: string;
  nature: ParticipationNature;
  participationSituation: string;
  participationNote: string;
  allocations: ClassAllocation[];
};

/**
 * Fixtures locais desta etapa: participações existentes AINDA SEM alocação,
 * para demonstrar a enturmação inicial ("Sem turma atual.").
 */
const LOCAL_TARGETS: Array<
  Omit<ParticipationTarget, "studentName" | "sigemId"> & { studentId: string }
> = [
  {
    id: "part-demo-9001",
    studentId: "alu-005",
    unitId: "demo-001",
    unitNameAtTime: "Instituição Educacional Demonstrativa Horizonte",
    enrollmentId: "alu-005-me1",
    enrollmentNumber: "ME-DEMO-1005",
    academicLinkId: "part-demo-9001-vl",
    periodLabel: "Período letivo 2026",
    periodNote:
      "Período letivo demonstrativo: organização temporal própria, não equivalente ao ano civil.",
    offerLabel: "Ensino Fundamental — 1º segmento",
    academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    participationLabel: "Participação regular",
    nature: "Regular",
    participationSituation: "Em andamento",
    participationNote:
      "Participação regular demonstrativa sem alocação em turma: o aluno permanece aluno mesmo sem turma atual.",
    allocations: [],
  },
  {
    id: "part-demo-9002",
    studentId: "alu-003",
    unitId: "demo-003",
    unitNameAtTime: "Unidade Educacional Demonstrativa do Campo",
    enrollmentId: "alu-003-me1",
    enrollmentNumber: "ME-DEMO-1003",
    academicLinkId: "part-demo-9002-vl",
    periodLabel: "Período letivo 2026",
    periodNote: "Período letivo demonstrativo da unidade do campo.",
    offerLabel: "Ensino Fundamental — 1º segmento",
    academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    participationLabel: "Participação regular",
    nature: "Regular",
    participationSituation: "Em andamento",
    participationNote:
      "Participação regular demonstrativa em unidade com turma multietapa: o agrupamento correspondente deve ser registrado.",
    allocations: [],
  },
];

function targetsFromStudents(): ParticipationTarget[] {
  return demonstrationStudents.flatMap((student) => {
    const person = getPersonByStudentId(student.id);
    const studentName = person?.socialName ?? student.personName;
    return student.enrollments.flatMap((enrollment) =>
      enrollment.academicLinks.flatMap((link) =>
        link.participations.map((participation) => ({
          id: participation.id,
          studentId: student.id,
          studentName,
          sigemId: student.sigemId,
          unitId: link.unitId,
          unitNameAtTime: link.unitNameAtTime,
          enrollmentId: enrollment.id,
          enrollmentNumber: enrollment.number,
          academicLinkId: link.id,
          periodLabel: link.periodLabel,
          periodNote: link.periodNote,
          offerLabel: link.offerLabel,
          academicOrganization: link.academicOrganization,
          participationLabel: participation.label,
          nature: participation.nature,
          participationSituation: participation.situation,
          participationNote: participation.note,
          allocations: participation.allocations,
        })),
      ),
    );
  });
}

export function listParticipationTargets(): ParticipationTarget[] {
  const locals = LOCAL_TARGETS.map((item) => {
    const student = demonstrationStudents.find((candidate) => candidate.id === item.studentId);
    const person = student ? getPersonByStudentId(student.id) : null;
    return {
      ...item,
      studentName: person?.socialName ?? student?.personName ?? "Aluno demonstrativo",
      sigemId: student?.sigemId ?? "SIGEM-AL-000000",
    } satisfies ParticipationTarget;
  });
  return [...targetsFromStudents(), ...locals];
}

export function getParticipationTarget(id: string | null): ParticipationTarget | null {
  if (!id) return null;
  return listParticipationTargets().find((target) => target.id === id) ?? null;
}

export function targetsForStudent(studentId: string): ParticipationTarget[] {
  return listParticipationTargets().filter((target) => target.studentId === studentId);
}

/** Participações que já poderiam ser movimentadas: possuem alocação vigente. */
export function movableTargets(): ParticipationTarget[] {
  return listParticipationTargets().filter((target) => currentAllocation(target) !== null);
}

export function currentAllocation(target: ParticipationTarget | null): ClassAllocation | null {
  if (!target) return null;
  return target.allocations.find((allocation) => allocation.situation === "Vigente") ?? null;
}

export function historicalAllocations(target: ParticipationTarget | null): ClassAllocation[] {
  if (!target) return [];
  return target.allocations.filter((allocation) => allocation.situation !== "Vigente");
}

/**
 * Comparação demonstrativa do contexto temporal. O rótulo do período letivo pode
 * variar (a EJA tem organização temporal própria), então a comparação usa a
 * referência numérica do período e nunca presume ano civil.
 */
function periodReference(label: string): number | undefined {
  const match = /\d{4}/.exec(label);
  return match ? Number(match[0]) : undefined;
}

function samePeriodContext(item: DemonstrationClass, target: ParticipationTarget): boolean {
  if (item.academicPeriod.label === target.periodLabel) return true;
  const reference = periodReference(target.periodLabel);
  return reference !== undefined && reference === item.academicPeriod.order;
}

/**
 * Elegibilidade DEMONSTRATIVA da turma de destino. Não é motor de elegibilidade:
 * turmas claramente incompatíveis não são apresentadas como opção normal e a
 * compatibilidade incerta é identificada visualmente.
 */
export type ClassEligibility =
  "compativel" | "incerta" | "organizacao-divergente" | "periodo-divergente" | "historica";

export type ClassOption = {
  item: DemonstrationClass;
  eligibility: ClassEligibility;
  selectable: boolean;
  reason: string;
  capacityNote: string;
  capacityWarning: boolean;
};

function capacityFor(item: DemonstrationClass) {
  const warning = item.demonstrativeHeadcount >= DEMO_CAPACITY_REFERENCE;
  return {
    capacityWarning: warning,
    capacityNote: warning
      ? `Ocupação demonstrativa de ${item.demonstrativeHeadcount} estudante(s), acima da referência fictícia de ${DEMO_CAPACITY_REFERENCE}. ${CAPACITY_PENDING_NOTE} Nada é bloqueado por números fictícios e excedente autorizado poderá existir.`
      : `Ocupação demonstrativa de ${item.demonstrativeHeadcount} estudante(s). ${CAPACITY_PENDING_NOTE}`,
  };
}

export function classOptionsForTarget(target: ParticipationTarget | null): ClassOption[] {
  if (!target) return [];
  return demonstrationClasses
    .filter((item) => item.unitId === target.unitId)
    .map((item) => {
      const capacity = capacityFor(item);
      if (item.situation === "Encerrada") {
        return {
          item,
          eligibility: "historica" as const,
          selectable: false,
          reason:
            "Turma encerrada: permanece consultável como fato histórico e não recebe nova alocação.",
          ...capacity,
        };
      }
      if (!samePeriodContext(item, target)) {
        return {
          item,
          eligibility: "periodo-divergente" as const,
          selectable: false,
          reason: `Turma registrada em outro contexto temporal (${item.academicPeriod.label}); a alocação pertence ao período letivo da participação.`,
          ...capacity,
        };
      }
      if (item.academicOrganization !== target.academicOrganization) {
        return {
          item,
          eligibility: "organizacao-divergente" as const,
          selectable: false,
          reason: `${RECLASSIFICATION_BLOCK_NOTE} A troca de turma não altera o contexto acadêmico formal do aluno (${target.academicOrganization}).`,
          ...capacity,
        };
      }
      if (target.nature !== "Regular") {
        return {
          item,
          eligibility: "incerta" as const,
          selectable: true,
          reason: `${COMPATIBILITY_PENDING_NOTE} As regras de alocação de participações complementares e de AEE ainda não estão definidas.`,
          ...capacity,
        };
      }
      return {
        item,
        eligibility: "compativel" as const,
        selectable: true,
        reason:
          "Turma demonstrativamente compatível com unidade, período letivo, oferta e organização acadêmica da participação.",
        ...capacity,
      };
    });
}

export function selectableClassOptions(target: ParticipationTarget | null) {
  return classOptionsForTarget(target).filter((option) => option.selectable);
}

export function blockedClassOptions(target: ParticipationTarget | null) {
  return classOptionsForTarget(target).filter((option) => !option.selectable);
}

export function getClassOption(target: ParticipationTarget | null, classId: string) {
  return classOptionsForTarget(target).find((option) => option.item.id === classId) ?? null;
}

/** Turma com um único agrupamento não exige campo redundante de série/agrupamento. */
export function requiresGroupingChoice(item: DemonstrationClass | null | undefined) {
  return Boolean(item && item.groupings.length > 1);
}

export function unitNameOf(unitId: string) {
  return getClassUnitName(unitId);
}

/* ------------------------------ datas ------------------------------ */

export function formatBrDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function previousDay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------ rascunho ------------------------------ */

export type AllocationMode = "enturmacao" | "movimentacao";

export type AllocationDraft = {
  targetId: string | null;
  classId: string;
  groupingLabel: string;
  /** Início da alocação (enturmação) ou data efetiva da movimentação. */
  startDate: string;
  /** Término quando aplicável; alocação atual pode permanecer sem término. */
  endDate: string;
  note: string;
};

export function createBlankAllocationDraft(targetId?: string | null, classId?: string | null) {
  return {
    targetId: targetId ?? null,
    classId: classId ?? "",
    groupingLabel: "",
    startDate: "",
    endDate: "",
    note: "",
  } satisfies AllocationDraft;
}

export function isAllocationDraftDirty(draft: AllocationDraft, initial: AllocationDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export type AllocationIssueField =
  "targetId" | "classId" | "groupingLabel" | "startDate" | "endDate" | "conflito" | "capacidade";

export type AllocationIssue = {
  id: string;
  field: AllocationIssueField;
  severity: "erro" | "aviso";
  message: string;
};

export function allocationIssueFor(issues: AllocationIssue[], field: AllocationIssueField) {
  return issues.find((issue) => issue.field === field);
}

/**
 * Vigência demonstrativa resultante: na movimentação, a alocação anterior é
 * encerrada no dia anterior à data efetiva e a nova começa na data efetiva.
 */
export type MovementPreview = {
  previousFrom: string;
  previousUntil: string;
  nextFrom: string;
};

export function movementPreview(
  allocation: ClassAllocation | null,
  effectiveDate: string,
): MovementPreview | null {
  if (!allocation || !effectiveDate) return null;
  const until = previousDay(effectiveDate);
  return {
    previousFrom: formatAcademicDate(allocation.from),
    previousUntil: until ? formatBrDate(until) : "",
    nextFrom: formatBrDate(effectiveDate),
  };
}

/** Compatibilidade: delega ao parser canônico. */
export function labelToIso(label: string): string | null {
  return parseAcademicDate(label);
}

export function validateAllocationDraft(
  draft: AllocationDraft,
  mode: AllocationMode,
  target: ParticipationTarget | null,
): AllocationIssue[] {
  const issues: AllocationIssue[] = [];
  const option = target ? getClassOption(target, draft.classId) : null;
  const active = currentAllocation(target);

  if (!draft.targetId || !target) {
    issues.push({
      id: "target",
      field: "targetId",
      severity: "erro",
      message:
        "Participação não selecionada: a alocação parte de uma participação existente e nunca cria uma participação.",
    });
  }
  if (!draft.classId) {
    issues.push({
      id: "class",
      field: "classId",
      severity: "erro",
      message: "Turma de destino não selecionada.",
    });
  } else if (!option || !option.selectable) {
    issues.push({
      id: "class-blocked",
      field: "classId",
      severity: "erro",
      message: option?.reason ?? "Turma indisponível como opção de alocação.",
    });
  }
  if (option && requiresGroupingChoice(option.item) && !draft.groupingLabel) {
    issues.push({
      id: "grouping",
      field: "groupingLabel",
      severity: "erro",
      message:
        "Turma com mais de um agrupamento: registre o agrupamento correspondente ao contexto acadêmico do aluno. Os agrupamentos não são concatenados em uma série única.",
    });
  }
  if (!draft.startDate) {
    issues.push({
      id: "start",
      field: "startDate",
      severity: "erro",
      message:
        mode === "movimentacao"
          ? "Data efetiva da movimentação não informada: a alocação possui vigência."
          : "Início da alocação não informado: a alocação possui vigência temporal.",
    });
  }
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
    issues.push({
      id: "end",
      field: "endDate",
      severity: "erro",
      message: "Término da alocação anterior ao início informado.",
    });
  }

  if (mode === "enturmacao" && active) {
    issues.push({
      id: "active-conflict",
      field: "conflito",
      severity: "erro",
      message: `Conflito de alocação: ${ACTIVE_ALLOCATION_CONFLICT_NOTE}`,
    });
  }

  if (mode === "movimentacao") {
    if (!active) {
      issues.push({
        id: "no-active",
        field: "conflito",
        severity: "erro",
        message:
          "Nenhuma alocação vigente para movimentar. A enturmação inicial é a operação apropriada quando não há turma atual.",
      });
    } else {
      const activeStart = labelToIso(active.from);
      if (draft.startDate && activeStart && draft.startDate <= activeStart) {
        issues.push({
          id: "overlap",
          field: "startDate",
          severity: "erro",
          message: `Sobreposição de vigência: a data efetiva deve ser posterior ao início da alocação atual (${formatAcademicDate(active.from)}). A continuidade temporal das alocações precisa permanecer coerente.`,
        });
      }
      if (draft.classId && active.classId && draft.classId === active.classId) {
        issues.push({
          id: "same-class",
          field: "classId",
          severity: "erro",
          message: "Turma de destino igual à turma atual: não há movimentação a representar.",
        });
      }
    }
  }

  if (option?.eligibility === "incerta") {
    issues.push({
      id: "uncertain",
      field: "classId",
      severity: "aviso",
      message: option.reason,
    });
  }
  if (option?.capacityWarning) {
    issues.push({
      id: "capacity",
      field: "capacidade",
      severity: "aviso",
      message: option.capacityNote,
    });
  }
  if (!draft.endDate && mode === "enturmacao") {
    issues.push({
      id: "open-ended",
      field: "endDate",
      severity: "aviso",
      message:
        "Alocação sem término definido: uma alocação atual pode permanecer aberta e não pressupõe durar todo o período letivo.",
    });
  }

  return issues;
}
