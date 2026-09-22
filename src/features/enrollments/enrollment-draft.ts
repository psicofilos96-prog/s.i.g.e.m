/**
 * INGRESSO E MATRÍCULA ESCOLAR — modelo demonstrativo (Etapa 8C).
 *
 * Escopo conceitual: PESSOA → ALUNO → MATRÍCULA ESCOLAR.
 *
 * A MATRÍCULA ESCOLAR é o vínculo permanente entre um aluno e uma unidade
 * escolar. Ela não é a identidade do aluno, não é matrícula anual, não é
 * vínculo letivo, não é participação e não é turma. Para a mesma combinação
 * Aluno + Unidade não se cria automaticamente outra matrícula permanente:
 * quando existe relação anterior, a relação escolar é reutilizada.
 *
 * Nada aqui é persistido; nenhum vínculo letivo, participação, enturmação ou
 * transferência é executado. Os identificadores demonstrativos não possuem
 * algoritmo de geração definido.
 */
import { demonstrationUnits } from "@/features/units/units-data";
import {
  demonstrationStudents,
  getDemonstrationStudent,
  type SchoolEnrollment,
} from "@/features/students/students-data";
import { getPersonByStudentId, maskIdentifier } from "@/features/students/person-draft";

export const ENROLLMENT_SCOPE_NOTE =
  "Esta operação não cria vínculo letivo, participação ou alocação em turma.";

export const OTHER_UNIT_WARNING =
  "Existe relação escolar registrada em outra unidade. A situação deverá ser validada antes da continuidade acadêmica.";

export const IDENTITY_STEP_NOTE =
  "O cadastro de identidade Pessoa/Aluno é uma operação anterior e diferente da matrícula escolar.";

/** Formas de ingresso apenas demonstrativas; nenhuma taxonomia oficial é assumida. */
export const ENTRY_FORM_OPTIONS = [
  "Ingresso demonstrativo sem origem declarada",
  "Ingresso demonstrativo informado pela família",
  "Ingresso demonstrativo encaminhado pela rede",
];

export const ENROLLMENT_WORKSPACE_SECTIONS = [
  { id: "localizar", label: "Localizar aluno", available: true },
  { id: "identidade", label: "Confirmar identidade", available: true },
  { id: "unidade", label: "Selecionar unidade escolar", available: true },
  { id: "relacao", label: "Verificar relação anterior", available: true },
  { id: "ingresso", label: "Definir ingresso", available: true },
  { id: "documentacao", label: "Documentação de ingresso", available: false },
  { id: "revisao", label: "Revisar e concluir", available: true },
] as const;

export type MasterRegistryResult = {
  studentId: string;
  sigemId: string;
  /** Nome de tratamento; nenhum outro dado pessoal é necessário para localizar. */
  displayName: string;
  birthDate: string;
  /** CPF mascarado apenas quando existe; nunca usado como identidade primária. */
  maskedCpf: string;
  externalId: string;
  situationNote: string;
  enrollmentNumbers: string[];
};

/** Resumo minimizado de um aluno do cadastro mestre. */
export function getRegistryResult(studentId: string): MasterRegistryResult | null {
  const student = getDemonstrationStudent(studentId);
  if (!student) return null;
  const person = getPersonByStudentId(studentId);
  return {
    studentId: student.id,
    sigemId: student.sigemId,
    displayName: person?.socialName ?? student.personName,
    birthDate: person?.birthDate ?? "Não informado",
    maskedCpf: maskIdentifier(person?.identifiers.cpf ?? null),
    externalId: maskIdentifier(student.externalId),
    situationNote: student.currentSituationNote,
    enrollmentNumbers: student.enrollments.map((enrollment) => enrollment.number),
  };
}

/** Pesquisa demonstrativa no cadastro mestre: nome, SIGEM, matrícula escolar, externo. */
export function searchMasterRegistry(query: string): MasterRegistryResult[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return demonstrationStudents
    .filter((student) => {
      const person = getPersonByStudentId(student.id);
      const haystack = [
        student.personName,
        person?.socialName ?? "",
        student.sigemId,
        student.externalId ?? "",
        ...student.enrollments.map((enrollment) => enrollment.number),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    })
    .map((student) => getRegistryResult(student.id))
    .filter((result): result is MasterRegistryResult => Boolean(result));
}

export type UnitRelationScenario = "primeiro-ingresso" | "matricula-existente" | "retorno";

export type UnitRelation = {
  scenario: UnitRelationScenario;
  label: string;
  message: string;
  detail: string;
  /** Matrícula escolar encontrada na unidade, quando existe. */
  enrollment: SchoolEnrollment | null;
  /** Relações registradas em outras unidades, nunca ignoradas silenciosamente. */
  otherUnits: SchoolEnrollment[];
};

export function findUnitRelation(studentId: string, unitId: string): UnitRelation {
  const student = getDemonstrationStudent(studentId);
  const enrollments = student?.enrollments ?? [];
  const sameUnit = enrollments.filter((enrollment) => enrollment.unitId === unitId);
  const otherUnits = enrollments.filter((enrollment) => enrollment.unitId !== unitId);
  const active = sameUnit.find((enrollment) => enrollment.situation === "Vigente");
  const historical = sameUnit.find((enrollment) => enrollment.situation === "Encerrada");

  if (active) {
    return {
      scenario: "matricula-existente",
      label: "Matrícula escolar existente",
      message: "Este aluno já possui matrícula escolar nesta unidade.",
      detail:
        "A matrícula escolar é permanente e atravessa períodos letivos. Nenhuma segunda matrícula permanente é criada para a mesma combinação aluno + unidade.",
      enrollment: active,
      otherUnits,
    };
  }
  if (historical) {
    return {
      scenario: "retorno",
      label: "Retorno à mesma unidade",
      message: "Matrícula escolar anterior encontrada.",
      detail:
        "O retorno reutiliza a relação escolar já existente: não exige nova identidade Pessoa/Aluno e não deve gerar outra matrícula escolar permanente. A continuação para novo contexto letivo pertence ao fluxo de vínculo letivo.",
      enrollment: historical,
      otherUnits,
    };
  }
  return {
    scenario: "primeiro-ingresso",
    label: "Primeiro ingresso nesta unidade",
    message: "Nenhuma matrícula escolar anterior encontrada nesta unidade.",
    detail:
      "Será preparada demonstrativamente a relação Aluno → Matrícula Escolar → Unidade. Nenhum vínculo letivo é aberto nesta operação.",
    enrollment: null,
    otherUnits,
  };
}

/** Quantidade de vínculos letivos históricos dentro da mesma matrícula escolar. */
export function academicLinkCount(enrollment: SchoolEnrollment | null) {
  return enrollment?.academicLinks.length ?? 0;
}

export type EnrollmentDraft = {
  query: string;
  studentId: string | null;
  identityConfirmed: boolean;
  unitId: string | null;
  entryDate: string;
  entryForm: string;
  contextNote: string;
};

export function createBlankEnrollmentDraft(preselectedStudentId?: string): EnrollmentDraft {
  return {
    query: "",
    studentId: preselectedStudentId ?? null,
    identityConfirmed: false,
    unitId: null,
    entryDate: "",
    entryForm: ENTRY_FORM_OPTIONS[0]!,
    contextNote: "",
  };
}

export function isEnrollmentDraftDirty(draft: EnrollmentDraft, initial: EnrollmentDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function isValidEntryDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1;
}

export type EnrollmentIssueField =
  "studentId" | "identityConfirmed" | "unitId" | "entryDate" | "duplicidade" | "outraUnidade";

export type EnrollmentIssue = {
  id: string;
  field: EnrollmentIssueField;
  severity: "erro" | "aviso";
  message: string;
};

export function validateEnrollmentDraft(
  draft: EnrollmentDraft,
  relation: UnitRelation | null,
): EnrollmentIssue[] {
  const issues: EnrollmentIssue[] = [];
  if (!draft.studentId) {
    issues.push({
      id: "student",
      field: "studentId",
      severity: "erro",
      message:
        "Aluno não selecionado: o ingresso começa pela localização da pessoa/aluno já existente no cadastro mestre.",
    });
  } else if (!draft.identityConfirmed) {
    issues.push({
      id: "identity",
      field: "identityConfirmed",
      severity: "erro",
      message: "Identidade não confirmada: confirme que este é o aluno antes de prosseguir.",
    });
  }
  if (!draft.unitId) {
    issues.push({
      id: "unit",
      field: "unitId",
      severity: "erro",
      message:
        "Unidade escolar não selecionada: a matrícula escolar existe em relação à instituição.",
    });
  }
  if (draft.entryDate.trim() && !isValidEntryDate(draft.entryDate)) {
    issues.push({
      id: "entry-date",
      field: "entryDate",
      severity: "erro",
      message: "Data de ingresso inválida: utilize o formato demonstrativo dd/mm/aaaa.",
    });
  }
  if (relation?.scenario === "matricula-existente") {
    issues.push({
      id: "duplicate",
      field: "duplicidade",
      severity: "erro",
      message:
        "Matrícula escolar já existente para este aluno nesta unidade: a criação de uma segunda matrícula permanente está impedida. Utilize a matrícula existente.",
    });
  }
  if (relation?.scenario === "retorno") {
    issues.push({
      id: "return",
      field: "duplicidade",
      severity: "aviso",
      message:
        "Retorno à mesma unidade: a relação escolar existente deve ser reutilizada em vez de gerar nova matrícula permanente.",
    });
  }
  if (relation && relation.otherUnits.length > 0) {
    issues.push({
      id: "other-unit",
      field: "outraUnidade",
      severity: "aviso",
      message: OTHER_UNIT_WARNING,
    });
  }
  if (!draft.entryDate.trim()) {
    issues.push({
      id: "entry-date-missing",
      field: "entryDate",
      severity: "aviso",
      message:
        "Data de ingresso não informada: nenhuma regra municipal de calendário é assumida nesta etapa.",
    });
  }
  return issues;
}

export function enrollmentIssueFor(issues: EnrollmentIssue[], field: EnrollmentIssueField) {
  return issues.find((issue) => issue.field === field);
}

export function unitName(unitId: string | null) {
  if (!unitId) return "Não selecionada";
  return demonstrationUnits.find((unit) => unit.id === unitId)?.currentName ?? "Não selecionada";
}

/** Identificador da matrícula escolar: demonstrativo, distinto do identificador SIGEM do aluno. */
export const NEW_ENROLLMENT_IDENTIFIER_NOTE =
  "Gerado pelo SIGEM após a criação da matrícula escolar; distinto do identificador SIGEM do aluno e de matrícula anual.";
