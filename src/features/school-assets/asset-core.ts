/**
 * Lote 07 (Expansão) — Patrimônio, infraestrutura e manutenção: núcleo puro.
 * Patrimônio ≠ compra: bem nasce por tombamento, nunca de nota de compra. Histórico é cadeia
 * de eventos; estado atual é projeção. Infraestrutura da escola continua no cadastro canônico
 * (versão cadastral / Tabela SEMED 09 / Educacenso) — aqui só se compara por vigência.
 */

export type AssetEventKind = "tombamento" | "movimentacao" | "condicao" | "inventariado" | "baixa";
export type AssetEvent = Readonly<{ seq: number; kind: AssetEventKind; on: string; schoolId?: string; roomId?: string | null; condition?: string; reason?: string; actorPersonId: string | null }>;

export type AssetState = { exists: boolean; schoolId: string | null; roomId: string | null; condition: string | null; writtenOff: boolean; lastInventory: string | null };

export function projectAsset(events: readonly AssetEvent[]): { ok: true; state: AssetState } | { ok: false; reason: string } {
  const ev = [...events].sort((a, b) => a.seq - b.seq);
  if (!ev.length || ev[0]!.kind !== "tombamento") return { ok: false, reason: "sem-tombamento" };
  for (let i = 0; i < ev.length; i++) if (ev[i]!.seq !== i + 1) return { ok: false, reason: "cadeia-com-lacuna" };
  const s: AssetState = { exists: true, schoolId: null, roomId: null, condition: null, writtenOff: false, lastInventory: null };
  for (const e of ev) {
    if (!e.actorPersonId) return { ok: false, reason: "evento-sem-pessoa" };
    if (s.writtenOff) return { ok: false, reason: "evento-apos-baixa" };
    if (e.kind === "tombamento" || e.kind === "movimentacao") { s.schoolId = e.schoolId ?? s.schoolId; s.roomId = e.roomId ?? null; }
    if (e.kind === "condicao") s.condition = e.condition ?? null;
    if (e.kind === "inventariado") s.lastInventory = e.on;
    if (e.kind === "baixa") { if (!e.reason?.trim()) return { ok: false, reason: "baixa-sem-motivo" }; s.writtenOff = true; }
  }
  return { ok: true, state: s };
}

/** Tombamento único por rede. */
export const duplicateTags = (tags: readonly string[]) => [...new Set(tags.filter((t, i) => tags.indexOf(t) !== i))];

/** Ordem de serviço. Aprovação nunca pela mesma pessoa que solicitou; aceite só após execução com evidência. */
export type WoState = "solicitada" | "vistoriada" | "aprovada" | "em-execucao" | "executada" | "aceita" | "recusada" | "cancelada";
const NEXT: Record<WoState, readonly WoState[]> = {
  solicitada: ["vistoriada", "cancelada"], vistoriada: ["aprovada", "recusada"], aprovada: ["em-execucao", "cancelada"],
  "em-execucao": ["executada"], executada: ["aceita", "em-execucao"], aceita: [], recusada: [], cancelada: [],
};
export function woMove(from: WoState, to: WoState, ctx: { requesterId: string; actorId: string | null; evidenceCount: number }) {
  if (!ctx.actorId) return { ok: false as const, reason: "sem-pessoa" };
  if (!NEXT[from].includes(to)) return { ok: false as const, reason: "transicao-invalida" };
  if (to === "aprovada" && ctx.actorId === ctx.requesterId) return { ok: false as const, reason: "aprovador-igual-solicitante" };
  if (to === "aceita" && ctx.evidenceCount < 1) return { ok: false as const, reason: "sem-evidencia" };
  return { ok: true as const };
}

/** Prioridade só da configuração; sem configuração ⇒ "não classificada", nunca presumida. */
export const priorityOf = (cfg: Readonly<Record<string, string>>, category: string) => cfg[category] ?? null;

/** Inventário periódico: vencido só se a periodicidade estiver configurada. */
export function inventoryOverdue(last: string | null, periodDays: number | null, today: string) {
  if (periodDays == null) return null;
  if (last == null) return true;
  return (Date.parse(today) - Date.parse(last)) / 86_400_000 > periodDays;
}

/** Infraestrutura: compara declaração da SEMED 09 com Educacenso só na mesma data de referência. */
export function compareInfra(a: { refDate: string; value: number | null }, b: { refDate: string; value: number | null }) {
  if (a.refDate !== b.refDate) return "nao-comparavel" as const;
  if (a.value == null || b.value == null) return "sem-dado" as const;
  return a.value === b.value ? "coincide" as const : "divergente" as const;
}
