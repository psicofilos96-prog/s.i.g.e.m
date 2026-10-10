/**
 * LOTE 7/14 — Agrupamento de APRESENTAÇÃO da infraestrutura (não é norma): usa o atributo e o
 * grupo (G1…G5) que a própria fonte declara no rótulo. Atributo desconhecido cai em "Outros",
 * nunca é descartado. Grupo sem campo na fonte aparece como tal — ausência ≠ "não".
 */
export type InfraGroup = "acessibilidade" | "servicos" | "dependencias" | "instalacoes" | "equipamentos" | "predio" | "outros";
export const INFRA_GROUP_LABEL: Record<InfraGroup, string> = {
  acessibilidade: "Acessibilidade", servicos: "Serviços básicos", dependencias: "Dependências",
  instalacoes: "Instalações pedagógicas e áreas", equipamentos: "Equipamentos", predio: "Prédio e funcionamento", outros: "Outros",
};
export const INFRA_GROUP_ORDER: InfraGroup[] = ["predio", "servicos", "acessibilidade", "dependencias", "instalacoes", "equipamentos", "outros"];

const SERVICES = new Set(["abastecimento-de-agua", "esgotamento-sanitario", "fonte-de-energia-eletrica", "destinacao-do-lixo", "tratamento-do-lixo-residuos-pela-escola", "fornece-agua-potavel-para-o-consumo-humano"]);
const PREDIO = new Set(["local-de-funcionamento-da-escola", "forma-de-ocupacao-do-predio-escolar", "escola-compartilha-o-seu-predio-com-outra-instituicao", "salas-de-aula-dentro-do-predio-escolar", "salas-de-aula-fora-do-predio-escolar"]);

export function infraGroupOf(attributeId: string, label: string): InfraGroup {
  if (/acessib/i.test(attributeId) || /acessív|acessib/i.test(label)) return "acessibilidade";
  if (SERVICES.has(attributeId)) return "servicos";
  if (PREDIO.has(attributeId)) return "predio";
  if (/equipament/i.test(label)) return "equipamentos";
  if (/\(G[123]\)/.test(label)) return "dependencias";
  if (/\(G[45]\)/.test(label) || /^salas-de-aula/.test(attributeId) || attributeId === "terreirao" || attributeId === "viveiro-criacao-de-animais") return "instalacoes";
  return "outros";
}

export function groupInfra<T extends { attributeId: string; label: string }>(facts: readonly T[]): Array<{ group: InfraGroup; items: T[] }> {
  const m = new Map<InfraGroup, T[]>();
  for (const f of facts) { const g = infraGroupOf(f.attributeId, f.label); m.set(g, [...(m.get(g) ?? []), f]); }
  return INFRA_GROUP_ORDER.map((group) => ({ group, items: m.get(group) ?? [] })).filter((g) => g.items.length || g.group === "equipamentos");
}
