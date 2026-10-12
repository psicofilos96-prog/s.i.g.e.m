/**
 * OP por escola — LOTE 03: Central de Acompanhamento Pedagógico (projeção pura).
 * Cada bloco vem de uma fonte canônica já lida com a sessão; estado explícito, fonte e data.
 * Fonte não lida ≠ zero. Nenhum número é ilustrativo: sem leitura, não há valor.
 * Drill-down fica dentro da Central (/orientacao?bloco=…&item=…), sem abrir módulo desconexo.
 */
export type BlockState = "disponivel" | "zero" | "nao-lido" | "sem-permissao" | "bloqueado";
export const BLOCKS = {
  professores: { label: "Professores", source: "institutional_engagements" },
  turmas: { label: "Turmas", source: "class_at" },
  planejamentos: { label: "Planejamentos recebidos", source: "teaching_plans_overview_at" },
  devolutivas: { label: "Devolutivas pendentes", source: "teaching_plans_overview_at" },
  intervencoes: { label: "Intervenções", source: "aa_intervention_versions" },
  reunioes: { label: "Reuniões", source: "collegial_session_events" },
  prioridades: { label: "Prioridades", source: "school_pedagogical_records_at" },
  alertas: { label: "Alertas", source: "regra homologada" },
} as const;
export type BlockId = keyof typeof BLOCKS;

export interface SourceRead<T> { status: "ok" | "denied" | "not-read" | "error"; rows: T[]; readAt: string | null }
export interface Item { id: string; label: string; reason?: string; due?: string | null }
export interface Block { id: BlockId; label: string; source: string; state: BlockState; count: number | null; readAt: string | null; items: Item[]; note: string }

function block(id: BlockId, read: SourceRead<Item> | undefined, blockedReason?: string): Block {
  const b = BLOCKS[id];
  const base = { id, label: b.label, source: b.source, readAt: read?.readAt ?? null };
  if (blockedReason) return { ...base, state: "bloqueado", count: null, items: [], note: blockedReason };
  if (!read || read.status === "not-read" || read.status === "error") return { ...base, state: "nao-lido", count: null, items: [], note: "Fonte não lida: sem valor." };
  if (read.status === "denied") return { ...base, state: "sem-permissao", count: null, items: [], note: "Sem permissão para esta fonte." };
  if (!read.readAt) return { ...base, state: "nao-lido", count: null, items: [], note: "Leitura sem data: sem valor." };
  return { ...base, state: read.rows.length === 0 ? "zero" : "disponivel", count: read.rows.length, items: read.rows, note: "" };
}

export interface CentralInput {
  schoolId: string; date: string;
  reads: Partial<Record<BlockId, SourceRead<Item>>>;
  /** alerta só existe com regra homologada; sem regra o bloco fica bloqueado */
  alertRuleHomologated: boolean;
}

export function buildCentral(i: CentralInput): { schoolId: string; date: string; blocks: Block[] } {
  const blocks = (Object.keys(BLOCKS) as BlockId[]).map((id) =>
    id === "alertas" && !i.alertRuleHomologated ? block(id, i.reads[id], "Sem regra de alerta homologada: nenhum alerta é calculado.") : block(id, i.reads[id]));
  return { schoolId: i.schoolId, date: i.date, blocks };
}

/** Devolutiva pendente = plano compartilhado sem devolutiva do orientador; derivado, nunca persistido. */
export function pendingFeedback(plans: { planId: string; version: number; label: string; sharedAt: string }[], feedbackFor: Set<string>): Item[] {
  return plans.filter((p) => !feedbackFor.has(`${p.planId}:${p.version}`))
    .sort((a, b) => a.sharedAt.localeCompare(b.sharedAt))
    .map((p) => ({ id: `${p.planId}:${p.version}`, label: p.label, reason: "Plano compartilhado sem devolutiva.", due: null }));
}

/** Drill-down dentro da Central: mesmo fluxo, sem trocar de módulo. */
export function drillDown(blockId: BlockId, itemId?: string) {
  return { to: "/orientacao" as const, search: itemId ? { bloco: blockId, item: itemId } : { bloco: blockId } };
}

/** Texto do contador: zero só quando observado; ausência por extenso. */
export function counterText(b: Block): string {
  if (b.state === "disponivel" || b.state === "zero") return String(b.count);
  return b.state === "sem-permissao" ? "Sem permissão" : b.state === "bloqueado" ? "Bloqueado" : "Não disponível";
}
