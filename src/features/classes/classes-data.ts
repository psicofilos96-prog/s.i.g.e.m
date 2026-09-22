/**
 * TURMAS — dados fictícios isolados da interface.
 *
 * Nada aqui é cadastro oficial da Prefeitura Municipal de Itaperuna nem
 * enumeração definitiva de domínio. A estrutura existe para demonstrar a
 * experiência de consulta e leitura de turmas.
 *
 * Princípios representados pelos fixtures:
 * - uma turma existe dentro de um contexto institucional e temporal;
 * - turma NÃO é sinônimo de série: não há campo `serie`;
 * - uma turma pode atender mais de um agrupamento (multisseriada/multietapa);
 * - a EJA permanece organizada por fases próprias;
 * - jornada e turno são conceitos distintos;
 * - a matriz aplicada é contextual e histórica, registrada no período;
 * - período letivo não é ano civil nem período avaliativo.
 */
import { demonstrationUnits } from "@/features/units/units-data";
import { demonstrationOffers } from "@/features/curriculum/curriculum-data";

export type ClassDataOrigin = "documentado" | "inventado" | "misto";

/** Valores demonstrativos para filtros. Não são enums definitivos. */
export const DEMO_CLASS_SITUATIONS = ["Em atividade", "Em formação", "Encerrada"] as const;
export type DemoClassSituation = (typeof DEMO_CLASS_SITUATIONS)[number];

export const DEMO_CLASS_SHIFTS = ["Manhã", "Tarde", "Noite", "Manhã e tarde"] as const;
export type DemoClassShift = (typeof DEMO_CLASS_SHIFTS)[number];

/**
 * Agrupamento atendido pela turma. Pode ser um ano, uma fase da EJA ou um
 * agrupamento da Educação Infantil — por isso o `kind` é descritivo, não um enum
 * estrutural, e nunca se reduz a "série".
 */
export type ClassGrouping = {
  id: string;
  label: string;
  kind: "Ano" | "Fase" | "Agrupamento";
  note: string;
};

/** Período letivo: organização temporal própria, não necessariamente o ano civil. */
export type AcademicPeriod = {
  label: string;
  note: string;
  /** Apenas para ordenação demonstrativa na consulta. */
  order: number;
};

export type ClassHistoryEntry = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
};

export type DemonstrationClass = {
  id: string;
  code: string;
  name: string;
  unitId: string;
  academicPeriod: AcademicPeriod;
  offerId: string;
  /** Organização acadêmica da oferta que contextualiza a turma. */
  academicOrganization: string;
  groupings: ClassGrouping[];
  /** Turno — recorte de horário de funcionamento. */
  shift: DemoClassShift;
  /** Jornada — organização do tempo escolar; nunca um Sim/Não de integral. */
  journey: string;
  journeyNote: string;
  /** Matriz referenciada no contexto da oferta e do período letivo. */
  matrixId: string;
  matrixContextLabel: string;
  matrixContextPeriod: string;
  situation: DemoClassSituation;
  situationNote: string;
  /** Síntese demonstrativa, sem lista de estudantes e sem cálculo oficial. */
  demonstrativeHeadcount: number;
  demonstrativeCapacityNote: string;
  professionalsNote: string;
  contextNote: string;
  dataOrigin: ClassDataOrigin;
  history: ClassHistoryEntry[];
  updatedAt: string;
};

export const demonstrationClasses: DemonstrationClass[] = [
  {
    id: "tur-001",
    code: "TUR-2026-001",
    name: "Turma demonstrativa 3º ano A",
    unitId: "demo-001",
    academicPeriod: {
      label: "Período letivo 2026",
      note: "Rótulo demonstrativo. O período letivo é uma organização temporal própria e não pressupõe coincidir com o ano civil.",
      order: 2026,
    },
    offerId: "of-002",
    academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    groupings: [
      {
        id: "tur-001-g1",
        label: "3º ano",
        kind: "Ano",
        note: "Organização simples: a turma atende um único agrupamento.",
      },
    ],
    shift: "Manhã",
    journey: "Jornada parcial — 20h semanais",
    journeyNote:
      "Jornada e turno são informações distintas: o turno indica o horário, a jornada indica a organização do tempo escolar.",
    matrixId: "mc-ef1-1",
    matrixContextLabel: "MC-EF1-001 · Versão 1",
    matrixContextPeriod: "Registrada como aplicável no período letivo 2026",
    situation: "Em atividade",
    situationNote: "Situação contextual demonstrativa, sem relação com registros censitários.",
    demonstrativeHeadcount: 24,
    demonstrativeCapacityNote:
      "Número fictício apenas para demonstrar a leitura; não há cálculo oficial de capacidade.",
    professionalsNote: "Vínculos de profissionais serão modelados em etapa futura.",
    contextNote:
      "Exemplo de turma regular de organização simples: fácil de compreender, sem campo estrutural de série.",
    dataOrigin: "inventado",
    history: [
      {
        id: "tur-001-h1",
        title: "Turma registrada no período letivo 2026",
        description: "Evento fictício de abertura da turma no contexto da oferta do 1º segmento.",
        timestamp: "05 fev 2026",
      },
    ],
    updatedAt: "20 set 2026",
  },
  {
    id: "tur-002",
    code: "TUR-2026-002",
    name: "Turma demonstrativa Maternal II",
    unitId: "demo-001",
    academicPeriod: {
      label: "Período letivo 2026",
      note: "A Educação Infantil também organiza seu tempo em período letivo, não em período avaliativo.",
      order: 2026,
    },
    offerId: "of-001",
    academicOrganization: "Educação Infantil · Berçário, Maternal, 1º e 2º Período",
    groupings: [
      {
        id: "tur-002-g1",
        label: "Maternal II",
        kind: "Agrupamento",
        note: "Agrupamento da Educação Infantil; não corresponde a ano escolar.",
      },
    ],
    shift: "Manhã e tarde",
    journey: "Jornada integral — 35h semanais com ampliação curricular",
    journeyNote:
      "Jornada integral é organização de tempo e ampliação curricular, nunca um atributo Sim/Não da turma.",
    matrixId: "mc-ei-2",
    matrixContextLabel: "MC-EI-002 · Versão 2",
    matrixContextPeriod: "Registrada como aplicável desde 01 fev 2026",
    situation: "Em atividade",
    situationNote: "Turma fictícia de jornada integral, para validar a leitura de tempo ampliado.",
    demonstrativeHeadcount: 18,
    demonstrativeCapacityNote: "Valor fictício; não representa lotação autorizada.",
    professionalsNote: "Indicação de vínculos futuros; sem atribuição docente nesta etapa.",
    contextNote:
      "Exemplo de contexto de jornada integral, com turno abrangendo manhã e tarde e ampliação curricular.",
    dataOrigin: "misto",
    history: [
      {
        id: "tur-002-h1",
        title: "Turma registrada com jornada integral",
        description:
          "Evento fictício: a jornada é registrada como organização do tempo, com ampliação curricular associada.",
        timestamp: "05 fev 2026",
      },
    ],
    updatedAt: "20 set 2026",
  },
  {
    id: "tur-003",
    code: "TUR-2026-003",
    name: "Turma demonstrativa multietapa do campo",
    unitId: "demo-003",
    academicPeriod: {
      label: "Período letivo 2026",
      note: "Período letivo demonstrativo; a organização temporal pode variar conforme a oferta.",
      order: 2026,
    },
    offerId: "of-004",
    academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    groupings: [
      {
        id: "tur-003-g1",
        label: "1º ano",
        kind: "Ano",
        note: "Agrupamento atendido na mesma turma.",
      },
      {
        id: "tur-003-g2",
        label: "2º ano",
        kind: "Ano",
        note: "Agrupamento atendido na mesma turma.",
      },
      {
        id: "tur-003-g3",
        label: "3º ano",
        kind: "Ano",
        note: "Agrupamento atendido na mesma turma.",
      },
    ],
    shift: "Manhã",
    journey: "Jornada parcial — 20h semanais",
    journeyNote: "Turno único, com agrupamentos distintos atendidos na mesma turma.",
    matrixId: "mc-ef1-1",
    matrixContextLabel: "MC-EF1-001 · Versão 1",
    matrixContextPeriod: "Registrada como aplicável no período letivo 2026",
    situation: "Em atividade",
    situationNote:
      "Exemplo multisseriado/multietapa: a turma atende três agrupamentos, cada um identificado separadamente.",
    demonstrativeHeadcount: 15,
    demonstrativeCapacityNote: "Valor fictício de síntese, sem regra de composição.",
    professionalsNote:
      "Vínculos e regras de compatibilidade entre agrupamentos ainda não modelados.",
    contextNote:
      "Uma turma não equivale a uma série: aqui há mais de um agrupamento, sem concatenar rótulos em campo opaco.",
    dataOrigin: "inventado",
    history: [
      {
        id: "tur-003-h1",
        title: "Turma registrada com três agrupamentos",
        description:
          "Evento fictício demonstrando que o registro preserva cada agrupamento de forma distinguível.",
        timestamp: "05 fev 2026",
      },
    ],
    updatedAt: "19 set 2026",
  },
  {
    id: "tur-004",
    code: "TUR-2026-004",
    name: "Turma demonstrativa EJA Fases II e III",
    unitId: "demo-003",
    academicPeriod: {
      label: "Período letivo 2026 · organização própria da EJA",
      note: "A EJA pode ter organização temporal própria; o rótulo não implica correspondência com ano civil.",
      order: 2026,
    },
    offerId: "of-005",
    academicOrganization: "EJA — 1º segmento · Fases I a V",
    groupings: [
      {
        id: "tur-004-g1",
        label: "Fase II",
        kind: "Fase",
        note: "Fase da EJA; não equivale a ano escolar.",
      },
      {
        id: "tur-004-g2",
        label: "Fase III",
        kind: "Fase",
        note: "Fase da EJA atendida na mesma turma.",
      },
    ],
    shift: "Noite",
    journey: "Jornada noturna demonstrativa",
    journeyNote: "Organização de tempo própria da modalidade, distinta do turno em si.",
    matrixId: "mc-eja1-1",
    matrixContextLabel: "MC-EJA1-001 · Versão 1",
    matrixContextPeriod: "Registrada como aplicável no período letivo 2026",
    situation: "Em atividade",
    situationNote: "Fases da EJA preservadas como organização própria.",
    demonstrativeHeadcount: 21,
    demonstrativeCapacityNote: "Síntese fictícia, sem regra oficial.",
    professionalsNote: "Sem atribuição docente nesta etapa.",
    contextNote:
      "A EJA aparece por fases, com agrupamentos distinguíveis, e não por anos escolares.",
    dataOrigin: "misto",
    history: [
      {
        id: "tur-004-h1",
        title: "Turma registrada com fases próprias",
        description: "Evento fictício de abertura no contexto da oferta de EJA — 1º segmento.",
        timestamp: "12 fev 2026",
      },
    ],
    updatedAt: "18 set 2026",
  },
  {
    id: "tur-005",
    code: "TUR-2026-005",
    name: "Turma demonstrativa 7º ano B",
    unitId: "demo-005",
    academicPeriod: {
      label: "Período letivo 2026",
      note: "Rótulo demonstrativo do período letivo; períodos avaliativos internos não são modelados aqui.",
      order: 2026,
    },
    offerId: "of-008",
    academicOrganization: "Ensino Fundamental — 2º segmento · 6º ao 9º ano",
    groupings: [
      {
        id: "tur-005-g1",
        label: "7º ano",
        kind: "Ano",
        note: "Agrupamento único atendido pela turma.",
      },
    ],
    shift: "Tarde",
    journey: "Jornada parcial — 28h semanais",
    journeyNote: "Carga semanal documentada para o agrupamento; o turno é informação separada.",
    matrixId: "mc-ef2-2",
    matrixContextLabel: "MC-EF2-002 · Versão 2",
    matrixContextPeriod: "Registrada como aplicável desde 01 fev 2026",
    situation: "Em formação",
    situationNote:
      "Situação contextual fictícia: a turma está em composição e ainda não foi registrada em atividade.",
    demonstrativeHeadcount: 9,
    demonstrativeCapacityNote: "Síntese fictícia de acompanhamento, sem cálculo oficial.",
    professionalsNote: "Vínculos futuros.",
    contextNote: "Turma em formação, demonstrando situação contextual distinta de encerramento.",
    dataOrigin: "inventado",
    history: [
      {
        id: "tur-005-h1",
        title: "Turma criada em composição",
        description: "Evento fictício de abertura da turma antes do início das atividades.",
        timestamp: "27 jan 2026",
      },
    ],
    updatedAt: "21 set 2026",
  },
  {
    id: "tur-006",
    code: "TUR-2025-006",
    name: "Turma demonstrativa 6º ano A (encerrada)",
    unitId: "demo-005",
    academicPeriod: {
      label: "Período letivo 2025",
      note: "Período letivo anterior, preservado como contexto registrado na época.",
      order: 2025,
    },
    offerId: "of-008",
    academicOrganization: "Ensino Fundamental — 2º segmento · 6º ao 9º ano",
    groupings: [
      {
        id: "tur-006-g1",
        label: "6º ano",
        kind: "Ano",
        note: "Agrupamento registrado no período letivo de 2025.",
      },
    ],
    shift: "Manhã",
    journey: "Jornada parcial — 28h semanais",
    journeyNote: "Jornada registrada no contexto do período letivo encerrado.",
    matrixId: "mc-ef2-1",
    matrixContextLabel: "MC-EF2-001 · Versão 1",
    matrixContextPeriod:
      "Matriz aplicada no período letivo 2025; versões posteriores não alteram este registro",
    situation: "Encerrada",
    situationNote:
      "Turma histórica: permanece consultável com o contexto registrado naquele momento, sem reinterpretação pelos cadastros atuais.",
    demonstrativeHeadcount: 26,
    demonstrativeCapacityNote: "Síntese fictícia preservada do período encerrado.",
    professionalsNote: "Vínculos da época não são modelados nesta etapa.",
    contextNote:
      "Turma encerrada, demonstrando preservação histórica de período, organização e matriz aplicada.",
    dataOrigin: "inventado",
    history: [
      {
        id: "tur-006-h1",
        title: "Turma registrada no período letivo 2025",
        description: "Evento fictício de abertura no período anterior.",
        timestamp: "05 fev 2025",
      },
      {
        id: "tur-006-h2",
        title: "Período letivo encerrado",
        description:
          "Evento fictício de encerramento: o contexto registrado permanece consultável sem depender do cadastro atual.",
        timestamp: "19 dez 2025",
      },
    ],
    updatedAt: "15 set 2026",
  },
  {
    id: "tur-007",
    code: "TUR-2026-007",
    name: "Turma demonstrativa EJA Fases VII e VIII",
    unitId: "demo-005",
    academicPeriod: {
      label: "Período letivo 2026 · organização própria da EJA",
      note: "Organização temporal própria da modalidade.",
      order: 2026,
    },
    offerId: "of-006",
    academicOrganization: "EJA — 2º segmento · Fases VI a IX",
    groupings: [
      {
        id: "tur-007-g1",
        label: "Fase VII",
        kind: "Fase",
        note: "Fase do 2º segmento da EJA.",
      },
      {
        id: "tur-007-g2",
        label: "Fase VIII",
        kind: "Fase",
        note: "Fase atendida na mesma turma.",
      },
    ],
    shift: "Noite",
    journey: "Jornada noturna demonstrativa",
    journeyNote: "Turno noturno e jornada da modalidade são registrados separadamente.",
    matrixId: "mc-eja2-1",
    matrixContextLabel: "MC-EJA2-001 · Versão 1",
    matrixContextPeriod: "Registrada como aplicável no período letivo 2026",
    situation: "Em atividade",
    situationNote: "Segmento distinto, com fases próprias.",
    demonstrativeHeadcount: 19,
    demonstrativeCapacityNote: "Síntese fictícia.",
    professionalsNote: "Vínculos futuros.",
    contextNote: "Segundo exemplo de EJA, em outro segmento e outra unidade fictícia.",
    dataOrigin: "misto",
    history: [
      {
        id: "tur-007-h1",
        title: "Turma registrada no 2º segmento da EJA",
        description: "Evento fictício de abertura.",
        timestamp: "12 fev 2026",
      },
    ],
    updatedAt: "17 set 2026",
  },
  {
    id: "tur-008",
    code: "TUR-2026-008",
    name: "Turma demonstrativa 1º Período",
    unitId: "demo-007",
    academicPeriod: {
      label: "Período letivo 2026",
      note: "Rótulo demonstrativo do período letivo.",
      order: 2026,
    },
    offerId: "of-007",
    academicOrganization: "Educação Infantil · Berçário, Maternal, 1º e 2º Período",
    groupings: [
      {
        id: "tur-008-g1",
        label: "1º Período",
        kind: "Agrupamento",
        note: "Agrupamento da Educação Infantil.",
      },
    ],
    shift: "Tarde",
    journey: "Jornada parcial — 20h semanais",
    journeyNote: "Jornada parcial registrada para o agrupamento.",
    matrixId: "mc-ei-2",
    matrixContextLabel: "MC-EI-002 · Versão 2",
    matrixContextPeriod: "Registrada como aplicável desde 01 fev 2026",
    situation: "Em atividade",
    situationNote: "Turma fictícia de organização simples na Educação Infantil.",
    demonstrativeHeadcount: 20,
    demonstrativeCapacityNote: "Síntese fictícia.",
    professionalsNote: "Vínculos futuros.",
    contextNote: "Educação Infantil de jornada parcial, sem grade de disciplinas.",
    dataOrigin: "inventado",
    history: [
      {
        id: "tur-008-h1",
        title: "Turma registrada no período letivo 2026",
        description: "Evento fictício de abertura.",
        timestamp: "05 fev 2026",
      },
    ],
    updatedAt: "16 set 2026",
  },
];

export function getDemonstrationClass(id: string) {
  return demonstrationClasses.find((item) => item.id === id);
}

export function getClassUnitName(unitId: string) {
  return demonstrationUnits.find((unit) => unit.id === unitId)?.currentName ?? "Unidade fictícia";
}

export function getClassOffer(offerId: string) {
  return demonstrationOffers.find((offer) => offer.id === offerId);
}

export function classSituationTone(situation: DemoClassSituation) {
  switch (situation) {
    case "Em atividade":
      return "success" as const;
    case "Em formação":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

/** Períodos letivos presentes nos fixtures, para filtro demonstrativo. */
export const DEMO_ACADEMIC_PERIODS = Array.from(
  new Set(demonstrationClasses.map((item) => item.academicPeriod.label)),
);

/** Agrupamentos presentes nos fixtures, para filtro demonstrativo. */
export const DEMO_CLASS_GROUPINGS = Array.from(
  new Set(demonstrationClasses.flatMap((item) => item.groupings.map((group) => group.label))),
).sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Organizações acadêmicas presentes nos fixtures. */
export const DEMO_CLASS_ORGANIZATIONS = Array.from(
  new Set(demonstrationClasses.map((item) => item.academicOrganization)),
);

/** Unidades com turmas fictícias. */
export const DEMO_CLASS_UNITS = Array.from(
  new Set(demonstrationClasses.map((item) => item.unitId)),
).map((unitId) => ({ value: unitId, label: getClassUnitName(unitId) }));

/**
 * Áreas da turma — hipóteses de UX, não contratos definitivos.
 * Somente a visão geral é funcional nesta etapa.
 */
export const classDetailAreas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "students", label: "Estudantes", available: false },
  { id: "components", label: "Componentes", available: false },
  { id: "professionals", label: "Profissionais", available: false },
  { id: "schedules", label: "Horários", available: false },
  { id: "history", label: "Histórico", available: false },
] as const;
