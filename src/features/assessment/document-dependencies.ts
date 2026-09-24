/**
 * Mapa de dependências dos documentos listados em /diario/documentos,
 * derivado da arquitetura real. "existe" = já há fonte no SIGEM (demonstrativa).
 */
export type DependencyState =
  "existe-demonstrativo" | "preparado-12a" | "depende-homologacao" | "inexistente";

export type DocumentDependency = {
  document: string;
  requires: Array<{ data: string; state: DependencyState }>;
};

export const documentDependencies: DocumentDependency[] = [
  {
    document: "Diário de Classe",
    requires: [
      { data: "Atuação pedagógica (pedagogical-data)", state: "existe-demonstrativo" },
      { data: "Aulas previstas (horários 10A–10D)", state: "existe-demonstrativo" },
      { data: "Aulas ministradas e conteúdos (11B)", state: "existe-demonstrativo" },
      { data: "Chamadas (11C)", state: "existe-demonstrativo" },
      { data: "Instrumentos e lançamentos", state: "preparado-12a" },
      { data: "Persistência e assinatura", state: "inexistente" },
    ],
  },
  {
    document: "Registros de Frequência",
    requires: [
      { data: "Chamadas concluídas (11C)", state: "existe-demonstrativo" },
      { data: "Regras de frequência, abonos e justificativas", state: "depende-homologacao" },
      { data: "Frequência homologada", state: "inexistente" },
    ],
  },
  {
    document: "Planilha de Acompanhamento Pedagógico",
    requires: [
      { data: "Alunos por alocação temporal", state: "existe-demonstrativo" },
      { data: "Lançamentos por período", state: "preparado-12a" },
      { data: "Resultados por período (regra de consolidação)", state: "inexistente" },
    ],
  },
  {
    document: "Boletim",
    requires: [
      { data: "Períodos avaliativos homologados", state: "depende-homologacao" },
      { data: "Resultados por período e componente", state: "inexistente" },
      { data: "Frequência homologada", state: "inexistente" },
      { data: "Fechamento de período", state: "inexistente" },
    ],
  },
  {
    document: "Ficha Individual",
    requires: [
      { data: "Trajetória: matrícula, vínculos, alocações (8A–8G)", state: "existe-demonstrativo" },
      { data: "Resultados por componente com contexto temporal", state: "preparado-12a" },
      { data: "Frequência homologada", state: "inexistente" },
      { data: "Situação acadêmica", state: "inexistente" },
    ],
  },
  {
    document: "Folha Final",
    requires: [
      { data: "Matrícula e vínculos do período", state: "existe-demonstrativo" },
      { data: "Resultado final por componente", state: "inexistente" },
      { data: "Frequência homologada", state: "inexistente" },
      { data: "Situação acadêmica e conselho", state: "inexistente" },
      { data: "Fechamento anual", state: "inexistente" },
    ],
  },
  {
    document: "Observações",
    requires: [
      { data: "Observações individuais da Educação Infantil (11D)", state: "existe-demonstrativo" },
      { data: "Evidências de desenvolvimento por período (referências)", state: "preparado-12a" },
      { data: "Definição de quais registros são oficiais", state: "inexistente" },
    ],
  },
];

/** Disponibilidade DERIVADA das dependências — nunca uma flag arbitrária. */
export type DocumentAvailability =
  "disponivel" | "parcialmente-disponivel" | "depende-homologacao" | "indisponivel";

export const DOCUMENT_AVAILABILITY_LABEL: Record<DocumentAvailability, string> = {
  disponivel: "Disponível para consulta",
  "parcialmente-disponivel": "Parcialmente disponível",
  "depende-homologacao": "Depende de homologação",
  indisponivel: "Indisponível",
};

export function documentAvailability(dependency: DocumentDependency): {
  state: DocumentAvailability;
  satisfied: number;
  total: number;
  blocking: string[];
} {
  const total = dependency.requires.length;
  const ready = dependency.requires.filter((r) => r.state === "existe-demonstrativo");
  const blocking = dependency.requires
    .filter((r) => r.state !== "existe-demonstrativo")
    .map((r) => r.data);
  const onlyHomologation = dependency.requires
    .filter((r) => r.state !== "existe-demonstrativo")
    .every((r) => r.state === "depende-homologacao");
  const state: DocumentAvailability =
    blocking.length === 0
      ? "disponivel"
      : onlyHomologation
        ? "depende-homologacao"
        : ready.length * 2 >= total
          ? "parcialmente-disponivel"
          : "indisponivel";
  return { state, satisfied: ready.length, total, blocking };
}

export function getDocumentDependency(name: string) {
  return documentDependencies.find((d) => d.document === name);
}
