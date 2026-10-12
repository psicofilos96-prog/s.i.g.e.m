/**
 * CIECE Lote 17 — Solicitações, documentos e prazos (núcleo puro; efetivação só por writers canônicos).
 * Reaproveita: protocolo/numeração/tramitação/retenção = `document-studio/ged-core.ts`
 * (`nextNumber`, `canMove`, `retentionAction`, `attachmentAllowed`). Aqui: ciclo de solicitação de
 * informação, acervo CIECE versionado por hash e agenda censitária cujo prazo só existe com
 * documento de origem.
 */
import { nextNumber, retentionAction, attachmentAllowed } from "@/features/document-studio/ged-core";

export const CAP_ATTEND = "atender-solicitacao-ciece";
export const CAP_DELIVER = "conferir-entrega-ciece";

export type ReqState = "recebida" | "classificada" | "atribuida" | "em-elaboracao" | "em-conferencia" | "entregue" | "arquivada" | "recusada";
const NEXT: Record<ReqState, ReqState[]> = {
  recebida: ["classificada", "recusada"], classificada: ["atribuida"], atribuida: ["em-elaboracao"],
  "em-elaboracao": ["em-conferencia"], "em-conferencia": ["entregue", "em-elaboracao"], entregue: ["arquivada"], arquivada: [], recusada: ["arquivada"],
};
export type ReqEvent = { seq: number; key: string; to: ReqState; by: string; at: string; capabilities: string[]; classification?: string; assignee?: string; deadline?: { date: string; sourceDoc: string }; deliverableRef?: string; reason?: string };
export type Request = { protocol: string; requester: string; subject: string; events: ReqEvent[] };

export function openRequest(issued: Parameters<typeof nextNumber>[0], year: number, unit: string, requester: string, subject: string): Request {
  const n = nextNumber(issued, "requerimento", year, unit);
  return { protocol: typeof n === "object" && n && "label" in n ? String((n as { label: unknown }).label) : `requerimento-${unit}-${year}-${JSON.stringify(n)}`, requester, subject, events: [] };
}
export const stateOf = (r: Request): ReqState => r.events.at(-1)?.to ?? "recebida";

export function applyEvent(r: Request, e: ReqEvent): { ok: true; request: Request } | { ok: false; reason: string } {
  if (r.events.some((x) => x.key === e.key)) return { ok: true, request: r }; // idempotente
  if (e.seq !== r.events.length + 1) return { ok: false, reason: "seq-fora-de-ordem" };
  const cur = stateOf(r);
  if (!NEXT[cur].includes(e.to)) return { ok: false, reason: `transicao-invalida:${cur}->${e.to}` };
  const need = e.to === "entregue" ? CAP_DELIVER : CAP_ATTEND;
  if (!e.capabilities.includes(need)) return { ok: false, reason: `sem-capacidade:${need}` };
  if (e.to === "classificada" && !e.classification) return { ok: false, reason: "classificacao-ausente" };
  if (e.to === "atribuida" && !e.assignee) return { ok: false, reason: "responsavel-ausente" };
  if (e.deadline && !e.deadline.sourceDoc) return { ok: false, reason: "prazo-sem-documento-de-origem" };
  if (e.to === "recusada" && !e.reason) return { ok: false, reason: "recusa-sem-motivo" };
  if (e.to === "entregue") {
    if (!e.deliverableRef) return { ok: false, reason: "entrega-sem-artefato" };
    const author = r.events.find((x) => x.to === "em-conferencia")?.by;
    if (author === e.by) return { ok: false, reason: "conferente-igual-ao-elaborador" };
  }
  return { ok: true, request: { ...r, events: [...r.events, e] } };
}
/** Prazo só o declarado com documento; sem prazo ⇒ null (nunca SLA inventado). */
export function deadlineOf(r: Request) { return [...r.events].reverse().find((e) => e.deadline)?.deadline ?? null; }
export function overdue(r: Request, today: string): boolean | null {
  const d = deadlineOf(r); if (!d) return null;
  return !["entregue", "arquivada", "recusada"].includes(stateOf(r)) && today > d.date;
}

export type DocClass = "levantamento" | "arquivo-censitario" | "recibo" | "ata" | "orientacao" | "planilha" | "evidencia";
export type DocVersion = { docId: string; version: number; cls: DocClass; path: string; sha256: string; uploadedBy: string; at: string; supersedes: number | null };

/** Acervo append-only: versão nova encadeada; mesmo hash = idempotente; anexo só em armazenamento privado. */
export function addVersion(chain: DocVersion[], v: DocVersion): { ok: true; chain: DocVersion[] } | { ok: false; reason: string } {
  if (!attachmentAllowed(v.path)) return { ok: false, reason: "caminho-nao-privado" };
  if (!/^[a-f0-9]{64}$/.test(v.sha256)) return { ok: false, reason: "hash-invalido" };
  const same = chain.filter((c) => c.docId === v.docId);
  if (same.some((c) => c.sha256 === v.sha256)) return { ok: true, chain };
  if (same.length && same[0]!.cls !== v.cls) return { ok: false, reason: "classe-imutavel" };
  const head = same.at(-1)?.version ?? 0;
  if (v.version !== head + 1 || v.supersedes !== (head || null)) return { ok: false, reason: "versao-fora-da-cadeia" };
  return { ok: true, chain: [...chain, v] };
}
/** Retenção por classe só com política decidida; sem decisão sempre retém (ged-core). */
export const retention = (policies: Partial<Record<DocClass, { years: number | null; legalBasis: string | null }>>, cls: DocClass, archivedOn: string, today: string) =>
  retentionAction(policies[cls] ?? null, archivedOn, today);

export type AgendaItem = { id: string; title: string; kind: "censo" | "levantamento"; date: string | null; sourceDoc: { id: string; sha256: string; excerpt: string } | null };
/** Agenda só com data + documento de origem; o resto vai para "pendente de fonte", nunca data presumida. */
export function agenda(items: AgendaItem[]) {
  const dated = items.filter((i) => i.date && i.sourceDoc?.sha256).sort((a, b) => a.date!.localeCompare(b.date!));
  return { dated, pendingSource: items.filter((i) => !dated.includes(i)).map((i) => ({ id: i.id, reason: !i.sourceDoc ? "sem-documento-de-origem" : "sem-data-no-documento" })) };
}
