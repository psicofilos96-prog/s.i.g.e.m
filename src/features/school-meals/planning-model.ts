// NAE.1 — modelo puro do Planejamento Nutricional (espécies do registro mestre, abas, estados, bloqueios).
export type MasterStatus = "rascunho" | "conferida" | "homologada" | "retirada";
export interface MasterRow {
  logical_id: string; version: number; status: MasterStatus; school_id: string | null;
  valid_from: string; valid_to: string | null; payload: Record<string, unknown>;
  author_person_id: string; recorded_at: string; functional_validation: string | null;
}

export const PLANNING_TABS: { id: string; label: string; kinds: string[]; blocker?: string }[] = [
  { id: "catalogos", label: "Catálogos", kinds: ["item-alimentar", "unidade-de-medida", "apresentacao-embalagem", "especificacao-tecnica", "fornecedor", "referencia-contratual", "marca-aprovada", "programacao-de-entrega", "publico-de-atendimento"] },
  { id: "cardapios", label: "Cardápios", kinds: ["cardapio-planejado"], blocker: "MENU_CONTENT — AWAITING_OFFICIAL_NORMALIZED_SOURCE" },
  { id: "fichas", label: "Fichas Técnicas", kinds: ["receita-ficha-tecnica"], blocker: "MENU_CONTENT — AWAITING_OFFICIAL_NORMALIZED_SOURCE" },
  { id: "parametros", label: "Parâmetros", kinds: ["parametro-per-capita", "fator-de-conversao", "regra-de-elegibilidade-item"], blocker: "UNIT_CONVERSIONS/PER_CAPITA/ITEM_RESTRICTIONS — BLOCKED_BY_HOMOLOGATED_RULES" },
  { id: "especiais", label: "Especiais", kinds: ["necessidade-alimentar-especial"] },
  { id: "inspetores", label: "Inspetores", kinds: ["designacao-inspetor", "treinamento-inspetor"], blocker: "FUNCTIONAL_SOURCE_REQUIRED" },
  { id: "documentos", label: "Documentos", kinds: ["documento-tecnico"] },
  { id: "pendencias", label: "Pendências de Homologação", kinds: [] },
];

export const KIND_LABEL: Record<string, string> = {
  "item-alimentar": "Gênero/item", "unidade-de-medida": "Unidade de medida", "apresentacao-embalagem": "Apresentação/embalagem",
  "especificacao-tecnica": "Especificação técnica", "fator-de-conversao": "Fator de conversão", "publico-de-atendimento": "Público de atendimento",
  "parametro-per-capita": "Per capita/porção", "regra-de-elegibilidade-item": "Elegibilidade/restrição de item",
  "necessidade-alimentar-especial": "Necessidade alimentar especial", "receita-ficha-tecnica": "Receita/ficha técnica",
  "cardapio-planejado": "Cardápio planejado", fornecedor: "Fornecedor", "referencia-contratual": "Processo/ata/contrato/empenho",
  "marca-aprovada": "Marca aprovada", "programacao-de-entrega": "Programação de entrega", "designacao-inspetor": "Designação de inspetor",
  "treinamento-inspetor": "Treinamento de inspetor", "documento-tecnico": "Documento técnico",
};

export const STATUS_LABEL: Record<MasterStatus, string> = {
  rascunho: "Rascunho", conferida: "Conferida", homologada: "Homologada", retirada: "Retirada",
};

/** Só homologado é operacional; rascunho/conferida nunca aparecem como publicado. */
export const isOperational = (r: Pick<MasterRow, "status">) => r.status === "homologada";

/** Conversão só existe se houver fator homologado exato; nunca presumida, nunca inversa implícita. */
export function findConversion(rows: MasterRow[], from: string, to: string): number | "BLOCKED_BY_HOMOLOGATED_RULE" {
  const r = rows.find((x) => isOperational(x) && x.payload["de_unidade_ref"] === from && x.payload["para_unidade_ref"] === to);
  return r && typeof r.payload["fator"] === "number" ? (r.payload["fator"] as number) : "BLOCKED_BY_HOMOLOGATED_RULE";
}

const SENSITIVE = ["estudante_id", "student_id", "diagnostico", "cpf", "laudo"];
/** Resumo humano sem expor JSON cru nem campo sensível. */
export function summarize(r: Pick<MasterRow, "payload">): string {
  const p = r.payload;
  for (const k of ["nome", "rotulo", "titulo", "descricao", "marca", "numero", "competencia", "frequencia", "efeito"]) {
    if (typeof p[k] === "string" && (p[k] as string).trim()) return p[k] as string;
  }
  return "Sem rótulo declarado";
}
export const hasSensitive = (p: Record<string, unknown>) => SENSITIVE.some((k) => k in p);

export const pendingReview = (rows: MasterRow[]) => rows.filter((r) => r.status === "rascunho" || r.status === "conferida");
