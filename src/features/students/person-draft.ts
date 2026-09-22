/**
 * PESSOA / ALUNO — modelo demonstrativo de identidade cadastral (Etapa 8B).
 *
 * Nada aqui é persistido nem constitui domínio definitivo:
 * - PESSOA é a identidade humana canônica; ALUNO é o papel educacional dessa
 *   pessoa dentro do SIGEM. Esta etapa não cria matrícula escolar, vínculo
 *   letivo, participação ou alocação em turma;
 * - o identificador SIGEM é apresentado como conceitualmente permanente, sem
 *   algoritmo de geração definido;
 * - CPF não é identidade primária e não é exigido de ninguém;
 * - a verificação de duplicidade é DEMONSTRATIVA: nomes iguais não significam
 *   a mesma pessoa, nada é fundido automaticamente e casos ambíguos exigem
 *   decisão humana;
 * - dados de saúde, NEE e AEE não pertencem a este cadastro.
 */
import { demonstrationStudents, type DemonstrationStudent } from "@/features/students/students-data";

/** Rótulo conceitual para dúvidas de identidade; não é enum definitivo. */
export const IDENTITY_VERIFICATION_LABEL = "Identidade requer verificação";

/** Opções administrativas demonstrativas; sem fonte normativa congelada. */
export const ADMINISTRATIVE_SEX_OPTIONS = [
  "Feminino (registro administrativo)",
  "Masculino (registro administrativo)",
  "Não informado no cadastro",
];

export type PersonIdentifiers = {
  /** Interno, permanente, diferente de matrícula escolar e de identificadores externos. */
  sigemId: string;
  /** Pode não existir: CPF não é requisito universal. */
  cpf: string | null;
  /** Identificador educacional externo, quando aplicável. */
  educationalExternalId: string | null;
  /** Documento cadastral civil, quando necessário. */
  civilRegistry: string | null;
};

export type DemonstrationPerson = {
  id: string;
  /** Aluno correspondente quando esta pessoa já assume o papel de aluno. */
  studentId: string | null;
  fullName: string;
  /** Nome social quando aplicável; não substitui o histórico documental. */
  socialName: string | null;
  /** Formato demonstrativo dd/mm/aaaa. */
  birthDate: string;
  administrativeSex: string;
  identifiers: PersonIdentifiers;
  /** Contato mínimo, apresentado mascarado nas listas. */
  contactPhone: string | null;
  contactNote: string;
  roleNote: string;
  /** Indica apenas se existe vínculo ativo; não altera a validade da identidade. */
  hasActiveLink: boolean;
};

function personFromStudent(
  student: DemonstrationStudent,
  extra: {
    birthDate: string;
    administrativeSex: string;
    socialName?: string | null;
    cpf?: string | null;
    civilRegistry?: string | null;
    contactPhone?: string | null;
    contactNote: string;
    roleNote: string;
  },
): DemonstrationPerson {
  return {
    id: `pes-${student.id}`,
    studentId: student.id,
    fullName: student.personName,
    socialName: extra.socialName ?? null,
    birthDate: extra.birthDate,
    administrativeSex: extra.administrativeSex,
    identifiers: {
      sigemId: student.sigemId,
      cpf: extra.cpf ?? null,
      educationalExternalId: student.externalId,
      civilRegistry: extra.civilRegistry ?? null,
    },
    contactPhone: extra.contactPhone ?? null,
    contactNote: extra.contactNote,
    roleNote: extra.roleNote,
    hasActiveLink: student.currentSituation !== "Sem participação atual",
  };
}

const [s1, s2, s3, s4, s5, s6, s7] = demonstrationStudents;

/**
 * Cadastro mestre demonstrativo de pessoas.
 * Pessoas fictícias; nenhum dado real de nenhuma pessoa.
 */
export const demonstrationPersons: DemonstrationPerson[] = [
  personFromStudent(s1!, {
    birthDate: "12/03/2016",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[0]!,
    cpf: "000.000.000-01",
    civilRegistry: "Certidão fictícia 0001-DEMO",
    contactPhone: "(22) 90000-0001",
    contactNote: "Contato fictício de uso demonstrativo.",
    roleNote: "Pessoa já existente no cadastro mestre, com papel de aluno ativo.",
  }),
  personFromStudent(s2!, {
    birthDate: "08/07/2015",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[1]!,
    cpf: null,
    civilRegistry: "Certidão fictícia 0002-DEMO",
    contactPhone: "(22) 90000-0002",
    contactNote: "Pessoa sem CPF registrado: ausência de CPF não impede o cadastro.",
    roleNote: "Papel de aluno mantido ao longo de vários períodos letivos.",
  }),
  personFromStudent(s3!, {
    birthDate: "21/11/2013",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[0]!,
    cpf: "000.000.000-03",
    civilRegistry: "Certidão fictícia 0003-DEMO",
    contactPhone: "(22) 90000-0003",
    contactNote: "Mudança de escola não criou nova pessoa nem novo identificador SIGEM.",
    roleNote: "Mesma pessoa após transferência entre unidades.",
  }),
  personFromStudent(s4!, {
    birthDate: "02/05/1997",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[1]!,
    cpf: "000.000.000-04",
    contactPhone: "(22) 90000-0004",
    contactNote: "Retorno à rede sem novo cadastro de pessoa.",
    roleNote: "Identidade reaproveitada no retorno à mesma escola.",
  }),
  personFromStudent(s5!, {
    birthDate: "30/09/2016",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[0]!,
    socialName: "Nome social fictício Cinco",
    cpf: null,
    civilRegistry: "Certidão fictícia 0005-DEMO",
    contactPhone: "(22) 90000-0005",
    contactNote: "Nome social registrado sem apagar o histórico documental anterior.",
    roleNote: "Mudança de turma não alterou a identidade da pessoa.",
  }),
  personFromStudent(s6!, {
    birthDate: "14/02/2021",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[1]!,
    cpf: null,
    civilRegistry: "Certidão fictícia 0006-DEMO",
    contactPhone: "(22) 90000-0006",
    contactNote: "Participações educacionais não são atributos desta ficha.",
    roleNote: "Pessoa com participações de naturezas diferentes registradas fora do cadastro.",
  }),
  personFromStudent(s7!, {
    birthDate: "19/06/2012",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[0]!,
    cpf: "000.000.000-07",
    civilRegistry: "Certidão fictícia 0007-DEMO",
    contactPhone: "(22) 90000-0007",
    contactNote: "Sem vínculo ativo: a identidade permanece válida e consultável.",
    roleNote: "Aluno histórico, sem participação atual, preservado no cadastro mestre.",
  }),
  /** Homônimo: mesmo nome de outra pessoa, com data de nascimento diferente. */
  {
    id: "pes-homonimo-001",
    studentId: null,
    fullName: "Aluna Fictícia Demonstrativa Um",
    socialName: null,
    birthDate: "05/08/2011",
    administrativeSex: ADMINISTRATIVE_SEX_OPTIONS[0]!,
    identifiers: {
      sigemId: "SIGEM-AL-000181",
      cpf: null,
      educationalExternalId: "EXT-DEMO-981",
      civilRegistry: "Certidão fictícia 0081-DEMO",
    },
    contactPhone: "(22) 90000-0081",
    contactNote: "Homônima fictícia: nome coincidente, pessoa distinta.",
    roleNote: "Existe no cadastro mestre como pessoa diferente, com identificador SIGEM próprio.",
    hasActiveLink: false,
  },
];

export function getDemonstrationPerson(id: string) {
  return demonstrationPersons.find((person) => person.id === id);
}

/** Pessoa correspondente a um aluno já existente (usada na edição). */
export function getPersonByStudentId(studentId: string) {
  return demonstrationPersons.find((person) => person.studentId === studentId);
}

/** Mascara identificadores em listas e resumos: minimização de dados. */
export function maskIdentifier(value: string | null) {
  if (!value) return "Não informado";
  const visible = value.slice(-2);
  return `••• ${visible}`;
}

export type PersonDraft = {
  originStudentId: string | null;
  fullName: string;
  socialName: string;
  birthDate: string;
  administrativeSex: string;
  cpf: string;
  educationalExternalId: string;
  civilRegistry: string;
  contactPhone: string;
  contactNote: string;
  /** Pessoas que o operador declarou não serem a mesma pessoa. */
  dismissedMatchIds: string[];
  /** Decisão humana registrada: identidade ainda requer verificação. */
  identityNeedsVerification: boolean;
};

export function createBlankPersonDraft(): PersonDraft {
  return {
    originStudentId: null,
    fullName: "",
    socialName: "",
    birthDate: "",
    administrativeSex: "",
    cpf: "",
    educationalExternalId: "",
    civilRegistry: "",
    contactPhone: "",
    contactNote: "",
    dismissedMatchIds: [],
    identityNeedsVerification: false,
  };
}

export function createPersonDraftFrom(person: DemonstrationPerson): PersonDraft {
  return {
    originStudentId: person.studentId,
    fullName: person.fullName,
    socialName: person.socialName ?? "",
    birthDate: person.birthDate,
    administrativeSex: person.administrativeSex,
    cpf: person.identifiers.cpf ?? "",
    educationalExternalId: person.identifiers.educationalExternalId ?? "",
    civilRegistry: person.identifiers.civilRegistry ?? "",
    contactPhone: person.contactPhone ?? "",
    contactNote: person.contactNote,
    dismissedMatchIds: [],
    identityNeedsVerification: false,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function isValidDemonstrativeDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return false;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1;
}

export type MatchStrength = "forte" | "possivel" | "homonimo";

export type PersonMatch = {
  person: DemonstrationPerson;
  strength: MatchStrength;
  reason: string;
};

/**
 * Verificação DEMONSTRATIVA de possíveis correspondências.
 * Não há motor de matching: nomes iguais não significam a mesma pessoa e
 * nenhum caso é bloqueado ou fundido automaticamente.
 */
export function findPossibleMatches(draft: PersonDraft): PersonMatch[] {
  const name = normalize(draft.fullName);
  const social = normalize(draft.socialName);
  const birth = draft.birthDate.trim();
  const external = draft.educationalExternalId.trim();
  const cpf = draft.cpf.trim();
  if (!name && !external && !cpf) return [];

  const matches: PersonMatch[] = [];
  for (const person of demonstrationPersons) {
    if (person.studentId && person.studentId === draft.originStudentId) continue;
    if (draft.dismissedMatchIds.includes(person.id)) continue;

    const sameName =
      Boolean(name) &&
      (normalize(person.fullName) === name ||
        (person.socialName ? normalize(person.socialName) === name : false));
    const sameSocial = Boolean(social) && normalize(person.fullName) === social;
    const sameBirth = Boolean(birth) && person.birthDate === birth;
    const sameExternal = Boolean(external) && person.identifiers.educationalExternalId === external;
    const sameCpf = Boolean(cpf) && person.identifiers.cpf === cpf;

    if (sameExternal || sameCpf) {
      matches.push({
        person,
        strength: "forte",
        reason: sameExternal
          ? "Identificador externo coincidente. Conferência humana necessária antes de continuar."
          : "CPF coincidente. Conferência humana necessária antes de continuar.",
      });
      continue;
    }
    if (sameName && sameBirth) {
      matches.push({
        person,
        strength: "forte",
        reason: `Nome e data de nascimento coincidentes. ${IDENTITY_VERIFICATION_LABEL}.`,
      });
      continue;
    }
    if (sameName || sameSocial) {
      matches.push({
        person,
        strength: birth ? "homonimo" : "possivel",
        reason: birth
          ? "Nome coincidente com data de nascimento diferente: homônimo, provavelmente outra pessoa. Nada é fundido automaticamente."
          : "Nome coincidente sem data de nascimento informada para comparação.",
      });
    }
  }
  return matches;
}

export type PersonDraftIssue = {
  id: string;
  field?: keyof PersonDraft;
  severity: "erro" | "aviso";
  message: string;
};

export function validatePersonDraft(draft: PersonDraft, matches: PersonMatch[]): PersonDraftIssue[] {
  const issues: PersonDraftIssue[] = [];

  if (!draft.fullName.trim()) {
    issues.push({
      id: "name",
      field: "fullName",
      severity: "erro",
      message: "Nome completo não informado: é a identificação mínima da pessoa.",
    });
  }
  if (!draft.birthDate.trim()) {
    issues.push({
      id: "birth",
      field: "birthDate",
      severity: "erro",
      message: "Data de nascimento não informada: usada na verificação de possíveis duplicidades.",
    });
  } else if (!isValidDemonstrativeDate(draft.birthDate)) {
    issues.push({
      id: "birth-format",
      field: "birthDate",
      severity: "erro",
      message: "Data de nascimento inválida no formato demonstrativo dd/mm/aaaa.",
    });
  }
  if (draft.cpf.trim() && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(draft.cpf.trim())) {
    issues.push({
      id: "cpf-format",
      field: "cpf",
      severity: "erro",
      message: "Formato demonstrativo de CPF inválido (000.000.000-00).",
    });
  }
  if (!draft.cpf.trim()) {
    issues.push({
      id: "cpf-absent",
      field: "cpf",
      severity: "aviso",
      message:
        "Sem CPF informado. CPF não é identidade primária do aluno e não é exigido para concluir o cadastro.",
    });
  }
  if (!draft.administrativeSex) {
    issues.push({
      id: "sex",
      field: "administrativeSex",
      severity: "aviso",
      message: "Sexo cadastral não informado: campo administrativo, sem enumeração definitiva.",
    });
  }

  const strong = matches.filter((match) => match.strength !== "homonimo");
  if (strong.length) {
    issues.push({
      id: "duplicate",
      severity: "aviso",
      message: `${strong.length} possível(is) cadastro(s) correspondente(s) em aberto. ${IDENTITY_VERIFICATION_LABEL}: a decisão é humana, nenhuma fusão automática ocorre.`,
    });
  }
  if (matches.some((match) => match.strength === "homonimo")) {
    issues.push({
      id: "homonym",
      severity: "aviso",
      message:
        "Homônimo identificado: nome coincidente não caracteriza a mesma pessoa. Revise antes de concluir.",
    });
  }
  if (draft.identityNeedsVerification) {
    issues.push({
      id: "verification",
      severity: "aviso",
      message: `${IDENTITY_VERIFICATION_LABEL}: reconciliação humana pendente, registrada pelo operador.`,
    });
  }

  return issues;
}

export function personIssueFor(issues: PersonDraftIssue[], field: keyof PersonDraft) {
  return issues.find((issue) => issue.field === field && issue.severity === "erro");
}

export function isPersonDraftDirty(draft: PersonDraft, initial: PersonDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export type PersonChangeNature = "Correção cadastral" | "Alteração histórica relevante";

/**
 * Campos de identidade relevantes ficam marcados como alteração histórica:
 * documentos e registros antigos não passam a ter sido emitidos com o dado novo.
 */
const CHANGE_FIELDS: Array<{
  key: keyof PersonDraft;
  label: string;
  nature: PersonChangeNature;
  note?: string;
}> = [
  {
    key: "fullName",
    label: "Nome completo",
    nature: "Alteração histórica relevante",
    note: "Registros e documentos anteriores permanecem emitidos com o nome vigente na época.",
  },
  {
    key: "socialName",
    label: "Nome social",
    nature: "Alteração histórica relevante",
    note: "Nome social passa a ser o nome de tratamento sem reescrever o histórico documental.",
  },
  {
    key: "birthDate",
    label: "Data de nascimento",
    nature: "Alteração histórica relevante",
    note: "Alteração usada na verificação de identidade; exige conferência documental.",
  },
  { key: "administrativeSex", label: "Sexo cadastral", nature: "Correção cadastral" },
  { key: "cpf", label: "CPF", nature: "Correção cadastral" },
  {
    key: "educationalExternalId",
    label: "Identificador educacional externo",
    nature: "Correção cadastral",
  },
  { key: "civilRegistry", label: "Documento civil", nature: "Correção cadastral" },
  { key: "contactPhone", label: "Telefone de contato", nature: "Correção cadastral" },
  { key: "contactNote", label: "Observação de contato", nature: "Correção cadastral" },
];

export function personDraftChanges(draft: PersonDraft, initial: PersonDraft) {
  return CHANGE_FIELDS.filter(({ key }) => draft[key] !== initial[key]).map(
    ({ key, label, nature, note }) => ({
      field: label,
      nature,
      note,
      from: String(initial[key] ?? "") || "não informado",
      to: String(draft[key] ?? "") || "não informado",
    }),
  );
}

/** Áreas do workspace; algumas permanecem conceituais nesta etapa. */
export const PERSON_WORKSPACE_SECTIONS = [
  { id: "identificacao", label: "Identificação", available: true },
  { id: "pessoais", label: "Dados pessoais", available: true },
  { id: "identificadores", label: "Documentação e identificadores", available: true },
  { id: "contato", label: "Contato", available: true },
  { id: "duplicidade", label: "Verificação de duplicidade", available: true },
  { id: "responsaveis", label: "Responsáveis e relações", available: false },
  { id: "contextos", label: "Necessidades e contextos específicos", available: false },
  { id: "revisao", label: "Revisão", available: true },
];

/**
 * Relações de responsabilidade: apenas área conceitual.
 * Não são necessariamente a mesma pessoa e não serão reduzidas a um campo único.
 */
export const RESPONSIBILITY_RELATIONS = [
  "Responsável legal",
  "Responsável financeiro",
  "Responsável pela matrícula",
  "Contato de emergência",
  "Pessoa autorizada a buscar",
];

export const PERSON_SCOPE_NOTE =
  "Concluir cadastro cria conceitualmente a identidade Pessoa/Aluno. Não cria matrícula escolar, não cria vínculo letivo e não coloca o aluno em turma.";

export const SENSITIVE_DATA_NOTE =
  "Saúde, necessidades específicas e AEE não pertencem a esta ficha: AEE é participação educacional, e dados sensíveis exigirão finalidade, escopo de acesso e proteção próprios.";
