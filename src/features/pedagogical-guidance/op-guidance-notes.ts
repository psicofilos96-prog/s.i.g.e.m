/**
 * OP por escola — LOTE 18 (orientações e devolutivas).
 * Orientação = ledger append-only por logicalId: registro → envio → ciência → providência → devolutiva →
 * acompanhamento → encerramento. Estado é projeção (nenhum campo persistido).
 * Notificação só pela camada única (`emit_notification_event`, chave idempotente, payload com variáveis
 * declaradas e sem conteúdo); providência com responsável vira tarefa da Central (dedupeKey estável).
 * Caráter formativo: nenhum evento gera sanção, avaliação funcional ou registro disciplinar.
 */
import { decideOpAccess, type OpDesignation } from "./op-designations";
import { dedupeKey } from "../tasks/task-model";

export type NoteEventKind = "registrar" | "enviar" | "ciencia" | "providencia" | "devolutiva" | "acompanhamento" | "encerrar";
export interface NoteEvent {
  id: string; logicalId: string; seq: number; kind: NoteEventKind; actorPersonId: string; at: string; idempotencyKey: string;
  // registrar
  schoolId?: string; recipientPersonId?: string; recipientEngagementId?: string; subject?: string; context?: string; basis?: string; documentRefs?: string[];
  // providencia
  actionId?: string; actionText?: string; responsibleEngagementId?: string | null; dueOn?: string | null;
  // devolutiva / acompanhamento / encerrar
  text?: string; reason?: string;
}
export type NoteStatus = "rascunho" | "enviada" | "ciente" | "com-providencias" | "respondida" | "em-acompanhamento" | "encerrada";
export interface NoteView {
  logicalId: string; schoolId: string; authorPersonId: string; recipientPersonId: string; recipientEngagementId: string;
  subject: string; context: string; basis: string; documentRefs: string[];
  actions: { id: string; text: string; responsibleEngagementId: string | null; dueOn: string | null }[];
  feedback: { at: string; text: string }[]; followups: { at: string; text: string }[];
  status: NoteStatus; history: NoteEvent[]; functionalEffect: false;
}

const PUNITIVE = /(advert[êe]ncia|suspens[ãa]o|san[çc][ãa]o|puni[çc]|processo administrativo|\bpad\b|avalia[çc][ãa]o funcional|est[áa]gio probat[óo]rio|desconto|falta funcional)/i;
const ORDER: NoteEventKind[] = ["registrar", "enviar", "ciencia", "providencia", "devolutiva", "acompanhamento", "encerrar"];

/** Transições permitidas a partir do estado; providência/acompanhamento podem repetir. */
const NEXT: Record<NoteStatus, NoteEventKind[]> = {
  rascunho: ["enviar", "encerrar"], enviada: ["ciencia"], ciente: ["providencia", "devolutiva", "encerrar"],
  "com-providencias": ["providencia", "devolutiva"], respondida: ["acompanhamento", "encerrar"],
  "em-acompanhamento": ["acompanhamento", "encerrar"], encerrada: [],
};
const AFTER: Partial<Record<NoteEventKind, NoteStatus>> = { enviar: "enviada", ciencia: "ciente", providencia: "com-providencias", devolutiva: "respondida", acompanhamento: "em-acompanhamento", encerrar: "encerrada" };

export function projectNotes(events: NoteEvent[]): { list: NoteView[]; rejected: string[] } {
  const by = new Map<string, NoteEvent[]>();
  for (const e of events) by.set(e.logicalId, [...(by.get(e.logicalId) ?? []), e]);
  const list: NoteView[] = []; const rejected: string[] = [];
  for (const [lid, ch] of by) {
    const s = [...ch].sort((a, b) => a.seq - b.seq); const h = s[0]!;
    if (!s.every((e, i) => e.seq === i + 1) || h.kind !== "registrar") { rejected.push(lid); continue; }
    const v: NoteView = { logicalId: lid, schoolId: h.schoolId!, authorPersonId: h.actorPersonId, recipientPersonId: h.recipientPersonId!, recipientEngagementId: h.recipientEngagementId!,
      subject: h.subject!, context: h.context ?? "", basis: h.basis ?? "", documentRefs: h.documentRefs ?? [], actions: [], feedback: [], followups: [], status: "rascunho", history: s, functionalEffect: false };
    let ok = true;
    for (const e of s.slice(1)) {
      if (!NEXT[v.status].includes(e.kind) || !ORDER.includes(e.kind)) { ok = false; break; }
      const byRecipient = e.actorPersonId === v.recipientPersonId, byAuthor = e.actorPersonId === v.authorPersonId;
      if ((e.kind === "ciencia" || e.kind === "devolutiva") && !byRecipient) { ok = false; break; }
      if (["enviar", "providencia", "acompanhamento", "encerrar"].includes(e.kind) && !byAuthor) { ok = false; break; }
      if (e.kind === "providencia") v.actions.push({ id: e.actionId!, text: e.actionText!, responsibleEngagementId: e.responsibleEngagementId ?? null, dueOn: e.dueOn ?? null });
      if (e.kind === "devolutiva") v.feedback.push({ at: e.at, text: e.text! });
      if (e.kind === "acompanhamento") v.followups.push({ at: e.at, text: e.text! });
      v.status = AFTER[e.kind]!;
    }
    if (ok) list.push(v); else rejected.push(lid);
  }
  return { list, rejected };
}

export interface NoteCommand {
  personNatural: boolean; personId: string; today: string; event: NoteEvent; expectedSeq: number; existing: NoteEvent[];
  designations: OpDesignation[]; capabilities: { id: string; scope: "escola" | "rede"; schoolId: string | null }[];
  activeEngagementsAtSchool: ReadonlyMap<string, string>; // engagementId → personId
}

/** Executor estreito: idempotente, base esperada, competência, termos punitivos recusados; fail-closed. */
export function recordNoteEvent(c: NoteCommand): { ok: true; replay: boolean; event: NoteEvent } | { ok: false; reasons: string[] } {
  const rep = c.existing.find((x) => x.idempotencyKey === c.event.idempotencyKey);
  if (rep) return rep.logicalId === c.event.logicalId && rep.kind === c.event.kind ? { ok: true, replay: true, event: rep } : { ok: false, reasons: ["Chave idempotente reutilizada."] };
  const e = c.event; const r: string[] = [];
  if (!c.personNatural) r.push("Executor técnico não pratica ato de orientação.");
  if (e.actorPersonId !== c.personId) r.push("Ato só em nome de quem o pratica.");
  const chain = c.existing.filter((x) => x.logicalId === e.logicalId);
  if (chain.length !== c.expectedSeq || e.seq !== c.expectedSeq + 1) r.push("Base esperada divergente.");
  const cur = projectNotes(chain).list[0];
  const schoolId = e.kind === "registrar" ? e.schoolId : cur?.schoolId;
  const needsOpAccess = e.kind === "registrar" || (cur && c.personId === cur.authorPersonId);
  if (!schoolId) r.push("Orientação inexistente.");
  else if (needsOpAccess) {
    const a = decideOpAccess({ personNatural: c.personNatural, personId: c.personId, date: c.today, schoolId, classId: null, granularity: "individual", action: "registrar", purpose: "acompanhamento", designations: c.designations, capabilities: c.capabilities });
    if (!a.ok) r.push(a.reason);
  }
  if (e.kind === "registrar") {
    if (!e.subject?.trim() || !e.recipientEngagementId) r.push("Destinatário e assunto obrigatórios.");
    const p = e.recipientEngagementId ? c.activeEngagementsAtSchool.get(e.recipientEngagementId) : undefined;
    if (!p || p !== e.recipientPersonId) r.push("Destinatário sem atuação vigente na escola.");
    if (e.recipientPersonId === c.personId) r.push("Ninguém orienta a si mesmo.");
  }
  if (e.kind === "providencia") {
    if (!e.actionId || !e.actionText?.trim()) r.push("Providência sem descrição.");
    if (e.responsibleEngagementId && !c.activeEngagementsAtSchool.has(e.responsibleEngagementId)) r.push("Responsável sem atuação vigente.");
  }
  if ((e.kind === "devolutiva" || e.kind === "acompanhamento") && !e.text?.trim()) r.push("Texto obrigatório.");
  if (e.kind === "encerrar" && !e.reason?.trim()) r.push("Encerramento exige motivo.");
  const texts = [e.subject, e.context, e.basis, e.actionText, e.reason, e.kind === "acompanhamento" ? e.text : undefined].filter(Boolean).join(" ");
  if (PUNITIVE.test(texts)) r.push("Orientação é formativa: não registra sanção, avaliação funcional nem processo disciplinar.");
  if (!r.length && projectNotes([...chain, e]).rejected.length) r.push("Ato incompatível com o estado ou com quem pode praticá-lo.");
  return r.length ? { ok: false, reasons: r } : { ok: true, replay: false, event: e };
}

/** Notificação pela camada única: só evento + destinatário + link; nenhum conteúdo da orientação no payload. */
export function notificationFor(v: NoteView, e: NoteEvent) {
  const map: Partial<Record<NoteEventKind, { kind: string; to: "destinatario" | "autor" }>> = {
    enviar: { kind: "op.orientacao.enviada", to: "destinatario" }, devolutiva: { kind: "op.orientacao.devolutiva", to: "autor" },
    providencia: { kind: "op.orientacao.providencia", to: "destinatario" }, encerrar: { kind: "op.orientacao.encerrada", to: "destinatario" },
  };
  const m = map[e.kind]; if (!m) return null;
  return { eventKind: m.kind, idempotencyKey: `op-orientacao:${v.logicalId}:${e.seq}`, schoolId: v.schoolId,
    recipientPersonId: m.to === "destinatario" ? v.recipientPersonId : v.authorPersonId, link: `/orientacao?nota=${v.logicalId}`, variables: {} };
}

/** Providências com responsável → Central de tarefas; prazo só se declarado; nunca "atraso" sem prazo. */
export function noteTasks(v: NoteView) {
  return v.actions.filter((a) => a.responsibleEngagementId).map((a) => {
    const sourceRef = `${v.logicalId}:${a.id}`;
    return { schoolId: v.schoolId, title: a.text, dueOn: a.dueOn, assigneeEngagement: a.responsibleEngagementId!, sourceKind: "op-orientacao", sourceRef,
      dedupeKey: dedupeKey(v.schoolId, "op-orientacao", sourceRef, a.text, "v1") };
  });
}

/** Leitura: autor e destinatário veem a orientação; demais orientadores da escola com acesso; central só contagem por status suprimida. */
export function notesFor(viewer: { kind: "pessoa"; personId: string } | { kind: "central" }, list: NoteView[]) {
  if (viewer.kind === "pessoa") return list.filter((n) => n.authorPersonId === viewer.personId || n.recipientPersonId === viewer.personId);
  const out: Record<string, number | "suprimido"> = {};
  for (const s of Object.keys(NEXT)) { const n = list.filter((x) => x.status === s).length; out[s] = n > 0 && n < 5 ? "suprimido" : n; }
  return out;
}
