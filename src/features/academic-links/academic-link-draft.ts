/**
 * VÍNCULO LETIVO, RENOVAÇÃO E PARTICIPAÇÃO — modelo demonstrativo (Etapa 8D).
 *
 * Escopo conceitual: PESSOA → ALUNO → MATRÍCULA ESCOLAR → VÍNCULO LETIVO →
 * PARTICIPAÇÃO. A alocação em turma pertence a fluxo posterior.
 *
 * Invariantes conceituais preservadas:
 * - a MATRÍCULA ESCOLAR permanece a mesma na continuidade dentro da unidade;
 * - o VÍNCULO LETIVO é temporal: renovar cria novo contexto e nunca reescreve
 *   o vínculo anterior;
 * - período letivo não é ano civil nem período avaliativo;
 * - organização acadêmica não é sempre "série": a EJA organiza-se em fases;
 * - PARTICIPAÇÃO é distinta do vínculo letivo, aceita coexistência e o AEE não
 *   é atributo da identidade do aluno;
 * - nenhuma regra de coexistência é inventada: quando não definida, avisa.
 *
 * Nada é persistido. Nenhum identificador possui algoritmo definitivo.
 */
import {
  demonstrationStudents,
  type AcademicLink,
  type ParticipationNature,
  type SchoolEnrollment,
} from "@/features/students/students-data";
import { getPersonByStudentId } from "@/features/students/person-draft";
import { getCurriculumMatrix, getUnitOffers } from "@/features/curriculum/curriculum-data";
import { organizationsForOffer, getOffer } from "@/features/classes/class-draft";

export const ACADEMIC_LINK_SCOPE_NOTE = "Esta operação não aloca o aluno em uma turma.";

export const COEXISTENCE_PENDING_NOTE = "Regra de coexistência requer validação.";

export const REGULAR_CONFLICT_WARNING =
  "Existe participação regular registrada em outra unidade para período sobreposto.";

export const NO_ENROLLMENT_NOTE =
  "Nenhuma matrícula escolar disponível para este contexto. O ingresso (Aluno → Matrícula Escolar) é uma operação anterior e diferente do vínculo letivo.";

export const RECLASSIFICATION_NOTE =
  "Mudança de contexto acadêmico não explicada por continuidade simples dependerá de operações formais futuras. A edição direta de vínculo letivo não é mecanismo de reclassificação.";

export const PERIOD_NOT_CIVIL_YEAR_NOTE =
  "Período letivo é uma organização temporal própria: não equivale ao ano civil nem ao período avaliativo.";

export const ACADEMIC_LINK_SECTIONS = [
  { id: "matricula", label: "Matrícula escolar", available: true },
  { id: "periodo", label: "Período letivo", available: true },
  { id: "oferta", label: "Oferta educacional", available: true },
  { id: "organizacao", label: "Organização acadêmica", available: true },
  { id: "participacao", label: "Participação", available: true },
  { id: "matriz", label: "Matriz curricular contextual", available: true },
  { id: "alocacao", label: "Alocação em turma", available: false },
  { id: "revisao", label: "Revisar e concluir", available: true },
] as const;

/** Catálogo demonstrativo de participações; não é enumeração definitiva. */
export const PARTICIPATION_CATALOGUE: Array<{
  label: string;
  nature: ParticipationNature;
  note: string;
}> = [
  {
    label: "Participação regular",
    nature: "Regular",
    note: "Escolarização principal do aluno neste contexto letivo.",
  },
  {
    label: "Atendimento educacional especializado (AEE)",
    nature: "Complementar",
    note: "Pode coexistir com a participação regular e não a substitui. Não é atributo da identidade Pessoa/Aluno nem campo da ficha cadastral.",
  },
  {
    label: "Atividade complementar demonstrativa",
    nature: "Complementar",
    note: "Participação complementar separada da regular; não altera a organização acadêmica principal.",
  },
  {
    label: "Atendimento domiciliar/hospitalar demonstrativo",
    nature: "Complementar",
    note: "Representação demonstrativa de participação que pode não depender de participação regular simultânea.",
  },
];

export const REGULAR_PARTICIPATION_LABEL = PARTICIPATION_CATALOGUE[0]!.label;
export const AEE_PARTICIPATION_LABEL = PARTICIPATION_CATALOGUE[1]!.label;

export function participationNature(label: string): ParticipationNature | null {
  return PARTICIPATION_CATALOGUE.find((item) => item.label === label)?.nature ?? null;
}

export function participationNote(label: string) {
  return PARTICIPATION_CATALOGUE.find((item) => item.label === label)?.note ?? "";
}

/**
 * Coexistência: apenas a combinação demonstrada (regular + AEE) é apresentada
 * como claramente coexistente. Nada é bloqueado academicamente.
 */
export function coexistenceLabel(labels: string[]): string {
  if (labels.length < 2) return "Participação única neste vínculo letivo.";
  const hasRegular = labels.includes(REGULAR_PARTICIPATION_LABEL);
  const onlyRegularAndAee =
    labels.length === 2 && hasRegular && labels.includes(AEE_PARTICIPATION_LABEL);
  if (onlyRegularAndAee) {
    return "Coexistência demonstrada: participação regular e AEE convivem no mesmo vínculo letivo.";
  }
  return COEXISTENCE_PENDING_NOTE;
}

/** Matrícula escolar de origem: o vínculo letivo sempre parte de uma existente. */
export type EnrollmentOrigin = {
  id: string;
  studentId: string;
  studentName: string;
  sigemId: string;
  enrollmentNumber: string;
  unitId: string;
  unitNameAtTime: string;
  enrollmentSituation: SchoolEnrollment["situation"];
  openedAt: string;
  note: string;
  links: AcademicLink[];
};

/**
 * Matrícula escolar demonstrativa recém-criada, ainda sem vínculo letivo
 * (fixture local desta etapa: cobre a primeira criação de vínculo).
 */
const FIRST_LINK_ORIGIN: EnrollmentOrigin = {
  id: "me-demo-1008",
  studentId: "alu-007",
  studentName: "",
  sigemId: "",
  enrollmentNumber: "ME-DEMO-1008",
  unitId: "demo-001",
  unitNameAtTime: "Instituição Educacional Demonstrativa Horizonte",
  enrollmentSituation: "Vigente",
  openedAt: "02/02/2027",
  note: "Matrícula escolar demonstrativa sem vínculo letivo registrado: nenhuma continuidade é presumida automaticamente.",
  links: [],
};

function originsFromStudents(): EnrollmentOrigin[] {
  return demonstrationStudents.flatMap((student) => {
    const person = getPersonByStudentId(student.id);
    return student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      studentId: student.id,
      studentName: person?.socialName ?? student.personName,
      sigemId: student.sigemId,
      enrollmentNumber: enrollment.number,
      unitId: enrollment.unitId,
      unitNameAtTime: enrollment.unitNameAtTime,
      enrollmentSituation: enrollment.situation,
      openedAt: enrollment.openedAt,
      note: enrollment.note,
      links: enrollment.academicLinks,
    }));
  });
}

export function listEnrollmentOrigins(): EnrollmentOrigin[] {
  const extra = { ...FIRST_LINK_ORIGIN };
  const student = demonstrationStudents.find((item) => item.id === extra.studentId);
  const person = student ? getPersonByStudentId(student.id) : null;
  extra.studentName = person?.socialName ?? student?.personName ?? "Aluno demonstrativo";
  extra.sigemId = student?.sigemId ?? "SIGEM-AL-000000";
  return [...originsFromStudents(), extra];
}

export function getEnrollmentOrigin(originId: string | null): EnrollmentOrigin | null {
  if (!originId) return null;
  return listEnrollmentOrigins().find((origin) => origin.id === originId) ?? null;
}

export function originsForStudent(studentId: string): EnrollmentOrigin[] {
  return listEnrollmentOrigins().filter((origin) => origin.studentId === studentId);
}

/** Períodos letivos demonstrativos, incluindo um período ainda em organização. */
export const ACADEMIC_LINK_PERIOD_OPTIONS = (() => {
  const fromFixtures = new Set(
    listEnrollmentOrigins().flatMap((origin) => origin.links.map((link) => link.periodLabel)),
  );
  fromFixtures.add("Período letivo 2027");
  return Array.from(fromFixtures).sort((a, b) => a.localeCompare(b, "pt-BR"));
})();

export type ContinuityState = "primeiro-vinculo" | "renovacao" | "vinculo-existente" | "indefinido";

export type ContinuityAssessment = {
  state: ContinuityState;
  label: string;
  message: string;
  detail: string;
  /** Vínculo letivo já registrado no período selecionado, quando existe. */
  existingLink: AcademicLink | null;
  /** Vínculo letivo anterior mais recente, preservado como fato histórico. */
  previousLink: AcademicLink | null;
  /** Demais vínculos históricos da mesma matrícula escolar. */
  historicalLinks: AcademicLink[];
};

export function assessContinuity(
  origin: EnrollmentOrigin | null,
  periodLabel: string,
): ContinuityAssessment {
  if (!origin || !periodLabel) {
    return {
      state: "indefinido",
      label: "Contexto incompleto",
      message: "Selecione a matrícula escolar e o período letivo.",
      detail: PERIOD_NOT_CIVIL_YEAR_NOTE,
      existingLink: null,
      previousLink: null,
      historicalLinks: origin?.links ?? [],
    };
  }
  const existingLink = origin.links.find((link) => link.periodLabel === periodLabel) ?? null;
  const others = origin.links.filter((link) => link.periodLabel !== periodLabel);
  const previousLink = others.length ? others[others.length - 1]! : null;

  if (existingLink) {
    return {
      state: "vinculo-existente",
      label: "Vínculo letivo já registrado",
      message: "Já existe vínculo letivo registrado para esta matrícula neste contexto.",
      detail:
        "Nenhum vínculo equivalente é criado silenciosamente. Consulte o vínculo existente; as regras de coexistência de vínculos no mesmo período ainda não estão definidas.",
      existingLink,
      previousLink,
      historicalLinks: origin.links,
    };
  }
  if (!origin.links.length) {
    return {
      state: "primeiro-vinculo",
      label: "Primeiro vínculo letivo desta matrícula",
      message: "Nenhum vínculo letivo registrado nesta matrícula escolar.",
      detail:
        "A matrícula escolar permanece a mesma; o vínculo letivo acrescenta o contexto acadêmico do período selecionado.",
      existingLink: null,
      previousLink: null,
      historicalLinks: [],
    };
  }
  return {
    state: "renovacao",
    label: "Continuidade ainda não registrada",
    message: "Continuidade ainda não registrada neste período letivo.",
    detail:
      "A renovação cria um novo vínculo letivo associado à MESMA matrícula escolar. O vínculo anterior permanece histórico e imutável: nada é sobrescrito.",
    existingLink: null,
    previousLink,
    historicalLinks: origin.links,
  };
}

export type RegularConflict = {
  enrollmentNumber: string;
  unitNameAtTime: string;
  periodLabel: string;
  participationLabel: string;
};

/**
 * Conflito demonstrativo: participação regular registrada em outra unidade no
 * mesmo período. Nada é transferido, encerrado ou resolvido automaticamente.
 */
export function findRegularConflicts(
  origin: EnrollmentOrigin | null,
  periodLabel: string,
): RegularConflict[] {
  if (!origin || !periodLabel) return [];
  const student = demonstrationStudents.find((item) => item.id === origin.studentId);
  if (!student) return [];
  const conflicts: RegularConflict[] = [];
  for (const enrollment of student.enrollments) {
    if (enrollment.unitId === origin.unitId) continue;
    for (const link of enrollment.academicLinks) {
      if (link.periodLabel !== periodLabel) continue;
      for (const participation of link.participations) {
        if (participation.nature !== "Regular") continue;
        if (participation.situation !== "Em andamento") continue;
        conflicts.push({
          enrollmentNumber: enrollment.number,
          unitNameAtTime: enrollment.unitNameAtTime,
          periodLabel: link.periodLabel,
          participationLabel: participation.label,
        });
      }
    }
  }
  return conflicts;
}

/** Ofertas da unidade da matrícula escolar, contextualizadas pelo período. */
export function offersForOrigin(origin: EnrollmentOrigin | null, periodLabel: string) {
  if (!origin) return [];
  const offers = getUnitOffers(origin.unitId);
  if (!periodLabel) return offers;
  const isPastPeriod = /20(1|2)[0-5]/.test(periodLabel);
  return isPastPeriod ? offers : offers.filter((offer) => offer.situation === "Oferta vigente");
}

export function organizationOptions(offerId: string) {
  return organizationsForOffer(offerId);
}

export function isPhaseOrganization(offerId: string) {
  return Boolean(getOffer(offerId)?.stage.startsWith("EJA"));
}

export function contextualMatrix(offerId: string) {
  const offer = getOffer(offerId);
  if (!offer) return null;
  const matrix = getCurriculumMatrix(offer.matrixId);
  if (!matrix) return null;
  return { matrix, offer };
}

export type AcademicLinkDraft = {
  originId: string | null;
  periodLabel: string;
  offerId: string;
  academicOrganization: string;
  participationLabels: string[];
  note: string;
};

export function createBlankAcademicLinkDraft(originId?: string | null): AcademicLinkDraft {
  return {
    originId: originId ?? null,
    periodLabel: "",
    offerId: "",
    academicOrganization: "",
    participationLabels: [REGULAR_PARTICIPATION_LABEL],
    note: "",
  };
}

export function isAcademicLinkDraftDirty(draft: AcademicLinkDraft, initial: AcademicLinkDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export type AcademicLinkIssueField =
  | "originId"
  | "periodLabel"
  | "offerId"
  | "academicOrganization"
  | "participationLabels"
  | "duplicidade"
  | "conflito";

export type AcademicLinkIssue = {
  id: string;
  field: AcademicLinkIssueField;
  severity: "erro" | "aviso";
  message: string;
};

export function validateAcademicLinkDraft(
  draft: AcademicLinkDraft,
  continuity: ContinuityAssessment,
  conflicts: RegularConflict[],
): AcademicLinkIssue[] {
  const issues: AcademicLinkIssue[] = [];
  if (!draft.originId) {
    issues.push({
      id: "origin",
      field: "originId",
      severity: "erro",
      message:
        "Matrícula escolar não selecionada: o vínculo letivo parte de uma matrícula escolar existente.",
    });
  }
  if (!draft.periodLabel) {
    issues.push({
      id: "period",
      field: "periodLabel",
      severity: "erro",
      message: "Período letivo não selecionado: o vínculo letivo é temporal.",
    });
  }
  if (!draft.offerId) {
    issues.push({
      id: "offer",
      field: "offerId",
      severity: "erro",
      message: "Oferta educacional não selecionada dentro da unidade da matrícula escolar.",
    });
  }
  if (!draft.academicOrganization) {
    issues.push({
      id: "organization",
      field: "academicOrganization",
      severity: "erro",
      message:
        "Organização acadêmica não selecionada: período da Educação Infantil, ano do Ensino Fundamental ou fase da EJA, conforme a oferta.",
    });
  }
  if (draft.participationLabels.length === 0) {
    issues.push({
      id: "participation",
      field: "participationLabels",
      severity: "erro",
      message:
        "Nenhuma participação definida: a participação representa a natureza da participação educacional no vínculo letivo.",
    });
  }
  if (continuity.state === "vinculo-existente") {
    issues.push({
      id: "duplicate",
      field: "duplicidade",
      severity: "erro",
      message:
        "Já existe vínculo letivo registrado para esta matrícula neste contexto: nenhum vínculo equivalente é criado.",
    });
  }
  const hasRegular = draft.participationLabels.includes(REGULAR_PARTICIPATION_LABEL);
  if (conflicts.length && hasRegular) {
    issues.push({
      id: "regular-conflict",
      field: "conflito",
      severity: "erro",
      message: `${REGULAR_CONFLICT_WARNING} A situação exige resolução antes de nova participação regular; nada é transferido nem encerrado automaticamente.`,
    });
  } else if (conflicts.length) {
    issues.push({
      id: "regular-conflict-warning",
      field: "conflito",
      severity: "aviso",
      message: REGULAR_CONFLICT_WARNING,
    });
  }
  if (continuity.state === "renovacao") {
    issues.push({
      id: "renewal",
      field: "duplicidade",
      severity: "aviso",
      message:
        "Renovação demonstrativa: novo vínculo letivo na mesma matrícula escolar. O vínculo anterior não é alterado.",
    });
  }
  if (
    draft.participationLabels.length > 1 &&
    coexistenceLabel(draft.participationLabels) === COEXISTENCE_PENDING_NOTE
  ) {
    issues.push({
      id: "coexistence",
      field: "participationLabels",
      severity: "aviso",
      message: COEXISTENCE_PENDING_NOTE,
    });
  }
  return issues;
}

export function academicLinkIssueFor(issues: AcademicLinkIssue[], field: AcademicLinkIssueField) {
  return issues.find((issue) => issue.field === field);
}
