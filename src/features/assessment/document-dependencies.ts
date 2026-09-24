/**
 * Mapa de dependências dos documentos listados em /diario/documentos,
 * derivado da arquitetura real. "existe" = já há fonte no SIGEM (demonstrativa).
 */
export type DependencyState = "existe-demonstrativo" | "preparado-12a" | "inexistente";

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
      { data: "Regras de frequência, abonos e justificativas", state: "inexistente" },
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
      { data: "Períodos avaliativos homologados", state: "preparado-12a" },
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
