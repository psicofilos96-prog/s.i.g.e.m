export type UnitStatus = "Em atividade" | "Em revisão" | "Cadastro incompleto";

export type DemonstrationUnit = {
  id: string;
  name: string;
  identifier: string;
  category: string;
  location: string;
  context: string;
  status: UnitStatus;
  updatedAt: string;
  updatedSort: number;
  address: string;
  contact: string;
  note: string;
};

// Fixture exclusivamente visual. Não representa cadastro, taxonomia ou situação oficial.
export const demonstrationUnits: DemonstrationUnit[] = [
  {
    id: "demo-001",
    name: "Unidade Demonstrativa Horizonte",
    identifier: "DEM-001",
    category: "Unidade escolar",
    location: "Contexto urbano",
    context: "Rede municipal · Exemplo de interface",
    status: "Em atividade",
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
    category: "Unidade escolar",
    location: "Contexto rural",
    context: "Rede municipal · Exemplo de interface",
    status: "Em revisão",
    updatedAt: "21 set 2026",
    updatedSort: 7,
    address: "Localidade demonstrativa · Itaperuna/RJ",
    contact: "Não informado",
    note: "Cadastro ilustrativo em revisão para demonstrar estados da interface.",
  },
  {
    id: "demo-003",
    name: "Centro Demonstrativo das Águas",
    identifier: "DEM-003",
    category: "Centro educacional",
    location: "Contexto urbano",
    context: "Rede municipal · Exemplo de interface",
    status: "Em atividade",
    updatedAt: "18 set 2026",
    updatedSort: 6,
    address: "Avenida demonstrativa, 240 · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Registro fictício sem correspondência com uma instituição real.",
  },
  {
    id: "demo-004",
    name: "Núcleo Demonstrativo Ipê",
    identifier: "DEM-004",
    category: "Núcleo educacional",
    location: "Contexto rural",
    context: "Rede municipal · Exemplo de interface",
    status: "Cadastro incompleto",
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
    category: "Unidade escolar",
    location: "Contexto urbano",
    context: "Rede municipal · Exemplo de interface",
    status: "Em atividade",
    updatedAt: "12 set 2026",
    updatedSort: 4,
    address: "Rua demonstrativa, 45 · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Registro de apoio para avaliação da densidade da listagem.",
  },
  {
    id: "demo-006",
    name: "Centro Demonstrativo Vale",
    identifier: "DEM-006",
    category: "Centro educacional",
    location: "Contexto urbano",
    context: "Rede municipal · Exemplo de interface",
    status: "Em revisão",
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
    category: "Unidade escolar",
    location: "Contexto rural",
    context: "Rede municipal · Exemplo de interface",
    status: "Em atividade",
    updatedAt: "08 set 2026",
    updatedSort: 2,
    address: "Estrada demonstrativa · Itaperuna/RJ",
    contact: "(00) 0000-0000",
    note: "Conteúdo demonstrativo, sem valor cadastral ou administrativo.",
  },
  {
    id: "demo-008",
    name: "Núcleo Demonstrativo Estação",
    identifier: "DEM-008",
    category: "Núcleo educacional",
    location: "Contexto urbano",
    context: "Rede municipal · Exemplo de interface",
    status: "Cadastro incompleto",
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