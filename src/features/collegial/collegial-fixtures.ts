/**
 * Etapa 12J — configurações DEMONSTRATIVAS de colegiados.
 *
 * Nada aqui é norma da Rede Municipal. Os dois colegiados abaixo existem para
 * exercitar a infraestrutura com governanças estruturalmente diferentes, usando
 * o mesmo motor. Permanecem em RASCUNHO e não atribuem a nenhum órgão — nem ao
 * Conselho de Classe — poder de aprovar, reprovar, dispensar critério ou alterar
 * resultado: competência só existe em regra de situação homologada (12I).
 */
import type {
  CollegialActor,
  CollegialBodyConfiguration,
} from "./collegial-types";

export const COLLEGIAL_DEMONSTRATION_NOTE =
  "Configuração demonstrativa em rascunho: serve para exercitar sessão, pauta, deliberação e ata. Não está homologada, não confere competência a órgão algum e não determina situação de nenhum aluno.";

/** Perfis demonstrativos: capacidades são dados, não cargos do motor. */
export const collegialDemonstrationProfiles: CollegialActor[] = [
  {
    id: "perfil-colegiado-configuracao",
    name: "Perfil demonstrativo — configuração",
    profileLabel: "Configuração institucional",
    capabilities: ["configurar-colegiado", "revisar-colegiado"],
  },
  {
    id: "perfil-colegiado-conducao",
    name: "Perfil demonstrativo — condução de sessão",
    profileLabel: "Condução de sessão",
    capabilities: ["conduzir-sessao", "secretariar-sessao", "provocar-colegiado"],
  },
  {
    id: "perfil-colegiado-consulta",
    name: "Perfil demonstrativo — consulta",
    profileLabel: "Consulta",
    capabilities: ["consultar-colegiado"],
  },
];

export const collegialDemonstrationActor = (profileId: string): CollegialActor =>
  collegialDemonstrationProfiles.find((profile) => profile.id === profileId) ??
  collegialDemonstrationProfiles[collegialDemonstrationProfiles.length - 1]!;

/**
 * Colegiado demonstrativo A — governança densa: papéis obrigatórios, quórum por
 * proporção, votação nominal com apuração declarada e assinatura por papel.
 */
export const demonstrationCollegialBodyA: CollegialBodyConfiguration = {
  id: "col-demo-a",
  version: 1,
  label: "Colegiado demonstrativo A",
  description:
    "Governança densa apenas para demonstração: papéis obrigatórios, quórum proporcional, votação nominal e assinatura por papel.",
  status: "rascunho",
  scope: {},
  sessionNatures: [
    { id: "nat-demo-a-1", label: "Natureza demonstrativa A1" },
    { id: "nat-demo-a-2", label: "Natureza demonstrativa A2" },
  ],
  requiredParticipantRoles: [
    { roleId: "papel-demo-conducao", label: "Papel demonstrativo de condução", minimum: 1 },
    { roleId: "papel-demo-registro", label: "Papel demonstrativo de registro", minimum: 1 },
  ],
  quorumPolicy: {
    id: "quo-demo-a",
    label: "Quórum demonstrativo por proporção dos convocados",
    requirement: { unit: "proporcao-dos-convocados", minimum: 0.5 },
    note: "Valor demonstrativo, editável na configuração. Não é referência normativa da rede.",
  },
  decisionMethod: {
    id: "dec-demo-a",
    label: "Votação nominal demonstrativa",
    recordsVotes: true,
    voteOptions: [
      { id: "voto-demo-favoravel", label: "Manifestação favorável", countsAsFavorable: true },
      { id: "voto-demo-contrario", label: "Manifestação contrária" },
      { id: "voto-demo-abstencao", label: "Abstenção registrada" },
    ],
    approval: {
      basis: "proporcao-dos-votos",
      operator: "maior",
      value: 0.5,
      unit: "proporção",
    },
    note: "Apuração declarada pela configuração; o motor não conhece maioria alguma.",
  },
  signaturePolicy: {
    id: "ass-demo-a",
    label: "Aceite demonstrativo por papel",
    requiredRoleIds: ["papel-demo-conducao", "papel-demo-registro"],
  },
  provocationPolicy: {
    id: "pro-demo-a",
    label: "Provocação formal demonstrativa",
    allowedCapabilities: ["provocar-colegiado"],
    admittedReasons: [
      { id: "mot-demo-a-1", label: "Motivo demonstrativo com documentação", requiresDocument: true },
      { id: "mot-demo-a-2", label: "Motivo demonstrativo sem documentação" },
    ],
  },
  conductCapabilities: ["conduzir-sessao"],
  audit: { events: [], demonstrative: true },
  note: COLLEGIAL_DEMONSTRATION_NOTE,
};

/**
 * Colegiado demonstrativo B — governança mínima: nenhuma exigência de papel,
 * nenhum quórum declarado, decisão sem votos e nenhuma política de assinatura ou
 * provocação. Prova que o motor não presume requisito algum.
 */
export const demonstrationCollegialBodyB: CollegialBodyConfiguration = {
  id: "col-demo-b",
  version: 1,
  label: "Colegiado demonstrativo B",
  description:
    "Governança mínima apenas para demonstração: sem papéis obrigatórios, sem quórum, decisão sem votação e sem política de assinatura ou provocação.",
  status: "rascunho",
  scope: {},
  sessionNatures: [{ id: "nat-demo-b-1", label: "Natureza demonstrativa B1" }],
  requiredParticipantRoles: [],
  decisionMethod: {
    id: "dec-demo-b",
    label: "Declaração colegiada demonstrativa, sem registro de votos",
    recordsVotes: false,
  },
  conductCapabilities: ["conduzir-sessao"],
  audit: { events: [], demonstrative: true },
  note: COLLEGIAL_DEMONSTRATION_NOTE,
};

export const demonstrationCollegialBodies: CollegialBodyConfiguration[] = [
  demonstrationCollegialBodyA,
  demonstrationCollegialBodyB,
];
