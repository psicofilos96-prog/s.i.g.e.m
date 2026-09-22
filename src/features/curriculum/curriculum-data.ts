/**
 * FIXTURES DEMONSTRATIVOS — NÃO SÃO CADASTRO OFICIAL DAS ESCOLAS DE ITAPERUNA.
 *
 * Origem dos dados (declarada em cada registro por `dataOrigin`):
 * - "documentado": estrutura derivada da matriz curricular documentada
 *   (organização acadêmica, elementos curriculares e cargas totais informadas).
 * - "inventado": criado exclusivamente para demonstrar a experiência de uso
 *   (identificadores, versões, datas de vigência, distribuição de cargas por
 *   elemento quando a documentação não detalha, associação a unidades
 *   fictícias e situações operacionais).
 *
 * Nada aqui é enumeração oficial, contrato de domínio ou schema de banco.
 * Conceitos mantidos deliberadamente distintos: unidade escolar, oferta
 * educacional, organização acadêmica, matriz curricular e vigência.
 */

import type { MatrixTableColumn, MatrixTableGroup } from "@/components/sigem/curriculum-table";

export type CurriculumDataOrigin = "documentado" | "inventado" | "misto";

/**
 * Situações demonstrativas de matriz; não representam fluxo de aprovação nem
 * enumeração definitiva de backend. "Rascunho" existe apenas para demonstrar a
 * experiência de elaboração: nada é persistido.
 */
export const DEMO_MATRIX_SITUATIONS = ["Rascunho", "Vigente", "Histórica"] as const;
export type DemoMatrixSituation = (typeof DEMO_MATRIX_SITUATIONS)[number];

/** Recortes demonstrativos de organização acadêmica. Não são enums oficiais. */
export const DEMO_MATRIX_SEGMENTS = [
  "Educação Infantil",
  "Ensino Fundamental — 1º segmento",
  "Ensino Fundamental — 2º segmento",
  "EJA — 1º segmento",
  "EJA — 2º segmento",
  "Ampliação curricular (tempo integral)",
] as const;
export type DemoMatrixSegment = (typeof DEMO_MATRIX_SEGMENTS)[number];

/** Estrutura por campos de experiências e jornadas (Educação Infantil). */
export type ExperienceFieldsStructure = {
  kind: "experience-fields";
  organizationLabel: string;
  groupings: Array<{ id: string; label: string; helper?: string }>;
  fields: Array<{ id: string; label: string; description: string }>;
  journeys: Array<{ id: string; label: string; weekly: string; description: string }>;
  note: string;
};

/** Estrutura matricial de elementos curriculares por coluna (ano ou fase). */
export type MatrixGridStructure = {
  kind: "grid";
  organizationLabel: string;
  rowsHeader: string;
  unitLabel: string;
  columns: MatrixTableColumn[];
  groups: MatrixTableGroup[];
  totals: Array<number | null>;
  totalsLabel: string;
  legend: string[];
};

/** Estrutura de ampliação curricular; arquitetura visual preparada, sem modelagem. */
export type ExtendedTimeStructure = {
  kind: "extended-time";
  organizationLabel: string;
  description: string;
  axes: Array<{ id: string; label: string; description: string }>;
  pending: string[];
};

export type CurriculumStructure =
  ExperienceFieldsStructure | MatrixGridStructure | ExtendedTimeStructure;

export type CurriculumMatrix = {
  id: string;
  code: string;
  name: string;
  segment: DemoMatrixSegment;
  organization: string;
  version: string;
  versionOrder: number;
  situation: DemoMatrixSituation;
  effectiveFrom: string;
  effectiveUntil: string | null;
  normativeReference: string;
  previousVersionId?: string;
  nextVersionId?: string;
  dataOrigin: CurriculumDataOrigin;
  summary: string;
  structure: CurriculumStructure;
  updatedAt: string;
  updatedSort: number;
};

const FIVE_EXPERIENCE_FIELDS: ExperienceFieldsStructure["fields"] = [
  {
    id: "eu-outro-nos",
    label: "O eu, o outro e o nós",
    description: "Campo de experiências previsto na organização documentada da Educação Infantil.",
  },
  {
    id: "corpo-gestos",
    label: "Corpo, gestos e movimentos",
    description: "Campo de experiências previsto na organização documentada.",
  },
  {
    id: "tracos-sons",
    label: "Traços, sons, cores e formas",
    description: "Campo de experiências previsto na organização documentada.",
  },
  {
    id: "escuta-fala",
    label: "Escuta, fala, pensamento e imaginação",
    description: "Campo de experiências previsto na organização documentada.",
  },
  {
    id: "espacos-tempos",
    label: "Espaços, tempos, quantidades, relações e transformações",
    description: "Campo de experiências previsto na organização documentada.",
  },
];

const infantilStructure: ExperienceFieldsStructure = {
  kind: "experience-fields",
  organizationLabel: "Berçário, Maternal, 1º Período e 2º Período",
  groupings: [
    { id: "bercario", label: "Berçário" },
    { id: "maternal", label: "Maternal" },
    { id: "periodo-1", label: "1º Período" },
    { id: "periodo-2", label: "2º Período" },
  ],
  fields: FIVE_EXPERIENCE_FIELDS,
  journeys: [
    {
      id: "parcial",
      label: "Jornada parcial",
      weekly: "20h semanais",
      description: "Carga semanal documentada para a jornada parcial.",
    },
    {
      id: "integral",
      label: "Jornada integral",
      weekly: "35h semanais",
      description:
        "Carga semanal documentada para a jornada integral, associada a ampliação curricular — não é atributo Sim/Não.",
    },
  ],
  note: "A Educação Infantil não é representada como grade convencional de disciplinas: a leitura se organiza por campos de experiências, agrupamentos e jornadas.",
};

const infantilStructureAnterior: ExperienceFieldsStructure = {
  ...infantilStructure,
  journeys: [
    {
      id: "parcial",
      label: "Jornada parcial",
      weekly: "20h semanais",
      description: "Carga semanal registrada na versão anterior demonstrativa.",
    },
  ],
  note: "Versão anterior demonstrativa: a jornada integral ainda não constava desta versão. O registro histórico permanece consultável.",
};

const ef1Columns: MatrixTableColumn[] = [
  { id: "ano-1", label: "1º ano" },
  { id: "ano-2", label: "2º ano" },
  { id: "ano-3", label: "3º ano" },
  { id: "ano-4", label: "4º ano" },
  { id: "ano-5", label: "5º ano" },
];

const ef1Structure: MatrixGridStructure = {
  kind: "grid",
  organizationLabel: "1º ao 5º ano",
  rowsHeader: "Componentes curriculares",
  unitLabel: "horas semanais",
  columns: ef1Columns,
  groups: [
    {
      id: "componentes",
      rows: [
        { id: "lp", label: "Língua Portuguesa", values: [7, 7, 7, 7, 7] },
        { id: "mat", label: "Matemática", values: [5, 5, 5, 5, 5] },
        { id: "cie", label: "Ciências", values: [2, 2, 2, 2, 2] },
        { id: "his", label: "História", values: [1, 1, 1, 1, 1] },
        { id: "geo", label: "Geografia", values: [1, 1, 1, 1, 1] },
        { id: "art", label: "Arte", values: [1, 1, 1, 1, 1] },
        { id: "edf", label: "Educação Física", values: [2, 2, 2, 2, 2] },
        { id: "rel", label: "Ensino Religioso", values: [1, 1, 1, 1, 1] },
      ],
    },
  ],
  totals: [20, 20, 20, 20, 20],
  totalsLabel: "Total semanal",
  legend: [
    "Total semanal de 20h: carga documentada.",
    "Distribuição por componente: inventada apenas para demonstrar a leitura matricial.",
    "“—” indica valor não documentado nesta demonstração.",
  ],
};

const ef2Columns: MatrixTableColumn[] = [
  { id: "ano-6", label: "6º ano" },
  { id: "ano-7", label: "7º ano" },
  { id: "ano-8", label: "8º ano" },
  { id: "ano-9", label: "9º ano" },
];

const ef2Structure: MatrixGridStructure = {
  kind: "grid",
  organizationLabel: "6º ao 9º ano",
  rowsHeader: "Componentes curriculares",
  unitLabel: "horas semanais",
  columns: ef2Columns,
  groups: [
    {
      id: "componentes",
      rows: [
        { id: "lp", label: "Língua Portuguesa", values: [6, 6, 6, 6] },
        { id: "mat", label: "Matemática", values: [6, 6, 6, 6] },
        { id: "cie", label: "Ciências", values: [3, 3, 3, 4] },
        { id: "his", label: "História", values: [3, 3, 3, 3] },
        { id: "geo", label: "Geografia", values: [3, 3, 3, 3] },
        { id: "ing", label: "Língua Inglesa", values: [2, 2, 2, 2] },
        { id: "art", label: "Arte", values: [2, 2, 2, 2] },
        { id: "edf", label: "Educação Física", values: [2, 2, 2, 2] },
        { id: "rel", label: "Ensino Religioso", values: [1, 1, 1, 1] },
      ],
    },
  ],
  totals: [28, 28, 28, 29],
  totalsLabel: "Total semanal",
  legend: [
    "Totais semanais documentados: 28h no 6º, 7º e 8º ano e 29h no 9º ano.",
    "Distribuição por componente: inventada apenas para demonstrar a leitura matricial.",
  ],
};

const ef2StructureAnterior: MatrixGridStructure = {
  ...ef2Structure,
  groups: [
    {
      id: "componentes",
      rows: [
        { id: "lp", label: "Língua Portuguesa", values: [6, 6, 6, 6] },
        { id: "mat", label: "Matemática", values: [6, 6, 6, 6] },
        { id: "cie", label: "Ciências", values: [3, 3, 3, 3] },
        { id: "his", label: "História", values: [3, 3, 3, 3] },
        { id: "geo", label: "Geografia", values: [3, 3, 3, 3] },
        { id: "ing", label: "Língua Inglesa", values: [2, 2, 2, 2] },
        { id: "art", label: "Arte", values: [2, 2, 2, 2] },
        { id: "edf", label: "Educação Física", values: [2, 2, 2, 2] },
        { id: "rel", label: "Ensino Religioso", values: [null, null, null, null] },
      ],
    },
  ],
  totals: [27, 27, 27, 27],
  legend: [
    "Versão anterior demonstrativa, preservada para consulta histórica.",
    "Valores inventados apenas para evidenciar que uma nova versão não reescreve o passado.",
  ],
};

const ejaColumns1: MatrixTableColumn[] = [
  { id: "fase-1", label: "Fase I" },
  { id: "fase-2", label: "Fase II" },
  { id: "fase-3", label: "Fase III" },
  { id: "fase-4", label: "Fase IV" },
  { id: "fase-5", label: "Fase V" },
];

const eja1Structure: MatrixGridStructure = {
  kind: "grid",
  organizationLabel: "Fases I a V (1º segmento)",
  rowsHeader: "Componentes curriculares",
  unitLabel: "horas semanais",
  columns: ejaColumns1,
  groups: [
    {
      id: "componentes",
      rows: [
        { id: "lp", label: "Língua Portuguesa", values: [6, 6, 6, 6, 6] },
        { id: "mat", label: "Matemática", values: [5, 5, 5, 5, 5] },
        { id: "cie", label: "Ciências", values: [2, 2, 2, 2, 2] },
        { id: "est", label: "Estudos Sociais", values: [3, 3, 3, 3, 3] },
        { id: "art", label: "Arte", values: [1, 1, 1, 1, 1] },
      ],
    },
  ],
  totals: [17, 17, 17, 17, 17],
  totalsLabel: "Total semanal",
  legend: [
    "As Fases da EJA possuem organização própria e não equivalem diretamente a anos escolares.",
    "Divisão em fases: documentada. Cargas por componente: inventadas para demonstração.",
  ],
};

const ejaColumns2: MatrixTableColumn[] = [
  { id: "fase-6", label: "Fase VI" },
  { id: "fase-7", label: "Fase VII" },
  { id: "fase-8", label: "Fase VIII" },
  { id: "fase-9", label: "Fase IX" },
];

const eja2Structure: MatrixGridStructure = {
  kind: "grid",
  organizationLabel: "Fases VI a IX (2º segmento)",
  rowsHeader: "Componentes curriculares",
  unitLabel: "horas semanais",
  columns: ejaColumns2,
  groups: [
    {
      id: "componentes",
      rows: [
        { id: "lp", label: "Língua Portuguesa", values: [4, 4, 4, 4] },
        { id: "mat", label: "Matemática", values: [4, 4, 4, 4] },
        { id: "cie", label: "Ciências", values: [3, 3, 3, 3] },
        { id: "his", label: "História", values: [2, 2, 2, 2] },
        { id: "geo", label: "Geografia", values: [2, 2, 2, 2] },
        { id: "ing", label: "Língua Inglesa", values: [1, 1, 1, 1] },
        { id: "art", label: "Arte", values: [1, 1, 1, 1] },
      ],
    },
  ],
  totals: [17, 17, 17, 17],
  totalsLabel: "Total semanal",
  legend: [
    "Fases VI a IX pertencem ao 2º segmento e mantêm organização própria.",
    "Cargas por componente inventadas exclusivamente para demonstração de leitura.",
  ],
};

const integralStructure: ExtendedTimeStructure = {
  kind: "extended-time",
  organizationLabel: "Ampliação curricular em jornada estendida",
  description:
    "O tempo integral é tratado como organização de oferta e de jornada com ampliação curricular, não como atributo Sim/Não da escola. Esta versão apenas prepara a arquitetura visual.",
  axes: [
    {
      id: "jornada",
      label: "Jornada ampliada",
      description:
        "Jornada documentada de 35h semanais na Educação Infantil integral; demais organizações a especificar.",
    },
    {
      id: "ampliacao",
      label: "Elementos de ampliação curricular",
      description:
        "Espaço reservado para elementos integradores; nenhuma lista definitiva foi criada nesta etapa.",
    },
    {
      id: "articulacao",
      label: "Articulação com a matriz da etapa",
      description:
        "A ampliação se articula à matriz da etapa correspondente, sem substituí-la nem duplicá-la.",
    },
  ],
  pending: [
    "Campos integradores completos",
    "Atribuição docente",
    "Horários",
    "Frequência",
    "Matrícula em tempo integral",
    "Cálculo de jornada",
  ],
};

export const curriculumMatrices: CurriculumMatrix[] = [
  {
    id: "mc-ei-2",
    code: "MC-EI-002",
    name: "Matriz curricular da Educação Infantil",
    segment: "Educação Infantil",
    organization: "Berçário, Maternal, 1º e 2º Período",
    version: "Versão 2",
    versionOrder: 2,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Documento normativo demonstrativo nº 02/2026 (referência fictícia)",
    previousVersionId: "mc-ei-1",
    dataOrigin: "misto",
    summary:
      "Organização por campos de experiências e jornadas, com parcial de 20h e integral de 35h semanais.",
    structure: infantilStructure,
    updatedAt: "20 set 2026",
    updatedSort: 9,
  },
  {
    id: "mc-ei-1",
    code: "MC-EI-001",
    name: "Matriz curricular da Educação Infantil",
    segment: "Educação Infantil",
    organization: "Berçário, Maternal, 1º e 2º Período",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Histórica",
    effectiveFrom: "01 fev 2023",
    effectiveUntil: "31 jan 2026",
    normativeReference: "Documento normativo demonstrativo nº 01/2023 (referência fictícia)",
    nextVersionId: "mc-ei-2",
    dataOrigin: "inventado",
    summary:
      "Versão anterior demonstrativa, sem jornada integral. Permanece consultável e não é sobrescrita.",
    structure: infantilStructureAnterior,
    updatedAt: "12 jan 2026",
    updatedSort: 3,
  },
  {
    id: "mc-ef1-1",
    code: "MC-EF1-001",
    name: "Matriz curricular do Ensino Fundamental — 1º segmento",
    segment: "Ensino Fundamental — 1º segmento",
    organization: "1º ao 5º ano",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Documento normativo demonstrativo nº 03/2026 (referência fictícia)",
    dataOrigin: "misto",
    summary: "Componentes curriculares do 1º ao 5º ano com total semanal documentado de 20h.",
    structure: ef1Structure,
    updatedAt: "20 set 2026",
    updatedSort: 8,
  },
  {
    id: "mc-ef2-2",
    code: "MC-EF2-002",
    name: "Matriz curricular do Ensino Fundamental — 2º segmento",
    segment: "Ensino Fundamental — 2º segmento",
    organization: "6º ao 9º ano",
    version: "Versão 2",
    versionOrder: 2,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Documento normativo demonstrativo nº 04/2026 (referência fictícia)",
    previousVersionId: "mc-ef2-1",
    dataOrigin: "misto",
    summary: "Cargas por componente com total de 28h no 6º, 7º e 8º ano e 29h no 9º ano.",
    structure: ef2Structure,
    updatedAt: "19 set 2026",
    updatedSort: 7,
  },
  {
    id: "mc-ef2-1",
    code: "MC-EF2-001",
    name: "Matriz curricular do Ensino Fundamental — 2º segmento",
    segment: "Ensino Fundamental — 2º segmento",
    organization: "6º ao 9º ano",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Histórica",
    effectiveFrom: "01 fev 2022",
    effectiveUntil: "31 jan 2026",
    normativeReference: "Documento normativo demonstrativo nº 02/2022 (referência fictícia)",
    nextVersionId: "mc-ef2-2",
    dataOrigin: "inventado",
    summary:
      "Versão anterior aplicada a períodos encerrados. Continua consultável exatamente como foi aplicada.",
    structure: ef2StructureAnterior,
    updatedAt: "10 jan 2026",
    updatedSort: 2,
  },
  {
    id: "mc-eja1-1",
    code: "MC-EJA1-001",
    name: "Matriz curricular da EJA — 1º segmento",
    segment: "EJA — 1º segmento",
    organization: "Fases I a V",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Documento normativo demonstrativo nº 05/2026 (referência fictícia)",
    dataOrigin: "misto",
    summary:
      "Organização em Fases I a V, com estrutura própria e não equivalente a anos escolares.",
    structure: eja1Structure,
    updatedAt: "18 set 2026",
    updatedSort: 6,
  },
  {
    id: "mc-eja2-1",
    code: "MC-EJA2-001",
    name: "Matriz curricular da EJA — 2º segmento",
    segment: "EJA — 2º segmento",
    organization: "Fases VI a IX",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Documento normativo demonstrativo nº 06/2026 (referência fictícia)",
    dataOrigin: "misto",
    summary: "Organização em Fases VI a IX, preservando a divisão em segmentos.",
    structure: eja2Structure,
    updatedAt: "16 set 2026",
    updatedSort: 5,
  },
  {
    id: "mc-int-1",
    code: "MC-INT-001",
    name: "Ampliação curricular em tempo integral",
    segment: "Ampliação curricular (tempo integral)",
    organization: "Jornada ampliada articulada à matriz da etapa",
    version: "Versão 1",
    versionOrder: 1,
    situation: "Vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    normativeReference: "Referência normativa a definir",
    dataOrigin: "inventado",
    summary:
      "Estrutura preparada visualmente; o tempo integral é organização de oferta e jornada, não um Sim/Não.",
    structure: integralStructure,
    updatedAt: "14 set 2026",
    updatedSort: 4,
  },
];

export function getCurriculumMatrix(id: string) {
  return curriculumMatrices.find((matrix) => matrix.id === id);
}

export function matrixSituationTone(situation: DemoMatrixSituation) {
  return situation === "Vigente" ? ("success" as const) : ("neutral" as const);
}

/**
 * OFERTA EDUCACIONAL — conceito relacionado à unidade, distinto dela.
 * Uma oferta possui organização acadêmica própria e pode ser regida por uma
 * matriz curricular versionada em determinada vigência. Registros inventados.
 */
export type EducationalOffer = {
  id: string;
  unitId: string;
  stage: string;
  organization: string;
  journey: string;
  journeyNote: string;
  situation: "Oferta vigente" | "Oferta encerrada";
  effectiveFrom: string;
  effectiveUntil: string | null;
  matrixId: string;
  matrixLabel: string;
  previousMatrix?: { matrixId: string; label: string; period: string };
  note: string;
};

export const demonstrationOffers: EducationalOffer[] = [
  {
    id: "of-001",
    unitId: "demo-001",
    stage: "Educação Infantil",
    organization: "Berçário, Maternal, 1º e 2º Período",
    journey: "Jornada integral — 35h semanais",
    journeyNote:
      "Jornada com ampliação curricular; não é representada como atributo Sim/Não da unidade.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-ei-2",
    matrixLabel: "MC-EI-002 · Versão 2",
    previousMatrix: {
      matrixId: "mc-ei-1",
      label: "MC-EI-001 · Versão 1",
      period: "01 fev 2023 a 31 jan 2026",
    },
    note: "Registro fictício: a oferta pertence à unidade, mas não se confunde com sua identidade.",
  },
  {
    id: "of-002",
    unitId: "demo-001",
    stage: "Ensino Fundamental — 1º segmento",
    organization: "1º ao 5º ano",
    journey: "Jornada parcial — 20h semanais",
    journeyNote: "Carga semanal documentada para a organização do 1º segmento.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-ef1-1",
    matrixLabel: "MC-EF1-001 · Versão 1",
    note: "Registro fictício de oferta vigente regida pela matriz do 1º segmento.",
  },
  {
    id: "of-003",
    unitId: "demo-001",
    stage: "Ensino Fundamental — 2º segmento",
    organization: "6º ao 9º ano",
    journey: "Jornada parcial — 28h a 29h semanais",
    journeyNote: "Cargas totais documentadas por ano do 2º segmento.",
    situation: "Oferta encerrada",
    effectiveFrom: "01 fev 2022",
    effectiveUntil: "31 dez 2025",
    matrixId: "mc-ef2-1",
    matrixLabel: "MC-EF2-001 · Versão 1",
    note: "Oferta histórica fictícia: permanece consultável e não é sobrescrita pela oferta atual.",
  },
  {
    id: "of-004",
    unitId: "demo-003",
    stage: "Ensino Fundamental — 1º segmento",
    organization: "1º ao 5º ano",
    journey: "Jornada parcial — 20h semanais",
    journeyNote: "Carga semanal documentada.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-ef1-1",
    matrixLabel: "MC-EF1-001 · Versão 1",
    note: "Registro fictício de oferta vigente.",
  },
  {
    id: "of-005",
    unitId: "demo-003",
    stage: "EJA — 1º segmento",
    organization: "Fases I a V",
    journey: "Jornada noturna demonstrativa",
    journeyNote: "As Fases da EJA têm organização própria e não equivalem a anos escolares.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-eja1-1",
    matrixLabel: "MC-EJA1-001 · Versão 1",
    note: "Registro fictício de oferta de EJA em fases.",
  },
  {
    id: "of-006",
    unitId: "demo-005",
    stage: "EJA — 2º segmento",
    organization: "Fases VI a IX",
    journey: "Jornada noturna demonstrativa",
    journeyNote: "Segmento distinto, com fases próprias.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-eja2-1",
    matrixLabel: "MC-EJA2-001 · Versão 1",
    note: "Registro fictício de oferta de EJA no 2º segmento.",
  },
  {
    id: "of-008",
    unitId: "demo-005",
    stage: "Ensino Fundamental — 2º segmento",
    organization: "6º ao 9º ano",
    journey: "Jornada parcial — 28h a 29h semanais",
    journeyNote: "Cargas totais documentadas por ano do 2º segmento.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-ef2-2",
    matrixLabel: "MC-EF2-002 · Versão 2",
    previousMatrix: {
      matrixId: "mc-ef2-1",
      label: "MC-EF2-001 · Versão 1",
      period: "01 fev 2022 a 31 jan 2026",
    },
    note: "Registro fictício: a nova versão passa a reger a oferta sem alterar o período anterior.",
  },
  {
    id: "of-007",
    unitId: "demo-007",
    stage: "Educação Infantil",
    organization: "1º e 2º Período",
    journey: "Jornada parcial — 20h semanais",
    journeyNote: "Jornada parcial documentada.",
    situation: "Oferta vigente",
    effectiveFrom: "01 fev 2026",
    effectiveUntil: null,
    matrixId: "mc-ei-2",
    matrixLabel: "MC-EI-002 · Versão 2",
    note: "Registro fictício de oferta parcial.",
  },
];

export function getUnitOffers(unitId: string) {
  return demonstrationOffers.filter((offer) => offer.unitId === unitId);
}

export function offerSituationTone(situation: EducationalOffer["situation"]) {
  return situation === "Oferta vigente" ? ("success" as const) : ("neutral" as const);
}

/** Aplicação demonstrativa da matriz em ofertas; nenhuma regra automática existe. */
export function getMatrixApplications(matrixId: string) {
  return demonstrationOffers.filter(
    (offer) => offer.matrixId === matrixId || offer.previousMatrix?.matrixId === matrixId,
  );
}
