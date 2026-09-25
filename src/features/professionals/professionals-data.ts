/**
 * Dados integralmente fictícios para validação da estrutura de profissionais.
 * Não representam servidores, cargos, regras jurídicas ou atos do Município.
 */

export type FunctionalStatus = "Vigente" | "Encerrado" | "Em conferência";
export type ProfessionalSituation = "Com contexto vigente" | "Histórico" | "Em conferência";

export type FunctionalAllocation = {
  id: string;
  place: string;
  unitId?: string;
  sector?: string;
  /** Tipo de contexto organizacional demonstrativo; não é taxonomia oficial. */
  contextKind?: string;
  /** Carga horária destinada à lotação, quando conhecida. Pode inexistir. */
  distributedHours?: string;
  start: string;
  end?: string;
  status: "Atual" | "Histórico";
};

export type FunctionAssignment = {
  id: string;
  name: string;
  context: string;
  /** Tipo de contexto institucional demonstrativo; não é taxonomia oficial. */
  contextKind?: string;
  /** Lotação relacionada, quando pertinente. Ausência é situação válida. */
  postingId?: string;
  /** Carga horária contextual da atribuição, quando conhecida. */
  contextualHours?: string;
  /** Referência ao ato ou documento que fundamenta a atribuição; opcional. */
  administrativeReference?: string;
  start: string;
  end?: string;
  status: "Atual" | "Histórico";
};

export type PedagogicalActivity = {
  id: string;
  context: string;
  component?: string;
  period: string;
  start: string;
  end?: string;
  status: "Atual" | "Histórico";
};

export type FunctionalLink = {
  id: string;
  employerContext: string;
  functionalIdentifier: string;
  cargo: string;
  framework?: string;
  weeklyHours?: string;
  status: FunctionalStatus;
  start: string;
  end?: string;
  allocations: FunctionalAllocation[];
  functions: FunctionAssignment[];
  pedagogicalActivities: PedagogicalActivity[];
};

export type FunctionalHistoryEntry = {
  id: string;
  year: string;
  title: string;
  description: string;
  status: "Atual" | "Histórico";
  technicalDetail: string;
};

export type DemonstrationProfessional = {
  id: string;
  personId: string;
  personName: string;
  professionalId: string;
  externalId?: string;
  situation: ProfessionalSituation;
  links: FunctionalLink[];
  history: FunctionalHistoryEntry[];
  updatedAt: string;
};

const municipal = "Contexto municipal demonstrativo";
const partner = "Contexto conveniado demonstrativo";
const external = "Contexto externo demonstrativo — cessão";

export const demonstrationProfessionals: DemonstrationProfessional[] = [
  {
    id: "pro-001",
    personId: "pes-pro-001",
    personName: "Profissional Fictícia Aurora Martins",
    professionalId: "SIGEM-PR-000201",
    externalId: "EXT-DEMO-P01",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:10",
    links: [
      {
        id: "vf-001",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2001",
        cargo: "Docência — exemplo conceitual",
        framework: "Classificação administrativa não oficial",
        weeklyHours: "20 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2024",
        allocations: [
          {
            id: "lot-001",
            place: "Instituição Educacional Demonstrativa Horizonte",
            unitId: "demo-001",
            start: "2024",
            status: "Atual",
          },
        ],
        functions: [
          {
            id: "fun-001-a",
            name: "Coordenação — função demonstrativa",
            context: "Instituição Educacional Demonstrativa Horizonte",
            contextKind: "Unidade escolar",
            postingId: "lot-001",
            start: "2025",
            status: "Atual",
          },
          {
            id: "fun-001-b",
            name: "Coordenação — função demonstrativa",
            context: "Instituição Educacional Demonstrativa Horizonte",
            contextKind: "Unidade escolar",
            start: "2025",
            status: "Atual",
          },
        ],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-001",
        year: "2024",
        title: "Ingresso no contexto funcional",
        description: "Vínculo e lotação inicial registrados separadamente.",
        status: "Histórico",
        technicalDetail: "Vínculo vf-001 · Lotação lot-001",
      },
      {
        id: "hist-002",
        year: "2026",
        title: "Contexto funcional vigente",
        description: "Permanece lotada na instituição demonstrativa.",
        status: "Atual",
        technicalDetail: "Vínculo vigente sem inferência de atuação pedagógica",
      },
    ],
  },
  {
    id: "pro-002",
    personId: "pes-pro-002",
    personName: "Profissional Fictício Bento Nogueira",
    professionalId: "SIGEM-PR-000202",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:15",
    links: [
      {
        id: "vf-002-a",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2002-A",
        cargo: "Apoio administrativo — exemplo",
        weeklyHours: "30 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2022",
        allocations: [
          {
            id: "lot-002-a",
            place: "Secretaria demonstrativa",
            sector: "Setor administrativo demonstrativo",
            start: "2022",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
      {
        id: "vf-002-b",
        employerContext: partner,
        functionalIdentifier: "VF-DEMO-2002-B",
        cargo: "Formação educacional — exemplo",
        status: "Vigente",
        start: "2025",
        allocations: [
          {
            id: "lot-002-b",
            place: "Núcleo Educacional Demonstrativo Ponte",
            unitId: "demo-004",
            start: "2025",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-003",
        year: "2022",
        title: "Primeiro vínculo funcional",
        description: "Início do vínculo municipal demonstrativo.",
        status: "Histórico",
        technicalDetail: "Vínculo vf-002-a",
      },
      {
        id: "hist-004",
        year: "2025",
        title: "Novo vínculo funcional",
        description: "Segundo vínculo criado sem duplicar Pessoa ou Profissional.",
        status: "Atual",
        technicalDetail: "Vínculo vf-002-b coexistente",
      },
    ],
  },
  {
    id: "pro-003",
    personId: "pes-pro-003",
    personName: "Profissional Fictícia Cecília Andrade",
    professionalId: "SIGEM-PR-000203",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:20",
    links: [
      {
        id: "vf-003",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2003",
        cargo: "Docência — exemplo conceitual",
        weeklyHours: "40 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2023",
        allocations: [
          {
            id: "lot-003-a",
            place: "Instituição Educacional Demonstrativa Horizonte",
            unitId: "demo-001",
            contextKind: "Unidade escolar",
            distributedHours: "30 h destinadas a esta lotação",
            start: "2024",
            status: "Atual",
          },
          {
            id: "lot-003-b",
            place: "Escola Demonstrativa Águas Claras",
            unitId: "demo-002",
            contextKind: "Unidade escolar",
            distributedHours: "10 h destinadas a esta lotação",
            start: "2025",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-005",
        year: "2024",
        title: "Lotação na unidade Horizonte",
        description: "Primeira lotação vinculada ao mesmo vínculo funcional.",
        status: "Histórico",
        technicalDetail: "Lotação lot-003-a",
      },
      {
        id: "hist-006",
        year: "2025",
        title: "Segunda lotação simultânea",
        description: "A nova lotação não substituiu a anterior.",
        status: "Atual",
        technicalDetail: "Lotações lot-003-a e lot-003-b atuais",
      },
    ],
  },
  {
    id: "pro-004",
    personId: "pes-pro-004",
    personName: "Profissional Fictício Davi Campos",
    professionalId: "SIGEM-PR-000204",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:25",
    links: [
      {
        id: "vf-004",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2004",
        cargo: "Cargo administrativo — exemplo",
        framework: "Enquadramento demonstrativo B",
        weeklyHours: "40 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2021",
        allocations: [
          {
            id: "lot-004",
            place: "Instituição Educacional Demonstrativa Serra",
            unitId: "demo-003",
            start: "2021",
            status: "Atual",
          },
        ],
        functions: [
          {
            id: "fun-004-hist",
            name: "Apoio institucional — função demonstrativa",
            context: "Instituição Educacional Demonstrativa Serra",
            contextKind: "Unidade escolar",
            postingId: "lot-004",
            start: "2022",
            end: "2024",
            status: "Histórico",
          },
          {
            id: "fun-004",
            name: "Coordenação — função demonstrativa",
            context: "Instituição Educacional Demonstrativa Serra",
            contextKind: "Unidade escolar",
            postingId: "lot-004",
            contextualHours: "20 h contextuais informadas na atribuição",
            administrativeReference: "Referência administrativa demonstrativa DEMO-2025/04",
            start: "2025",
            status: "Atual",
          },
        ],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-007",
        year: "2021",
        title: "Ingresso em cargo administrativo",
        description: "Cargo associado ao vínculo funcional.",
        status: "Histórico",
        technicalDetail: "Cargo e vínculo preservados",
      },
      {
        id: "hist-008",
        year: "2025",
        title: "Atribuição de função de coordenação",
        description: "A função foi registrada sem alterar o cargo.",
        status: "Atual",
        technicalDetail: "Função fun-004",
      },
    ],
  },
  {
    id: "pro-005",
    personId: "pes-pro-005",
    personName: "Profissional Fictícia Elisa Monteiro",
    professionalId: "SIGEM-PR-000205",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:30",
    links: [
      {
        id: "vf-005",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2005",
        cargo: "Cargo técnico — exemplo",
        status: "Vigente",
        start: "2020",
        allocations: [
          {
            id: "lot-005-a",
            place: "Instituição Educacional Demonstrativa Horizonte",
            unitId: "demo-001",
            start: "2020",
            status: "Atual",
          },
          {
            id: "lot-005-b",
            place: "Escola Demonstrativa Águas Claras",
            unitId: "demo-002",
            start: "2025",
            status: "Atual",
          },
        ],
        functions: [
          {
            id: "fun-005-a",
            name: "Direção — função demonstrativa",
            context: "Instituição Educacional Demonstrativa Horizonte",
            contextKind: "Unidade escolar",
            postingId: "lot-005-a",
            start: "2024",
            status: "Atual",
          },
          {
            id: "fun-005-b",
            name: "Coordenação — função demonstrativa",
            context: "Escola Demonstrativa Águas Claras",
            contextKind: "Unidade escolar",
            postingId: "lot-005-b",
            start: "2025",
            status: "Atual",
          },
          {
            id: "fun-005-c",
            name: "Direção — função demonstrativa",
            context: "Escola Demonstrativa Águas Claras",
            contextKind: "Unidade escolar",
            postingId: "lot-005-b",
            start: "2026",
            status: "Atual",
          },
        ],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-009",
        year: "2024",
        title: "Função de direção atribuída",
        description: "Função vinculada a uma lotação específica.",
        status: "Histórico",
        technicalDetail: "Função fun-005-a",
      },
      {
        id: "hist-010",
        year: "2025",
        title: "Segunda função em outro contexto",
        description: "Duas funções atuais coexistem no mesmo vínculo.",
        status: "Atual",
        technicalDetail: "Funções fun-005-a e fun-005-b",
      },
    ],
  },
  {
    id: "pro-006",
    personId: "pes-pro-006",
    personName: "Profissional Fictício Fábio Ribeiro",
    professionalId: "SIGEM-PR-000206",
    externalId: "EXT-DEMO-P06",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:35",
    links: [
      {
        id: "vf-006",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2006",
        cargo: "Docência — exemplo conceitual",
        weeklyHours: "20 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2024",
        allocations: [
          {
            id: "lot-006",
            place: "Instituição Educacional Demonstrativa Horizonte",
            unitId: "demo-001",
            start: "2024",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [
          {
            id: "atu-006",
            context: "Turma demonstrativa 3º ano A",
            component: "Componente curricular demonstrativo",
            period: "Período letivo 2026",
            start: "2026",
            status: "Atual",
          },
        ],
      },
    ],
    history: [
      {
        id: "hist-011",
        year: "2024",
        title: "Vínculo e lotação registrados",
        description: "Cargo e lotação foram preservados como conceitos próprios.",
        status: "Histórico",
        technicalDetail: "Vínculo vf-006 · Lotação lot-006",
      },
      {
        id: "hist-012",
        year: "2026",
        title: "Atuação pedagógica atribuída",
        description: "Atuação específica, sem derivação automática do cargo.",
        status: "Atual",
        technicalDetail: "Atuação atu-006",
      },
    ],
  },
  {
    id: "pro-007",
    personId: "pes-pro-007",
    personName: "Profissional Fictícia Gabriela Torres",
    professionalId: "SIGEM-PR-000207",
    situation: "Histórico",
    updatedAt: "23/09/2026 · 08:40",
    links: [
      {
        id: "vf-007",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2007",
        cargo: "Apoio escolar — exemplo",
        weeklyHours: "Carga horária registrada no vínculo histórico: 30 h",
        status: "Encerrado",
        start: "2019",
        end: "2024",
        allocations: [
          {
            id: "lot-007",
            place: "Espaço Educacional Demonstrativo Estação",
            unitId: "demo-005",
            start: "2019",
            end: "2024",
            status: "Histórico",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-013",
        year: "2019",
        title: "Ingresso no contexto funcional",
        description: "Vínculo histórico iniciado.",
        status: "Histórico",
        technicalDetail: "Vínculo vf-007",
      },
      {
        id: "hist-014",
        year: "2024",
        title: "Encerramento do vínculo",
        description: "Registro encerrado e preservado para consulta.",
        status: "Histórico",
        technicalDetail: "Sem vínculo vigente",
      },
    ],
  },
  {
    id: "pro-008",
    personId: "pes-pro-008",
    personName: "Profissional Fictício Heitor Almeida",
    professionalId: "SIGEM-PR-000208",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:45",
    links: [
      {
        id: "vf-008",
        employerContext: external,
        functionalIdentifier: "VF-DEMO-2008",
        cargo: "Cargo de origem não classificado pelo SIGEM",
        status: "Vigente",
        start: "2025",
        allocations: [
          {
            id: "lot-008",
            place: "Núcleo Educacional Demonstrativo Ponte",
            unitId: "demo-004",
            start: "2025",
            status: "Atual",
          },
        ],
        functions: [
          {
            id: "fun-008",
            name: "Apoio institucional — função demonstrativa",
            context: "Núcleo Educacional Demonstrativo Ponte",
            start: "2025",
            status: "Atual",
          },
        ],
        pedagogicalActivities: [],
      },
      {
        id: "vf-008-b",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2008-B",
        cargo: "Apoio educacional — exemplo",
        weeklyHours: "20 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2026",
        allocations: [],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-015",
        year: "2025",
        title: "Início do contexto externo demonstrativo",
        description: "A cessão não foi convertida em categoria jurídica oficial.",
        status: "Atual",
        technicalDetail: "Contexto funcional externo",
      },
    ],
  },
  {
    id: "pro-009",
    personId: "pes-pro-009",
    personName: "Profissional Fictícia Íris Ferreira",
    professionalId: "SIGEM-PR-000209",
    situation: "Em conferência",
    updatedAt: "23/09/2026 · 08:50",
    links: [
      {
        id: "vf-009",
        employerContext: partner,
        functionalIdentifier: "VF-DEMO-2009",
        cargo: "Mediação educacional — exemplo",
        status: "Em conferência",
        start: "2026",
        allocations: [
          {
            id: "lot-009",
            place: "Escola Demonstrativa Águas Claras",
            unitId: "demo-002",
            start: "2026",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-016",
        year: "2026",
        title: "Contexto funcional em conferência",
        description: "Carga horária não informada; nenhum valor foi presumido.",
        status: "Atual",
        technicalDetail: "Vínculo vf-009 em conferência",
      },
    ],
  },
  {
    id: "pro-010",
    personId: "pes-pro-010",
    personName: "Profissional Fictício João Leal",
    professionalId: "SIGEM-PR-000210",
    situation: "Com contexto vigente",
    updatedAt: "23/09/2026 · 08:55",
    links: [
      {
        id: "vf-010",
        employerContext: municipal,
        functionalIdentifier: "VF-DEMO-2010",
        cargo: "Serviço técnico — exemplo",
        weeklyHours: "30 h semanais informadas no vínculo",
        status: "Vigente",
        start: "2020",
        allocations: [
          {
            id: "lot-010-a",
            place: "Instituição Educacional Demonstrativa Serra",
            unitId: "demo-003",
            start: "2020",
            end: "2024",
            status: "Histórico",
          },
          {
            id: "lot-010-b",
            place: "Espaço Educacional Demonstrativo Estação",
            unitId: "demo-005",
            contextKind: "Unidade escolar",
            distributedHours: "20 h destinadas a esta lotação",
            start: "2025",
            status: "Atual",
          },
        ],
        functions: [],
        pedagogicalActivities: [],
      },
    ],
    history: [
      {
        id: "hist-017",
        year: "2020",
        title: "Lotação inicial",
        description: "Atuação na instituição Serra.",
        status: "Histórico",
        technicalDetail: "Lotação lot-010-a",
      },
      {
        id: "hist-018",
        year: "2025",
        title: "Mudança de lotação",
        description: "A lotação anterior foi encerrada e preservada.",
        status: "Atual",
        technicalDetail: "Lotação lot-010-b",
      },
    ],
  },
  /**
   * Cenário integrado B: Pessoa com papel Profissional já criado e nenhum
   * vínculo funcional registrado. A identidade permanece válida e consultável.
   */
  {
    id: "pro-011",
    personId: "pes-pro-011",
    personName: "Profissional Fictícia Lívia Prado",
    professionalId: "SIGEM-PR-000211",
    situation: "Em conferência",
    updatedAt: "23/09/2026 · 09:05",
    links: [],
    history: [
      {
        id: "hist-019",
        year: "2026",
        title: "Papel profissional criado",
        description:
          "A Pessoa passou a possuir o papel Profissional. Nenhum vínculo funcional foi criado junto.",
        status: "Atual",
        technicalDetail: "Profissional pro-011 sem vínculo funcional",
      },
    ],
  },
];

export const PROFESSIONAL_DATA_MINIMIZATION_NOTE =
  "Minimização de dados: esta consulta não apresenta CPF, endereço residencial, dados bancários, familiares, médicos ou documentos pessoais completos.";

export const PROFESSIONAL_SITUATIONS = [
  ...new Set(demonstrationProfessionals.map((item) => item.situation)),
];
export const PROFESSIONAL_EMPLOYERS = [
  ...new Set(
    demonstrationProfessionals.flatMap((item) => item.links.map((link) => link.employerContext)),
  ),
];
export const PROFESSIONAL_CARGOS = [
  ...new Set(demonstrationProfessionals.flatMap((item) => item.links.map((link) => link.cargo))),
];
export const PROFESSIONAL_FUNCTIONS = [
  ...new Set(
    demonstrationProfessionals.flatMap((item) =>
      item.links.flatMap((link) => link.functions.map((assignment) => assignment.name)),
    ),
  ),
];
export const PROFESSIONAL_ALLOCATIONS = [
  ...new Set(
    demonstrationProfessionals.flatMap((item) =>
      item.links.flatMap((link) => link.allocations.map((allocation) => allocation.place)),
    ),
  ),
];

export function getDemonstrationProfessional(id: string) {
  return demonstrationProfessionals.find((item) => item.id === id);
}

export function currentLinks(item: DemonstrationProfessional) {
  return item.links.filter((link) => link.status !== "Encerrado");
}

export function currentAllocations(item: DemonstrationProfessional) {
  return currentLinks(item).flatMap((link) =>
    link.allocations.filter((allocation) => allocation.status === "Atual"),
  );
}

export function currentFunctions(item: DemonstrationProfessional) {
  return currentLinks(item).flatMap((link) =>
    link.functions.filter((assignment) => assignment.status === "Atual"),
  );
}

export function hasPedagogicalActivity(item: DemonstrationProfessional) {
  return item.links.some((link) => link.pedagogicalActivities.length > 0);
}

export function professionalSituationTone(situation: ProfessionalSituation) {
  if (situation === "Com contexto vigente") return "success" as const;
  if (situation === "Em conferência") return "warning" as const;
  return "neutral" as const;
}

export const professionalDetailAreas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "trajectory", label: "Trajetória funcional", available: true },
  { id: "links", label: "Vínculos", available: false },
  { id: "allocations", label: "Lotações", available: false },
  { id: "functions", label: "Funções", available: false },
  { id: "pedagogical", label: "Atuação pedagógica", available: false },
  { id: "documents", label: "Documentos", available: false },
  { id: "audit", label: "Histórico/Auditoria", available: false },
] as const;
