/**
 * Etapa 12E — modelos de composição DEMONSTRATIVOS.
 *
 * Nenhum valor aqui é regra da rede: todos têm normativeStatus "demonstrativo",
 * portanto o motor devolve bloqueio informativo em vez de calcular. Os pesos,
 * categorias, quantidades mínimas e pontos de arredondamento existem apenas
 * para demonstrar que a estrutura é configurável.
 */
import type { CompositionModel } from "./assessment-composition-types";

export const compositionModels: CompositionModel[] = [
  {
    id: "mc-demo-quantitativa",
    label: "Modelo demonstrativo de composição quantitativa",
    configurationId: "cfg-2026-quantitativa-demo",
    configurationVersion: 1,
    scaleSemantics: "quantitativa",
    categories: [
      {
        id: "cat-demo-continua",
        label: "Categoria demonstrativa contínua",
        instrumentTypeIds: ["it-atividade", "it-trabalho", "it-projeto"],
        weight: 1,
        minimumEntries: 1,
        aggregation: { kind: "media-simples" },
      },
      {
        id: "cat-demo-pontual",
        label: "Categoria demonstrativa pontual",
        instrumentTypeIds: ["it-prova", "it-pratica"],
        weight: 1,
        minimumEntries: 1,
        aggregation: { kind: "media-simples" },
      },
    ],
    periodAggregation: { kind: "media-ponderada" },
    annualAggregation: { kind: "media-simples" },
    requiresAllPeriods: true,
    rounding: {
      id: "arr-demo",
      mode: "meio-acima",
      decimals: 0,
      // Apenas pontos de fechamento; categorias e subtotais preservam precisão.
      applyAt: ["periodo", "anual"],
      normativeStatus: "demonstrativo",
    },
    administrativeEntries: {
      accepted: false,
      acceptedOrigins: [],
      normativeStatus: "pendente",
    },
    normativeStatus: "demonstrativo",
    version: 1,
  },
  {
    id: "mc-demo-conceitual",
    label: "Modelo demonstrativo conceitual (sem equivalência numérica)",
    configurationId: "cfg-2026-conceitual-demo",
    configurationVersion: 1,
    scaleSemantics: "conceitual",
    categories: [],
    periodAggregation: { kind: "media-simples" },
    annualAggregation: { kind: "media-simples" },
    requiresAllPeriods: true,
    rounding: { id: "arr-demo-nenhum", mode: "sem-arredondamento", applyAt: [], normativeStatus: "pendente" },
    administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
    normativeStatus: "demonstrativo",
    version: 1,
  },
];

export function compositionModelFor(
  configurationId: string,
  models: readonly CompositionModel[] = compositionModels,
) {
  return models.find((m) => m.configurationId === configurationId);
}
