/**
 * Matriz de capacidades (P1-02): inventário das capabilities que o banco exige
 * (extraído das migrations por `scripts/capability-inventory.mjs`) × regras da
 * política homologada vigente × atuações vigentes. Só leitura: nada é atribuído
 * aqui — atribuir é nova versão da política (rascunho → homologação por pessoa
 * competente), porque privilégio sem decisão institucional seria autorização falsa.
 */
import inventoryJson from "./capability-inventory.json";
import { engagementActive, type PolicyRule } from "./policy-governance";

export type InventoryEntry = { id: string; module: string; firstMigration: string; scopes: ("rede" | "escola" | "indefinido")[] };
export const CAPABILITY_INVENTORY = inventoryJson as InventoryEntry[];

const CALL = /has_(network_|school_)?capability\s*\(\s*'([a-z][a-z0-9-]+)'/g;

/** Capabilities citadas literalmente num SQL, com o escopo da função que as exige. */
export function extractCapabilities(sql: string): { id: string; scope: "rede" | "escola" | "indefinido" }[] {
  const out: { id: string; scope: "rede" | "escola" | "indefinido" }[] = [];
  for (const m of sql.matchAll(CALL)) out.push({ id: m[2]!, scope: m[1] === "network_" ? "rede" : m[1] === "school_" ? "escola" : "indefinido" });
  return out;
}

const MODULES: [RegExp, string][] = [
  [/_enr_|enr0|matricul|inscric|vaga|reserva|enturma/, "Matrículas"],
  [/tecnolog|chamado|backup|restaura|conectiv|catalogo-digital|acessos-digitais|incidentes-de-seguranca|conhecimento-tecnico|mudancas/, "Tecnologia"],
  [/acervo|docserv|document|protocol|process|numerar|anexos|assinat/, "Documentos e Acervo"],
  [/formac|formacao|desenvolvimento|trilha|certific/, "Desenvolvimento"],
  [/pessoal|servidor|lotac|folha|frequencia-funcional|atuac/, "Gestão de Pessoas"],
  [/permanenc|busca-ativa|evasao|infrequen/, "Permanência"],
  [/operac|transporte|infraestrutura|patrimonio|manutenc/, "Centro de Operações"],
];
export function moduleOfMigration(file: string, id: string): string {
  const key = `${id} ${file}`;
  for (const [re, m] of MODULES) if (re.test(key)) return m;
  return "Demais módulos";
}

export type MatrixStatus = "sem-titular" | "regra-sem-vinculo-vigente" | "com-titular";
export type MatrixRow = InventoryEntry & {
  holders: { engagementKind: string; scope: readonly string[]; activeEngagements: number }[];
  status: MatrixStatus;
};

type Eng = { id: string; engagement_kind_id: string; valid_from: string; valid_until: string | null };

export function buildCapabilityMatrix(inventory: readonly InventoryEntry[], rules: readonly PolicyRule[], engagements: readonly Eng[], endings: ReadonlyMap<string, string>, on: string): MatrixRow[] {
  const active = new Map<string, number>();
  for (const e of engagements) if (engagementActive(e, endings.get(e.id) ?? null, on)) active.set(e.engagement_kind_id, (active.get(e.engagement_kind_id) ?? 0) + 1);
  return inventory.map((c) => {
    const holders = rules.filter((r) => r.capability_id === c.id).map((r) => ({ engagementKind: r.engagement_kind_id, scope: r.scope_dimensions, activeEngagements: active.get(r.engagement_kind_id) ?? 0 }));
    const status: MatrixStatus = holders.length === 0 ? "sem-titular" : holders.some((h) => h.activeEngagements > 0) ? "com-titular" : "regra-sem-vinculo-vigente";
    return { ...c, holders, status };
  });
}

export const STATUS_LABEL: Record<MatrixStatus, string> = {
  "sem-titular": "Sem titular — nenhuma regra na política vigente",
  "regra-sem-vinculo-vigente": "Regra existe, mas nenhuma atuação vigente desse tipo",
  "com-titular": "Com titular vigente",
};
