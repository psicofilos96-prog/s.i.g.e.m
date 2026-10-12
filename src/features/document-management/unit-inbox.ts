// L09 — Caixa de entrada por unidade: projeção de `admin_unit_inbox` (tramitações cujo destino
// está no alcance da sessão). Atos só por `record_inbox_act` (autor = pessoa da sessão);
// encaminhar usa `dispatch_admin_case` (L08); tarefa nasce em `create_operational_task` e é vinculada.
import { supabase } from "@/integrations/supabase/client";

export type InboxActType = "ciencia" | "providencia" | "analise" | "tarefa_vinculada";
export interface InboxRow {
  dispatchId: string; caseNumber: string; subject: string; fromUnitId: string; toUnitId: string;
  dueOn: string | null; settledAs: "recebido" | "devolvido" | null; myCiencia: boolean;
}
export type InboxBox = "a-receber" | "em-andamento" | "devolvidos";

export function inboxBox(r: InboxRow): InboxBox {
  if (r.settledAs === "devolvido") return "devolvidos";
  return r.settledAs === "recebido" ? "em-andamento" : "a-receber";
}

/** Agrupa sem ranking: a ordem dentro da caixa é a do prazo declarado, sem prazo ao fim. */
export function groupInbox(rows: readonly InboxRow[]): Record<InboxBox, InboxRow[]> {
  const out: Record<InboxBox, InboxRow[]> = { "a-receber": [], "em-andamento": [], devolvidos: [] };
  for (const r of rows) out[inboxBox(r)].push(r);
  for (const k of Object.keys(out) as InboxBox[])
    out[k].sort((a, b) => (a.dueOn ?? "9999") .localeCompare(b.dueOn ?? "9999") || a.caseNumber.localeCompare(b.caseNumber));
  return out;
}

export function allowedInboxActs(r: InboxRow): InboxActType[] {
  const acts: InboxActType[] = r.myCiencia ? [] : ["ciencia"];
  return r.settledAs === "recebido" ? [...acts, "providencia", "analise", "tarefa_vinculada"] : acts;
}

const REFUSALS: Record<string, string> = {
  "inbox:no-person": "Sessão sem pessoa institucional vinculada.",
  "inbox:forbidden": "Esta tramitação não está na caixa de uma unidade sob sua competência.",
  "inbox:not-received": "Registre o recebimento antes de providências, análise ou tarefas.",
  "inbox:already-acknowledged": "Você já deu ciência desta tramitação.",
  "inbox:text-required": "Providência e análise exigem texto (mín. 10 caracteres).",
  "inbox:task-not-readable": "Tarefa inexistente ou fora do seu alcance.",
};
export function explainInboxError(msg: string): string {
  const k = Object.keys(REFUSALS).find((x) => msg.includes(x));
  return (k && REFUSALS[k]) || "Falha na caixa de entrada; nada foi registrado.";
}

export async function readInbox() {
  const { data, error } = await supabase.from("admin_unit_inbox").select("*").order("sent_at", { ascending: false }).limit(500);
  if (error) return { ok: false as const, reason: explainInboxError(error.message) };
  return { ok: true as const, rows: (data ?? []).map((r) => ({
    dispatchId: r.dispatch_id!, caseNumber: r.case_number!, subject: r.subject!, fromUnitId: r.from_unit_id!,
    toUnitId: r.to_unit_id!, dueOn: r.due_on, settledAs: (r.settled_as as InboxRow["settledAs"]) ?? null, myCiencia: !!r.my_ciencia,
  })) };
}

export async function recordInboxAct(i: { dispatchId: string; actType: InboxActType; textBody?: string; taskId?: string; idempotencyKey: string }) {
  const { error } = await supabase.rpc("record_inbox_act", {
    _dispatch_id: i.dispatchId, _act_type: i.actType, _text_body: i.textBody ?? "",
    _task_id: (i.taskId ?? null) as string, _idempotency_key: i.idempotencyKey,
  });
  return error ? { ok: false as const, reason: explainInboxError(error.message) } : { ok: true as const };
}
