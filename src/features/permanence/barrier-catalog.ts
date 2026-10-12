/**
 * L09 Permanência — catálogo de barreiras (migration 0397).
 * Tipo é versão append-only (sem semente); vale só a última versão aprovada por pessoa
 * ≠ autor com decisão. Sensibilidade (comum/restrita/reforçada) define capacidade de
 * leitura na RLS. Barreira do caso nasce "relatada" com fonte; "confirmada" só por pessoa
 * ≠ quem relatou e com referência de fonte; nada é julgamento moral nem diagnóstico.
 */
export type Sensitivity = "comum" | "restrita" | "reforcada";
export interface BarrierType { id: string; typeKey: string; version: number; label: string; sensitivity: Sensitivity; requiresConfirmation: boolean; authorPerson: string; approvedBy: string | null; decisionRef: string | null }
export type BarrierStatus = "relatada" | "confirmada" | "descartada" | "superada";
export type SourceKind = "familia" | "estudante" | "escola" | "rede-de-protecao" | "registro-oficial" | "visita";
export interface BarrierEvent { caseId: string; barrierRef: string; seq: number; typeId: string; status: BarrierStatus; sourceKind: SourceKind; sourceRef: string | null; justification: string | null; authorPerson: string }

/** Exemplos de categorias para o rascunho do catálogo — nunca gravados automaticamente. */
export const SUGGESTED_CATEGORIES: readonly { key: string; label: string; sensitivity: Sensitivity }[] = [
  { key: "transporte", label: "Transporte", sensitivity: "comum" },
  { key: "acessibilidade", label: "Acessibilidade", sensitivity: "restrita" },
  { key: "pedagogica", label: "Barreira pedagógica", sensitivity: "comum" },
  { key: "mudanca", label: "Mudança de endereço ou município", sensitivity: "restrita" },
  { key: "violencia", label: "Situação de violência", sensitivity: "reforcada" },
  { key: "vulnerabilidade", label: "Vulnerabilidade social", sensitivity: "reforcada" },
];

const JUDGMENT = /(culpa|neglig|irrespons|desestrutur|diagn|transtorno|vagabund|pregui[cç])/i;
export const judgmentFree = (s: string) => !JUDGMENT.test(s);

/** Catálogo vigente: por chave, a maior versão; só conta se essa for aprovada (rascunho mais novo bloqueia). */
export function activeCatalog(types: readonly BarrierType[]): { active: BarrierType[]; pending: string[] } {
  const head = new Map<string, BarrierType>();
  for (const t of types) if (!head.has(t.typeKey) || t.version > head.get(t.typeKey)!.version) head.set(t.typeKey, t);
  const active: BarrierType[] = []; const pending: string[] = [];
  for (const t of head.values()) (t.approvedBy && t.decisionRef && t.approvedBy !== t.authorPerson ? active : pending).push(t as never);
  return { active: active.sort((a, b) => a.label.localeCompare(b.label)), pending: (pending as unknown as BarrierType[]).map((t) => t.typeKey).sort() };
}

export const READ_CAPABILITY: Record<Sensitivity, string[]> = {
  comum: ["ler-barreiras-do-caso"],
  restrita: ["ler-barreiras-do-caso", "ler-barreiras-restritas"],
  reforcada: ["ler-barreiras-do-caso", "ler-barreiras-reforcadas"],
};
export const canRead = (s: Sensitivity, caps: ReadonlySet<string>) => READ_CAPABILITY[s].every((c) => caps.has(c));

export interface BarrierView { barrierRef: string; type: BarrierType; status: BarrierStatus; confirmed: boolean; needsConfirmation: boolean; sources: SourceKind[]; history: BarrierEvent[] }

export function projectBarriers(events: readonly BarrierEvent[], types: readonly BarrierType[], caps: ReadonlySet<string>): BarrierView[] {
  const byType = new Map(types.map((t) => [t.id, t]));
  const groups = new Map<string, BarrierEvent[]>();
  for (const e of events) groups.set(e.barrierRef, [...(groups.get(e.barrierRef) ?? []), e]);
  const out: BarrierView[] = [];
  for (const [ref, evs] of groups) {
    const h = [...evs].sort((a, b) => a.seq - b.seq);
    if (h.some((e, i) => e.seq !== i + 1)) throw new Error("barrier-catalog:broken-chain");
    const type = byType.get(h[0]!.typeId);
    if (!type || !canRead(type.sensitivity, caps)) continue; // sem capacidade: não aparece nem conta
    const status = h.at(-1)!.status;
    const confirmed = h.some((e) => e.status === "confirmada");
    out.push({ barrierRef: ref, type, status, confirmed, needsConfirmation: type.requiresConfirmation && !confirmed && status === "relatada",
      sources: [...new Set(h.map((e) => e.sourceKind))], history: h });
  }
  return out.sort((a, b) => a.type.label.localeCompare(b.type.label) || a.barrierRef.localeCompare(b.barrierRef));
}

/** Espelho da regra do banco para a tela. */
export function validateBarrierEvent(prev: BarrierView | null, d: { status: BarrierStatus; sourceRef: string | null; justification: string | null; authorPerson: string }): string | null {
  if (d.justification && !judgmentFree(d.justification)) return "Texto com julgamento ou diagnóstico não é aceito.";
  if (!prev) return d.status === "relatada" ? null : "Barreira começa como relatada.";
  if (prev.status === "descartada" || prev.status === "superada") return "Barreira já encerrada.";
  if (d.status !== "relatada" && (d.justification ?? "").trim().length < 10) return "Justifique a mudança.";
  if (d.status === "confirmada" && prev.history[0]!.authorPerson === d.authorPerson) return "Confirmação por pessoa diferente de quem relatou.";
  if (d.status === "confirmada" && (d.sourceRef ?? "").trim().length < 3) return "Confirmação exige referência da fonte.";
  return null;
}
