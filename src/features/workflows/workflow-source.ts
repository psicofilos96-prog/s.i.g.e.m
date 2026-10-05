import { supabase } from "@/integrations/supabase/client";
import { currentEvent, dueOf, isTerminal, type Pending, type WorkflowDefinition, type WorkflowEvent } from "./workflow-model";

type Def = { id: string; workflow_key: string; title: string; definition: WorkflowDefinition };

/** Lê só o que a RLS libera; capability por transição é perguntada ao banco (nunca inferida por cargo). */
export async function loadPendings(userId: string): Promise<{ items: Pending[]; events: Map<string, WorkflowEvent[]>; defs: Map<string, Def> } | null> {
  const [d, i, e] = await Promise.all([
    supabase.from("workflow_definitions").select("id, workflow_key, title, definition"),
    supabase.from("workflow_instances").select("*"),
    supabase.from("workflow_events").select("*").order("seq"),
  ]);
  if (d.error || i.error || e.error) return null;
  const defs = new Map((d.data ?? []).map((x) => [x.id, x as unknown as Def]));
  const events = new Map<string, WorkflowEvent[]>();
  for (const x of e.data ?? []) events.set(x.instance_id, [...(events.get(x.instance_id) ?? []), {
    id: x.id, seq: x.seq, transitionId: x.transition_id, fromState: x.from_state, toState: x.to_state, comment: x.comment,
    attachmentRef: x.attachment_ref, dueOn: x.due_on, actor: x.actor, recordedAt: x.recorded_at }]);
  const capCache = new Map<string, boolean>();
  const has = async (cap: string, school: string | null) => {
    const k = `${cap}|${school}`; if (capCache.has(k)) return capCache.get(k)!;
    const r = await supabase.rpc("workflow_has_capability", { _cap: cap, _school: school as string });
    const v = !r.error && r.data === true; capCache.set(k, v); return v;
  };
  const items: Pending[] = [];
  for (const inst of i.data ?? []) {
    const def = defs.get(inst.definition_id); const evs = events.get(inst.id) ?? []; const head = currentEvent(evs);
    if (!def || !head) continue; // cadeia quebrada nunca é exibida como estado
    const outs = def.definition.transitions.filter((t) => t.from === head.toState);
    let canAct = false; for (const t of outs) if (await has(t.capability, inst.school_id)) { canAct = true; break; }
    items.push({ instanceId: inst.id, workflowKey: def.workflow_key, title: def.title, schoolId: inst.school_id, subjectRef: inst.subject_ref,
      state: head.toState, seq: head.seq, dueOn: dueOf(evs), openedBy: inst.opened_by, mine: inst.opened_by === userId, canAct,
      terminal: isTerminal(def.definition, head.toState) });
  }
  return { items, events, defs };
}

export async function capabilitiesFor(def: WorkflowDefinition, school: string | null): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of new Set(def.transitions.map((t) => t.capability))) {
    const r = await supabase.rpc("workflow_has_capability", { _cap: c, _school: school as string });
    if (!r.error && r.data === true) out.add(c);
  }
  return out;
}

const MESSAGES: Record<string, string> = {
  "stale-seq": "Outra pessoa tramitou este processo. Recarregue.", "invalid-transition": "Esta ação não vale no estado atual.",
  "capability-missing": "Sua conta não pode executar esta ação neste escopo.", "comment-required": "Esta ação exige comentário.",
};
export async function transition(p: { instanceId: string; transitionId: string; expectedSeq: number; comment: string; dueOn: string | null }) {
  const r = await supabase.rpc("apply_workflow_transition", { _instance: p.instanceId, _transition: p.transitionId, _expected_seq: p.expectedSeq,
    _idempotency_key: crypto.randomUUID(), _comment: p.comment, _attachment_ref: null as unknown as string, _due_on: p.dueOn as string });
  if (r.error) { const k = Object.keys(MESSAGES).find((m) => r.error!.message.includes(m)); throw new Error(k ? MESSAGES[k] : "Não foi possível tramitar."); }
  return r.data;
}
