/**
 * Fórmulas de frequência DEMONSTRATIVAS. Nada aqui é norma da rede: são
 * exemplos que exercitam a infraestrutura declarativa. Nenhuma está homologada,
 * nenhuma declara patamar mínimo e nenhuma atribui efeito a justificativa.
 *
 * A rede cadastra as suas próprias fórmulas: unidade, escopo, universo,
 * numerador, agregação, tratamento de ocorrências, precisão e comportamento
 * diante de dado incompleto são todos configuração.
 */
import type { AttendanceFrequencyFormula } from "./attendance-formula";

export const demonstrationAttendanceFormulas: AttendanceFrequencyFormula[] = [
  {
    id: "ffr-demo-unidades-ciclo",
    version: 1,
    label: "Proporção de presença por unidades, no ciclo",
    description:
      "Presenças divididas pelas unidades aplicáveis, apuradas no escopo do ciclo inteiro.",
    status: "rascunho",
    unitId: "unidades",
    scopeDimensionId: "ciclo",
    aggregation: "escopo-unico",
    denominator: [{ measureId: "unidades-aplicaveis" }],
    numerator: [{ measureId: "presencas" }],
    incompleteData: "impede-conclusao",
    resultFactId: "proporcao-de-presenca-por-unidades",
    note: "Exemplo demonstrativo. Sem valor institucional e sem patamar mínimo.",
  },
  {
    id: "ffr-demo-carga-horaria-ciclo",
    version: 1,
    label: "Proporção de presença por carga horária, no ciclo",
    description:
      "Minutos com presença divididos pelos minutos aplicáveis, apurados no escopo do ciclo inteiro.",
    status: "rascunho",
    unitId: "minutos",
    scopeDimensionId: "ciclo",
    aggregation: "escopo-unico",
    denominator: [{ measureId: "minutos-aplicaveis" }],
    numerator: [{ measureId: "minutos-de-presenca" }],
    incompleteData: "impede-conclusao",
    resultFactId: "proporcao-de-presenca-por-carga-horaria",
    note: "Exemplo demonstrativo. Carga horária desconhecida impede a conclusão, jamais vira zero.",
  },
  {
    id: "ffr-demo-unidades-por-componente",
    version: 1,
    label: "Proporção de presença por unidades, por componente curricular",
    description:
      "Mesma infraestrutura, apurada na dimensão do componente curricular. Nenhuma lógica específica de etapa ou modalidade participa disso.",
    status: "rascunho",
    unitId: "unidades",
    scopeDimensionId: "componente-ou-campo",
    aggregation: "escopo-unico",
    denominator: [{ measureId: "unidades-aplicaveis" }],
    numerator: [{ measureId: "presencas" }],
    incompleteData: "impede-conclusao",
    resultFactId: "proporcao-de-presenca-por-unidades",
    note: "Exemplo demonstrativo de apuração por componente.",
  },
];

export const formulaById = (id: string) =>
  demonstrationAttendanceFormulas.find((formula) => formula.id === id);

export const ATTENDANCE_FORMULA_DEMONSTRATION_NOTE =
  "Fórmulas de frequência demonstrativas, em rascunho. A rede define universo, numerador, unidade, escopo, agregação, tratamento de ocorrências e precisão; nenhuma delas tem valor institucional enquanto não for homologada.";
