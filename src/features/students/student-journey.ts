import {
  currentAcademicLink,
  currentEnrollment,
  type DemonstrationStudent,
  type StudentParticipation,
} from "@/features/students/students-data";

export type StudentJourneyAction =
  | { kind: "enrollment"; label: string; description: string }
  | { kind: "academic-link"; label: string; description: string; enrollmentId: string }
  | { kind: "allocation"; label: string; description: string; participationId: string }
  | { kind: "movement"; label: string; description: string; participationId: string }
  | { kind: "review"; label: string; description: string };

export type StudentJourneySummary = {
  enrollment: ReturnType<typeof currentEnrollment>;
  academicLink: ReturnType<typeof currentAcademicLink>;
  regularParticipation: StudentParticipation | null;
  complementaryParticipations: StudentParticipation[];
  pendingItems: string[];
  nextAction: StudentJourneyAction;
};

export function studentJourneySummary(student: DemonstrationStudent): StudentJourneySummary {
  const enrollment = currentEnrollment(student);
  const academicLink = currentAcademicLink(student);
  const activeParticipations =
    academicLink?.participations.filter(
      (participation) => participation.situation === "Em andamento",
    ) ?? [];
  const regularParticipation =
    activeParticipations.find((participation) => participation.nature === "Regular") ?? null;
  const complementaryParticipations = activeParticipations.filter(
    (participation) => participation.nature === "Complementar",
  );
  const activeAllocation = regularParticipation?.allocations.find(
    (allocation) => allocation.situation === "Vigente",
  );

  const pendingItems: string[] = [];
  if (!enrollment) pendingItems.push("Sem matrícula escolar vigente.");
  if (enrollment && !academicLink) pendingItems.push("Sem vínculo letivo em andamento.");
  if (academicLink && !regularParticipation)
    pendingItems.push("Sem participação regular em andamento.");
  if (regularParticipation && !activeAllocation)
    pendingItems.push("Participação regular sem turma atual.");
  for (const participation of complementaryParticipations) {
    if (!participation.allocations.some((allocation) => allocation.situation === "Vigente")) {
      pendingItems.push(
        `${participation.label}: sem alocação vigente; verificar apenas se aplicável.`,
      );
    }
  }

  let nextAction: StudentJourneyAction;
  if (student.currentSituation === "Sem participação atual") {
    nextAction = {
      kind: "review",
      label: "Revisar trajetória escolar",
      description: "Não há operação acadêmica automática indicada para este contexto histórico.",
    };
  } else if (!enrollment) {
    nextAction = {
      kind: "enrollment",
      label: "Ingresso e matrícula escolar",
      description: "Criar ou reutilizar o vínculo permanente do aluno com uma unidade escolar.",
    };
  } else if (!academicLink) {
    nextAction = {
      kind: "academic-link",
      label: "Criar vínculo letivo",
      description: "Abrir um novo contexto temporal a partir da matrícula escolar existente.",
      enrollmentId: enrollment.id,
    };
  } else if (regularParticipation && !activeAllocation) {
    nextAction = {
      kind: "allocation",
      label: "Enturmar participação regular",
      description: "Relacionar temporalmente a participação existente a uma turma compatível.",
      participationId: regularParticipation.id,
    };
  } else if (regularParticipation && activeAllocation) {
    nextAction = {
      kind: "movement",
      label: "Movimentar entre turmas",
      description: "Encerrar a alocação atual e criar outra, preservando o histórico.",
      participationId: regularParticipation.id,
    };
  } else {
    nextAction = {
      kind: "review",
      label: "Revisar trajetória escolar",
      description: "Não há operação acadêmica automática indicada para este contexto histórico.",
    };
  }

  return {
    enrollment,
    academicLink,
    regularParticipation,
    complementaryParticipations,
    pendingItems,
    nextAction,
  };
}
