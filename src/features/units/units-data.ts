/**
 * FIXTURES FICTÍCIOS — NÃO SÃO DADOS OFICIAIS DE ITAPERUNA.
 *
 * Estes registros evoluem a demonstração de UX para conceitos institucionais
 * reais do SIGEM, mas continuam sendo apenas exemplos locais. Os valores de
 * situação, contexto e localização NÃO formam enumerações oficiais, NÃO são
 * contrato de domínio e NÃO antecipam schema de banco.
 *
 * Princípios representados aqui apenas para experiência de interface:
 * - a identidade institucional não depende exclusivamente do nome atual;
 * - nomes anteriores permanecem preservados no histórico nominal;
 * - código INEP, quando presente, é identificador externo;
 * - situação operacional não equivale a encerramento oficial/censitário;
 * - instituição, oferta educacional e estrutura física são conceitos distintos.
 */

/** Situações conceituais fictícias para demonstrar filtro e leitura operacional. */
export const DEMO_OPERATIONAL_SITUATIONS = [
  "Operação registrada",
  "Operação em acompanhamento",
  "Cadastro em conferência",
] as const;
export type DemoOperationalSituation = (typeof DEMO_OPERATIONAL_SITUATIONS)[number];

/** Contextos conceituais fictícios; não representam classificação jurídica oficial. */
export const DEMO_INSTITUTIONAL_CONTEXTS = [
  "Atendimento municipal direto",
  "Atendimento conveniado acompanhado",
  "Instituição privada com vínculo cadastral",
] as const;
export type DemoInstitutionalContext = (typeof DEMO_INSTITUTIONAL_CONTEXTS)[number];

/** Recortes fictícios de localização usados apenas para demonstrar filtro. */
export const DEMO_LOCATION_SCOPES = [
  "Área urbana demonstrativa",
  "Localidade rural demonstrativa",
] as const;
export type DemoLocationScope = (typeof DEMO_LOCATION_SCOPES)[number];

export const DEMO_INEP_FILTERS = [
  { value: "with-inep", label: "Com código INEP demonstrativo" },
  { value: "without-inep", label: "Sem código INEP demonstrativo" },
] as const;

export type NominalHistoryEntry = {
  previousName: string;
  currentName: string;
  effectiveUntil: string;
  effectiveFrom: string;
  note: string;
};

export type DemonstrationUnit = {
  id: string;
  currentName: string;
  internalIdentifier: string;
  /** Código externo demonstrativo. Pode inexistir sem afetar a identidade interna. */
  inepCode?: string;
  previousNames: NominalHistoryEntry[];
  institutionalContext: DemoInstitutionalContext;
  physicalContext: string;
  locationScope: DemoLocationScope;
  neighborhood: string;
  locality: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  operationalSituation: DemoOperationalSituation;
  situationNote: string;
  updatedAt: string;
  updatedSort: number;
  institutionalNote: string;
};

export const demonstrationUnits: DemonstrationUnit[] = [
  {
    id: "demo-001",
    currentName: "Instituição Educacional Demonstrativa Horizonte",
    internalIdentifier: "SIGEM-UI-001",
    inepCode: "33000001",
    previousNames: [
      {
        previousName: "Unidade Demonstrativa Horizonte Antiga",
        currentName: "Instituição Educacional Demonstrativa Horizonte",
        effectiveUntil: "31 dez 2024",
        effectiveFrom: "01 jan 2025",
        note: "Exemplo fictício de alteração de denominação com histórico preservado.",
      },
    ],
    institutionalContext: "Atendimento municipal direto",
    physicalContext: "Funcionamento em prédio institucional demonstrativo",
    locationScope: "Área urbana demonstrativa",
    neighborhood: "Bairro demonstrativo central",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Endereço demonstrativo, 100",
    contactPhone: "(00) 0000-0000",
    contactEmail: "contato.horizonte@exemplo.invalid",
    operationalSituation: "Operação registrada",
    situationNote:
      "Situação operacional demonstrativa para consulta; não indica status censitário oficial.",
    updatedAt: "22 set 2026",
    updatedSort: 8,
    institutionalNote:
      "Registro fictício usado para demonstrar que a instituição mantém identidade própria mesmo após mudança de nome.",
  },
  {
    id: "demo-002",
    currentName: "Centro Educacional Demonstrativo Caminhos",
    internalIdentifier: "SIGEM-UI-002",
    inepCode: "33000002",
    previousNames: [],
    institutionalContext: "Atendimento conveniado acompanhado",
    physicalContext: "Uso de espaço compartilhado demonstrativo",
    locationScope: "Área urbana demonstrativa",
    neighborhood: "Bairro demonstrativo norte",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Localidade demonstrativa, 45",
    contactPhone: "Não informado",
    contactEmail: "caminhos@exemplo.invalid",
    operationalSituation: "Operação em acompanhamento",
    situationNote:
      "Acompanhamento operacional fictício; não representa autorização, convênio ou regra real.",
    updatedAt: "21 set 2026",
    updatedSort: 7,
    institutionalNote:
      "Exemplo de instituição no universo acompanhado pelo SIGEM sem simplificar sua natureza jurídica.",
  },
  {
    id: "demo-003",
    currentName: "Escola Demonstrativa Águas Claras",
    internalIdentifier: "SIGEM-UI-003",
    previousNames: [
      {
        previousName: "Escola Demonstrativa Águas",
        currentName: "Escola Demonstrativa Águas Claras",
        effectiveUntil: "30 jun 2023",
        effectiveFrom: "01 jul 2023",
        note: "Demonstração de histórico nominal sem sobrescrever a denominação anterior.",
      },
    ],
    institutionalContext: "Atendimento municipal direto",
    physicalContext: "Unidade com referência física principal demonstrativa",
    locationScope: "Localidade rural demonstrativa",
    neighborhood: "Localidade demonstrativa leste",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Estrada demonstrativa, km 2",
    contactPhone: "(00) 0000-0000",
    contactEmail: "aguas@exemplo.invalid",
    operationalSituation: "Operação registrada",
    situationNote: "Registro operacional fictício sem vínculo com dados oficiais.",
    updatedAt: "18 set 2026",
    updatedSort: 6,
    institutionalNote:
      "Exemplo fictício com código externo ausente para mostrar que a identidade interna permanece consultável.",
  },
  {
    id: "demo-004",
    currentName: "Instituição Demonstrativa Ipê",
    internalIdentifier: "SIGEM-UI-004",
    inepCode: "33000004",
    previousNames: [],
    institutionalContext: "Instituição privada com vínculo cadastral",
    physicalContext: "Endereço institucional informado sem detalhamento de prédio",
    locationScope: "Área urbana demonstrativa",
    neighborhood: "Bairro demonstrativo oeste",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Informação cadastral pendente",
    contactPhone: "Não informado",
    contactEmail: "Não informado",
    operationalSituation: "Cadastro em conferência",
    situationNote:
      "Conferência operacional fictícia; não define suspensão, encerramento ou irregularidade.",
    updatedAt: "15 set 2026",
    updatedSort: 5,
    institutionalNote:
      "Registro ilustrativo para demonstrar que instituições distintas podem compor o mesmo universo institucional do sistema.",
  },
  {
    id: "demo-005",
    currentName: "Núcleo Educacional Demonstrativo Ponte",
    internalIdentifier: "SIGEM-UI-005",
    inepCode: "33000005",
    previousNames: [],
    institutionalContext: "Atendimento municipal direto",
    physicalContext: "Atividade associada a anexo demonstrativo",
    locationScope: "Área urbana demonstrativa",
    neighborhood: "Bairro demonstrativo sul",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Rua demonstrativa, 45",
    contactPhone: "(00) 0000-0000",
    contactEmail: "ponte@exemplo.invalid",
    operationalSituation: "Operação registrada",
    situationNote: "Situação demonstrativa para leitura rápida da listagem.",
    updatedAt: "12 set 2026",
    updatedSort: 4,
    institutionalNote:
      "Exemplo usado para separar identidade institucional de eventual anexo ou referência física.",
  },
  {
    id: "demo-006",
    currentName: "Centro Demonstrativo Vale do Muriaé",
    internalIdentifier: "SIGEM-UI-006",
    previousNames: [],
    institutionalContext: "Atendimento conveniado acompanhado",
    physicalContext: "Funcionamento em estrutura física compartilhada demonstrativa",
    locationScope: "Localidade rural demonstrativa",
    neighborhood: "Localidade demonstrativa vale",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Praça demonstrativa, 8",
    contactPhone: "Não informado",
    contactEmail: "vale@exemplo.invalid",
    operationalSituation: "Operação em acompanhamento",
    situationNote: "Acompanhamento fictício sem inferir regra administrativa.",
    updatedAt: "10 set 2026",
    updatedSort: 3,
    institutionalNote:
      "Registro fictício para demonstrar consulta institucional sem modelar oferta educacional.",
  },
  {
    id: "demo-007",
    currentName: "Instituição Educacional Demonstrativa Serra",
    internalIdentifier: "SIGEM-UI-007",
    inepCode: "33000007",
    previousNames: [
      {
        previousName: "Unidade Demonstrativa Alto da Serra",
        currentName: "Instituição Educacional Demonstrativa Serra",
        effectiveUntil: "28 fev 2022",
        effectiveFrom: "01 mar 2022",
        note: "Exemplo fictício de denominação anterior mantida para rastreabilidade.",
      },
    ],
    institutionalContext: "Atendimento municipal direto",
    physicalContext: "Referência física principal com possibilidade de anexos futuros",
    locationScope: "Localidade rural demonstrativa",
    neighborhood: "Serra demonstrativa",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Estrada demonstrativa sem número",
    contactPhone: "(00) 0000-0000",
    contactEmail: "serra@exemplo.invalid",
    operationalSituation: "Operação registrada",
    situationNote: "Situação operacional fictícia e independente de encerramento censitário.",
    updatedAt: "08 set 2026",
    updatedSort: 2,
    institutionalNote: "Exemplo que reforça a preservação histórica da denominação institucional.",
  },
  {
    id: "demo-008",
    currentName: "Espaço Educacional Demonstrativo Estação",
    internalIdentifier: "SIGEM-UI-008",
    previousNames: [],
    institutionalContext: "Instituição privada com vínculo cadastral",
    physicalContext: "Localização demonstrativa em conferência",
    locationScope: "Área urbana demonstrativa",
    neighborhood: "Bairro demonstrativo estação",
    locality: "Itaperuna/RJ · referência fictícia",
    address: "Informação cadastral pendente",
    contactPhone: "Não informado",
    contactEmail: "Não informado",
    operationalSituation: "Cadastro em conferência",
    situationNote:
      "Estado de conferência fictício para demonstrar pendências sem inferir sanções ou encerramento.",
    updatedAt: "02 set 2026",
    updatedSort: 1,
    institutionalNote:
      "Exemplo criado exclusivamente para validar a experiência de consulta e estados de informação.",
  },
];

export function getDemonstrationUnit(id: string) {
  return demonstrationUnits.find((unit) => unit.id === id);
}

/** Tom visual das situações demonstrativas. Não é semântica oficial do domínio. */
export function operationalSituationTone(situation: DemoOperationalSituation) {
  if (situation === "Operação registrada") return "success" as const;
  if (situation === "Operação em acompanhamento") return "warning" as const;
  return "info" as const;
}

/**
 * Áreas internas: hipóteses de UX, não arquitetura definitiva do domínio.
 * A composição real será definida posteriormente. Oferta educacional e estrutura
 * física aparecem somente como áreas relacionadas/futuras, sem modelagem.
 */
export const unitDetailAreas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "educational-offer", label: "Oferta educacional", available: false },
  { id: "physical-structure", label: "Estrutura física", available: false },
] as const;
