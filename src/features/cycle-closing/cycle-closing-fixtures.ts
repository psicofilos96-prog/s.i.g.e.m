/**
 * Etapa 12K — políticas DEMONSTRATIVAS de encerramento.
 *
 * Nada aqui é norma da Rede Municipal: as duas políticas existem para exercitar
 * a mesma infraestrutura com exigências estruturalmente diferentes. Permanecem
 * em RASCUNHO, não homologam nada e não determinam situação de estudante algum.
 *
 * Observe que os `sourceKind` e os estados aceitos são CONFIGURAÇÃO: o inspetor
 * e os avaliadores não conhecem nenhum deles.
 */
import type {
  ClosingActor,
  CycleClosingPolicy,
  OperationAdmissibilityPolicy,
} from "./cycle-closing-types";

export const CLOSING_DEMONSTRATION_NOTE =
  "Política demonstrativa em rascunho: serve para exercitar a conferência da cadeia, o ato de encerramento e o retrato imutável. Não está homologada e não encerra ciclo algum da rede.";

/** Estados institucionais como DADO, não como enumeração do motor. */
export const demonstrationInstitutionalStates = {
  open: "aberto",
  closed: "encerrado",
  underRectification: "em-retificacao",
} as const;

export const INSTITUTIONAL_STATE_LABEL: Record<string, string> = {
  aberto: "Aberto",
  encerrado: "Encerrado",
  "em-retificacao": "Em retificação",
};

export const closingDemonstrationProfiles: ClosingActor[] = [
  {
    id: "perfil-encerramento-configuracao",
    name: "Perfil demonstrativo — configuração",
    profileLabel: "Configuração institucional",
    capabilities: ["configurar-encerramento", "revisar-encerramento"],
  },
  {
    id: "perfil-encerramento-lavratura",
    name: "Perfil demonstrativo — lavratura",
    profileLabel: "Lavratura do encerramento",
    capabilities: ["conferir-encerramento", "encerrar-ciclo-turma"],
  },
  {
    id: "perfil-encerramento-retificacao",
    name: "Perfil demonstrativo — retificação",
    profileLabel: "Retificação e reabertura",
    capabilities: [
      "conferir-encerramento",
      "encerrar-ciclo-turma",
      "retificar-encerramento-turma",
      "reabrir-turma-encerrada",
    ],
  },
  {
    id: "perfil-encerramento-consulta",
    name: "Perfil demonstrativo — consulta",
    profileLabel: "Consulta",
    capabilities: ["consultar-encerramento"],
  },
];

export const closingDemonstrationActor = (profileId: string): ClosingActor =>
  closingDemonstrationProfiles.find((profile) => profile.id === profileId) ??
  closingDemonstrationProfiles[closingDemonstrationProfiles.length - 1]!;

/** Matriz demonstrativa: operações de outros módulos participam por cadastro. */
export const demonstrationAdmissibilityPolicy: OperationAdmissibilityPolicy = {
  id: "adm-demo-1",
  label: "Matriz demonstrativa de admissibilidade",
  fallback: "permitida",
  rules: [
    {
      operationId: "registrar-lancamento-avaliativo",
      label: "Registrar lançamento avaliativo",
      institutionalStates: ["encerrado"],
      admissibility: "vedada",
      note: "Com a turma encerrada, o lançamento deixa de ser admitido enquanto não houver rito formal.",
    },
    {
      operationId: "registrar-lancamento-avaliativo",
      label: "Registrar lançamento avaliativo",
      institutionalStates: ["em-retificacao"],
      admissibility: "exige-rito",
      requiredCapabilities: ["retificar-encerramento-turma"],
    },
    {
      operationId: "abrir-sessao-colegiada",
      label: "Abrir sessão colegiada",
      institutionalStates: ["encerrado"],
      admissibility: "exige-rito",
      requiredCapabilities: ["reabrir-turma-encerrada"],
    },
  ],
};

/**
 * Política A — cadeia completa exigida, com situação acadêmica terminal.
 */
export const demonstrationClosingPolicyFull: CycleClosingPolicy = {
  id: "enc-demo-completo",
  version: 1,
  label: "Política demonstrativa — cadeia completa",
  description:
    "Exige calendário homologado, fechamentos avaliativos e de frequência de todos os períodos, consolidação do ciclo, situação acadêmica terminal e nenhuma deliberação pendente.",
  status: "rascunho",
  scope: {},
  requirements: [
    {
      id: "req-demo-calendario",
      label: "Calendário do ciclo em estado aceito",
      evaluatorId: "estado-de-fonte",
      mandatory: true,
      perStudent: false,
      parameters: { sourceKind: "calendario", acceptedStates: ["homologado"], minimumCount: 1 },
    },
    {
      id: "req-demo-cobertura-avaliativa",
      label: "Fechamento avaliativo de todos os períodos esperados",
      evaluatorId: "cobertura-de-fontes",
      mandatory: true,
      perStudent: false,
      parameters: { sourceKind: "fechamento-avaliativo-periodo" },
    },
    {
      id: "req-demo-cobertura-frequencia",
      label: "Fechamento de frequência de todos os períodos esperados",
      evaluatorId: "cobertura-de-fontes",
      mandatory: true,
      perStudent: false,
      parameters: { sourceKind: "fechamento-frequencia-periodo" },
    },
    {
      id: "req-demo-consolidacao",
      label: "Consolidação do ciclo materializada",
      evaluatorId: "estado-de-fonte",
      mandatory: true,
      perStudent: false,
      parameters: {
        sourceKind: "consolidacao-ciclo",
        acceptedStates: ["materializada"],
        minimumCount: 1,
      },
    },
    {
      id: "req-demo-deliberacao",
      label: "Nenhuma deliberação exigida permanece pendente",
      evaluatorId: "ausencia-de-pendencia",
      mandatory: true,
      perStudent: true,
      parameters: {
        sourceKind: "situacao-academica",
        pendingStates: ["aguardando-deliberacao"],
      },
    },
  ],
  terminalStandingRequirement: {
    required: true,
    note: "Valor demonstrativo: a política exige situação terminal, sem restringir quais são aceitas.",
  },
  cohortCompletionPolicy: { requiresAllStudentsResolved: true },
  admissibilityPolicy: demonstrationAdmissibilityPolicy,
  rectificationPolicy: {
    requiresJustification: true,
    requiredCapabilities: ["retificar-encerramento-turma"],
  },
  closingCapabilities: ["encerrar-ciclo-turma"],
  audit: { events: [], demonstrative: true },
  note: CLOSING_DEMONSTRATION_NOTE,
};

/**
 * Política B — percurso qualitativo: SEM exigência de situação acadêmica
 * terminal (ajuste 3). Prova que um percurso encerra legitimamente sem
 * APROVADO, REPROVADO ou qualquer situação inventada para o encerramento.
 */
export const demonstrationClosingPolicyQualitative: CycleClosingPolicy = {
  id: "enc-demo-qualitativo",
  version: 1,
  label: "Política demonstrativa — percurso qualitativo",
  description:
    "Exige apenas o registro do percurso e nenhuma situação acadêmica terminal. Não há requisito de nota, frequência mínima ou deliberação.",
  status: "rascunho",
  scope: {},
  requirements: [
    {
      id: "req-demo-registro-percurso",
      label: "Registro do percurso disponível",
      evaluatorId: "estado-de-fonte",
      mandatory: true,
      perStudent: true,
      parameters: {
        sourceKind: "registro-de-percurso",
        acceptedStates: ["registrado"],
        minimumCount: 1,
      },
    },
  ],
  rectificationPolicy: {
    requiresJustification: true,
    requiredCapabilities: ["retificar-encerramento-turma"],
  },
  closingCapabilities: ["encerrar-ciclo-turma"],
  audit: { events: [], demonstrative: true },
  note: CLOSING_DEMONSTRATION_NOTE,
};

export const demonstrationClosingPolicies: CycleClosingPolicy[] = [
  demonstrationClosingPolicyFull,
  demonstrationClosingPolicyQualitative,
];

/** Natureza dos atos, também cadastrável. */
export const demonstrationActKinds = {
  closing: { id: "encerramento", label: "Ato de encerramento do ciclo e da turma" },
  rectification: { id: "retificacao", label: "Ato de retificação do encerramento" },
  reopening: { id: "reabertura", label: "Ato de reabertura para retificação" },
} as const;

/** Terminologia do LABORATÓRIO; com sessão nunca é usada (6D.FINAL.6). */
export const demonstrationClosingTerminology = {
  states: {
    open: { id: demonstrationInstitutionalStates.open, label: INSTITUTIONAL_STATE_LABEL.aberto! },
    closed: { id: demonstrationInstitutionalStates.closed, label: INSTITUTIONAL_STATE_LABEL.encerrado! },
    underRectification: { id: demonstrationInstitutionalStates.underRectification, label: INSTITUTIONAL_STATE_LABEL["em-retificacao"]! },
  },
  acts: demonstrationActKinds,
};
