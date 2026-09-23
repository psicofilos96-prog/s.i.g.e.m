import { demonstrationProfessionals } from "./professionals-data";

export type IdentityRole = "Aluno" | "Profissional";

export type ProfessionalIdentityPerson = {
  id: string;
  sigemId: string;
  fullName: string;
  socialName?: string;
  birthDate: string;
  administrativeSex?: string;
  cpf: string | null;
  civilIdentifier?: string;
  externalIdentifier?: string;
  roles: IdentityRole[];
  professionalId?: string;
};

/** Cadastro mestre demonstrativo, integralmente fictício e minimizado. */
export const professionalIdentityPeople: ProfessionalIdentityPerson[] = [
  {
    id: "pes-prof-001",
    sigemId: "SIGEM-PE-000301",
    fullName: "Pessoa Fictícia Marina Vale",
    birthDate: "14/04/1992",
    administrativeSex: "Feminino (registro administrativo)",
    cpf: "000.000.000-31",
    roles: [],
  },
  {
    id: "pes-prof-002",
    sigemId: "SIGEM-PE-000302",
    fullName: "Profissional Fictícia Aurora Martins",
    birthDate: "18/09/1988",
    administrativeSex: "Feminino (registro administrativo)",
    cpf: "000.000.000-32",
    roles: ["Profissional"],
    professionalId: "pro-001",
  },
  {
    id: "pes-prof-003",
    sigemId: "SIGEM-AL-000104",
    fullName: "Aluno Fictício Demonstrativo Quatro",
    socialName: "Pessoa Fictícia Alex Santos",
    birthDate: "02/05/1997",
    administrativeSex: "Masculino (registro administrativo)",
    cpf: "000.000.000-04",
    externalIdentifier: "EXT-DEMO-704",
    roles: ["Aluno"],
  },
  {
    id: "pes-prof-004",
    sigemId: "SIGEM-PE-000304",
    fullName: "Pessoa Fictícia Renata Lima",
    birthDate: "21/07/1990",
    cpf: "000.000.000-34",
    roles: [],
  },
  {
    id: "pes-prof-005",
    sigemId: "SIGEM-PE-000305",
    fullName: "Pessoa Fictícia Renata Lima",
    birthDate: "03/12/1984",
    cpf: null,
    roles: [],
  },
  {
    id: "pes-prof-006",
    sigemId: "SIGEM-PE-000306",
    fullName: "Pessoa Fictícia Samuel Rocha",
    birthDate: "11/01/1995",
    cpf: null,
    roles: [],
  },
  {
    id: "pes-prof-007",
    sigemId: "SIGEM-PE-000307",
    fullName: "Pessoa Fictícia Tânia Reis",
    birthDate: "29/06/1987",
    cpf: "000.000.000-37",
    externalIdentifier: "EXT-PESSOA-DEMO-307",
    roles: [],
  },
  {
    id: "pes-prof-008",
    sigemId: "SIGEM-PE-000308",
    fullName: "Profissional Fictícia Gabriela Torres",
    birthDate: "17/02/1979",
    cpf: null,
    roles: ["Profissional"],
    professionalId: "pro-007",
  },
];

const professionalPersonOverrides: Record<
  string,
  Pick<ProfessionalIdentityPerson, "sigemId" | "birthDate" | "cpf" | "administrativeSex">
> = {
  "pro-001": {
    sigemId: "SIGEM-PE-000302",
    birthDate: "18/09/1988",
    cpf: "000.000.000-32",
    administrativeSex: "Feminino (registro administrativo)",
  },
  "pro-002": {
    sigemId: "SIGEM-PE-000312",
    birthDate: "09/03/1985",
    cpf: null,
    administrativeSex: "Masculino (registro administrativo)",
  },
  "pro-003": {
    sigemId: "SIGEM-PE-000313",
    birthDate: "25/08/1991",
    cpf: "000.000.000-33",
    administrativeSex: "Feminino (registro administrativo)",
  },
  "pro-004": {
    sigemId: "SIGEM-PE-000314",
    birthDate: "06/11/1982",
    cpf: "000.000.000-44",
    administrativeSex: "Masculino (registro administrativo)",
  },
  "pro-005": {
    sigemId: "SIGEM-PE-000315",
    birthDate: "30/01/1989",
    cpf: null,
    administrativeSex: "Feminino (registro administrativo)",
  },
  "pro-006": {
    sigemId: "SIGEM-PE-000316",
    birthDate: "12/10/1993",
    cpf: "000.000.000-66",
    administrativeSex: "Masculino (registro administrativo)",
  },
  "pro-007": {
    sigemId: "SIGEM-PE-000308",
    birthDate: "17/02/1979",
    cpf: null,
    administrativeSex: "Feminino (registro administrativo)",
  },
  "pro-008": {
    sigemId: "SIGEM-PE-000318",
    birthDate: "20/05/1986",
    cpf: "000.000.000-88",
    administrativeSex: "Masculino (registro administrativo)",
  },
  "pro-009": {
    sigemId: "SIGEM-PE-000319",
    birthDate: "07/07/1990",
    cpf: null,
    administrativeSex: "Feminino (registro administrativo)",
  },
  "pro-010": {
    sigemId: "SIGEM-PE-000320",
    birthDate: "15/12/1983",
    cpf: "000.000.000-10",
    administrativeSex: "Masculino (registro administrativo)",
  },
};

export function identityForProfessional(
  professionalId: string,
): ProfessionalIdentityPerson | undefined {
  const professional = demonstrationProfessionals.find((item) => item.id === professionalId);
  const identity = professionalPersonOverrides[professionalId];
  if (!professional || !identity) return undefined;
  const fixture = professionalIdentityPeople.find(
    (person) => person.professionalId === professionalId,
  );
  return (
    fixture ?? {
      id: professional.personId,
      sigemId: identity.sigemId,
      fullName: professional.personName,
      birthDate: identity.birthDate,
      cpf: identity.cpf,
      ...(identity.administrativeSex ? { administrativeSex: identity.administrativeSex } : {}),
      ...(professional.externalId ? { externalIdentifier: professional.externalId } : {}),
      roles: ["Profissional"],
      professionalId,
    }
  );
}

export function allIdentityPeople() {
  const known = new Set(
    professionalIdentityPeople.flatMap((person) =>
      person.professionalId ? [person.professionalId] : [],
    ),
  );
  return [
    ...professionalIdentityPeople,
    ...demonstrationProfessionals
      .filter((professional) => !known.has(professional.id))
      .map((professional) => identityForProfessional(professional.id))
      .filter((person): person is ProfessionalIdentityPerson => Boolean(person)),
  ];
}

export type IdentityMatchStrength = "forte" | "possivel" | "homonimo";
export type IdentitySearchResult = {
  person: ProfessionalIdentityPerson;
  strength: IdentityMatchStrength;
  reason: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

export function maskCpf(value: string | null) {
  if (!value) return "Não informado";
  return `•••.•••.•••-${value.slice(-2)}`;
}

export function searchIdentityPeople(query: string): IdentitySearchResult[] {
  const term = normalize(query);
  if (!term) return [];
  return allIdentityPeople().flatMap<IdentitySearchResult>((person) => {
    const exactIdentifier = [person.sigemId, person.cpf, person.externalIdentifier].some(
      (value) => value && normalize(value) === term,
    );
    const exactName = [person.fullName, person.socialName].some(
      (value) => value && normalize(value) === term,
    );
    const partialName = [person.fullName, person.socialName].some(
      (value) => value && normalize(value).includes(term),
    );
    if (exactIdentifier)
      return [
        {
          person,
          strength: "forte",
          reason: "Identificador coincidente; confirmação humana obrigatória.",
        },
      ];
    if (exactName)
      return [
        {
          person,
          strength: "possivel",
          reason: "Nome coincidente; nascimento e identificadores devem ser conferidos.",
        },
      ];
    if (partialName)
      return [
        {
          person,
          strength: "homonimo",
          reason: "Semelhança nominal; pode ser homônimo e nenhuma seleção é automática.",
        },
      ];
    return [];
  });
}

export type ProfessionalIdentityDraft = {
  resolution: "pendente" | "nova" | "existente";
  selectedPersonId: string | null;
  fullName: string;
  socialName: string;
  birthDate: string;
  administrativeSex: string;
  cpf: string;
  civilIdentifier: string;
  externalIdentifier: string;
  dismissedPersonIds: string[];
  reviewedPersonIds: string[];
  changeReason: "correcao" | "historica";
};

export function blankProfessionalIdentityDraft(): ProfessionalIdentityDraft {
  return {
    resolution: "pendente",
    selectedPersonId: null,
    fullName: "",
    socialName: "",
    birthDate: "",
    administrativeSex: "",
    cpf: "",
    civilIdentifier: "",
    externalIdentifier: "",
    dismissedPersonIds: [],
    reviewedPersonIds: [],
    changeReason: "correcao",
  };
}

export function draftFromIdentity(person: ProfessionalIdentityPerson): ProfessionalIdentityDraft {
  return {
    resolution: "existente",
    selectedPersonId: person.id,
    fullName: person.fullName,
    socialName: person.socialName ?? "",
    birthDate: person.birthDate,
    administrativeSex: person.administrativeSex ?? "",
    cpf: person.cpf ?? "",
    civilIdentifier: person.civilIdentifier ?? "",
    externalIdentifier: person.externalIdentifier ?? "",
    dismissedPersonIds: [],
    reviewedPersonIds: [person.id],
    changeReason: "correcao",
  };
}

export function isProfessionalIdentityDirty(
  draft: ProfessionalIdentityDraft,
  initial: ProfessionalIdentityDraft,
) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function validateProfessionalIdentityDraft(draft: ProfessionalIdentityDraft) {
  const errors: string[] = [];
  if (draft.resolution === "pendente") errors.push("Resolva a Pessoa antes de concluir.");
  if (!draft.fullName.trim()) errors.push("Nome civil não informado.");
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(draft.birthDate))
    errors.push("Data de nascimento inválida no formato dd/mm/aaaa.");
  if (draft.cpf && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(draft.cpf))
    errors.push("CPF inválido no formato demonstrativo.");
  return errors;
}

export function professionalIdentityChanges(
  draft: ProfessionalIdentityDraft,
  initial: ProfessionalIdentityDraft,
) {
  const fields: Array<
    [
      keyof ProfessionalIdentityDraft,
      string,
      "Correção cadastral" | "Alteração historicamente relevante",
    ]
  > = [
    ["fullName", "Nome civil", "Alteração historicamente relevante"],
    ["socialName", "Nome social", "Alteração historicamente relevante"],
    ["birthDate", "Data de nascimento", "Alteração historicamente relevante"],
    ["administrativeSex", "Sexo cadastral", "Correção cadastral"],
    ["cpf", "CPF", "Correção cadastral"],
    ["civilIdentifier", "Documento civil", "Correção cadastral"],
    ["externalIdentifier", "Identificador externo", "Correção cadastral"],
  ];
  return fields
    .filter(([key]) => draft[key] !== initial[key])
    .map(([key, field, nature]) => ({
      field,
      nature,
      from: String(initial[key] || "Não informado"),
      to: String(draft[key] || "Não informado"),
    }));
}

export const PROFESSIONAL_IDENTITY_SECTIONS = [
  ["localizar", "Localizar Pessoa"],
  ["confirmar", "Confirmar identidade"],
  ["dados", "Dados cadastrais"],
  ["identificadores", "Identificadores"],
  ["duplicidade", "Verificação de duplicidade"],
  ["papel", "Papel Profissional"],
  ["revisao", "Revisão"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;
