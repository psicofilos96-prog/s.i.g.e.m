/**
 * FIXTURES DEMONSTRATIVOS — NÃO SÃO CONTRATO DE DOMÍNIO.
 *
 * Nada neste arquivo representa taxonomia, situação, categoria ou cadastro
 * oficial da rede municipal. Os valores foram deliberadamente mantidos
 * NEUTROS ("Marcador A", "Grupo 1", "Contexto 1") para não sugerir regras de
 * domínio que ainda não foram definidas. A modelagem real (nomes de estados,
 * categorias, etapas, modalidades, relações) será fornecida posteriormente e
 * substituirá integralmente este conjunto.
 *
 * Nenhuma enumeração criada aqui deve ser reutilizada como enum de domínio.
 */

/** Marcadores neutros usados apenas para demonstrar variações visuais de estado. */
export const DEMO_MARKERS = ["Marcador A", "Marcador B", "Marcador C"] as const;
export type DemoMarker = (typeof DEMO_MARKERS)[number];

/** Grupos neutros usados apenas para demonstrar uma coluna classificatória. */
export const DEMO_GROUPS = ["Grupo 1", "Grupo 2", "Grupo 3"] as const;
export type DemoGroup = (typeof DEMO_GROUPS)[number];

/** Contextos neutros usados apenas para demonstrar um filtro de recorte. */
export const DEMO_CONTEXTS = ["Contexto 1", "Contexto 2"] as const;
export type DemoContext = (typeof DEMO_CONTEXTS)[number];

export type DemonstrationUnit = {
  id: string;
  name: string;
  identifier: string;
  /** Classificação NEUTRA e provisória. Não é categoria institucional. */
  group: DemoGroup;
  /** Recorte NEUTRO e provisório. Não é zoneamento oficial. */
  context: DemoContext;
  /** Marcador NEUTRO e provisório. Não é situação oficial de uma unidade. */
  marker: DemoMarker;
  updatedAt: string;
  updatedSort: number;
  address: string;
  contact: string;
  note: string;
};

export const demonstrationUnits: DemonstrationUnit[] = [
  {
    id: "demo-001",
    name: "Unidade Demonstrativa Horizonte",
    identifier: "DEM-001",
    group: "Grupo 1",
    context: "Contexto 1",
    marker: "Marcador A",
    updatedAt: "22 set 2026",
    updatedSort: 8,
    address: "Endereço demonstrativo, 100 · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Informações fictícias usadas somente para validar a experiência de consulta.",
  },
  {
    id: "demo-002",
    name: "Unidade Demonstrativa Caminhos",
    identifier: "DEM-002",
    group: "Grupo 1",
    context: "Contexto 2",
    marker: "Marcador B",
    updatedAt: "21 set 2026",
    updatedSort: 7,
    address: "Localidade demonstrativa · Itaperuna/RJ",
    contact: "Não informado",
    note: "Registro ilustrativo criado para demonstrar variações de estado da interface.",
  },
  {
    id: "demo-003",
    name: "Unidade Demonstrativa Águas",
    identifier: "DEM-003",
    group: "Grupo 2",
    context: "Contexto 1",
    marker: "Marcador A",
    updatedAt: "18 set 2026",
    updatedSort: 6,
    address: "Avenida demonstrativa, 240 · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Registro fictício sem correspondência com uma instituição real.",
  },
  {
    id: "demo-004",
    name: "Unidade Demonstrativa Ipê",
    identifier: "DEM-004",
    group: "Grupo 3",
    context: "Contexto 2",
    marker: "Marcador C",
    updatedAt: "15 set 2026",
    updatedSort: 5,
    address: "Informação pendente",
    contact: "Não informado",
    note: "Exemplo criado para validar a apresentação de informações pendentes.",
  },
  {
    id: "demo-005",
    name: "Unidade Demonstrativa Ponte",
    identifier: "DEM-005",
    group: "Grupo 1",
    context: "Contexto 1",
    marker: "Marcador A",
    updatedAt: "12 set 2026",
    updatedSort: 4,
    address: "Rua demonstrativa, 45 · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Registro de apoio para avaliação da densidade da listagem.",
  },
  {
    id: "demo-006",
    name: "Unidade Demonstrativa Vale",
    identifier: "DEM-006",
    group: "Grupo 2",
    context: "Contexto 1",
    marker: "Marcador B",
    updatedAt: "10 set 2026",
    updatedSort: 3,
    address: "Praça demonstrativa, 8 · Itaperuna/RJ",
    contact: "Não informado",
    note: "Registro fictício para composição do protótipo operacional.",
  },
  {
    id: "demo-007",
    name: "Unidade Demonstrativa Serra",
    identifier: "DEM-007",
    group: "Grupo 1",
    context: "Contexto 2",
    marker: "Marcador A",
    updatedAt: "08 set 2026",
    updatedSort: 2,
    address: "Estrada demonstrativa · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Conteúdo demonstrativo, sem valor cadastral ou administrativo.",
  },
  {
    id: "demo-008",
    name: "Unidade Demonstrativa Estação",
    identifier: "DEM-008",
    group: "Grupo 3",
    context: "Contexto 1",
    marker: "Marcador C",
    updatedAt: "02 set 2026",
    updatedSort: 1,
    address: "Informação pendente",
    contact: "Não informado",
    note: "Exemplo criado exclusivamente para validar estados visuais.",
  },
];

export function getDemonstrationUnit(id: string) {
  return demonstrationUnits.find((unit) => unit.id === id);
}

/** Tom visual dos marcadores. Mapeamento apenas visual, sem semântica de domínio. */
export function markerTone(marker: DemoMarker) {
  if (marker === "Marcador A") return "success" as const;
  if (marker === "Marcador B") return "warning" as const;
  return "neutral" as const;
}

/**
 * Áreas internas da unidade: HIPÓTESES DE UX, não arquitetura de domínio.
 * A composição definitiva das abas será fornecida posteriormente. Mantemos
 * apenas o mínimo necessário para demonstrar o padrão de navegação interna.
 */
export const unitDetailAreas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "placeholder-a", label: "Área a definir", available: false },
  { id: "placeholder-b", label: "Área a definir", available: false },
] as const;
