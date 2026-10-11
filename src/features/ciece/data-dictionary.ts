/**
 * CIECE Lote 05 — dicionário de dados e catálogo de indicadores (projeção sobre registros existentes).
 * Entidade/fonte/vigência vêm do FACT_CATALOG; dono/writer de FACT_GOVERNANCE; LGPD de DATA_INVENTORY;
 * campos e tipos do schema gerado (types.ts). Nada é descrito por palpite: sem descrição = "não documentado".
 */
import { FACT_CATALOG } from "./fact-catalog";
import { FACT_GOVERNANCE } from "./ciece-governance";
import { DATA_INVENTORY } from "@/features/privacy/data-inventory";
import { NETWORK_INDICATORS, EVALUATORS, type IndicatorDefinition } from "@/features/dashboards/network-indicator-catalog";

export type SchemaColumn = { table: string; column: string; type: string; nullable: boolean };

export function dictionary(schema: SchemaColumn[]) {
  return FACT_CATALOG.map((f) => {
    const g = FACT_GOVERNANCE.find((x) => x.factTypeId === f.factTypeId)!;
    const inv = DATA_INVENTORY.find((i) => i.tables.includes(f.sourceId));
    const cols = schema.filter((c) => c.table === f.sourceId);
    return {
      entity: f.sourceId, factType: f.factTypeId, description: f.label, owner: g.ownerSector, writer: g.writer,
      temporal: f.temporal, referenceDate: g.referenceDate, granularity: f.granularity,
      lgpd: inv ? { sensitivity: inv.sensitivity, minors: inv.minors, access: inv.access } : { sensitivity: "não classificado" as const },
      fields: cols.map((c) => ({ field: c.column, type: c.type, nullable: c.nullable, description: "não documentado", quality: "não avaliada" })),
      schemaFound: cols.length > 0,
      usedBy: NETWORK_INDICATORS.filter((i) => i.factTypes.includes(f.factTypeId)).map((i) => `${i.key}@v${i.version}`),
      history: "append-only; correção por nova versão",
    };
  });
}

const FORMULA: Record<(typeof EVALUATORS)[number], { formula: string; numerator: string; denominator: string | null }> = {
  "contagem-fatos": { formula: "Σ fatos selecionados", numerator: "fatos que atendem aos filtros", denominator: null },
  "contagem-distinta": { formula: "|{sujeitos distintos}|", numerator: "sujeitos distintos", denominator: null },
  "proporcao-entre-selecoes": { formula: "numerador ÷ denominador (denominador > 0)", numerator: "seleção A", denominator: "seleção B (sem ausentes)" },
  "saldo-entre-selecoes": { formula: "entradas − saídas", numerator: "entradas", denominator: null },
  "projecao-oficial": { formula: "valor oficializado sem recálculo", numerator: "célula oficial", denominator: null },
};

/** Visão completa de cada indicador; fórmula sempre explícita a partir do avaliador auditado. */
export function indicatorCard(i: IndicatorDefinition) {
  const f = FORMULA[i.evaluator];
  const limitations: string[] = [];
  if (i.nature === "derivado") limitations.push("derivado: não é dado oficial");
  if (f.denominator) limitations.push("ausentes ficam fora do denominador; denominador 0 ⇒ sem percentual");
  return {
    code: `${i.key}@v${i.version}`, name: i.name, definition: i.definition, ...f, unit: i.unit,
    filters: i.dimensions, exclusions: ["versões superadas", "fatos sem vigência declarada"], source: i.factTypes,
    referenceDate: i.window, version: i.version, responsible: "CIECE (definição) / setores donos (fatos)", nature: i.nature,
    dependsOn: i.dependsOn, provenance: i.provenance, limitations,
  };
}

export const indicatorCatalog = () => NETWORK_INDICATORS.map(indicatorCard);
