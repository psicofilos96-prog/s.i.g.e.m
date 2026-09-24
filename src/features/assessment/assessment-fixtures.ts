/**
 * Fixtures DEMONSTRATIVAS do domínio de avaliação. Nenhum valor aqui é regra
 * da rede: escalas e períodos têm normativeStatus "demonstrativo" ou "pendente".
 */
import type {
  AssessmentConfiguration,
  AssessmentInstrument,
  AssessmentPeriodStructure,
  InstrumentType,
  PendingNormativeRule,
} from "./assessment-types";

export const PENDING_NORMATIVE_RULES: PendingNormativeRule[] = [
  {
    id: "pn-periodos",
    topic: "Períodos avaliativos",
    description: "Quantidade, nome e datas dos períodos avaliativos da rede.",
  },
  {
    id: "pn-escala",
    topic: "Escala",
    description: "Escala numérica, conceitual ou descritiva por etapa/modalidade.",
  },
  {
    id: "pn-consolidacao",
    topic: "Consolidação",
    description:
      "Como resultados de instrumentos compõem o resultado do período, do componente e o final (pesos, médias, quantidade mínima).",
  },
  {
    id: "pn-arredondamento",
    topic: "Arredondamento",
    description: "Existência e forma de arredondamento.",
  },
  {
    id: "pn-recuperacao",
    topic: "Recuperação",
    description: "Recuperação paralela, periódica ou final e seu efeito no resultado.",
  },
  {
    id: "pn-situacao",
    topic: "Situação acadêmica",
    description: "Critérios de aprovação, reprovação, progressão e dependência.",
  },
  {
    id: "pn-frequencia",
    topic: "Frequência",
    description: "Frequência mínima, abonos e efeito da frequência na situação acadêmica.",
  },
  {
    id: "pn-conselho",
    topic: "Conselho de classe",
    description: "Competências e efeitos das decisões do conselho.",
  },
  {
    id: "pn-movimentacao",
    topic: "Movimentação",
    description:
      "Aproveitamento de resultados de aluno transferido, remanejado ou com ingresso posterior.",
  },
  {
    id: "pn-ei",
    topic: "Educação Infantil",
    description:
      "Quais registros descritivos ou relatórios serão documentos oficiais e sua periodicidade.",
  },
  { id: "pn-eja", topic: "EJA", description: "Organização avaliativa por fases e totalidades." },
  {
    id: "pn-aee",
    topic: "AEE e complementares",
    description: "Se e como AEE e atividades complementares são avaliados.",
  },
];

/** Ano letivo agora vive em academic-structure; reexportado por compatibilidade. */
export { academicYears } from "@/features/academic/academic-structure";

/** Três períodos desiguais — propositalmente não são bimestres. */
export const periodStructures: AssessmentPeriodStructure[] = [
  {
    id: "est-2026-a",
    academicYearId: "ano-2026",
    label: "Estrutura demonstrativa em três períodos",
    normativeStatus: "demonstrativo",
    periods: [
      {
        id: "pa-2026-a1",
        structureId: "est-2026-a",
        academicYearId: "ano-2026",
        sequence: 1,
        label: "Período demonstrativo 1",
        start: "2026-02-05",
        end: "2026-05-15",
      },
      {
        id: "pa-2026-a2",
        structureId: "est-2026-a",
        academicYearId: "ano-2026",
        sequence: 2,
        label: "Período demonstrativo 2",
        start: "2026-05-18",
        end: "2026-09-04",
      },
      {
        id: "pa-2026-a3",
        structureId: "est-2026-a",
        academicYearId: "ano-2026",
        sequence: 3,
        label: "Período demonstrativo 3",
        start: "2026-09-08",
        end: "2026-12-18",
      },
    ],
  },
  {
    id: "est-2026-unico",
    academicYearId: "ano-2026",
    label: "Período único demonstrativo",
    normativeStatus: "demonstrativo",
    periods: [
      {
        id: "pa-2026-u1",
        structureId: "est-2026-unico",
        academicYearId: "ano-2026",
        sequence: 1,
        label: "Período único",
        start: "2026-02-05",
        end: "2026-12-18",
      },
    ],
  },
  {
    id: "est-2025-unico",
    academicYearId: "ano-2025",
    label: "Período único demonstrativo 2025",
    normativeStatus: "demonstrativo",
    periods: [
      {
        id: "pa-2025-u1",
        structureId: "est-2025-unico",
        academicYearId: "ano-2025",
        sequence: 1,
        label: "Período único",
        start: "2025-02-03",
        end: "2025-12-19",
      },
    ],
  },
];

const allPending = PENDING_NORMATIVE_RULES.map((rule) => rule.id);

export const assessmentConfigurations: AssessmentConfiguration[] = [
  {
    id: "cfg-2026-quantitativa-demo",
    label: "Configuração quantitativa demonstrativa",
    academicYearId: "ano-2026",
    scope: { stageIds: ["etp-demo-anos-iniciais", "etp-demo-anos-finais"] },
    strategy: "quantitativa",
    periodStructureId: "est-2026-a",
    scales: [{ kind: "numerica", min: 0, max: 100, step: 1, normativeStatus: "demonstrativo" }],
    allowedInstrumentTypeIds: ["it-atividade", "it-prova", "it-trabalho", "it-projeto", "it-outro"],
    usesPedagogicalRecords: false,
    allowsGrades: true,
    allowsPromotionDecision: true,
    consolidationRules: [
      {
        id: "rc-periodo",
        level: "periodo",
        normativeStatus: "pendente",
        description: "Consolidação por período não definida.",
      },
      {
        id: "rc-final",
        level: "final",
        normativeStatus: "pendente",
        description: "Resultado final não definido.",
      },
    ],
    pendingRuleIds: allPending.filter((id) => id !== "pn-ei"),
    normativeStatus: "demonstrativo",
    version: 1,
  },
  {
    id: "cfg-2026-conceitual-demo",
    label: "Configuração conceitual demonstrativa",
    academicYearId: "ano-2026",
    scope: { stageIds: ["mod-demo-eja"] },
    strategy: "conceitual",
    periodStructureId: "est-2026-unico",
    scales: [
      {
        kind: "conceitual",
        ordered: false,
        options: [
          { id: "cc-demo-1", label: "Conceito demonstrativo 1" },
          { id: "cc-demo-2", label: "Conceito demonstrativo 2" },
        ],
        normativeStatus: "demonstrativo",
      },
      { kind: "descritiva" },
    ],
    allowedInstrumentTypeIds: ["it-atividade", "it-producao", "it-projeto", "it-outro"],
    usesPedagogicalRecords: false,
    allowsGrades: true,
    allowsPromotionDecision: true,
    consolidationRules: [],
    pendingRuleIds: allPending.filter((id) => id !== "pn-ei"),
    normativeStatus: "demonstrativo",
    version: 1,
  },
  {
    id: "cfg-2026-ei-acompanhamento",
    label: "Acompanhamento do desenvolvimento — Educação Infantil",
    academicYearId: "ano-2026",
    scope: { stageIds: ["etp-demo-ei"] },
    strategy: "acompanhamento",
    periodStructureId: "est-2026-unico",
    scales: [],
    allowedInstrumentTypeIds: [],
    usesPedagogicalRecords: true,
    allowsGrades: false,
    allowsPromotionDecision: false,
    consolidationRules: [],
    pendingRuleIds: ["pn-periodos", "pn-ei", "pn-aee"],
    normativeStatus: "demonstrativo",
    version: 1,
  },
];

/** Tipos configuráveis de instrumento — não é taxonomia normativa. */
export const instrumentTypes: InstrumentType[] = [
  { id: "it-atividade", label: "Atividade" },
  { id: "it-prova", label: "Prova" },
  { id: "it-trabalho", label: "Trabalho" },
  { id: "it-projeto", label: "Projeto" },
  { id: "it-producao", label: "Produção" },
  { id: "it-pratica", label: "Avaliação prática" },
  { id: "it-outro", label: "Outro" },
];

export const instrumentFixtures: AssessmentInstrument[] = [
  {
    id: "ins-demo-001",
    configurationId: "cfg-2026-quantitativa-demo",
    periodId: "pa-2026-a1",
    pedagogicalAssignmentId: "atp-001",
    classId: "tur-001",
    instrumentTypeId: "it-atividade",
    title: "Atividade demonstrativa de leitura",
    appliedOn: "2026-03-10",
    periodSource: "legado-demonstrativo",
    status: "aplicado",
    professionalId: "pro-006",
    // "Linguagens" demonstrativo não existe como código da matriz: identidade pela atuação.
    curriculumRef: { kind: "atuacao", assignmentId: "atp-001" },
    configurationVersion: 1,
    createdBy: {
      professionalId: "pro-006",
      pedagogicalAssignmentId: "atp-001",
      displayName: "Profissional Fictícia Fernanda Rocha",
      at: "2026-03-10T12:00:00.000Z",
    },
    snapshot: {
      classLabel: "Turma demonstrativa 3º ano A",
      fieldLabel: "Componente curricular demonstrativo — Linguagens",
    },
  },
];
